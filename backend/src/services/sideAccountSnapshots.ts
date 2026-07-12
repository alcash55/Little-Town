import { getSideAccounts, savePlayerSnapshot, type BingoPlayer } from "../db/players.js";
import { mapWithConcurrency, HISCORE_CONCURRENCY } from "../lib/concurrency.js";
import { hiscores } from "./hiscores.js";
import { checkSideAccountRsnChange, RsnChangeSource } from "./rsnChangeDetection.js";
import type { SideAccount } from "../types/index.js";

// -------------------------------------------------------
// Side-account hiscore snapshot polling (Sprint 5 follow-up).
//
// Since Sprint 3, upsert_player_hiscore_start/current accept a
// p_side_account_id, and bingo_player_hiscores has a side_account_id
// column, but nothing ever called savePlayerSnapshot with one — the cron
// and activation flows only ever iterated primary accounts. That starved
// GET /api/bingo/:bingoId/conflicts (db/conflicts.ts): its
// bingo_player_hiscore_history rows are populated by a DB trigger on every
// write to bingo_player_hiscores (20260711000000_hiscore_conflict_history
// .sql), so simply writing side-account snapshot rows here is enough —
// history and conflict detection follow automatically with no further
// application code.
//
// Sprint 6: side accounts now go through the same RSN-change detection +
// Wise Old Man auto-rename flow as primary accounts
// (services/rsnChangeDetection.ts's checkSideAccountRsnChange), backed by
// rsn_change_log's nullable side_account_id column
// (20260712000000_rsn_change_log_wom.sql).
// -------------------------------------------------------

export interface SideSnapshotResult {
  playerId: string;
  sideAccountId: string;
  rsn: string;
  ok: boolean;
  error?: string;
}

/**
 * Fetches hiscores for one side account and writes whichever snapshot
 * type(s) are requested. Never throws — a failed side-account lookup must
 * never fail the parent player's own main-account snapshot (callers run
 * this as a separate best-effort phase), so every outcome is reported via
 * the returned `ok`/`error` instead of a rejection.
 *
 * Runs RSN-change detection (checkSideAccountRsnChange) on a 404: logs an
 * unresolved rsn_change_log row keyed by side_account_id, attempts a Wise
 * Old Man auto-rename same as primary accounts, and if confirmed, updates
 * bingo_player_side_accounts.rsn and proceeds with the already-fetched
 * hiscore data for the new name so this tick's snapshot isn't lost.
 */
async function snapshotOneSideAccount(
  playerId: string,
  sideAccount: SideAccount,
  types: Array<"start" | "current">,
  source: RsnChangeSource,
): Promise<SideSnapshotResult> {
  const base = { playerId, sideAccountId: sideAccount.id, rsn: sideAccount.rsn };
  try {
    const data = await hiscores(sideAccount.rsn);
    const rsnCheck = await checkSideAccountRsnChange(sideAccount, Boolean(data), source);
    const effectiveData = data ?? rsnCheck.hiscoreData ?? null;
    if (!effectiveData) {
      console.warn(
        `[sideAccountSnapshots] Side account "${sideAccount.rsn}" (of player ${playerId}) is not ranked ` +
          "on the OSRS hiscores and no confirmed Wise Old Man rename resolved it — skipping its snapshot.",
      );
      return {
        ...base,
        ok: false,
        error: `Side account "${sideAccount.rsn}" is not ranked on the OSRS hiscores`,
      };
    }
    for (const type of types) {
      await savePlayerSnapshot(playerId, type, effectiveData, sideAccount.id);
    }
    const effectiveRsn = rsnCheck.renamed ? rsnCheck.newRsn! : sideAccount.rsn;
    return { ...base, rsn: effectiveRsn, ok: true };
  } catch (e) {
    console.error(`[sideAccountSnapshots] Failed to snapshot side account "${sideAccount.rsn}":`, e);
    return { ...base, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Snapshots every side account belonging to each of `players`, for the
 * given snapshot type(s) ("current" only for the cron's periodic refresh;
 * "start" + "current" for activation/retake, mirroring how main-account
 * snapshots are taken).
 *
 * OSRS lookups run through mapWithConcurrency at the same HISCORE_CONCURRENCY
 * budget every other hiscore fan-out in this app uses (not a second,
 * uncoordinated pool) — and because every caller here runs this as a
 * separate phase strictly after its own main-account pass (never
 * concurrently with it), the peak number of in-flight OSRS requests at any
 * instant never exceeds HISCORE_CONCURRENCY, regardless of how many side
 * accounts exist.
 *
 * Never throws: per-side-account failures are reported in the returned
 * array, never as a rejection.
 */
export async function snapshotAllSideAccounts(
  players: Pick<BingoPlayer, "id">[],
  types: Array<"start" | "current">,
  source: RsnChangeSource,
): Promise<SideSnapshotResult[]> {
  if (!players.length) return [];

  const perPlayerSideAccounts = await Promise.all(
    players.map(async (player) => ({ playerId: player.id, sideAccounts: await getSideAccounts(player.id) })),
  );

  const tasks = perPlayerSideAccounts.flatMap(({ playerId, sideAccounts }) =>
    sideAccounts.map((sideAccount) => ({ playerId, sideAccount })),
  );
  if (!tasks.length) return [];

  const settled = await mapWithConcurrency(tasks, HISCORE_CONCURRENCY, ({ playerId, sideAccount }) =>
    snapshotOneSideAccount(playerId, sideAccount, types, source),
  );

  // snapshotOneSideAccount never throws, so every entry is fulfilled — this
  // fallback only exists to satisfy the PromiseSettledResult type.
  return settled.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { playerId: "", sideAccountId: "", rsn: "", ok: false, error: "Unexpected rejection" },
  );
}
