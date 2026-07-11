import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { protect, authorize } from "../middleware/auth.js";
import { ApiResponse } from "../types/index.js";
import { getActiveBingo, getActiveBingoBoard } from "../db/bingos.js";
import { getAllPlayerSnapshots } from "../db/players.js";
import { buildDropStatusByRsn, DropSubmissionAttribution } from "../db/bingoSubmissions.js";
import { getBingoConflicts } from "../db/conflicts.js";
import { getDb } from "../db/client.js";

const router = Router();

// All bingo public routes require a logged-in user (any role)
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
      // Skill XP deltas — only for skills referenced by an Experience tile
      const skillDeltas: Record<string, number> = {};
      if (start?.skills && current?.skills) {
        for (const curr of current.skills as Array<{ id: number; name: string; xp: number }>) {
          if (filterSkills && !trackedSkills.has(curr.name.toLowerCase())) continue;
          const startSkill = (start.skills as typeof curr[]).find((s) => s.id === curr.id);
          const delta = curr.xp - (startSkill?.xp ?? curr.xp);
          if (delta > 0) skillDeltas[curr.name] = delta;
        }
      }

      // Activity KC deltas — only for activities referenced by a Kill Count tile
      const activityDeltas: Record<string, number> = {};
      if (start?.activities && current?.activities) {
        for (const curr of current.activities as Array<{ id: number; name: string; kc: number }>) {
          if (filterActivities && !trackedActivities.has(curr.name.toLowerCase())) continue;
          const startAct = (start.activities as typeof curr[]).find((a) => a.id === curr.id);
          const delta = curr.kc - (startAct?.kc ?? curr.kc);
          if (delta > 0) activityDeltas[curr.name] = delta;
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
 * Players are matched by registered_by = req.user.id.
 */
router.get(
  "/my-team-data",
  asyncHandler(async (req: Request, res: Response) => {
    const bingo = await getActiveBingo();
    if (!bingo?.id) {
      return res.status(404).json({ success: false, error: "No active bingo found" });
    }

    // Find the player record registered by this user to discover their team
    const db = getDb();
    const { data: myPlayers, error: mpErr } = await db
      .from("bingo_players")
      .select("*")
      .eq("bingo_id", bingo.id)
      .eq("registered_by", req.user!.id)
      .limit(1);
    if (mpErr) throw new Error(mpErr.message);

    const myPlayer = myPlayers?.[0] ?? null;
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

    // Build per-player skill/activity deltas
    const playerData = teamRows.map(({ player, start, current }) => {
      const skillDeltas: Record<string, number> = {};
      if (start?.skills && current?.skills) {
        for (const curr of current.skills as Array<{ id: number; name: string; xp: number }>) {
          if (filterSkills && !trackedSkills.has(curr.name.toLowerCase())) continue;
          const startSkill = (start.skills as typeof curr[]).find((s) => s.id === curr.id);
          const delta = curr.xp - (startSkill?.xp ?? curr.xp);
          if (delta > 0) skillDeltas[curr.name] = delta;
        }
      }

      const activityDeltas: Record<string, number> = {};
      if (start?.activities && current?.activities) {
        for (const curr of current.activities as Array<{ id: number; name: string; kc: number }>) {
          if (filterActivities && !trackedActivities.has(curr.name.toLowerCase())) continue;
          const startAct = (start.activities as typeof curr[]).find((a) => a.id === curr.id);
          const delta = curr.kc - (startAct?.kc ?? curr.kc);
          if (delta > 0) activityDeltas[curr.name] = delta;
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

    const tileIdByTask = new Map<string, string>();
    for (const row of (tileRows ?? []) as Array<{ id: string; task: string; type: string; position: number }>) {
      if (row.type === "Drops") tileIdByTask.set(row.task.toLowerCase(), row.id);
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

    // Shape the tile list for the frontend
    const tileList = tiles.map((tile) => ({
      task: tile.task,
      type: tile.type as "Kill Count" | "Experience" | "Drops",
      points: tile.points,
      target:
        tile.type === "Kill Count" ? ((tile as any).killCount ?? null)
        : tile.type === "Experience" ? ((tile as any).experience ?? null)
        : null,
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
