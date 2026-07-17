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
 * Idempotent — safe to call repeatedly (every cron tick, plus once at boot).
 * Flips every status='active' bingo whose end_date is strictly in the past
 * (same "< now, not <=" comparison as playerSnapshotCron.ts's
 * isBingoPastEnd) to status='complete'. In practice `uq_bingos_one_active`
 * means at most one row ever matches, but this doesn't assume that — it
 * processes every match it finds.
 *
 * Each transition is individually race-guarded: the UPDATE itself carries a
 * `status = 'active'` filter and is verified via the returned row, so if two
 * callers (e.g. a boot-time check and a concurrent cron tick) race on the
 * same bingo, only the winner logs the transition, counts pending
 * submissions, and fires the Discord notification — the loser's UPDATE
 * matches zero rows and is silently skipped, not double-processed.
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
    // Race guard: only actually transition (and only proceed to notify) if
    // this call is the one that flips it — a concurrent caller that lost the
    // race gets no row back here and moves on.
    const { data: updated, error: updateError } = await db
      .from("bingos")
      .update({ status: "complete", updated_at: nowIso })
      .eq("id", row.id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error(`[bingoLifecycle] Failed to complete bingo "${row.name}" (${row.id}):`, updateError.message);
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
