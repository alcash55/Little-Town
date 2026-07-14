import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

const ONBOARDING_BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/onboarding`;

/**
 * After this many consecutive claim-service failures (network error, or an
 * HTTP status this step doesn't have a specific mapping for — anything
 * that isn't the frozen contract's 200/422 RSN_NOT_FOUND/409 RSN_TAKEN,
 * TEAM-BRIEF.md Sprint 11 Track B #3) for the same typed RSN, stop making
 * the user retry forever and offer to continue unverified. A backend outage
 * (or, pre-merge, Track A's endpoint not existing yet) isn't something the
 * user can fix, and blocking onboarding on it is worse than letting them
 * through untracked (same soft-pass contract Sprint 10 shipped for the old
 * hiscores-only check).
 */
export const SOFT_PASS_AFTER_FAILURES = 2;

export type RsnValidationStatus =
  | 'idle'
  | 'validating'
  | 'valid'
  | 'invalid'
  | 'taken'
  | 'down'
  | 'soft-passed';

export interface AccountIdentity {
  username?: string | null;
  nickname?: string | null;
}

const normalizeForComparison = (value: string) => value.trim().toLowerCase();

/**
 * Strips any roster-sourced RSN suggestion that matches the signed-in
 * user's own username/nickname (case-insensitive, whitespace-trimmed)
 * before it ever reaches the Autocomplete's `options`.
 *
 * Root cause (TEAM-BRIEF.md Sprint 11 Track B #1): nothing upstream
 * guarantees a `bingo_players.rsn` row surfaced by `my-team-data` isn't
 * text an admin happened to type into Team Drafter's free-text RSN field
 * that collides with a user's account name (e.g. testing shorthand, or a
 * copy/paste mistake) — there is no user<->player link in the schema today
 * (Track A's own investigation confirms this). RsnStep used to trust every
 * roster entry as a legitimate "this is you" suggestion with no check
 * against the viewer's own account fields, which is what let a username or
 * nickname surface as if it were a confirmed RSN. This filter is
 * defense-in-depth at the last mile: whatever the roster contains,
 * account-derived text never reaches the picker.
 */
export function filterAccountDerivedRsns(
  candidates: readonly string[],
  account: AccountIdentity | null | undefined,
): string[] {
  const blocked = new Set(
    [account?.username, account?.nickname]
      .filter((value): value is string => !!value && value.trim().length > 0)
      .map(normalizeForComparison),
  );
  if (blocked.size === 0) return [...candidates];
  return candidates.filter((candidate) => !blocked.has(normalizeForComparison(candidate)));
}

/**
 * Maps a `POST /api/onboarding/rsn` response onto the step's status enum,
 * per the frozen contract (TEAM-BRIEF.md "Frozen contract" section):
 *   - 200                              -> 'valid' (claimed + tracked)
 *   - 422 { code: 'RSN_NOT_FOUND' }    -> 'invalid'
 *   - 409 { code: 'RSN_TAKEN' }        -> 'taken'
 *   - anything else (network error,
 *     unmapped status/code, service
 *     down, or Track A not merged yet) -> 'down'
 * Pure and synchronous so it's unit-testable without mocking `fetch`.
 */
export function classifyClaimStatus(
  httpStatus: number,
  code?: string,
): 'valid' | 'invalid' | 'taken' | 'down' {
  if (httpStatus === 200) return 'valid';
  if (httpStatus === 422 && code === 'RSN_NOT_FOUND') return 'invalid';
  if (httpStatus === 409 && code === 'RSN_TAKEN') return 'taken';
  return 'down';
}

type ClaimSuccessJson = {
  rsn?: string;
  tracked?: boolean;
  alreadyTracked?: boolean;
};

type ClaimErrorJson = {
  error?: string;
  code?: string;
};

export type RsnConfirmation = {
  /** The RSN the user typed/picked and committed (via Autocomplete onChange). */
  selected: string | null;
  status: RsnValidationStatus;
  /** Consecutive claim-service-error count for the current `selected` RSN — drives the soft-pass offer. */
  failures: number;
  /** True once the claim endpoint has confirmed `selected` was already tracked before this call (informational only). */
  alreadyTracked: boolean;
  /** Whichever reason makes Next safe to enable for this step: an actual claimed RSN, or an explicit soft-pass. */
  confirmed: boolean;
  commit: (value: string | null) => void;
  retry: () => void;
  softPass: () => void;
};

/**
 * Owns the "Confirm your RuneScape name" step's claim state, lifted out of
 * RsnStep so it survives Back/Next remounts of the step component (the
 * Wizard only renders the active step) instead of losing the user's typed
 * name — and so it doubles as the single source of truth OnboardingWizard
 * reads to gate the Next button.
 *
 * Every `commit` (Autocomplete select/Enter/blur — same trigger Sprint 10
 * used for its client-side hiscores probe) now calls the real
 * `POST /api/onboarding/rsn` claim endpoint directly: per the frozen
 * contract a 200 both validates AND registers the RSN in the Team Drafter
 * pool in one call, so "confirmed" here means "actually claimed", not just
 * "looked real". Re-committing the same already-claimed value is
 * server-side idempotent (contract: "re-claiming your own RSN is idempotent
 * 200"), so retrying/re-typing the same name is safe to repeat.
 */
export const useRsnConfirmation = (): RsnConfirmation => {
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<RsnValidationStatus>('idle');
  const [failures, setFailures] = useState(0);
  const [alreadyTracked, setAlreadyTracked] = useState(false);
  // Guards a slow/late claim response landing after the user has since
  // committed a different name, and against setting state after unmount
  // (dialog closed mid-request).
  const requestIdRef = useRef(0);
  // Re-armed on every effect setup (not just initialized once via useRef) —
  // StrictMode's dev-only mount/cleanup/remount cycle runs this cleanup once
  // before the "real" mount settles, and if the setup body didn't also flip
  // it back to true, the ref would be permanently stuck `false` after that
  // cycle even though the component is very much mounted, silently
  // discarding every claim response for the rest of the step's life.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runClaim = useCallback(async (rsn: string) => {
    const thisRequest = ++requestIdRef.current;
    setStatus('validating');
    try {
      const res = await fetchWithAuth(`${ONBOARDING_BASE_URL}/rsn`, {
        method: 'POST',
        body: JSON.stringify({ rsn }),
      });
      if (!mountedRef.current || requestIdRef.current !== thisRequest) return;

      const json: ClaimSuccessJson & ClaimErrorJson = await res
        .json()
        .catch(() => ({}) as ClaimSuccessJson & ClaimErrorJson);
      const outcome = classifyClaimStatus(res.status, json.code);

      if (outcome === 'down') {
        setFailures((f) => f + 1);
        setStatus('down');
        return;
      }

      setFailures(0);
      setAlreadyTracked(outcome === 'valid' ? !!json.alreadyTracked : false);
      if (outcome === 'valid' && json.rsn) {
        // Reflect the server's canonical form (e.g. hiscores-correct
        // capitalization) back into the field rather than leaving whatever
        // casing the user typed.
        setSelected(json.rsn);
      }
      setStatus(outcome);
    } catch {
      if (!mountedRef.current || requestIdRef.current !== thisRequest) return;
      setFailures((f) => f + 1);
      setStatus('down');
    }
  }, []);

  const commit = useCallback(
    (value: string | null) => {
      const trimmed = value?.trim() || null;
      setSelected(trimmed);
      setFailures(0);
      setAlreadyTracked(false);
      if (!trimmed) {
        requestIdRef.current += 1; // invalidate any in-flight claim for the previous value
        setStatus('idle');
        return;
      }
      void runClaim(trimmed);
    },
    [runClaim],
  );

  const retry = useCallback(() => {
    if (selected) void runClaim(selected);
  }, [selected, runClaim]);

  const softPass = useCallback(() => setStatus('soft-passed'), []);

  return {
    selected,
    status,
    failures,
    alreadyTracked,
    confirmed: status === 'valid' || status === 'soft-passed',
    commit,
    retry,
    softPass,
  };
};
