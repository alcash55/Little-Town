import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';

const BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/admin/invites`;

/**
 * Frozen contract (TEAM-BRIEF.md, Track A #1):
 *   POST   /api/admin/invites      { role?, expiresInHours? } -> { id, url, role, expiresAt, createdAt }
 *   GET    /api/admin/invites      -> { invites: [{ id, url, role, createdAt, expiresAt, usedAt, usedBy, revokedAt }] }
 *   DELETE /api/admin/invites/:id  -> revoke
 *
 * The brief leaves it to the backend whether `url` is reconstructable on GET
 * (returned every time) or only available at creation (null afterward). This
 * hook and UI handle both: `url` is typed `string | null` everywhere, and the
 * "just created" invite (which always has the url from the POST response) is
 * what the copy affordance relies on if GET later nulls it out.
 */

export type InviteRole = 'user' | 'moderator' | 'admin';

export const INVITE_ROLES: InviteRole[] = ['user', 'moderator', 'admin'];

export type ExpiryPreset = { label: string; hours: number };

export const EXPIRY_PRESETS: ExpiryPreset[] = [
  { label: '24 hours', hours: 24 },
  { label: '48 hours', hours: 48 },
  { label: '72 hours (default)', hours: 72 },
  { label: '7 days', hours: 168 },
  { label: '30 days', hours: 720 },
];

export type Invite = {
  id: string;
  url: string | null;
  role: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedBy: string | null;
  revokedAt: string | null;
};

export type InviteStatus = 'active' | 'used' | 'expired' | 'revoked';

export const getInviteStatus = (invite: Invite, now: Date = new Date()): InviteStatus => {
  if (invite.revokedAt) return 'revoked';
  if (invite.usedAt) return 'used';
  if (new Date(invite.expiresAt).getTime() <= now.getTime()) return 'expired';
  return 'active';
};

type CreateInviteJson = {
  id?: string;
  url?: string;
  role?: string;
  expiresAt?: string;
  createdAt?: string;
  error?: string;
};

type ListInvitesJson = {
  invites?: Invite[];
  error?: string;
};

/**
 * Drives /AdminPanel/UserInvite: list + generate + revoke against the admin
 * invites contract above. Mirrors the loading/error/dismiss shape used by
 * useMaintenance.ts and useTeamData.ts elsewhere in AdminPanel.
 */
export const useUserInvite = () => {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<Invite | null>(null);

  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(BASE_URL);
      const json: ListInvitesJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? res.statusText);
      }
      setInvites(Array.isArray(json.invites) ? json.invites : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invites.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const generateInvite = useCallback(async (role: InviteRole, expiresInHours: number) => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetchWithAuth(BASE_URL, {
        method: 'POST',
        body: JSON.stringify({ role, expiresInHours }),
      });
      const json: CreateInviteJson = await res.json().catch(() => ({}));
      if (!res.ok || !json.id || !json.url || !json.expiresAt || !json.createdAt) {
        throw new Error(json.error ?? res.statusText ?? 'Unexpected response.');
      }
      const created: Invite = {
        id: json.id,
        url: json.url,
        role: json.role ?? role,
        createdAt: json.createdAt,
        expiresAt: json.expiresAt,
        usedAt: null,
        usedBy: null,
        revokedAt: null,
      };
      setJustCreated(created);
      // Prepend rather than refetch: GET may null out `url` per the brief's
      // documented per-backend choice, so this freshly created row (straight
      // from the POST response) is the one guaranteed place the link shows.
      setInvites((prev) => [created, ...prev]);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Failed to generate invite.');
    } finally {
      setGenerating(false);
    }
  }, []);

  const revokeInvite = useCallback(async (id: string) => {
    setRevokingId(id);
    setRevokeError(null);
    try {
      const res = await fetchWithAuth(`${BASE_URL}/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(json.error ?? res.statusText);
      }
      setInvites((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, revokedAt: new Date().toISOString() } : inv)),
      );
    } catch (e) {
      setRevokeError(e instanceof Error ? e.message : 'Failed to revoke invite.');
    } finally {
      setRevokingId(null);
    }
  }, []);

  const dismissJustCreated = useCallback(() => setJustCreated(null), []);
  const dismissGenerateError = useCallback(() => setGenerateError(null), []);
  const dismissRevokeError = useCallback(() => setRevokeError(null), []);

  return {
    invites,
    loading,
    error,
    generating,
    generateError,
    justCreated,
    generateInvite,
    dismissJustCreated,
    dismissGenerateError,
    revokeInvite,
    revokingId,
    revokeError,
    dismissRevokeError,
    refresh: fetchInvites,
  };
};
