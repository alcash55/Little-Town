import { getDb } from "../db/client.js";
import { countPendingSubmissions } from "../db/bingoSubmissions.js";
import { notifyBingoEndedWithPendingScreenshots } from "./discordScreenshots.js";

/**
 * End-of-bingo lifecycle (TEAM-BRIEF.md Sprint 15, Track A — replaces
 * Sprint 14's D3 "frozen but still active" stopgap with a real status
 * transition; see playerSnapshotCron.ts's isBingoPastEnd doc comment for
 * that prior state). Prod's "yes sir" bingo ended 2026-06-30 but stayed
 * status='active' with nothing to flip it — blocking the next draft's
 * auto-activation (`uq_bingos_one_active`) for two sprints.
 *
 * Product decision 1: a bingo with status='active' whose end_date has
 * passed transitions to status='complete' automatically, via this idempotent
 * check — called on every stats-cron tick (playerSnapshotCron.ts) AND once
 * at server boot (index.ts), so a Render instance that was asleep past the
 * bingo's end_date doesn't wait up to 20 minutes for the next tick to notice.
 *
 * Product decision 2: ending never blocks on pending screenshots — they
 * survive the transition untouched and remain fully reviewable (see the
 * admin.ts review-endpoints audit, which now resolves "the bingo" via
 * getLatestBingo() instead of the active/draft-only getActiveBingo()).
 *
 * Product decision 4: when a transitioned bingo still has pending
 * submissions, this is the ONE place that fires the one-time Discord
 * notification (services/discordScreenshots.ts's
 * notifyBingoEndedWithPendingScreenshots) — never repeated on later ticks,
 * because idempotency here means an already-complete bingo simply never
 * matches the `status = 'active'` query below again. The in-app admin
 * warning (Track B) is driven independently, by GET /api/admin/bingo/latest's
 * live `pendingScreenshots` count, so it persists correctly across restarts
 * without needing its own "have we shown this" state.
 */
export interface CompletedBingoResult {
  id: string;
  name: string;
  pendingCount: number;
}

interface EndedActiveBingoRow {
  id: string;
  name: string;
  end_date: string | null;
}

/**
 * The ONE guarded status='active' -> 'complete' transition in the codebase
 * (TEAM-BRIEF.md Sprint 17, Track A1 — A1's "reuse the existing transition,
 * don't write a second path" instruction). Shared by completeEndedBingos
 * below (auto, driven by end_date passing) and endBingoEarly below (manual,
 * an admin action) — both are just different CALLERS of this same guarded
 * UPDATE, not separate transition logic.
 *
 * The UPDATE carries a `status = 'active'` filter and is verified via the
 * returned row, so if two callers race on the same bingo (e.g. the boot-time
 * check and a concurrent cron tick, or an admin's "End Early" click racing
 * the auto-complete tick), only the winner gets a non-null row back — the
 * loser's UPDATE matches zero rows and silently no-ops rather than double-
 * processing. Returns null both when the id doesn't exist AND when it
 * exists but isn't 'active' — callers that need to tell those apart (e.g.
 * the 404-vs-409 split in POST /admin/bingo/:bingoId/end) check existence
 * themselves first.
 */
async function transitionActiveBingoToComplete(bingoId: string, now: Date): Promise<EndedActiveBingoRow | null> {
  const db = getDb();
  const { data: updated, error } = await db
    .from("bingos")
    .update({ status: "complete", updated_at: now.toISOString() })
    .eq("id", bingoId)
    .eq("status", "active")
    .select("id, name, end_date")
    .maybeSingle();

  if (error) throw new Error(`Failed to complete bingo ${bingoId}: ${error.message}`);
  return updated as EndedActiveBingoRow | null;
}

/**
 * Idempotent — safe to call repeatedly (every cron tick, plus once at boot).
 * Flips every status='active' bingo whose end_date is strictly in the past
 * (same "< now, not <=" comparison as playerSnapshotCron.ts's
 * isBingoPastEnd) to status='complete'. In practice `uq_bingos_one_active`
 * means at most one row ever matches, but this doesn't assume that — it
 * processes every match it finds.
 *
 * Each transition goes through transitionActiveBingoToComplete above, so
 * it's individually race-guarded the same way endBingoEarly's manual
 * transition is.
 */
export async function completeEndedBingos(now: Date = new Date()): Promise<CompletedBingoResult[]> {
  const db = getDb();
  const nowIso = now.toISOString();

  const { data, error } = await db
    .from("bingos")
    .select("id, name, end_date")
    .eq("status", "active")
    .not("end_date", "is", null)
    .lt("end_date", nowIso);

  if (error) throw new Error(`Failed to query ended-but-still-active bingos: ${error.message}`);

  const results: CompletedBingoResult[] = [];

  for (const row of (data ?? []) as EndedActiveBingoRow[]) {
    let updated: EndedActiveBingoRow | null;
    try {
      updated = await transitionActiveBingoToComplete(row.id, now);
    } catch (e) {
      console.error(`[bingoLifecycle] Failed to complete bingo "${row.name}" (${row.id}):`, (e as Error).message);
      continue;
    }
    if (!updated) {
      // Lost the race to a concurrent caller — already handled elsewhere.
      continue;
    }

    const pendingCount = await countPendingSubmissions(row.id);

    console.log(
      `[bingoLifecycle] Bingo "${row.name}" (${row.id}) auto-completed — end_date ${row.end_date} has passed.` +
        (pendingCount > 0
          ? ` ${pendingCount} screenshot submission(s) still pending review.`
          : " No pending screenshot submissions."),
    );

    results.push({ id: row.id, name: row.name, pendingCount });

    if (pendingCount > 0) {
      // Best-effort, one-time — notifyBingoEndedWithPendingScreenshots
      // itself never throws (skips cleanly if the bot isn't configured), but
      // guard here too since this loop must keep processing other bingos
      // (and must never let a Discord failure look like the transition
      // itself failed).
      await notifyBingoEndedWithPendingScreenshots(row.name, pendingCount).catch((e) =>
        console.warn(`[bingoLifecycle] Discord end-of-bingo notification failed for "${row.name}":`, e),
      );
    }
  }

  return results;
}

/**
 * Manual "End Early" transition (TEAM-BRIEF.md Sprint 17, Track A1 — A1).
 * POST /api/admin/bingo/:bingoId/end's underlying service call. Goes through
 * the exact same guarded transitionActiveBingoToComplete as
 * completeEndedBingos above — this is a different CALLER (an admin action
 * instead of the end_date-passed cron/boot check), not a second transition
 * path.
 *
 * Returns null if the bingo isn't currently 'active' (already complete,
 * still draft/archived, or lost a race to a concurrent transition). Does
 * NOT distinguish "doesn't exist" from "exists but not active" — the route
 * checks existence itself first (404) before calling this, so a null return
 * here always means 409 "not active".
 */
export async function endBingoEarly(
  bingoId: string,
  actingAdminId?: string,
  now: Date = new Date(),
): Promise<(CompletedBingoResult & { endedAt: string }) | null> {
  const updated = await transitionActiveBingoToComplete(bingoId, now);
  if (!updated) return null;

  const pendingCount = await countPendingSubmissions(bingoId);
  const endedAt = now.toISOString();

  console.log(
    `[bingoLifecycle] Bingo "${updated.name}" (${bingoId}) ended early by admin ${actingAdminId ?? "unknown"}.` +
      (pendingCount > 0
        ? ` ${pendingCount} screenshot submission(s) still pending review.`
        : " No pending screenshot submissions."),
  );

  if (pendingCount > 0) {
    // Same product decision as completeEndedBingos: best-effort, one-time,
    // never lets a Discord failure look like the transition itself failed.
    await notifyBingoEndedWithPendingScreenshots(updated.name, pendingCount).catch((e) =>
      console.warn(`[bingoLifecycle] Discord end-of-bingo notification failed for "${updated.name}":`, e),
    );
  }

  return { id: updated.id, name: updated.name, pendingCount, endedAt };
}
