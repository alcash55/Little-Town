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

export async function getSubmissionById(id: string): Promise<BingoSubmission | null> {
  const { data, error } = await getDb()
    .from("bingo_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to get submission: ${error.message}`);
  return data as BingoSubmission | null;
}

export async function approveSubmission(
  id: string,
  input: { tileId: string; teamId: string; reviewedBy?: string },
): Promise<BingoSubmission> {
  const { data, error } = await getDb()
    .from("bingo_submissions")
    .update({
      status: "approved",
      tile_id: input.tileId,
      team_id: input.teamId,
      reviewed_by: input.reviewedBy ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) throw new Error(`Failed to approve submission: ${error?.message}`);
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
