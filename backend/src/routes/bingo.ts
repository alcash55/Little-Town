import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { protect, authorize, optionalAuth } from "../middleware/auth.js";
import { ApiResponse } from "../types/index.js";
import { getActiveBingo, getActiveBingoBoard } from "../db/bingos.js";
import { getAllPlayerSnapshots, resolveMyBingoPlayer } from "../db/players.js";
import {
  buildDropStatusByRsn,
  buildBoardTileCompletion,
  DropSubmissionAttribution,
} from "../db/bingoSubmissions.js";
import { getBingoConflicts } from "../db/conflicts.js";
import { getTeamXpHistory } from "../db/teamXpHistory.js";
import { getDb } from "../db/client.js";
import { computeBingoCompletion, normalizeTaskText, type EngineTile } from "../services/completionEngine.js";

const router = Router();

/**
 * GET /api/bingo/board
 *
 * Feeds the real BingoBoard page (TEAM-BRIEF.md Sprint 7, Track A item 1 —
 * frozen contract; made optionally-authenticated in Sprint 9, Track A per
 * TEAM-BRIEF.md's "Frozen contract change"). Registered — deliberately —
 * BEFORE the router-level `protect` below and behind its own `optionalAuth`
 * middleware instead, so this is the one bingo read route anonymous callers
 * can hit without a token. Bare-object response (not the usual ApiResponse
 * envelope), matching the team-xp-history / conflicts convention:
 *
 *   { active: false }
 *   { active: true, bingo: {id,name,boardSize}, myTeam: {id,name}|null,
 *     tiles: [{id,task,completedByMyTeam,pendingByMyTeam,type,points,targetValue}] }
 *
 * "active" deliberately means bingo.status === 'active' specifically (NOT
 * 'draft') — matches the status check playerSnapshotCron.ts and
 * discordScreenshots.ts already use for "is a bingo actually running", and
 * is stricter than getActiveBingo()'s own draft-or-active definition (which
 * exists for admin drafting flows, not this public read).
 *
 * Auth: optionalAuth populates req.user (impersonation-aware, via the same
 * applyImpersonation used by protect) when a valid bearer token is present,
 * and leaves it undefined otherwise — no token, an invalid token, or an
 * expired token are all treated identically as "anonymous", never a 401/500
 * (contract). Anonymous callers always get myTeam: null and every tile's
 * completedByMyTeam/pendingByMyTeam: false — the team-lookup query below is
 * skipped entirely when req.user is absent, so there is no code path where
 * an anonymous caller's request can accidentally resolve to somebody's team.
 *
 * myTeam / completion resolution for authenticated callers uses req.user
 * (the EFFECTIVE, possibly impersonated caller) exactly like
 * /my-team-data's own resolveMyBingoPlayer() call below (see its doc comment
 * in db/players.ts for the claim-first, registered_by-fallback resolution
 * order). completedByMyTeam/pendingByMyTeam only ever reflect the caller's
 * own team — other teams' progress is never fetched, let alone exposed
 * (contract 1). Anonymous callers see exactly the same board layout/tasks/
 * points that any authenticated non-team-member sees — this is the first
 * intentionally public bingo endpoint; see TEAM-BRIEF.md Sprint 9 Track A
 * report for the full security note on what that exposes.
 *
 * `type`/`points`/`targetValue` (TEAM-BRIEF.md Sprint 8, Track A item 4) are
 * an ADDITIVE extension — every existing field/shape above is unchanged —
 * feeding the board's tile artwork + points UI. `targetValue` is nullable
 * (camelCase mirror of getActiveBingoBoard()'s `target_value`).
 *
 * `completedByMyTeam` (Sprint 13, Track A — broadened per the frozen
 * contract): auto-verified for my team (Kill Count/Experience, via
 * services/completionEngine.ts's team-summed hiscore math) OR an approved
 * Drops submission for my team — deduped by construction (see that
 * module's header comment). `pendingByMyTeam` (NEW, Sprint 13): true when a
 * still-PENDING submission has been tagged (PATCH .../tag — see
 * routes/admin.ts) with this tile + my team, so the board can render a
 * yellow "awaiting review" cue before an admin has approved/denied it.
 */
router.get(
  "/board",
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const bingo = await getActiveBingo();
    if (!bingo?.id || bingo.status !== "active") {
      return res.status(200).json({ active: false });
    }

    const db = getDb();

    // Anonymous callers (req.user undefined) skip the team lookup entirely
    // — myTeamId stays null, so myTeam is null and every tile comes back
    // completedByMyTeam/pendingByMyTeam: false below. Same
    // resolveMyBingoPlayer() lookup /my-team-data uses to discover their
    // team for authenticated callers — req.user is already the effective
    // (post-impersonation) caller.
    let myTeamId: string | null = null;
    if (req.user) {
      const myPlayer = await resolveMyBingoPlayer(bingo.id, req.user.id);
      myTeamId = myPlayer?.team_id ?? null;
    }

    const myTeam = myTeamId
      ? (bingo.teamObjects ?? []).find((t) => t.id === myTeamId) ?? null
      : null;

    // getActiveBingoBoard() always attaches each row's id (its Tile type
    // marks `id` optional only because the same type also describes tile
    // literals passed INTO saveActiveBingoBoard(), which never have one).
    const rawTiles = await getActiveBingoBoard();
    const tiles = rawTiles.map((tile) => ({
      id: tile.id!,
      task: tile.task,
      type: tile.type,
      points: tile.points,
      targetValue: tile.target_value ?? null,
    }));

    // Engine + pending lookups only ever run for the caller's own team —
    // never other teams' (contract 1). No team -> skip both entirely and
    // pass null through so every tile comes back
    // completedByMyTeam/pendingByMyTeam: false.
    let completedTileIdsForMyTeam: Set<string> | null = null;
    let pendingTileIdsForMyTeam: Set<string> | null = null;
    if (myTeamId) {
      const engineTiles: EngineTile[] = tiles.map((t) => ({
        id: t.id,
        task: t.task,
        type: t.type,
        points: t.points,
        targetValue: t.targetValue,
      }));
      const allTeamIds = (bingo.teamObjects ?? []).map((t) => t.id);

      const [{ completedTileIdsByTeam }, pendingSubsRes] = await Promise.all([
        computeBingoCompletion(bingo.id, engineTiles, allTeamIds),
        db
          .from("bingo_submissions")
          .select("tile_id")
          .eq("bingo_id", bingo.id)
          .eq("team_id", myTeamId)
          .eq("status", "pending")
          .not("tile_id", "is", null),
      ]);
      if (pendingSubsRes.error) throw new Error(pendingSubsRes.error.message);

      completedTileIdsForMyTeam = completedTileIdsByTeam.get(myTeamId) ?? new Set();
      pendingTileIdsForMyTeam = new Set(
        (pendingSubsRes.data ?? [])
          .map((s: { tile_id: string | null }) => s.tile_id)
          .filter((id: string | null): id is string => id !== null),
      );
    }

    res.status(200).json({
      active: true,
      bingo: { id: bingo.id, name: bingo.name, boardSize: bingo.boardSize },
      myTeam: myTeam ? { id: myTeam.id, name: myTeam.name } : null,
      tiles: buildBoardTileCompletion(tiles, completedTileIdsForMyTeam, pendingTileIdsForMyTeam),
    });
  }),
);

// All other bingo routes require a logged-in user (any role)
router.use(protect);

/**
 * GET /api/bingo/team-data
 *
 * Returns progress data for the active bingo, filtered to only the skills
 * and activities that correspond to tiles on the bingo board. This avoids
 * leaking irrelevant stat changes and keeps the response focused.
 *
 * Each player row contains the delta between their start and current
 * snapshots (XP gained, KC gained per activity).
 *
 * Deliberately does NOT expose which specific tiles a team is targeting,
 * keeping team tactics private.
 */
router.get(
  "/team-data",
  asyncHandler(async (req: Request, res: Response) => {
    const bingo = await getActiveBingo();

    if (!bingo?.id) {
      return res.status(404).json({ success: false, error: "No active bingo found" });
    }

    // Load the board tiles so we can restrict tracked stats to bingo-relevant ones
    const tiles = await getActiveBingoBoard();
    // Derive tracked skill names (Experience tiles) and activity names (Kill Count tiles)
    const trackedSkills = new Set<string>();
    const trackedActivities = new Set<string>();
    for (const tile of tiles) {
      if (tile.type === "Experience") trackedSkills.add(tile.task.toLowerCase());
      if (tile.type === "Kill Count") trackedActivities.add(tile.task.toLowerCase());
    }
    // If the board is empty (not yet built), fall back to showing everything
    const filterSkills = trackedSkills.size > 0;
    const filterActivities = trackedActivities.size > 0;

    const rows = await getAllPlayerSnapshots(bingo.id);

    // Build teamId -> name lookup
    const teamNameById: Record<string, string> = {};
    for (const t of bingo.teamObjects ?? []) {
      teamNameById[t.id] = t.name;
    }

    const playerData = rows.map(({ player, start, current }) => {
      // Skill XP deltas — only for skills referenced by an Experience tile.
      // Keyed by normalizeTaskText(curr.name) (D1 fix, TEAM-BRIEF.md Sprint
      // 14) — see the /my-team-data block below for the full rationale;
      // this roster block carries the identical bug/fix.
      const skillDeltas: Record<string, number> = {};
      if (start?.skills && current?.skills) {
        for (const curr of current.skills as Array<{ id: number; name: string; xp: number }>) {
          if (filterSkills && !trackedSkills.has(curr.name.toLowerCase())) continue;
          const startSkill = (start.skills as typeof curr[]).find((s) => s.id === curr.id);
          const delta = curr.xp - (startSkill?.xp ?? curr.xp);
          if (delta > 0) skillDeltas[normalizeTaskText(curr.name)] = delta;
        }
      }

      // Activity KC deltas — only for activities referenced by a Kill Count tile
      const activityDeltas: Record<string, number> = {};
      if (start?.activities && current?.activities) {
        for (const curr of current.activities as Array<{ id: number; name: string; kc: number }>) {
          if (filterActivities && !trackedActivities.has(curr.name.toLowerCase())) continue;
          const startAct = (start.activities as typeof curr[]).find((a) => a.id === curr.id);
          const delta = curr.kc - (startAct?.kc ?? curr.kc);
          if (delta > 0) activityDeltas[normalizeTaskText(curr.name)] = delta;
        }
      }

      const teamId = player.team_id;
      const teamName = teamId ? (teamNameById[teamId] ?? "Unassigned") : "Unassigned";

      return {
        rsn: player.rsn,
        teamId,
        teamName,
        isCaptain: !!player.captain_team_id,
        snapshotTakenAt: current?.taken_at ?? null,
        skillDeltas,
        activityDeltas,
      };
    });

    // Group players by team
    const teamMap: Record<
      string,
      { teamId: string | null; teamName: string; players: typeof playerData }
    > = {};
    for (const p of playerData) {
      const key = p.teamId ?? "unassigned";
      if (!teamMap[key]) {
        teamMap[key] = { teamId: p.teamId, teamName: p.teamName, players: [] };
      }
      teamMap[key].players.push(p);
    }

    const teams = Object.values(teamMap).sort((a, b) =>
      a.teamName.localeCompare(b.teamName),
    );

    const response: ApiResponse = {
      success: true,
      data: {
        bingoName: bingo.name,
        startDate: bingo.startDate,
        endDate: bingo.endDate,
        teams,
      },
    };

    res.status(200).json(response);
  }),
);


/**
 * GET /api/bingo/my-team-data
 *
 * Returns bingo progress for the current user's team only.
 * Shape:
 *   - players[]  — one row per player on the team
 *   - tiles[]    — ordered tile list (columns)
 *   - For KC/XP tiles: playerProgress[rsn][tileIndex] = numeric delta
 *   - For Drops tiles: playerDrops[rsn][tileIndex] = 'approved' | 'pending' | null
 *
 * The caller's own player row is resolved via resolveMyBingoPlayer()
 * (db/players.ts) — rsn_claims first, falling back to an unambiguous
 * registered_by match. See that function's doc comment for why a bare
 * registered_by lookup isn't reliable on its own (most players are
 * admin-registered via the Team Drafter, which sets registered_by to the
 * ADMIN, not the player).
 */
router.get(
  "/my-team-data",
  asyncHandler(async (req: Request, res: Response) => {
    const bingo = await getActiveBingo();
    if (!bingo?.id) {
      return res.status(404).json({ success: false, error: "No active bingo found" });
    }

    const db = getDb();
    const myPlayer = await resolveMyBingoPlayer(bingo.id, req.user!.id);
    const myTeamId = myPlayer?.team_id ?? null;

    // Load ordered board tiles
    const tiles = await getActiveBingoBoard();

    // Build skill/activity filter sets
    const trackedSkills = new Set<string>();
    const trackedActivities = new Set<string>();
    for (const tile of tiles) {
      if (tile.type === "Experience") trackedSkills.add(tile.task.toLowerCase());
      if (tile.type === "Kill Count") trackedActivities.add(tile.task.toLowerCase());
    }
    const filterSkills = trackedSkills.size > 0;
    const filterActivities = trackedActivities.size > 0;

    // Get all snapshots, filtered to this team
    const rows = await getAllPlayerSnapshots(bingo.id);
    const teamNameById: Record<string, string> = {};
    for (const t of bingo.teamObjects ?? []) teamNameById[t.id] = t.name;

    const teamRows = rows.filter(({ player }) =>
      myTeamId ? player.team_id === myTeamId : player.id === myPlayer?.id
    );

    // Build per-player skill/activity deltas. Keyed by
    // normalizeTaskText(curr.name) — e.g. hiscore-canonical "Hitpoints" ->
    // "hitpoints" (D1 fix, TEAM-BRIEF.md Sprint 14 — root cause of the
    // "board shows completed tiles, TeamData shows zero progress" report).
    // bingo_board_tiles.task is stored lowercase (see boardTilesSchema in
    // lib/validation.ts / the drafter UI), but this used to key deltas by
    // the RAW hiscore API name (real-cased: "Hitpoints", "Prayer", ...) —
    // every KC/XP TeamData cell missed on casing and rendered "no progress
    // yet" regardless of real gains. normalizeTaskText is the SAME
    // normalizer services/completionEngine.ts uses for its own tile/hiscore
    // vocabulary matching (buildHiscoreVocab) — one shared keying
    // convention end to end, producer (here) and consumer
    // (frontend/.../TeamData/helpers.ts's getTileCell, which now looks up
    // by normalizeTaskText(tile.task) instead of the raw tile.task).
    const playerData = teamRows.map(({ player, start, current }) => {
      const skillDeltas: Record<string, number> = {};
      if (start?.skills && current?.skills) {
        for (const curr of current.skills as Array<{ id: number; name: string; xp: number }>) {
          if (filterSkills && !trackedSkills.has(curr.name.toLowerCase())) continue;
          const startSkill = (start.skills as typeof curr[]).find((s) => s.id === curr.id);
          const delta = curr.xp - (startSkill?.xp ?? curr.xp);
          if (delta > 0) skillDeltas[normalizeTaskText(curr.name)] = delta;
        }
      }

      const activityDeltas: Record<string, number> = {};
      if (start?.activities && current?.activities) {
        for (const curr of current.activities as Array<{ id: number; name: string; kc: number }>) {
          if (filterActivities && !trackedActivities.has(curr.name.toLowerCase())) continue;
          const startAct = (start.activities as typeof curr[]).find((a) => a.id === curr.id);
          const delta = curr.kc - (startAct?.kc ?? curr.kc);
          if (delta > 0) activityDeltas[normalizeTaskText(curr.name)] = delta;
        }
      }

      return {
        rsn: player.rsn,
        playerId: player.id,
        teamId: player.team_id,
        teamName: player.team_id ? (teamNameById[player.team_id] ?? "Unassigned") : "Unassigned",
        isCaptain: !!player.captain_team_id,
        snapshotTakenAt: current?.taken_at ?? null,
        skillDeltas,
        activityDeltas,
      };
    });

    // Load Drop submissions for this team so we can show pending/approved per player+tile
    // We need tile IDs — fetch them directly so we have id+task
    const { data: tileRows, error: tileErr } = await db
      .from("bingo_board_tiles")
      .select("id, task, type, position")
      .eq("bingo_id", bingo.id)
      .order("position", { ascending: true });
    if (tileErr) throw new Error(tileErr.message);

    // Keyed by the tile's real-cased task (matches tileList's tile.task
    // below and buildDropStatusByRsn's output) — this used to lowercase the
    // key, which made dropStatus lookups miss on any task with uppercase
    // characters (nearly all of them: "Zulrah", "General Graardor", ...).
    // TeamData/helpers.ts carried a frontend lowercase-fallback workaround
    // for this; fixed at the source here, so that workaround is removed too
    // (Sprint 11 candidates list, todo.md ~line 132).
    const tileIdByTask = new Map<string, string>();
    for (const row of (tileRows ?? []) as Array<{ id: string; task: string; type: string; position: number }>) {
      if (row.type === "Drops") tileIdByTask.set(row.task, row.id);
    }

    // Build set of team player IDs for submission lookup
    const teamPlayerIds = teamRows.map(({ player }) => player.id);
    const teamPlayerIdToRsn = new Map(teamRows.map(({ player }) => [player.id, player.rsn]));

    // Fetch pending+approved submissions for this team on Drops tiles.
    // Attribution is via bingo_submissions.player_id (a bingo_players.id) —
    // NOT submitted_by, which is a users FK unrelated to team roster
    // membership (contract 5).
    let submissionsData: DropSubmissionAttribution[] = [];

    if (tileIdByTask.size > 0 && teamPlayerIds.length > 0) {
      const dropsTileIds = Array.from(tileIdByTask.values());
      const { data: subs, error: subsErr } = await db
        .from("bingo_submissions")
        .select("id, tile_id, player_id, status")
        .eq("bingo_id", bingo.id)
        .in("status", ["pending", "approved"])
        .in("tile_id", dropsTileIds);
      if (subsErr) throw new Error(subsErr.message);
      submissionsData = (subs ?? []) as DropSubmissionAttribution[];
    }

    const tileTaskById = new Map(Array.from(tileIdByTask.entries()).map(([task, id]) => [id, task]));
    const dropStatus = buildDropStatusByRsn(submissionsData, teamPlayerIdToRsn, tileTaskById);

    // Engine-driven completion/progress for this team (TEAM-BRIEF.md Sprint
    // 13, Track A item 2 — "no second implementation": the frontend used to
    // locally infer a Kill Count/Experience cell's completion from a single
    // PLAYER's own delta >= target, which is simply wrong under this
    // sprint's team-total semantics (contract 1) — a team can complete a
    // tile via combined effort with no single member individually hitting
    // the target. `completed`/`teamProgress` below are the authoritative
    // per-tile values from services/completionEngine.ts; Drops tiles get
    // `teamProgress: null` (progress isn't numeric for them — dropStatus
    // above already covers their state) and `completed` mirrors whether the
    // team has an approved submission for that tile. Computed over every
    // team in the bingo (engine requirement — see computeBingoCompletion's
    // doc comment on why vocab/matching needs the full player set), then
    // this team's slice is picked out; skipped entirely when the caller has
    // no team, matching every other team-scoped block on this route.
    // getActiveBingoBoard() always attaches each row's id (same guarantee
    // /board's handler above relies on).
    const engineTiles: EngineTile[] = tiles.map((t) => ({
      id: t.id!,
      task: t.task,
      type: t.type,
      points: t.points,
      targetValue: t.target_value ?? null,
    }));

    let completedTileIdsForMyTeam: Set<string> = new Set();
    let progressForMyTeam: Map<string, number> = new Map();
    if (myTeamId) {
      const allTeamIds = (bingo.teamObjects ?? []).map((t) => t.id);
      const { completedTileIdsByTeam, progressByTeamAndTile } = await computeBingoCompletion(
        bingo.id,
        engineTiles,
        allTeamIds,
      );
      completedTileIdsForMyTeam = completedTileIdsByTeam.get(myTeamId) ?? new Set();
      progressForMyTeam = progressByTeamAndTile.get(myTeamId) ?? new Map();
    }

    // Shape the tile list for the frontend
    const tileList = tiles.map((tile) => ({
      task: tile.task,
      type: tile.type as "Kill Count" | "Experience" | "Drops",
      points: tile.points,
      target: tile.target_value ?? null,
      completed: tile.id ? completedTileIdsForMyTeam.has(tile.id) : false,
      teamProgress: tile.type === "Drops" || !tile.id ? null : progressForMyTeam.get(tile.id) ?? 0,
    }));

    const teamName = myTeamId ? (teamNameById[myTeamId] ?? "Unassigned") : "Unassigned";

    res.status(200).json({
      success: true,
      data: {
        bingoName: bingo.name,
        startDate: bingo.startDate,
        endDate: bingo.endDate,
        teamId: myTeamId,
        teamName,
        tiles: tileList,
        players: playerData.map(({ skillDeltas, activityDeltas, ...rest }) => ({
          ...rest,
          skillDeltas,
          activityDeltas,
          dropStatus: dropStatus[rest.rsn] ?? {},
        })),
      },
    });
  }),
);

/**
 * GET /api/bingo/team-xp-history
 *
 * Feeds the BingoScores line chart (TEAM-BRIEF.md Sprint 6, Track A item
 * 3). Same auth level as the other bingo read endpoints on this router
 * (any logged-in role, via the router-level `protect` above — no extra
 * `authorize`). Frozen contract: a bare `{ teams: [...] }`, matching the
 * `/:bingoId/conflicts` bare-object convention below rather than the usual
 * ApiResponse envelope. Bucketing rules are documented in
 * src/db/teamXpHistory.ts.
 */
router.get(
  "/team-xp-history",
  asyncHandler(async (req: Request, res: Response) => {
    const bingo = await getActiveBingo();
    if (!bingo?.id) {
      return res.status(404).json({ success: false, error: "No active bingo found" });
    }

    const teams = await getTeamXpHistory(bingo.id, bingo.teamObjects ?? []);
    res.status(200).json({ teams });
  }),
);

/**
 * GET /api/bingo/:bingoId/conflicts
 *
 * Admin-only (replaces the removed `/bingo/conflicts` stub — see todo.md
 * and 20260711000000_hiscore_conflict_history.sql). Detects main + side
 * accounts of the same registered player both gaining XP in overlapping
 * snapshot windows — see the detection-rules comment block above
 * getBingoConflicts() in src/db/conflicts.ts.
 *
 * Response shape is the frozen TEAM-BRIEF.md contract exactly — a bare
 * `{ conflicts: [...] }`, not the usual ApiResponse `{success,data}`
 * envelope, matching Track A's dependency-health contract's same bare-
 * object style.
 */
router.get(
  "/:bingoId/conflicts",
  authorize("admin", "moderator"),
  asyncHandler(async (req: Request, res: Response) => {
    const bingoId = Array.isArray(req.params.bingoId) ? req.params.bingoId[0] : req.params.bingoId;
    if (!bingoId) {
      return res.status(400).json({ success: false, error: "Bingo ID is required" });
    }

    const db = getDb();
    const { data: bingo, error: bingoError } = await db
      .from("bingos")
      .select("id")
      .eq("id", bingoId)
      .maybeSingle();
    if (bingoError) throw new Error(`Failed to look up bingo: ${bingoError.message}`);
    if (!bingo) {
      return res.status(404).json({ success: false, error: "Bingo not found" });
    }

    const conflicts = await getBingoConflicts(bingoId);
    res.status(200).json({ conflicts });
  }),
);

export default router;
