import { getDb } from "./client.js";
import { HiscoreData, SideAccount } from "../types/index.js";
import { AppError } from "../middleware/errorHandler.js";
import { findRsnClaimByUser } from "./rsnClaims.js";

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface BingoPlayer {
  id: string;
  bingo_id: string;
  team_id: string | null;
  captain_team_id: string | null;
  rsn: string;
  registered_by: string | null;
  registered_at: string;
}

export interface PlayerSnapshot {
  id: string;
  player_id: string;
  side_account_id: string | null;
  type: "start" | "current";
  skills: HiscoreData["skills"];
  activities: HiscoreData["activities"];
  taken_at: string;
}

// -------------------------------------------------------
// Player registration
// -------------------------------------------------------

/**
 * Register a player to a bingo. Returns the existing row if already registered.
 */
export async function registerBingoPlayer(
  bingoId: string,
  rsn: string,
  teamId?: string,
  registeredBy?: string,
): Promise<BingoPlayer> {
  const db = getDb();

  // Insert-if-absent (ignoreDuplicates), then always read back whichever row
  // exists. Re-registering an already-registered RSN must be a race-free
  // no-op — a merge-duplicates upsert would null out an existing team_id/
  // registered_by on every re-add (e.g. re-importing the same CSV).
  const { error: insertError } = await db.from("bingo_players").upsert(
    { bingo_id: bingoId, rsn, team_id: teamId ?? null, registered_by: registeredBy ?? null },
    { onConflict: "bingo_id,rsn", ignoreDuplicates: true },
  );

  if (insertError) throw new Error(`Failed to register player "${rsn}": ${insertError.message}`);

  const { data, error } = await db
    .from("bingo_players")
    .select("*")
    .eq("bingo_id", bingoId)
    .eq("rsn", rsn)
    .single();

  if (error || !data) throw new Error(`Failed to register player "${rsn}": ${error?.message}`);
  return data as BingoPlayer;
}

/**
 * Get all players registered to a bingo.
 */
export async function getBingoPlayers(bingoId: string): Promise<BingoPlayer[]> {
  const db = getDb();
  const { data, error } = await db
    .from("bingo_players")
    .select("*")
    .eq("bingo_id", bingoId)
    .order("registered_at", { ascending: true });

  if (error) throw new Error(`Failed to get players: ${error.message}`);
  return (data ?? []) as BingoPlayer[];
}

/**
 * Get a single player by RSN within a bingo.
 */
export async function getBingoPlayer(bingoId: string, rsn: string): Promise<BingoPlayer | null> {
  const db = getDb();
  const { data, error } = await db
    .from("bingo_players")
    .select("*")
    .eq("bingo_id", bingoId)
    .eq("rsn", rsn)
    .maybeSingle();

  if (error) throw new Error(`Failed to get player: ${error.message}`);
  return data as BingoPlayer | null;
}

/**
 * Get a single player by RSN within a bingo, case-insensitively. Used by
 * POST /api/onboarding/rsn (TEAM-BRIEF.md Sprint 11, Track A) so an
 * admin-pre-registered "zezima" gets LINKED when a user later claims
 * "Zezima" through onboarding, rather than creating a second, case-variant
 * pool row — bingo_players' own UNIQUE (bingo_id, rsn) is case-sensitive
 * (an existing, pre-this-sprint limitation; not touched here), so
 * `registerBingoPlayer` alone can't de-dupe across casing on its own.
 *
 * `.ilike` escaped for `%`/`_` (Postgres ILIKE wildcards) so this is a
 * case-insensitive EQUALS, not a pattern match — a literal RSN containing
 * either character (disallowed by lib/rsn.ts's isPlausibleRsn for new
 * claims, but bingo_players predates that check) can't accidentally widen
 * the match.
 */
export async function findBingoPlayerCaseInsensitive(
  bingoId: string,
  rsn: string,
): Promise<BingoPlayer | null> {
  const db = getDb();
  const escaped = rsn.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data, error } = await db
    .from("bingo_players")
    .select("*")
    .eq("bingo_id", bingoId)
    .ilike("rsn", escaped)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to look up player "${rsn}": ${error.message}`);
  return data as BingoPlayer | null;
}

/**
 * Resolves "which bingo_players row is ME" for a logged-in user — used by
 * GET /api/bingo/board and GET /api/bingo/my-team-data to find the caller's
 * own team. Two sources, in priority order:
 *
 *   1. `rsn_claims` (Sprint 11+) — a real, unambiguous user -> RSN link
 *      created by POST /api/onboarding/rsn. Preferred whenever it resolves.
 *   2. `bingo_players.registered_by` — the historical/fallback link. This
 *      column records who RAN the registration call, not who the player IS:
 *      the Team Drafter's admin "add player" flow (routes/admin.ts POST
 *      /bingo/players) sets `registered_by` to the ADMIN's user id for every
 *      player they add, which is the NORMAL way most players end up in a
 *      bingo. That means an admin who has registered several players has
 *      `registered_by = <admin id>` on ALL of them — a query for "the player
 *      registered_by me" is only trustworthy when it comes back with exactly
 *      one row. More than one match can't be resolved to a single "me"
 *      without guessing, so it's treated the same as zero matches (no
 *      self-registration to fall back to) rather than silently picking
 *      whichever row happens to sort first.
 *
 * A player who was admin-registered for someone ELSE (the common case) has
 * no rsn_claims row and a registered_by that points at the admin, not them —
 * such a user resolves to `null` here until they claim their RSN via
 * onboarding. That's a real gap (see todo.md's bug-report writeup); this
 * function doesn't invent a fix for admin-registered-but-never-claimed
 * players, it only fixes the two cases that ARE resolvable (a genuine claim,
 * or an unambiguous self-registration).
 */
export async function resolveMyBingoPlayer(
  bingoId: string,
  userId: string,
): Promise<BingoPlayer | null> {
  const claim = await findRsnClaimByUser(userId);
  if (claim) {
    const claimed = await findBingoPlayerCaseInsensitive(bingoId, claim.rsn);
    if (claimed) return claimed;
    // Claimed an RSN, but it isn't (yet) in THIS bingo's player pool —
    // fall through to the registered_by fallback rather than returning
    // null outright, in case an older registered_by link still applies.
  }

  const db = getDb();
  const { data, error } = await db
    .from("bingo_players")
    .select("*")
    .eq("bingo_id", bingoId)
    .eq("registered_by", userId);

  if (error) throw new Error(`Failed to resolve player for user ${userId}: ${error.message}`);

  const rows = (data ?? []) as BingoPlayer[];
  if (rows.length === 1) return rows[0];
  if (rows.length > 1) {
    console.warn(
      `[players] registered_by=${userId} matches ${rows.length} players in bingo ${bingoId} — ` +
        "ambiguous (likely an admin who registered multiple players via the Team Drafter), " +
        "treating as no self-registration rather than guessing which row is \"me\".",
    );
  }
  return null;
}

/**
 * Remove a player from a bingo (cascades snapshots and side accounts).
 */
export async function removeBingoPlayer(bingoId: string, rsn: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from("bingo_players")
    .delete()
    .eq("bingo_id", bingoId)
    .eq("rsn", rsn);

  if (error) throw new Error(`Failed to remove player "${rsn}": ${error.message}`);
}

/**
 * Update a player's team assignment.
 */
export async function updatePlayerTeam(
  bingoId: string,
  rsn: string,
  teamId: string | null,
): Promise<BingoPlayer> {
  const db = getDb();
  const { data, error } = await db
    .from("bingo_players")
    .update({ team_id: teamId })
    .eq("bingo_id", bingoId)
    .eq("rsn", rsn)
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to update team for "${rsn}": ${error?.message}`);
  return data as BingoPlayer;
}

/**
 * Set or clear a player's team captain role. Only one captain per team per bingo.
 * Delegates to the set_team_captain RPC, which atomically clears the team's
 * existing captain and sets the new one (avoiding the clear-then-set race).
 */
export async function updatePlayerCaptain(
  bingoId: string,
  rsn: string,
  captainTeamId: string | null,
): Promise<BingoPlayer> {
  const db = getDb();

  const { data, error } = await db.rpc("set_team_captain", {
    p_bingo_id: bingoId,
    p_rsn: rsn,
    p_captain_team_id: captainTeamId,
  });

  if (error) {
    // set_team_captain raises 'Player "..." not found in this bingo' /
    // 'Captain team not found for this bingo' — surface those as 404s
    // instead of letting them fall through to a generic 500.
    if (/not found/i.test(error.message)) {
      throw new AppError(error.message, 404);
    }
    throw new Error(`Failed to update captain for "${rsn}": ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new AppError(`Player "${rsn}" not found in this bingo`, 404);
  return row as BingoPlayer;
}

/**
 * Update a player's on-file RSN. Used only by the automatic Wise Old Man
 * rename resolution flow (services/rsnChangeDetection.ts) after a candidate
 * new name has been confirmed to resolve on the OSRS hiscores — there is no
 * manual "rename" admin action today (an admin fixes a bad RSN by removing
 * and re-registering the player instead).
 *
 * Can fail with a 23505 if the new name collides with another player
 * already registered in the same bingo (bingo_players' UNIQUE (bingo_id,
 * rsn)) — callers should treat that as "rename couldn't be applied" rather
 * than letting it bubble up as an unrelated 500 (see checkRsnChange, which
 * catches this and falls back to the unresolved-log path).
 */
export async function updatePlayerRsn(playerId: string, newRsn: string): Promise<BingoPlayer> {
  const db = getDb();
  const { data, error } = await db
    .from("bingo_players")
    .update({ rsn: newRsn })
    .eq("id", playerId)
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to update RSN for player ${playerId}: ${error?.message}`);
  return data as BingoPlayer;
}

/**
 * Reset all player team assignments for a bingo (set team_id = NULL).
 */
export async function resetPlayerTeams(bingoId: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from("bingo_players")
    .update({ team_id: null })
    .eq("bingo_id", bingoId);

  if (error) throw new Error(`Failed to reset teams: ${error.message}`);
}

// -------------------------------------------------------
// Snapshots
// -------------------------------------------------------

/**
 * Save a snapshot for a player, or (passing `sideAccountId`) for one of
 * their side accounts.
 * - 'start': only written once; subsequent calls are ignored.
 * - 'current': upserted every time.
 *
 * Delegates to the upsert_player_hiscore_start / upsert_player_hiscore_current
 * RPCs (see 20260709000000_snapshot_upsert_rpc.sql) instead of PostgREST's
 * .upsert(): bingo_player_hiscores' real arbiters, uq_hiscores_primary and
 * uq_hiscores_side, are PARTIAL unique indexes, and PostgREST's onConflict
 * option can only emit a bare column list, never the WHERE predicate needed
 * to infer a partial index. The RPCs pick the correct arbiter in SQL.
 *
 * Side-account writes (as of this sprint's services/sideAccountSnapshots.ts)
 * also feed bingo_player_hiscore_history via a DB trigger
 * (20260711000000_hiscore_conflict_history.sql), which is what
 * GET /api/bingo/:bingoId/conflicts reads — no extra call needed here.
 */
export async function savePlayerSnapshot(
  playerId: string,
  type: "start" | "current",
  data: HiscoreData,
  sideAccountId?: string,
): Promise<PlayerSnapshot> {
  const db = getDb();

  const rpcName = type === "start" ? "upsert_player_hiscore_start" : "upsert_player_hiscore_current";

  const { data: saved, error } = await db.rpc(rpcName, {
    p_player_id: playerId,
    p_side_account_id: sideAccountId ?? null,
    p_skills: data.skills,
    p_activities: data.activities,
    p_taken_at: new Date().toISOString(),
  });

  if (error || !saved) throw new Error(`Failed to save ${type} snapshot: ${error?.message}`);
  return saved as PlayerSnapshot;
}

/**
 * Deletes an existing 'start' snapshot row (if any) so a following
 * `savePlayerSnapshot(..., "start", ...)` call actually inserts a fresh row
 * instead of no-op'ing against upsert_player_hiscore_start's insert-if-
 * absent conflict handling (see that RPC's doc comment above).
 *
 * Used ONLY by bingo activation (TEAM-BRIEF.md Sprint 14, D2 fix) — start
 * snapshots are normally taken once at registration and must never move
 * again on their own (registration races, mid-bingo claims), but activation
 * time IS the baseline for the bingo that's about to start, so any start
 * snapshot predating it (typically taken days earlier at registration) must
 * be replaced. Not a general-purpose "reset a player" helper — every other
 * start-snapshot call site (registration, retake-start-snapshots) must keep
 * using the plain insert-if-absent path untouched.
 *
 * Two round trips (delete, then the caller's own insert) rather than one
 * atomic statement — acceptable here because activation is an infrequent,
 * effectively-single-writer operation (one admin action or one cron tick,
 * guarded by uq_bingos_one_active), not a hot concurrent path.
 */
export async function clearStartSnapshot(playerId: string, sideAccountId?: string): Promise<void> {
  const db = getDb();
  let query = db.from("bingo_player_hiscores").delete().eq("player_id", playerId).eq("type", "start");
  query = sideAccountId ? query.eq("side_account_id", sideAccountId) : query.is("side_account_id", null);
  const { error } = await query;
  if (error) throw new Error(`Failed to clear start snapshot: ${error.message}`);
}

/**
 * Get both snapshots for a player. Returns null for any that don't exist yet.
 */
export async function getPlayerSnapshots(playerId: string): Promise<{
  start: PlayerSnapshot | null;
  current: PlayerSnapshot | null;
}> {
  const db = getDb();
  const { data, error } = await db
    .from("bingo_player_hiscores")
    .select("*")
    .eq("player_id", playerId)
    .is("side_account_id", null);

  if (error) throw new Error(`Failed to get snapshots: ${error.message}`);

  const rows = (data ?? []) as PlayerSnapshot[];
  return {
    start: rows.find((r) => r.type === "start") ?? null,
    current: rows.find((r) => r.type === "current") ?? null,
  };
}

/**
 * Get snapshots for all players in a bingo in one query.
 */
export async function getAllPlayerSnapshots(bingoId: string): Promise<
  Array<{
    player: BingoPlayer;
    start: PlayerSnapshot | null;
    current: PlayerSnapshot | null;
  }>
> {
  const db = getDb();

  const { data: players, error: pErr } = await db
    .from("bingo_players")
    .select("*")
    .eq("bingo_id", bingoId);

  if (pErr) throw new Error(`Failed to get players: ${pErr.message}`);
  if (!players?.length) return [];

  const playerIds = players.map((p: BingoPlayer) => p.id);

  const { data: snapshots, error: sErr } = await db
    .from("bingo_player_hiscores")
    .select("*")
    .in("player_id", playerIds)
    .is("side_account_id", null);

  if (sErr) throw new Error(`Failed to get snapshots: ${sErr.message}`);

  const snapshotRows = (snapshots ?? []) as PlayerSnapshot[];

  return players.map((player: BingoPlayer) => ({
    player,
    start: snapshotRows.find((s) => s.player_id === player.id && s.type === "start") ?? null,
    current: snapshotRows.find((s) => s.player_id === player.id && s.type === "current") ?? null,
  }));
}

// -------------------------------------------------------
// Side accounts
// -------------------------------------------------------

/**
 * Get all side accounts for a player.
 */
export async function getSideAccounts(playerId: string): Promise<SideAccount[]> {
  const db = getDb();
  const { data, error } = await db
    .from("bingo_player_side_accounts")
    .select("*")
    .eq("player_id", playerId)
    .order("added_at", { ascending: true });

  if (error) throw new Error(`Failed to get side accounts: ${error.message}`);
  return (data ?? []) as SideAccount[];
}

/**
 * Add a side account to a player. Returns the existing row if the RSN is already tracked.
 */
export async function addSideAccount(
  playerId: string,
  rsn: string,
  notes?: string,
  addedBy?: string,
): Promise<SideAccount> {
  const db = getDb();

  // Insert-if-absent (ignoreDuplicates), then always read back whichever row
  // exists. Re-adding an already-tracked RSN must be a race-free no-op — a
  // merge-duplicates upsert would wipe existing notes/added_by on every
  // re-add.
  const { error: insertError } = await db.from("bingo_player_side_accounts").upsert(
    { player_id: playerId, rsn, notes: notes ?? null, added_by: addedBy ?? null },
    { onConflict: "player_id,rsn", ignoreDuplicates: true },
  );

  if (insertError) throw new Error(`Failed to add side account "${rsn}": ${insertError.message}`);

  const { data, error } = await db
    .from("bingo_player_side_accounts")
    .select("*")
    .eq("player_id", playerId)
    .eq("rsn", rsn)
    .single();

  if (error || !data) throw new Error(`Failed to add side account "${rsn}": ${error?.message}`);
  return data as SideAccount;
}

/**
 * Update a side account's on-file RSN. Side-account counterpart of
 * updatePlayerRsn — same caller (checkSideAccountRsnChange), same
 * "confirmed-by-hiscores WOM rename only" contract, same collision handling
 * (bingo_player_side_accounts' UNIQUE (player_id, rsn)).
 */
export async function updateSideAccountRsn(sideAccountId: string, newRsn: string): Promise<SideAccount> {
  const db = getDb();
  const { data, error } = await db
    .from("bingo_player_side_accounts")
    .update({ rsn: newRsn })
    .eq("id", sideAccountId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update RSN for side account ${sideAccountId}: ${error?.message}`);
  }
  return data as SideAccount;
}

/**
 * Remove a side account by its ID.
 */
export async function removeSideAccount(sideAccountId: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from("bingo_player_side_accounts")
    .delete()
    .eq("id", sideAccountId);

  if (error) throw new Error(`Failed to remove side account: ${error.message}`);
}

/**
 * Get all side accounts for every player in a bingo, keyed by player_id.
 */
export async function getAllSideAccounts(
  bingoId: string,
): Promise<Record<string, SideAccount[]>> {
  const db = getDb();

  const { data: players, error: pErr } = await db
    .from("bingo_players")
    .select("id")
    .eq("bingo_id", bingoId);

  if (pErr) throw new Error(`Failed to get players: ${pErr.message}`);
  if (!players?.length) return {};

  const playerIds = players.map((p: { id: string }) => p.id);

  const { data, error } = await db
    .from("bingo_player_side_accounts")
    .select("*")
    .in("player_id", playerIds)
    .order("added_at", { ascending: true });

  if (error) throw new Error(`Failed to get side accounts: ${error.message}`);

  const result: Record<string, SideAccount[]> = {};
  for (const row of (data ?? []) as SideAccount[]) {
    if (!result[row.player_id]) result[row.player_id] = [];
    result[row.player_id].push(row);
  }
  return result;
}

/**
 * Side accounts in a bingo that have never had a 'start' snapshot written —
 * e.g. one added to a player after the bingo was already active, whose
 * immediate best-effort snapshot (routes/admin.ts's POST
 * .../side-accounts) failed (RSN not yet ranked) or, for bingos created
 * before this fix shipped, was simply never attempted (TEAM-BRIEF.md
 * Sprint 7, Track A item 2). Feeds the extended "missing" sweep in
 * POST /bingo/:bingoId/retake-start-snapshots alongside its existing
 * main-account check.
 *
 * Two bulk queries (all side accounts for the bingo, all side_account_ids
 * with a 'start' row) diffed in memory — same shape as getAllPlayerSnapshots
 * above — rather than a per-side-account round trip.
 */
export async function getSideAccountsMissingStartSnapshot(
  bingoId: string,
): Promise<Array<{ playerId: string; sideAccount: SideAccount }>> {
  const byPlayer = await getAllSideAccounts(bingoId);
  const allPairs = Object.entries(byPlayer).flatMap(([playerId, accounts]) =>
    accounts.map((sideAccount) => ({ playerId, sideAccount })),
  );
  if (!allPairs.length) return [];

  const db = getDb();
  const { data, error } = await db
    .from("bingo_player_hiscores")
    .select("side_account_id")
    .in(
      "side_account_id",
      allPairs.map((p) => p.sideAccount.id),
    )
    .eq("type", "start");

  if (error) throw new Error(`Failed to check side account snapshots: ${error.message}`);

  const haveStart = new Set(
    ((data ?? []) as Array<{ side_account_id: string }>).map((r) => r.side_account_id),
  );
  return allPairs.filter((p) => !haveStart.has(p.sideAccount.id));
}

/**
 * Bulk-fetches start+current snapshots for a set of side accounts, keyed by
 * side_account_id — the side-account counterpart of getAllPlayerSnapshots
 * above. Feeds services/completionEngine.ts's loadEnginePlayers, which sums
 * a player's side-account deltas into their contribution toward their
 * team's total (TEAM-BRIEF.md Sprint 13, Track A item 1 — side-account
 * gains count, since it's the same real person's account).
 *
 * Every id in `sideAccountIds` always gets an entry in the returned map
 * (start/current both null if no snapshot rows exist yet) so callers can
 * `.get(id)!` without an extra existence check.
 */
export async function getSideAccountSnapshotsBulk(
  sideAccountIds: string[],
): Promise<Map<string, { start: PlayerSnapshot | null; current: PlayerSnapshot | null }>> {
  const result = new Map<string, { start: PlayerSnapshot | null; current: PlayerSnapshot | null }>();
  for (const id of sideAccountIds) result.set(id, { start: null, current: null });
  if (!sideAccountIds.length) return result;

  const db = getDb();
  const { data, error } = await db
    .from("bingo_player_hiscores")
    .select("*")
    .in("side_account_id", sideAccountIds);

  if (error) throw new Error(`Failed to get side account snapshots: ${error.message}`);

  for (const row of (data ?? []) as PlayerSnapshot[]) {
    if (!row.side_account_id) continue;
    const entry = result.get(row.side_account_id);
    if (!entry) continue; // defensive — shouldn't happen, every id was seeded above
    if (row.type === "start") entry.start = row;
    else entry.current = row;
  }
  return result;
}
