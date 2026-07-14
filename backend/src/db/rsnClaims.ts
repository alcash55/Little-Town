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
