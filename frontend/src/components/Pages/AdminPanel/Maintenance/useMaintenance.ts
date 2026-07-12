import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';

const BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/admin`;

export type MaintenanceJobId =
  | 'static-data-refresh'
  | 'player-snapshot-refresh'
  | 'retake-start-snapshots';

/**
 * One background job the admin can manually re-run.
 *
 * `path` is appended to BASE_URL. A `:bingoId` segment in `path` is
 * substituted with the active bingo's id at run time (see `requiresActiveBingo`
 * below) — mirrors how BingoOverview/BingoDetails resolve "the current bingo"
 * via GET /api/admin/bingo/details.
 */
export type MaintenanceJob = {
  id: MaintenanceJobId;
  name: string;
  description: string;
  path: string;
  /** When true, `path`'s `:bingoId` segment is filled from the active bingo
   * before the request fires; the job is blocked with a clear message if
   * there isn't one. */
  requiresActiveBingo?: boolean;
};

export const MAINTENANCE_JOBS: readonly MaintenanceJob[] = [
  {
    id: 'static-data-refresh',
    name: 'Static Data Refresh',
    description:
      'Refreshes the cached OSRS skills and activities reference data used across the app. Runs in the background — the response confirms it started, not that it finished.',
    path: '/static-data/refresh',
  },
  {
    id: 'player-snapshot-refresh',
    name: 'Player Snapshot Refresh',
    description:
      "Pulls fresh OSRS hiscores data for every tracked player and stores a new snapshot. Calls the live hiscores API once per player, so it can take a moment.",
    path: '/bingo/players/refresh/snapshots',
  },
  {
    id: 'retake-start-snapshots',
    name: 'Retake Start Snapshots',
    description:
      'Retries start-of-bingo hiscore snapshots for any player on the active bingo who is missing one (e.g. after a forced activation with failures). Idempotent — players who already have a start snapshot are skipped.',
    path: '/bingo/:bingoId/retake-start-snapshots',
    requiresActiveBingo: true,
  },
];

export type MaintenanceJobResult = {
  status: 'success' | 'error';
  message: string;
  /** ISO timestamp of when the response was received. */
  at: string;
};

const initialRunning: Record<MaintenanceJobId, boolean> = {
  'static-data-refresh': false,
  'player-snapshot-refresh': false,
  'retake-start-snapshots': false,
};

/**
 * Drives the manual job-trigger cards on /AdminPanel/Maintenance.
 *
 * Each job is independent: running one doesn't block the others, and a
 * result (or error) from a previous run stays visible until dismissed or
 * the job is re-run.
 */
export const useMaintenance = () => {
  const [running, setRunning] = useState<Record<MaintenanceJobId, boolean>>(initialRunning);
  const [results, setResults] = useState<Partial<Record<MaintenanceJobId, MaintenanceJobResult>>>({});
  const [activeBingoId, setActiveBingoId] = useState<string | null>(null);
  const [activeBingoLoading, setActiveBingoLoading] = useState(true);

  // Resolved once on mount, the same way BingoDetails/BingoOverview find "the
  // current bingo" — this page has no other reason to fetch bingo state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuth(`${BASE_URL}/bingo/details`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setActiveBingoId(json.data?.id ?? null);
      } catch {
        /* non-fatal: the retake-snapshots job just stays disabled */
      } finally {
        if (!cancelled) setActiveBingoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runJob = useCallback(
    async (job: MaintenanceJob) => {
      if (job.requiresActiveBingo && !activeBingoId) {
        setResults((prev) => ({
          ...prev,
          [job.id]: {
            status: 'error',
            message: 'No active bingo found — this job needs one to run against.',
            at: new Date().toISOString(),
          },
        }));
        return;
      }

      setRunning((prev) => ({ ...prev, [job.id]: true }));

      try {
        const path = job.requiresActiveBingo
          ? job.path.replace(':bingoId', activeBingoId as string)
          : job.path;
        const res = await fetchWithAuth(`${BASE_URL}${path}`, { method: 'POST' });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          const message = typeof json.error === 'string' ? json.error : res.statusText;
          throw new Error(message);
        }

        setResults((prev) => ({
          ...prev,
          [job.id]: {
            status: 'success',
            message: typeof json.message === 'string' ? json.message : 'Job completed.',
            at: new Date().toISOString(),
          },
        }));
      } catch (e) {
        setResults((prev) => ({
          ...prev,
          [job.id]: {
            status: 'error',
            message: e instanceof Error ? e.message : `Failed to run ${job.name}.`,
            at: new Date().toISOString(),
          },
        }));
      } finally {
        setRunning((prev) => ({ ...prev, [job.id]: false }));
      }
    },
    [activeBingoId],
  );

  const dismissResult = useCallback((jobId: MaintenanceJobId) => {
    setResults((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
  }, []);

  return {
    jobs: MAINTENANCE_JOBS,
    running,
    results,
    runJob,
    dismissResult,
    activeBingoId,
    activeBingoLoading,
  };
};
