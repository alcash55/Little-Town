import { useCallback, useState } from 'react';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';

const BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/admin`;

export type MaintenanceJobId = 'static-data-refresh' | 'player-snapshot-refresh';

/**
 * One background job the admin can manually re-run.
 *
 * `path` is appended to BASE_URL. Both jobs below are verified to exist in
 * backend/src/routes/admin.ts (see admin.ts:646-679) — no additive backend
 * route was needed for this ticket.
 */
export type MaintenanceJob = {
  id: MaintenanceJobId;
  name: string;
  description: string;
  path: string;
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

  const runJob = useCallback(async (job: MaintenanceJob) => {
    setRunning((prev) => ({ ...prev, [job.id]: true }));

    try {
      const res = await fetchWithAuth(`${BASE_URL}${job.path}`, { method: 'POST' });
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
  }, []);

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
  };
};
