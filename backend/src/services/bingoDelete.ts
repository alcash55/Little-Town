import { getBingoDeleteCounts, deleteBingoRow } from "../db/bingos.js";
import { purgeBingoScreenshots } from "../db/bingoSubmissions.js";

/**
 * DELETE /api/admin/bingo/:bingoId (TEAM-BRIEF.md Sprint 17, Track A2 — the
 * only destructive endpoint in the codebase). The route (routes/admin.ts)
 * owns every GUARD check — existence (404), the active-bingo refusal, and
 * the force+X-Confirm-Delete double gate — and only calls this once the
 * delete is fully authorized. This module owns the delete's MECHANICS:
 * snapshot pre-delete counts, delete the bingo row, purge orphaned storage
 * objects, and log a loud, unconditional audit line.
 *
 * getBingoDeleteCounts / deleteBingoRow / purgeBingoScreenshots are
 * data-engineer's Track A2 data-layer functions (db/bingos.ts,
 * db/bingoSubmissions.ts) — merged into main 2026-08-01.
 */

export interface BingoPurgeCounts {
  teams: number;
  tiles: number;
  players: number;
  submissions: number;
  storageObjects: number;
}

/**
 * Orchestrates the actual delete once the route has authorized it.
 *
 * Counts MUST be read before the delete (data-engineer's explicit ordering
 * requirement — getBingoDeleteCounts's own doc comment: a cascade delete
 * doesn't report cascaded row counts back, so they're unreadable after the
 * fact). The storage purge can run in either order relative to the delete
 * (purgeBingoScreenshots lists by the bingoId path prefix, not by reading
 * bingo_submissions rows) — done AFTER here so a storage failure can never
 * look like it blocked the (irreversible, already-committed) DB delete.
 *
 * The storage purge is best-effort: a failure is logged loudly but does NOT
 * fail the request — by that point the destructive DB delete has already
 * committed, so returning an error response would be misleading (a retry
 * would just 404). `purged.storageObjects` reflects however many objects
 * actually got deleted (0 if the purge itself failed).
 *
 * Always logs one loud audit line (console.warn, AUDIT-prefixed, includes
 * the acting admin id) — TEAM-BRIEF.md Track A1 item 2's explicit
 * requirement, unconditional even when the storage purge fails.
 */
export async function deleteBingoWithPurge(
  bingo: { id: string; name: string; status?: string },
  actingAdminId: string | undefined,
): Promise<BingoPurgeCounts> {
  const counts = await getBingoDeleteCounts(bingo.id);

  const deleted = await deleteBingoRow(bingo.id);
  if (!deleted) {
    // The route just fetched this bingo moments ago — this should be
    // unreachable outside a pathological concurrent-delete race. Fail
    // loudly rather than report a fake success.
    throw new Error(`Bingo ${bingo.id} ("${bingo.name}") disappeared before its delete could complete`);
  }

  let storageObjects = 0;
  try {
    storageObjects = await purgeBingoScreenshots(bingo.id);
  } catch (e) {
    console.error(
      `[bingo-delete] Storage purge failed for deleted bingo "${bingo.name}" (${bingo.id}) — ` +
        `screenshot objects may be orphaned in the bucket:`,
      (e as Error).message,
    );
  }

  const purged: BingoPurgeCounts = { ...counts, storageObjects };

  // Loud, structured, unconditional — grep-able audit trail for the only
  // destructive endpoint in the codebase.
  console.warn(
    `[bingo-delete] AUDIT: bingo "${bingo.name}" (${bingo.id}, status was "${bingo.status}") deleted by admin ` +
      `${actingAdminId ?? "unknown"}. Purged: ${purged.teams} team(s), ${purged.tiles} tile(s), ` +
      `${purged.players} player(s), ${purged.submissions} submission(s), ${purged.storageObjects} storage object(s).`,
  );

  return purged;
}
