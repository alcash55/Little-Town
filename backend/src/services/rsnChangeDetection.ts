import { logRsnChange, resolveRsnChange, RsnChangeSource } from "../db/rsnChangeLog.js";

export type { RsnChangeSource } from "../db/rsnChangeLog.js";

/**
 * Detects an RSN going stale (an already-registered player whose on-file RSN
 * stops resolving on the OSRS hiscores) and logs/clears it in
 * rsn_change_log. Never renames bingo_players.rsn — detection + logging only
 * (TEAM-BRIEF.md Track A item 1).
 *
 * Call this everywhere the backend does a hiscore lookup for a player who is
 * already registered: the snapshot cron, activation/retake snapshots, and
 * the admin-panel single/bulk refresh routes the team drafter uses. Do NOT
 * call it from the initial registration lookup in POST /bingo/players — an
 * RSN that fails to resolve there isn't a "change", it just hasn't been
 * validated yet.
 *
 * Best-effort: a logging failure is swallowed (after a console.error) so it
 * can never break the snapshot/activation flow that triggered it.
 */
export async function checkRsnChange(
  player: { id: string; rsn: string },
  hiscoreFound: boolean,
  source: RsnChangeSource,
): Promise<void> {
  try {
    if (hiscoreFound) {
      await resolveRsnChange(player.id);
      return;
    }

    await logRsnChange(player.id, player.rsn, source);
    // Loud on purpose (console.warn, not .log) — TEAM-BRIEF.md Track A item 1
    // explicitly asks for this to be visible in cron output.
    console.warn(
      `[rsnChangeDetection] "${player.rsn}" (player ${player.id}) is no longer resolving on the ` +
        `OSRS hiscores — logged as a possible RSN change (source: ${source}).`,
    );
  } catch (e) {
    console.error(`[rsnChangeDetection] Failed to record RSN status for "${player.rsn}":`, e);
  }
}
