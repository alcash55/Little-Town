/**
 * Invite links (TEAM-BRIEF.md Sprint 6, Track A item 1) — src/db/invites.ts
 * against the real local Supabase stack (invites table + accept_invite RPC,
 * 20260713000000_invites.sql).
 */
import { describe, test, expect, afterAll } from "bun:test";

import { getDb } from "../../src/db/client.js";
import {
  createInvite,
  listInvites,
  revokeInvite,
  validateInviteToken,
  acceptInvite,
} from "../../src/db/invites.js";
import { getLocalStackConfig, uniqueSuffix } from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[invites.test.ts] skipping: ${stack.reason}`);
}

async function invitesTableExists(): Promise<boolean> {
  const { error } = await getDb().from("invites").select("id").limit(0);
  if (!error) return true;
  return (error as { code?: string }).code !== "42P01";
}

const migrationApplied = stack.reachable ? await invitesTableExists() : false;
if (stack.reachable && !migrationApplied) {
  console.warn(
    "[invites.test.ts] skipping: invites table not found (20260713000000_invites.sql not yet applied)",
  );
}

const suite = stack.reachable && migrationApplied;

function tokenFromUrl(url: string): string {
  const match = url.match(/\/invite\/([a-f0-9]+)$/);
  if (!match) throw new Error(`Could not extract token from invite url: ${url}`);
  return match[1];
}

const createdInviteIds: string[] = [];
const createdUserIds: string[] = [];

describe.skipIf(!suite)("invites (create / validate / expire / revoke / single-use)", () => {
  test("createInvite returns a usable url with the raw token embedded, hashes it at rest", async () => {
    const invite = await createInvite({ role: "user" });
    createdInviteIds.push(invite.id);

    expect(invite.role).toBe("user");
    expect(invite.url).toMatch(/^https?:\/\/.+\/invite\/[a-f0-9]{64}$/);

    const row = await getDb().from("invites").select("token_hash").eq("id", invite.id).single();
    const token = tokenFromUrl(invite.url);
    expect(row.data!.token_hash).not.toBe(token); // never stored in plaintext
    expect(row.data!.token_hash).toHaveLength(64); // sha256 hex
  });

  test("default expiry is ~72h out", async () => {
    const before = Date.now();
    const invite = await createInvite({});
    createdInviteIds.push(invite.id);
    const expiresInHours = (new Date(invite.expiresAt).getTime() - before) / (60 * 60 * 1000);
    expect(expiresInHours).toBeGreaterThan(71.9);
    expect(expiresInHours).toBeLessThan(72.1);
  });

  test("a fresh invite validates as valid with its granted role", async () => {
    const invite = await createInvite({ role: "moderator" });
    createdInviteIds.push(invite.id);
    const token = tokenFromUrl(invite.url);

    const result = await validateInviteToken(token);
    expect(result).toEqual({ valid: true, role: "moderator" });
  });

  test("an unknown token is invalid with reason 'unknown'", async () => {
    const result = await validateInviteToken("f".repeat(64));
    expect(result).toEqual({ valid: false, reason: "unknown" });
  });

  test("listInvites never returns a usable url, even for an invite just created", async () => {
    const invite = await createInvite({});
    createdInviteIds.push(invite.id);

    const invites = await listInvites();
    const listed = invites.find((i) => i.id === invite.id);
    expect(listed).toBeDefined();
    expect(listed!.url).toBeNull();
    expect(listed!.usedAt).toBeNull();
    expect(listed!.revokedAt).toBeNull();
  });

  test("revoke: an active invite becomes invalid with reason 'revoked'", async () => {
    const invite = await createInvite({});
    createdInviteIds.push(invite.id);
    const token = tokenFromUrl(invite.url);

    await revokeInvite(invite.id);

    const result = await validateInviteToken(token);
    expect(result).toEqual({ valid: false, reason: "revoked" });
  });

  test("revoking an already-revoked invite throws a 409 AppError, not a silent no-op", async () => {
    const invite = await createInvite({});
    createdInviteIds.push(invite.id);
    await revokeInvite(invite.id);

    await expect(revokeInvite(invite.id)).rejects.toMatchObject({ statusCode: 409 });
  });

  test("revoking a nonexistent invite id throws a 404 AppError", async () => {
    await expect(revokeInvite("00000000-1111-2222-3333-444444444444")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test("an expired invite is invalid with reason 'expired'", async () => {
    const invite = await createInvite({ expiresInHours: 1 });
    createdInviteIds.push(invite.id);
    const token = tokenFromUrl(invite.url);

    // Backdate directly — createInvite only accepts a future expiry.
    await getDb()
      .from("invites")
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", invite.id);

    const result = await validateInviteToken(token);
    expect(result).toEqual({ valid: false, reason: "expired" });
  });

  test("accept: creates a user under the invite's role, single-use enforced end to end", async () => {
    const invite = await createInvite({ role: "moderator" });
    createdInviteIds.push(invite.id);
    const token = tokenFromUrl(invite.url);
    const username = `AcceptedUser${uniqueSuffix()}`;

    const user = await acceptInvite(token, { username, password: "correct horse battery" });
    createdUserIds.push(user.id);

    expect(user.username).toBe(username);
    expect(user.role).toBe("moderator");

    // The invite is now 'used' — GET /api/invites/:token reflects it...
    const afterAccept = await validateInviteToken(token);
    expect(afterAccept).toEqual({ valid: false, reason: "used" });

    // ...and a second accept attempt is rejected, not double-processed.
    await expect(
      acceptInvite(token, { username: `Second${uniqueSuffix()}`, password: "another password" }),
    ).rejects.toMatchObject({ statusCode: 410 });

    // Confirm the invite row itself recorded who used it.
    const row = await getDb().from("invites").select("used_by, used_at").eq("id", invite.id).single();
    expect(row.data!.used_by).toBe(user.id);
    expect(row.data!.used_at).not.toBeNull();
  });

  test("accepting an unknown token is a 404", async () => {
    await expect(
      acceptInvite("a".repeat(64), { username: `Nope${uniqueSuffix()}`, password: "password123" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test("accepting with a username that's already taken surfaces a 400 duplicate-key error", async () => {
    const invite = await createInvite({});
    createdInviteIds.push(invite.id);
    const token = tokenFromUrl(invite.url);

    const existingUsername = `DupeUser${uniqueSuffix()}`;
    const { data: existing, error } = await getDb()
      .from("users")
      .insert({ username: existingUsername, password_hash: "x", role: "user" })
      .select("id")
      .single();
    if (error || !existing) throw new Error(`Fixture setup failed: ${error?.message}`);
    createdUserIds.push((existing as { id: string }).id);

    let caught: unknown;
    try {
      await acceptInvite(token, { username: existingUsername, password: "password123" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect((caught as { code?: string }).code).toBe("23505");
  });
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all([
    ...createdInviteIds.map((id) => getDb().from("invites").delete().eq("id", id).then(() => undefined, () => undefined)),
    ...createdUserIds.map((id) => getDb().from("users").delete().eq("id", id).then(() => undefined, () => undefined)),
  ]);
});
