import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { protect } from "../middleware/auth.js";
import { ApiResponse } from "../types/index.js";
import { getActiveBingo } from "../db/bingos.js";
import { getAllPlayerSnapshots } from "../db/players.js";

const router = Router();

// All bingo public routes require a logged-in user (any role)
router.use(protect);

/**
 * GET /api/bingo/team-data
 *
 * Returns progress data for every team in the active bingo.
 * Each player row contains the delta between their start and current
 * snapshots (XP gained, KC gained per activity) so the stats page can
 * show meaningful progress without exposing raw hiscore numbers.
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

    const rows = await getAllPlayerSnapshots(bingo.id);

    // Build teamId -> name lookup
    const teamNameById: Record<string, string> = {};
    for (const t of bingo.teamObjects ?? []) {
      teamNameById[t.id] = t.name;
    }

    const playerData = rows.map(({ player, start, current }) => {
      // Skill XP deltas (current xp - start xp)
      const skillDeltas: Record<string, number> = {};
      if (start?.skills && current?.skills) {
        for (const curr of current.skills as Array<{ id: number; name: string; xp: number }>) {
          const startSkill = (start.skills as typeof curr[]).find((s) => s.id === curr.id);
          const delta = curr.xp - (startSkill?.xp ?? curr.xp);
          if (delta > 0) skillDeltas[curr.name] = delta;
        }
      }

      // Activity KC deltas (current kc - start kc)
      const activityDeltas: Record<string, number> = {};
      if (start?.activities && current?.activities) {
        for (const curr of current.activities as Array<{ id: number; name: string; kc: number }>) {
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

export default router;
