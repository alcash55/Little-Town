import {
  createContext,
  lazy,
  PropsWithChildren,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLoginModal } from '../LoginModal/useLoginModal';
import type { OnboardingStatus } from './OnboardingWizard';

// Lazy: only ever mounted for a signed-in user on their first visit (or via
// "Show intro"), so its weight (Stepper + 4 step components) shouldn't be
// part of the app shell chunk every visitor — including anonymous ones —
// downloads on first paint.
const OnboardingWizard = lazy(() => import('./OnboardingWizard'));

const STORAGE_PREFIX = 'onboarding:v1:';

type OnboardingRecord = {
  status: OnboardingStatus;
  at: string;
};

type OnboardingContextValue = {
  open: boolean;
  /** Re-opens the wizard on demand — the "Show intro" affordance. */
  showIntro: () => void;
  /** Only meaningful for a signed-in user (the wizard is keyed by user id) — gates whether "Show intro" renders. */
  canShowIntro: boolean;
  /**
   * False on a first-time (auto-opened) run — the wizard must be completed
   * once and isn't Escape/backdrop-dismissable there. True when reopened
   * via "Show intro", which stays freely dismissable (TEAM-BRIEF.md Track
   * A #1).
   */
  dismissable: boolean;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

const readRecord = (key: string): OnboardingRecord | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'status' in parsed &&
      ((parsed as { status: unknown }).status === 'completed' ||
        (parsed as { status: unknown }).status === 'skipped')
    ) {
      return parsed as OnboardingRecord;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * First-time onboarding wizard (TEAM-BRIEF.md Track B #2 — assumed scope,
 * Alex hasn't specced details). Auto-opens once per signed-in user id on
 * their first authenticated visit, persists completion/skip to localStorage
 * so it never reappears on its own, and stays reachable via `showIntro()`
 * (wired to a "Show intro" button in the sidebar footer).
 */
export const OnboardingProvider = ({ children }: PropsWithChildren<{}>) => {
  const { user, authReady } = useLoginModal();
  const [open, setOpen] = useState(false);
  // Tracks why the wizard is currently open, so the Dialog knows whether
  // it's allowed to be Escape/backdrop-dismissed. null once closed.
  const [openReason, setOpenReason] = useState<'auto' | 'manual' | null>(null);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);

  const storageKey = user ? `${STORAGE_PREFIX}${user.id}` : null;

  // Auto-open on first authenticated visit — once per signed-in user id, so
  // switching accounts in the same browser session re-evaluates instead of
  // staying stuck on whichever user triggered the check first. A user who
  // has already completed/skipped the wizard (any existing record) never
  // sees it auto-reopen — their persisted state is never reset.
  useEffect(() => {
    if (!authReady || !user || !storageKey) return;
    if (checkedUserId === user.id) return;
    setCheckedUserId(user.id);
    const record = readRecord(storageKey);
    if (!record) {
      setOpen(true);
      setOpenReason('auto');
    }
  }, [authReady, user, storageKey, checkedUserId]);

  // Logging out closes the wizard — there's no user to key its persistence on.
  useEffect(() => {
    if (!user) {
      setOpen(false);
      setOpenReason(null);
    }
  }, [user]);

  const finish = useCallback(
    (status: OnboardingStatus) => {
      if (storageKey) {
        const record: OnboardingRecord = { status, at: new Date().toISOString() };
        localStorage.setItem(storageKey, JSON.stringify(record));
      }
      setOpen(false);
      setOpenReason(null);
    },
    [storageKey],
  );

  const showIntro = useCallback(() => {
    setOpen(true);
    setOpenReason('manual');
  }, []);

  const value = useMemo<OnboardingContextValue>(
    () => ({ open, showIntro, canShowIntro: !!user, dismissable: openReason === 'manual' }),
    [open, showIntro, user, openReason],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {open && (
        // fallback={null}: the wizard is a Dialog, not a page — there's
        // nothing sensible to render as a "skeleton" for a dialog that
        // hasn't opened yet, and the chunk is small enough that the delay
        // is imperceptible.
        <Suspense fallback={null}>
          <OnboardingWizard open={open} dismissable={value.dismissable} onFinish={finish} />
        </Suspense>
      )}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return ctx;
};
