import crypto from "node:crypto";
import { getDb } from "./client.js";
import { AppError } from "../middleware/errorHandler.js";
import { hashPassword } from "./users.js";
import { User } from "../types/index.js";

// -------------------------------------------------------
// Types (contract: TEAM-BRIEF.md Track A item 1, frozen admin-facing shapes)
// -------------------------------------------------------

export type InviteRole = "user" | "admin" | "moderator";

interface InviteRow {
  id: string;
  role: InviteRole;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreatedInvite {
  id: string;
  url: string;
  role: InviteRole;
  expiresAt: string;
  createdAt: string;
}

export interface InviteListItem {
  id: string;
  url: string | null;
  role: InviteRole;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedBy: string | null;
  revokedAt: string | null;
}

export interface InviteValidation {
  valid: boolean;
  reason?: "expired" | "used" | "revoked" | "unknown";
  role?: InviteRole;
}

const DEFAULT_EXPIRY_HOURS = 72;
// Max expiry a caller can request — sanity bound, not a security control
// (revocation exists for that); prevents an accidental "expiresInHours:
// 999999" from minting an effectively-permanent link.
const MAX_EXPIRY_HOURS = 24 * 30;
const TOKEN_BYTES = 32; // 256-bit token -> 64 hex chars in the URL

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function inviteUrl(rawToken: string): string {
  // FRONTEND_URL is required in production (see index.ts's startup check);
  // this fallback only ever applies in local dev.
  const base = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/invite/${rawToken}`;
}

/**
 * Create a single-use invite. Only a SHA-256 hash of the token is persisted
 * (mirrors the users.password_hash convention) — the raw token exists only
 * in this function's return value, which is why `url` is only ever
 * returnable at creation time (see listInvites, which always returns
 * `url: null`).
 */
export async function createInvite(input: {
  role?: InviteRole;
  expiresInHours?: number;
  createdBy?: string;
}): Promise<CreatedInvite> {
  const role = input.role ?? "user";
  const hours = Math.min(input.expiresInHours ?? DEFAULT_EXPIRY_HOURS, MAX_EXPIRY_HOURS);
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = hashToken(rawToken);

  const { data, error } = await getDb()
    .from("invites")
    .insert({
      role,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(`Failed to create invite: ${error?.message}`);
  const row = data as InviteRow;

  return {
    id: row.id,
    url: inviteUrl(rawToken),
    role: row.role,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/**
 * List every invite. `url` is always null here — see createInvite's doc
 * comment; only the token hash is stored, so a usable link can't be
 * reconstructed after creation.
 */
export async function listInvites(): Promise<InviteListItem[]> {
  const { data, error } = await getDb()
    .from("invites")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list invites: ${error.message}`);

  return ((data ?? []) as InviteRow[]).map((row) => ({
    id: row.id,
    url: null,
    role: row.role,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    usedBy: row.used_by,
    revokedAt: row.revoked_at,
  }));
}

/**
 * Revoke an invite. A no-op guard (not an error) would hide a caller's
 * mistake, so this is explicit: 404 if the id doesn't exist at all, 409 if
 * it exists but is already used or already revoked.
 */
export async function revokeInvite(id: string): Promise<void> {
  const db = getDb();

  const { data: updated, error } = await db
    .from("invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null)
    .is("used_at", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Failed to revoke invite: ${error.message}`);
  if (updated) return;

  const { data: existing, error: lookupError } = await db
    .from("invites")
    .select("used_at, revoked_at")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new Error(`Failed to look up invite: ${lookupError.message}`);

  if (!existing) throw new AppError("Invite not found", 404, "NOT_FOUND");
  throw new AppError("Invite has already been used or revoked", 409, "INVITE_ALREADY_FINAL");
}

/**
 * Public lookup — GET /api/invites/:token. Never leaks whether a token
 * merely doesn't exist vs. exists-but-invalid beyond the frozen `reason`
 * enum; never returns the invite id or any other row detail.
 */
export async function validateInviteToken(rawToken: string): Promise<InviteValidation> {
  const tokenHash = hashToken(rawToken);
  const { data, error } = await getDb()
    .from("invites")
    .select("role, expires_at, used_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) throw new Error(`Failed to validate invite: ${error.message}`);
  if (!data) return { valid: false, reason: "unknown" };

  const row = data as Pick<InviteRow, "role" | "expires_at" | "used_at" | "revoked_at">;
  if (row.revoked_at) return { valid: false, reason: "revoked" };
  if (row.used_at) return { valid: false, reason: "used" };
  if (new Date(row.expires_at).getTime() < Date.now()) return { valid: false, reason: "expired" };

  return { valid: true, role: row.role };
}

/**
 * Accept an invite: create the account it grants and burn the invite, both
 * inside the single `accept_invite` Postgres transaction (see the migration
 * for the race-safety rationale — a `SELECT ... FOR UPDATE` on the invite
 * row is what actually enforces single-use, not this application code).
 * Password is hashed here (bcrypt, via db/users.ts) — the raw password is
 * never sent to Postgres.
 */
export async function acceptInvite(
  rawToken: string,
  input: { username: string; password: string; nickname?: string },
): Promise<User> {
  const tokenHash = hashToken(rawToken);
  const passwordHash = await hashPassword(input.password);

  const { data, error } = await getDb().rpc("accept_invite", {
    p_token_hash: tokenHash,
    p_username: input.username,
    p_password_hash: passwordHash,
    p_nickname: input.nickname ?? null,
  });

  if (error) {
    if (/invite not found/i.test(error.message)) {
      throw new AppError("Invite not found", 404, "INVITE_NOT_FOUND");
    }
    if (/invite has been revoked/i.test(error.message)) {
      throw new AppError("This invite has been revoked", 410, "INVITE_REVOKED");
    }
    if (/invite has already been used/i.test(error.message)) {
      throw new AppError("This invite has already been used", 410, "INVITE_USED");
    }
    if (/invite has expired/i.test(error.message)) {
      throw new AppError("This invite has expired", 410, "INVITE_EXPIRED");
    }
    // Anything else (e.g. a 23505 unique-violation on a duplicate username)
    // is thrown as-is, preserving `.code`, so errorHandler's Postgres-code
    // mapping (e.g. "username already exists") actually fires.
    throw error;
  }
  if (!data) throw new Error("accept_invite returned no user");

  const row = data as {
    id: string;
    username: string;
    nickname: string | null;
    email: string | null;
    role: InviteRole;
    created_at: string;
    updated_at: string;
  };

  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname ?? null,
    email: row.email ?? undefined,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
