import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLoginModal, User } from '../../LoginModal/useLoginModal';

const BASE_URL = import.meta.env.VITE_BASEURL || 'http://localhost:8081';

export type InviteRole = 'user' | 'admin' | 'moderator';
export type InvalidReason = 'expired' | 'used' | 'revoked' | 'unknown';

/**
 * Public onboarding contract — GET/POST /api/invites/:token[/accept]. Frozen
 * shape per the tech lead's brief (see backend/src/routes/invites.ts):
 *
 *   GET  /api/invites/:token          -> { valid, reason?, role? }
 *   POST /api/invites/:token/accept   { username, password, nickname? }
 *                                      -> 201 { success: true, data: { user, token, expiresAt } }
 *                                      -> 404/410 { error, code } for a token that's gone bad
 *                                      -> 400 { error, code? } for a rejected username/password
 */
type ValidateJson = {
  valid?: boolean;
  reason?: InvalidReason;
  role?: InviteRole;
};

type AcceptSuccessJson = {
  success: true;
  data: { user: User; token: string; expiresAt: string };
};

type AcceptErrorJson = {
  success?: false;
  error?: string;
  code?: string;
};

/** Maps the accept endpoint's error codes for a now-dead token back onto the same reason enum GET returns. */
const RACE_CODE_TO_REASON: Record<string, InvalidReason> = {
  INVITE_REVOKED: 'revoked',
  INVITE_USED: 'used',
  INVITE_EXPIRED: 'expired',
  INVITE_NOT_FOUND: 'unknown',
};

export type CheckState = 'checking' | 'valid' | 'invalid' | 'checkFailed';

/**
 * Drives /invite/:token: validates the token on load, then submits the
 * accept form. A 404/410 from the accept call (the token went bad between
 * load and submit — used, revoked, or expired by someone else in the
 * meantime) re-renders the same invalid-state UI the initial GET would have
 * shown, rather than a generic form error.
 */
export const useInviteAccept = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { completeSession } = useLoginModal();

  const [checkState, setCheckState] = useState<CheckState>('checking');
  const [reason, setReason] = useState<InvalidReason | null>(null);
  const [role, setRole] = useState<InviteRole | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const checkToken = useCallback(async () => {
    if (!token) {
      setCheckState('invalid');
      setReason('unknown');
      return;
    }

    setCheckState('checking');
    try {
      const res = await fetch(`${BASE_URL}/api/invites/${encodeURIComponent(token)}`);
      const json: ValidateJson = await res.json().catch(() => ({}) as ValidateJson);
      if (!res.ok) throw new Error('Invite lookup failed');

      if (json.valid) {
        setRole(json.role ?? null);
        setCheckState('valid');
      } else {
        setReason(json.reason ?? 'unknown');
        setCheckState('invalid');
      }
    } catch {
      setCheckState('checkFailed');
    }
  }, [token]);

  useEffect(() => {
    checkToken();
  }, [checkToken]);

  const submit = useCallback(
    async (username: string, password: string, nickname: string) => {
      if (!token) return;

      setFormError(null);
      setSubmitting(true);
      try {
        const res = await fetch(`${BASE_URL}/api/invites/${encodeURIComponent(token)}/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password,
            ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
          }),
        });
        const json: AcceptSuccessJson | AcceptErrorJson = await res
          .json()
          .catch(() => ({}) as AcceptErrorJson);

        if (res.ok && 'data' in json && json.data) {
          completeSession({ user: json.data.user, token: json.data.token });
          // Land straight in the app rather than showing our own "you're in"
          // screen — OnboardingProvider (see components/Onboarding) already
          // auto-opens its welcome wizard for a user's first authenticated
          // visit, which this now is. Staying on /invite/:token to show a
          // second, separate confirmation would double up with (and visually
          // collide behind) that wizard as soon as `user` updates.
          navigate('/');
          return;
        }

        const errJson = json as AcceptErrorJson;
        const raceReason = errJson.code ? RACE_CODE_TO_REASON[errJson.code] : undefined;
        if (raceReason) {
          // The token died between this page loading and the form being submitted
          // (someone else used it, an admin revoked it, or it expired mid-fill).
          setCheckState('invalid');
          setReason(raceReason);
          return;
        }

        setFormError(errJson.error ?? 'Something went wrong. Please try again.');
      } catch {
        setFormError('Network error — please check your connection and try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [token, completeSession],
  );

  return {
    checkState,
    reason,
    role,
    submitting,
    formError,
    submit,
    retryCheck: checkToken,
  };
};
