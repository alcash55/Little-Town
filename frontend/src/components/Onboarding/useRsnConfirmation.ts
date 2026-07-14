import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '../../utils/fetchWithAuth';
import { OnboardingProfile } from './useOnboardingProfile';

const HISCORES_BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/hiscores`;

/**
 * After this many consecutive hiscores-service failures (network error or a
 * non-404 error status — NOT a clean 404 "name not found", which is the
 * validation actually working) for the same typed RSN, stop making the user
 * retry forever and offer to continue unverified. A third-party outage
 * isn't something they can fix, and blocking onboarding on it is worse than
 * letting them through unverified (TEAM-BRIEF.md Track A #2 "hiscores API
 * down... decide whether to soft-pass after N failures and document").
 */
export const SOFT_PASS_AFTER_FAILURES = 2;

export type RsnValidationStatus =
  | 'idle'
  | 'validating'
  | 'valid'
  | 'invalid'
  | 'down'
  | 'soft-passed';

export type RsnConfirmation = {
  /** The RSN the user picked/typed and committed (via Autocomplete onChange). */
  selected: string | null;
  status: RsnValidationStatus;
  /** Consecutive service-error count for the current `selected` RSN — drives the soft-pass offer. */
  failures: number;
  /**
   * True once there's nothing left to confirm at all: no team roster to
   * pick from (team-less user) or the roster fetch itself failed. Next is
   * allowed through unconditionally in this case (documented in RsnStep).
   */
  cannotConfirm: boolean;
  /** Whichever reason makes Next safe to enable for this step. */
  confirmed: boolean;
  commit: (value: string | null) => void;
  retry: () => void;
  softPass: () => void;
};

/**
 * Owns the "Confirm your RuneScape name" step's validation state, lifted out
 * of RsnStep so it survives Back/Next remounts of the step component (the
 * Wizard only renders the active step) instead of losing the user's pick —
 * and so it double as the single source of truth OnboardingWizard reads to
 * gate the Next button.
 */
export const useRsnConfirmation = (profile: OnboardingProfile): RsnConfirmation => {
  const { loading, error, rsns, teamId } = profile;
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<RsnValidationStatus>('idle');
  const [failures, setFailures] = useState(0);
  // Guards a slow/late hiscores response landing after the user has since
  // picked a different name, and against setting state after unmount
  // (dialog closed mid-request).
  const requestIdRef = useRef(0);
  // Re-armed on every effect setup (not just initialized once via useRef) —
  // StrictMode's dev-only mount/cleanup/remount cycle runs this cleanup once
  // before the "real" mount settles, and if the setup body didn't also flip
  // it back to true, the ref would be permanently stuck `false` after that
  // cycle even though the component is very much mounted, silently
  // discarding every hiscores response for the rest of the step's life.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const rosterEmpty = !loading && !error && !teamId && rsns.length === 0;
  // The team-roster fetch itself failing leaves nothing to build the picker
  // from either — same "can't confirm something we can't show" logic as an
  // empty roster, so it gets the same pass-through rather than stranding
  // the user on a step they can never complete.
  const cannotConfirm = rosterEmpty || (!loading && !!error);

  const runValidation = useCallback(async (rsn: string) => {
    const thisRequest = ++requestIdRef.current;
    setStatus('validating');
    try {
      const res = await fetchWithAuth(`${HISCORES_BASE_URL}/${encodeURIComponent(rsn)}`);
      if (!mountedRef.current || requestIdRef.current !== thisRequest) return;
      if (res.status === 404) {
        setStatus('invalid');
        setFailures(0);
        return;
      }
      if (!res.ok) throw new Error(res.statusText);
      setStatus('valid');
      setFailures(0);
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
      if (!trimmed) {
        requestIdRef.current += 1; // invalidate any in-flight lookup for the previous value
        setStatus('idle');
        return;
      }
      void runValidation(trimmed);
    },
    [runValidation],
  );

  const retry = useCallback(() => {
    if (selected) void runValidation(selected);
  }, [selected, runValidation]);

  const softPass = useCallback(() => setStatus('soft-passed'), []);

  return {
    selected,
    status,
    failures,
    cannotConfirm,
    confirmed: cannotConfirm || status === 'valid' || status === 'soft-passed',
    commit,
    retry,
    softPass,
  };
};
