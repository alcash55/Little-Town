import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';
import { describeApiError } from '../../../../utils/apiError';

const BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/admin`;

export type LifecycleBingo = { id: string; name: string; status?: string };

export type PurgedCounts = {
  teams: number;
  tiles: number;
  players: number;
  submissions: number;
  storageObjects: number;
};

// `name` is snapshotted from the bingo at the moment it ended, not read live
// off the mirror when rendered — a later Delete/Clone in the same session
// advances (or nulls) that mirror, which must not retroactively blank out or
// change an already-shown End Early success message (bug caught in browser
// verification: chaining End -> Clone -> Delete left "Ended "" early." on
// screen once the mirror had moved on).
export type EndResult = { name: string; endedAt: string; pendingScreenshots: number };
export type CloneResult = { id: string; name: string; tilesCloned: number };

/**
 * Drives the End Early / Delete / Clone admin controls on BingoDetails
 * (TEAM-BRIEF.md Sprint 17, Track B1). All three hit the frozen
 * `/api/admin/bingo/...` contracts documented there verbatim.
 *
 * `source` is BingoDetails' own "current bingo" (active|draft, from
 * useBingoDetails/GET /api/admin/bingo/details). This hook mirrors it into
 * local state rather than reading it directly so the panel survives the
 * parent's post-action state:
 *  - After End Early, `/bingo/details` stops returning the (now complete)
 *    bingo on the next refetch — but Clone still needs its id as
 *    `sourceBingoId`, so the mirror is updated to `status: 'complete'`
 *    in place instead of being cleared.
 *  - After Delete, there is genuinely nothing left to mirror, so it's
 *    cleared explicitly and `onChanged` (BingoDetails' refetchBingo) is
 *    called to reset the create/edit form above it.
 *  - After Clone, `onChanged` is called so the page picks up the new draft
 *    it just created — the closest equivalent to "route the admin to the
 *    new draft" available without a per-bingo-id URL to navigate to.
 */
export const useBingoLifecycle = (source: LifecycleBingo | null, onChanged: () => void | Promise<void>) => {
  const [bingo, setBingo] = useState<LifecycleBingo | null>(source);

  useEffect(() => {
    if (source?.id) setBingo(source);
  }, [source?.id, source?.name, source?.status]);

  // --- End Early ---
  const [ending, setEnding] = useState(false);
  const [endResult, setEndResult] = useState<EndResult | null>(null);
  // 409 "Bingo is not active" — information, not a failure (frozen contract).
  const [endInfo, setEndInfo] = useState<string | null>(null);
  const [endError, setEndError] = useState<string | null>(null);

  // Returns whether the dialog that triggered this is safe to auto-close:
  // true for both a real success and the 409 "not active" info case (neither
  // needs the admin to retry anything), false only for a genuine failure
  // (network/5xx) — that stays open so the error is visible next to the
  // Confirm button instead of getting lost on the page below.
  const endEarly = useCallback(async (): Promise<boolean> => {
    if (!bingo?.id) return false;
    setEnding(true);
    setEndError(null);
    setEndInfo(null);
    setEndResult(null);
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/${bingo.id}/end`, { method: 'POST' });
      if (res.status === 409) {
        const info = await describeApiError(res, 'Bingo is not active');
        setEndInfo(info.message);
        return true;
      }
      if (!res.ok) {
        const info = await describeApiError(res, 'Failed to end bingo');
        throw new Error(info.message);
      }
      const json = await res.json();
      setEndResult({
        name: bingo.name,
        endedAt: json.data.endedAt,
        pendingScreenshots: json.data.pendingScreenshots,
      });
      setBingo((b) => (b ? { ...b, status: 'complete' } : b));
      return true;
    } catch (e) {
      setEndError(e instanceof Error ? e.message : 'Unable to reach the server. Please try again.');
      return false;
    } finally {
      setEnding(false);
    }
  }, [bingo?.id]);

  const dismissEndResult = useCallback(() => {
    setEndResult(null);
    setEndInfo(null);
    setEndError(null);
  }, []);

  // --- Delete ---
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<PurgedCounts | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteBingo = useCallback(
    async (confirmationText: string): Promise<boolean> => {
      if (!bingo?.id) return false;
      setDeleting(true);
      setDeleteError(null);
      try {
        const res = await fetchWithAuth(`${BASE_URL}/bingo/${bingo.id}`, {
          method: 'DELETE',
          // Both halves of the double-gate go on every delete request,
          // regardless of the bingo's status — the server only *enforces*
          // them for status='active', but requiring the same typed
          // confirmation client-side for every delete (not just active
          // ones) is deliberate: this is the only destructive endpoint in
          // the app and it should never be one accidental click.
          headers: { 'X-Confirm-Delete': confirmationText },
          body: JSON.stringify({ force: true }),
        });
        if (!res.ok) {
          const info = await describeApiError(res, 'Failed to delete bingo');
          throw new Error(info.message);
        }
        const json = await res.json();
        setDeleteResult(json.data.purged as PurgedCounts);
        setBingo(null);
        await onChanged();
        return true;
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : 'Unable to reach the server. Please try again.');
        return false;
      } finally {
        setDeleting(false);
      }
    },
    [bingo?.id, onChanged],
  );

  const dismissDeleteResult = useCallback(() => {
    setDeleteResult(null);
    setDeleteError(null);
  }, []);

  // --- Clone ---
  const [cloning, setCloning] = useState(false);
  const [cloneResult, setCloneResult] = useState<CloneResult | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);
  // 409 "an active bingo already exists" — the one clone-specific case the
  // brief calls out for a "here's what to do" message rather than a raw
  // error string.
  const [cloneConflict, setCloneConflict] = useState(false);

  const cloneBingo = useCallback(
    async (input: { name: string; startDate: string; endDate: string }): Promise<boolean> => {
      if (!bingo?.id) return false;
      setCloning(true);
      setCloneError(null);
      setCloneConflict(false);
      try {
        const res = await fetchWithAuth(`${BASE_URL}/bingo/clone`, {
          method: 'POST',
          body: JSON.stringify({ sourceBingoId: bingo.id, ...input }),
        });
        if (res.status === 409) {
          setCloneConflict(true);
          return true;
        }
        if (!res.ok) {
          const info = await describeApiError(res, 'Failed to clone bingo');
          throw new Error(info.message);
        }
        const json = await res.json();
        setCloneResult({ id: json.data.id, name: json.data.name, tilesCloned: json.data.tilesCloned });
        await onChanged();
        return true;
      } catch (e) {
        setCloneError(e instanceof Error ? e.message : 'Unable to reach the server. Please try again.');
        return false;
      } finally {
        setCloning(false);
      }
    },
    [bingo?.id, onChanged],
  );

  const dismissCloneResult = useCallback(() => {
    setCloneResult(null);
    setCloneError(null);
    setCloneConflict(false);
  }, []);

  return {
    bingo,
    // End Early
    ending,
    endResult,
    endInfo,
    endError,
    endEarly,
    dismissEndResult,
    // Delete
    deleting,
    deleteResult,
    deleteError,
    deleteBingo,
    dismissDeleteResult,
    // Clone
    cloning,
    cloneResult,
    cloneError,
    cloneConflict,
    cloneBingo,
    dismissCloneResult,
  };
};
