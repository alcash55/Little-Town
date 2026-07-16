import { getDb } from "./client.js";

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface BingoSubmission {
  id: string;
  bingo_id: string;
  tile_id: string | null;
  team_id: string | null;
  submitted_by: string | null;
  // uuid FK -> bingo_players.id, nullable (contract 1, migration owned by
  // data-engineer). Not selected explicitly except where noted below, so
  // rows read via `.select("*")` degrade to `undefined` (not `null`) until
  // the column exists — callers that branch on it should use `?? null`.
  player_id: string | null;
  screenshot_url: string | null;
  status: SubmissionStatus;
  notes: string | null;
  discord_message_id: string | null;
  image_path: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

// Private storage bucket created by the 20260708000000_screenshot_submissions.sql
// migration — service_role-only access (see 20260707000000_service_role_grants.sql).
export const SCREENSHOTS_BUCKET = "screenshots";
const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes — just long enough to render in the admin UI

// -------------------------------------------------------
// Discord ingest
// -------------------------------------------------------

/**
 * Used by the Discord ingest service to avoid re-downloading/re-uploading an
 * attachment it has already processed (bot re-scans the last 100 messages on
 * every startup).
 */
export async function submissionExistsByDiscordMessageId(discordMessageId: string): Promise<boolean> {
  const { data, error } = await getDb()
    .from("bingo_submissions")
    .select("id")
    .eq("discord_message_id", discordMessageId)
    .maybeSingle();

  if (error) throw new Error(`Failed to check for existing submission: ${error.message}`);
  return data !== null;
}

/**
 * Inserts a new pending submission from the Discord ingest service.
 * Uses ignoreDuplicates on discord_message_id so a race between the
 * startup backfill and a live message event (or a concurrent re-scan)
 * can't create duplicate rows for the same Discord message/attachment.
 */
export async function insertPendingSubmission(input: {
  bingoId: string;
  discordMessageId: string;
  imagePath: string;
  notes?: string;
}): Promise<void> {
  const { error } = await getDb().from("bingo_submissions").upsert(
    {
      bingo_id: input.bingoId,
      discord_message_id: input.discordMessageId,
      image_path: input.imagePath,
      notes: input.notes ?? null,
      status: "pending",
    },
    { onConflict: "discord_message_id", ignoreDuplicates: true },
  );

  if (error) throw new Error(`Failed to insert submission: ${error.message}`);
}

// -------------------------------------------------------
// Admin review
// -------------------------------------------------------

/**
 * Pending submissions for a bingo, oldest first (review queue order).
 */
export async function getPendingSubmissions(bingoId: string): Promise<BingoSubmission[]> {
  const { data, error } = await getDb()
    .from("bingo_submissions")
    .select("*")
    .eq("bingo_id", bingoId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to get pending submissions: ${error.message}`);
  return (data ?? []) as BingoSubmission[];
}

/**
 * Approved submissions with NO player attribution, oldest-approved first —
 * the admin-facing worklist for the backfill path (bug-report investigation,
 * H1). Feeds GET /bingo/screenshots/unattributed, which the ScreenshotSubmission
 * page's "Needs Player Attribution" section lists alongside the pending
 * queue, each with a player picker calling PATCH .../attribute.
 */
export async function getApprovedSubmissionsMissingAttribution(bingoId: string): Promise<BingoSubmission[]> {
  const { data, error } = await getDb()
    .from("bingo_submissions")
    .select("*")
    .eq("bingo_id", bingoId)
    .eq("status", "approved")
    .is("player_id", null)
    .order("reviewed_at", { ascending: true });

  if (error) throw new Error(`Failed to get unattributed approved submissions: ${error.message}`);
  return (data ?? []) as BingoSubmission[];
}

export async function getSubmissionById(id: string): Promise<BingoSubmission | null> {
  const { data, error } = await getDb()
    .from("bingo_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to get submission: ${error.message}`);
  return data as BingoSubmission | null;
}

/**
 * Validates a screenshot-approval `playerId` against the submission's bingo
 * roster (contract 2). Pure over the passed-in roster so it's unit-testable
 * without a DB — route handlers supply the roster via `getBingoPlayers()`.
 * Returns null when valid (including `playerId` omitted entirely); an error
 * message otherwise.
 */
export function validateApprovalPlayerId(
  playerId: string | undefined,
  teamId: string,
  roster: Array<{ id: string; team_id: string | null }>,
): string | null {
  if (playerId === undefined) return null;
  const player = roster.find((p) => p.id === playerId);
  if (!player || player.team_id !== teamId) {
    return "playerId must be a registered player on the given team";
  }
  return null;
}

export interface DropSubmissionAttribution {
  tile_id: string;
  player_id: string | null;
  status: SubmissionStatus;
}

/**
 * Builds `dropStatus[rsn][tileTask] = 'approved' | 'pending'` for
 * `/my-team-data`. Attribution is via `player_id` (a bingo_players.id) —
 * NOT `submitted_by`, which is a users FK unrelated to team roster
 * membership (contract 5). 'approved' wins over 'pending' for the same
 * rsn+tile. Pure over its inputs so it's unit-testable without a DB.
 */
export function buildDropStatusByRsn(
  submissions: DropSubmissionAttribution[],
  playerIdToRsn: Map<string, string>,
  tileIdToTask: Map<string, string>,
): Record<string, Record<string, "approved" | "pending">> {
  const dropStatus: Record<string, Record<string, "approved" | "pending">> = {};
  for (const sub of submissions) {
    const rsn = sub.player_id ? playerIdToRsn.get(sub.player_id) : undefined;
    if (!rsn) continue;
    const tileTask = tileIdToTask.get(sub.tile_id);
    if (!tileTask) continue;
    if (!dropStatus[rsn]) dropStatus[rsn] = {};
    const existing = dropStatus[rsn][tileTask];
    // approved beats pending
    if (!existing || (sub.status === "approved" && existing === "pending")) {
      dropStatus[rsn][tileTask] = sub.status as "approved" | "pending";
    }
  }
  return dropStatus;
}

/**
 * Builds the `tiles[]` list for `GET /api/bingo/board` (TEAM-BRIEF.md
 * Sprint 7, Track A item 1), attaching `completedByMyTeam`.
 * `completedByMyTeam` is true when the tile id is present in
 * `approvedTileIdsForMyTeam` — the set of `tile_id`s with an **approved**
 * `bingo_submissions` row for the caller's team, computed by the caller
 * (route handler) via a DB query scoped to `team_id = myTeamId`. Passing
 * `null` (caller has no team) always yields `completedByMyTeam: false` for
 * every tile, rather than requiring callers to special-case an empty team
 * lookup into an empty Set. Pure over its inputs so it's unit-testable
 * without a DB, mirroring buildDropStatusByRsn above. Only ever reflects the
 * caller's own team — never other teams' — since the caller only ever
 * passes in submissions already scoped to `myTeamId`.
 *
 * Generic over `T` (rather than a fixed `{id,task}` shape) so callers can
 * pass in tiles already carrying extra fields — e.g. `type`/`points`/
 * `targetValue` (Sprint 8, Track A item 4) — and get them back untouched,
 * with `completedByMyTeam` merged in, instead of this function silently
 * dropping any field it doesn't know about.
 */
export function buildBoardTileCompletion<T extends { id: string; task: string }>(
  tiles: T[],
  approvedTileIdsForMyTeam: Set<string> | null,
): Array<T & { completedByMyTeam: boolean }> {
  return tiles.map((tile) => ({
    ...tile,
    completedByMyTeam: approvedTileIdsForMyTeam?.has(tile.id) ?? false,
  }));
}

export async function approveSubmission(
  id: string,
  input: { tileId: string; teamId: string; playerId?: string; reviewedBy?: string },
): Promise<BingoSubmission> {
  const { data, error } = await getDb()
    .from("bingo_submissions")
    .update({
      status: "approved",
      tile_id: input.tileId,
      team_id: input.teamId,
      // Only touch player_id when the caller explicitly passed one (including
      // `undefined` intentionally omits the key rather than nulling out an
      // existing attribution on re-approve-style calls).
      ...(input.playerId !== undefined ? { player_id: input.playerId } : {}),
      reviewed_by: input.reviewedBy ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) throw new Error(`Failed to approve submission: ${error?.message}`);
  return data as BingoSubmission;
}

/**
 * Sets/changes player_id on an ALREADY-approved submission — the backfill
 * path for the attribution gap (bug-report investigation, H1: player_id is
 * optional at approval time, defaulting to "Unassigned" in the frontend
 * picker, so a real approved completion can end up with no player-level
 * attribution anywhere). Deliberately separate from approveSubmission,
 * which only ever transitions a 'pending' row — this only ever touches an
 * already-'approved' one, so the two can't be confused. Callers should
 * validate playerId against the roster the same way approval does
 * (validateApprovalPlayerId) before calling this.
 *
 * `backfillReviewedBy` (tech-lead follow-up, same investigation): fills in
 * `reviewed_by` too, but ONLY as a gap-fill — the caller should pass it when
 * (and only when) the submission's current `reviewed_by` is already null,
 * never to overwrite a real reviewer on a normally-approved row. Exists
 * because prod turned up approved submissions with `reviewed_by` NULL (no
 * approve/deny code path can produce that for an authenticated prod caller —
 * `getAuditUserId` only omits it for the local-dev bypass user, which is
 * inert outside `NODE_ENV !== 'production'` — so those rows most likely
 * predate/bypassed the review API entirely). Since those same rows are
 * exactly the ones this backfill endpoint touches, this is a low-risk place
 * to also close the "who's accountable for this row" gap going forward,
 * without a schema change.
 */
export async function attributeApprovedSubmission(
  id: string,
  playerId: string,
  backfillReviewedBy?: string,
): Promise<BingoSubmission> {
  const { data, error } = await getDb()
    .from("bingo_submissions")
    .update({
      player_id: playerId,
      ...(backfillReviewedBy !== undefined ? { reviewed_by: backfillReviewedBy } : {}),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) throw new Error(`Failed to attribute submission: ${error?.message}`);
  return data as BingoSubmission;
}

export async function denySubmission(
  id: string,
  input: { reviewedBy?: string },
): Promise<BingoSubmission> {
  const { data, error } = await getDb()
    .from("bingo_submissions")
    .update({
      status: "rejected",
      reviewed_by: input.reviewedBy ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) throw new Error(`Failed to deny submission: ${error?.message}`);
  return data as BingoSubmission;
}

/**
 * Short-lived signed URL for a screenshot in the private `screenshots`
 * bucket. Returns null (instead of throwing) on failure so a single bad
 * row doesn't take down the whole pending list.
 */
export async function getSignedScreenshotUrl(imagePath: string): Promise<string | null> {
  const { data, error } = await getDb()
    .storage.from(SCREENSHOTS_BUCKET)
    .createSignedUrl(imagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    console.error(`[bingoSubmissions] Failed to sign URL for "${imagePath}": ${error?.message}`);
    return null;
  }
  return data.signedUrl;
}
