import { getDb } from "./client.js";
import { AppError } from "../middleware/errorHandler.js";

// -------------------------------------------------------
// rsn_claims — which `users` row owns which OSRS account, independent of
// any single bingo cycle's player pool. See the header comment on
// supabase/migrations/20260715000000_rsn_claims.sql for the full design
// rationale (why this isn't a FK to bingo_players, why rsn_normalized is
// the real key, why user_id is UNIQUE).
// -------------------------------------------------------

export interface RsnClaimRow {
  id: string;
  user_id: string;
  rsn: string;
  rsn_normalized: string;
  claimed_at: string;
}

/** The current claimant of an RSN (by its normalized/lowercased form), if any. */
export async function findRsnClaim(rsnNormalized: string): Promise<RsnClaimRow | null> {
  const db = getDb();
  const { data, error } = await db
    .from("rsn_claims")
    .select("*")
    .eq("rsn_normalized", rsnNormalized)
    .maybeSingle();

  if (error) throw new Error(`Failed to look up RSN claim: ${error.message}`);
  return data as RsnClaimRow | null;
}

/** The RSN a given user currently has claimed, if any. */
export async function findRsnClaimByUser(userId: string): Promise<RsnClaimRow | null> {
  const db = getDb();
  const { data, error } = await db
    .from("rsn_claims")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to look up RSN claim for user ${userId}: ${error.message}`);
  return data as RsnClaimRow | null;
}

/**
 * Create or update `userId`'s claim to `rsn` (one claim per user — the
 * abuse-guard cap, see the migration header — so re-claiming under a
 * different RSN moves the existing row rather than adding a second one).
 *
 * Callers should already have checked findRsnClaim(rsnNormalized) for a
 * DIFFERENT user's claim and turned that into a 409 before calling this —
 * this is only a last-line defense against the race (two concurrent claims
 * of the same fresh RSN), surfaced the same way: AppError 409 "RSN_TAKEN".
 */
export async function upsertRsnClaim(
  userId: string,
  rsn: string,
  rsnNormalized: string,
): Promise<RsnClaimRow> {
  const db = getDb();
  const { data, error } = await db
    .from("rsn_claims")
    .upsert(
      { user_id: userId, rsn, rsn_normalized: rsnNormalized, claimed_at: new Date().toISOString() },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    // 23505 here can only be the OTHER unique constraint (rsn_normalized) —
    // the upsert's own onConflict already handles the user_id one. That
    // means someone else won a race to claim this RSN between this route's
    // pre-check and this write.
    if ((error as { code?: string } | null)?.code === "23505") {
      throw new AppError(`RSN "${rsn}" is already claimed by another account`, 409, "RSN_TAKEN");
    }
    throw new Error(`Failed to save RSN claim for user ${userId}: ${error?.message}`);
  }

  return data as RsnClaimRow;
}

// -------------------------------------------------------
// Admin release/reassign (TEAM-BRIEF.md Sprint 17, Track A2, contract A4)
// -------------------------------------------------------

export interface RsnClaimAdminRow {
  userId: string;
  username: string;
  rsn: string;
  rsnNormalized: string;
  claimedAt: string;
}

/**
 * Every current RSN claim, joined to `users` for `username` (the join
 * works because `rsn_claims.user_id` is a real FK to `users(id)` — see the
 * migration). Ordered newest-claim-first so a busy admin panel shows recent
 * activity at the top, matching listInvites'/listUsers' listing
 * conventions elsewhere in this file's sibling modules.
 */
export async function listRsnClaims(): Promise<RsnClaimAdminRow[]> {
  const { data, error } = await getDb()
    .from("rsn_claims")
    .select("user_id, rsn, rsn_normalized, claimed_at, users(username)")
    .order("claimed_at", { ascending: false });

  if (error) throw new Error(`Failed to list RSN claims: ${error.message}`);

  return ((data ?? []) as unknown as Array<{
    user_id: string;
    rsn: string;
    rsn_normalized: string;
    claimed_at: string;
    users: { username: string } | { username: string }[] | null;
  }>).map((row) => {
    // PostgREST embeds a to-one relationship as an object normally, but the
    // supabase-js generated types model every embed as possibly-array —
    // handle both shapes defensively rather than asserting one.
    const embeddedUser = Array.isArray(row.users) ? row.users[0] : row.users;
    return {
      userId: row.user_id,
      username: embeddedUser?.username ?? "",
      rsn: row.rsn,
      rsnNormalized: row.rsn_normalized,
      claimedAt: row.claimed_at,
    };
  });
}

/**
 * Releases (deletes) the claim on `rsnNormalized`, freeing that RSN for
 * anyone to claim again via POST /api/onboarding/rsn. Returns false — not
 * an error — if no claim exists for that RSN, so the route can turn that
 * into its own 404 rather than this layer guessing at HTTP semantics.
 */
export async function releaseRsnClaim(rsnNormalized: string): Promise<boolean> {
  const { data, error } = await getDb()
    .from("rsn_claims")
    .delete()
    .eq("rsn_normalized", rsnNormalized)
    .select("id");

  if (error) throw new Error(`Failed to release RSN claim "${rsnNormalized}": ${error.message}`);
  return (data ?? []).length > 0;
}

/**
 * Reassigns the claim on `rsnNormalized` to a different `userId`. Both of
 * the table's UNIQUE constraints are load-bearing here, not just
 * `UNIQUE(rsn_normalized)`:
 *   - `UNIQUE(user_id)` means the target user can hold at most one claim
 *     total — if they already hold a DIFFERENT rsn's claim, this must be
 *     refused with 409 (the frozen contract's own wording), not silently
 *     overwrite their existing claim or violate the constraint.
 *   - `UNIQUE(rsn_normalized)` is naturally respected because this UPDATEs
 *     the one existing row for `rsnNormalized` in place rather than
 *     inserting a second one.
 *
 * Pre-checks findRsnClaimByUser for a clear 409 message in the common
 * (non-race) case, then still catches 23505 as a last-line defense against
 * a concurrent claim/reassign landing between the pre-check and the
 * UPDATE — same two-layer pattern as upsertRsnClaim above.
 */
export async function reassignRsnClaim(
  rsnNormalized: string,
  userId: string,
): Promise<{ rsn: string; userId: string }> {
  const db = getDb();

  const existingForUser = await findRsnClaimByUser(userId);
  if (existingForUser && existingForUser.rsn_normalized !== rsnNormalized) {
    throw new AppError(
      `User already holds a different RSN claim ("${existingForUser.rsn}")`,
      409,
      "RSN_CLAIM_CONFLICT",
    );
  }

  const { data, error } = await db
    .from("rsn_claims")
    .update({ user_id: userId })
    .eq("rsn_normalized", rsnNormalized)
    .select("rsn, user_id")
    .maybeSingle();

  if (error) {
    if ((error as { code?: string } | null)?.code === "23505") {
      throw new AppError("User already holds a different RSN claim", 409, "RSN_CLAIM_CONFLICT");
    }
    throw new Error(`Failed to reassign RSN claim "${rsnNormalized}": ${error.message}`);
  }
  if (!data) {
    throw new AppError(`No RSN claim found for "${rsnNormalized}"`, 404, "RSN_CLAIM_NOT_FOUND");
  }

  return { rsn: data.rsn, userId: data.user_id };
}
