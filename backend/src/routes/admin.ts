import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { LOCAL_DEV_USER_ID, protect, authorize } from "../middleware/auth.js";
import { ApiResponse, BingoConfig } from "../types/index.js";
import {
  validateBody,
  bingoDetailsSchema,
  bingoUpdateSchema,
  boardTilesSchema,
  draftAssignmentsSchema,
  playerRegistrationSchema,
  sideAccountSchema,
  screenshotApprovalSchema,
} from "../lib/validation.js";
import { mapWithConcurrency } from "../lib/concurrency.js";
import {
  getActiveBingo,
  getBingoById,
  getActiveBingoBoard,
  listBingos,
  saveActiveBingoBoard,
  saveBingoDetails,
  updateBingo,
} from "../db/bingos.js";
import { refreshStaticData } from "../services/staticDataCron.js";
import { refreshAllPlayerSnapshots } from "../services/playerSnapshotCron.js";
import {
  activateBingoWithSnapshots,
  snapshotStartAndCurrent,
  HISCORE_CONCURRENCY,
  PlayerSnapshotResult,
} from "../services/bingoActivation.js";
import type { SideSnapshotResult } from "../services/sideAccountSnapshots.js";
import {
  registerBingoPlayer,
  getBingoPlayers,
  getBingoPlayer,
  removeBingoPlayer,
  savePlayerSnapshot,
  getPlayerSnapshots,
  getAllPlayerSnapshots,
  updatePlayerTeam,
  updatePlayerCaptain,
  resetPlayerTeams,
  getSideAccounts,
  getAllSideAccounts,
  addSideAccount,
  removeSideAccount,
} from "../db/players.js";
import { hiscores } from "../services/hiscores.js";
import { checkRsnChange } from "../services/rsnChangeDetection.js";
import {
  getPendingSubmissions,
  getSubmissionById,
  approveSubmission,
  denySubmission,
  getSignedScreenshotUrl,
  validateApprovalPlayerId,
} from "../db/bingoSubmissions.js";
import { getPlayerStats, PlayerStat } from "../db/playerStats.js";
import { reactToSubmissionMessage } from "../services/discordScreenshots.js";
import { getDependencyHealth } from "../services/dependencyHealth.js";

const router = Router();

router.use(protect);
router.use(authorize("admin", "moderator"));

const getAuditUserId = (req: Request): string | undefined =>
  req.user?.id === LOCAL_DEV_USER_ID ? undefined : req.user?.id;

// List all bingos
router.get(
  "/bingo",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const response: ApiResponse<BingoConfig[]> = {
      success: true,
      data: await listBingos(),
    };
    res.status(200).json(response);
  }),
);

// -------------------------------------------------------
// /bingo/details — must be before /bingo/:id
// -------------------------------------------------------

router.post(
  "/bingo/details",
  authorize("admin"),
  validateBody(bingoDetailsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, start, end, size, teams } = req.body as {
      name?: string;
      start?: string;
      end?: string;
      size?: number;
      teams?: string[];
    };

    if (!name) {
      return res.status(400).json({ success: false, error: "Bingo name is required" });
    }

    const response: ApiResponse<BingoConfig> = {
      success: true,
      data: await saveBingoDetails({ name, start, end, size, teams, createdBy: getAuditUserId(req) }),
      message: "Bingo details saved successfully",
    };

    res.status(201).json(response);
  }),
);

router.get(
  "/bingo/details",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const response: ApiResponse<BingoConfig | null> = {
      success: true,
      data: await getActiveBingo(),
    };
    res.status(200).json(response);
  }),
);

// -------------------------------------------------------
// /bingo/board — must be before /bingo/:id
// -------------------------------------------------------

router.post(
  "/bingo/board",
  authorize("admin"),
  validateBody(boardTilesSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const response: ApiResponse = {
      success: true,
      data: await saveActiveBingoBoard(req.body),
      message: "Bingo board saved successfully",
    };

    res.status(201).json(response);
  }),
);

router.put(
  "/bingo/board",
  authorize("admin"),
  validateBody(boardTilesSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const response: ApiResponse = {
      success: true,
      data: await saveActiveBingoBoard(req.body),
      message: "Bingo board updated successfully",
    };

    res.status(200).json(response);
  }),
);

router.get(
  "/bingo/board",
  asyncHandler(async (req: Request, res: Response) => {
    const response: ApiResponse = {
      success: true,
      data: await getActiveBingoBoard(),
    };
    res.status(200).json(response);
  }),
);

// -------------------------------------------------------
// /bingo/activate — snapshot all players then set status active
// Must be before /bingo/:id to avoid wildcard match
// -------------------------------------------------------

router.post(
  "/bingo/activate",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const bingo = await getActiveBingo();
    if (!bingo?.id) {
      return res.status(404).json({ success: false, error: "No active bingo found" });
    }

    if (bingo.status === "active") {
      return res.status(409).json({ success: false, error: "Bingo is already active" });
    }

    // Fetch all registered players
    const players = await getBingoPlayers(bingo.id);
    if (!players.length) {
      return res.status(400).json({ success: false, error: "No players registered to this bingo" });
    }

    // Activation semantics (TEAM-BRIEF.md Track A item 2): activation fails
    // with a clear error listing the players whose start snapshots failed,
    // unless the request explicitly passes { force: true }.
    const { force } = req.body as { force?: unknown };
    if (force !== undefined && typeof force !== "boolean") {
      return res.status(400).json({ success: false, error: "'force' must be a boolean" });
    }

    // Take start + current snapshots (concurrency-capped), then atomically
    // flip draft -> active via the activate_bingo RPC. `activated` is false
    // if another request won the activation race in the meantime, or if
    // activation was withheld because snapshots failed (see `blocked`).
    const { activated, blocked, succeeded, failed } = await activateBingoWithSnapshots(bingo.id, {
      force: force === true,
      source: "drafter",
    });

    if (blocked) {
      return res.status(422).json({
        success: false,
        error:
          `Activation blocked: start snapshot failed for ${failed.length} player${failed.length !== 1 ? "s" : ""}: ` +
          `${failed.join("; ")}. Fix the RSN(s) and retry, or pass { "force": true } to activate anyway.`,
        data: { succeeded, failed },
      });
    }

    if (!activated) {
      return res.status(409).json({ success: false, error: "Bingo is already active" });
    }

    const updatedBingo = (await getActiveBingo()) ?? bingo;

    const response: ApiResponse<BingoConfig> = {
      success: true,
      data: updatedBingo,
      message: `Bingo activated. Snapshots saved for ${succeeded} player${succeeded !== 1 ? "s" : ""}${
        failed.length ? `; ${failed.length} failed: ${failed.join(", ")}` : ""
      }.`,
    };

    res.status(200).json(response);
  }),
);

// -------------------------------------------------------
// /bingo/:bingoId/retake-start-snapshots — retry start snapshots for any
// player on an active bingo who is missing one (e.g. from a forced or
// cron-driven activation that had failures). Idempotent: players who
// already have a start snapshot are skipped, and re-running after a full
// success is a no-op. Must be before /bingo/:id to avoid the PUT wildcard
// (different HTTP method anyway, but kept alongside the other /bingo/:id-ish
// routes for readability).
// -------------------------------------------------------

router.post(
  "/bingo/:bingoId/retake-start-snapshots",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const bingoId = Array.isArray(req.params.bingoId) ? req.params.bingoId[0] : req.params.bingoId;
    if (!bingoId) return res.status(400).json({ success: false, error: "Bingo ID is required" });

    const bingo = await getBingoById(bingoId);
    if (!bingo) return res.status(404).json({ success: false, error: "Bingo not found" });
    if (bingo.status !== "active") {
      return res.status(409).json({
        success: false,
        error: `Bingo must be active to retake start snapshots (current status: ${bingo.status})`,
      });
    }

    const rows = await getAllPlayerSnapshots(bingoId);
    const missing = rows.filter((row) => row.start === null).map((row) => row.player);

    if (!missing.length) {
      const response: ApiResponse<{ results: PlayerSnapshotResult[]; sideResults: SideSnapshotResult[] }> = {
        success: true,
        data: { results: [], sideResults: [] },
        message: "No players are missing a start snapshot.",
      };
      return res.status(200).json(response);
    }

    // Reuses the same snapshot-taking logic activation uses, scoped to just
    // the missing players — RSN-change detection (checkRsnChange) runs
    // inside it too. Re-running this on players who already succeeded is a
    // no-op thanks to savePlayerSnapshot's "start" upsert-if-absent. Also
    // retakes those players' side accounts (best-effort — never affects
    // `succeeded`/`failed` below, which are main-account only).
    const { succeeded, failed, results, sideResults } = await snapshotStartAndCurrent(missing, "drafter");
    const sideFailed = sideResults.filter((r) => !r.ok);

    const response: ApiResponse<{ results: PlayerSnapshotResult[]; sideResults: SideSnapshotResult[] }> = {
      success: true,
      data: { results, sideResults },
      message: `Retook start snapshots for ${succeeded} of ${missing.length} missing player${
        missing.length !== 1 ? "s" : ""
      }${failed.length ? `; ${failed.length} still failing` : ""}${
        sideResults.length
          ? `; ${sideResults.length - sideFailed.length}/${sideResults.length} side account(s) succeeded`
          : ""
      }.`,
    };

    res.status(200).json(response);
  }),
);

// -------------------------------------------------------
// /bingo/:id — must be after all /bingo/* static routes
// -------------------------------------------------------

router.put(
  "/bingo/:id",
  authorize("admin"),
  validateBody(bingoUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id) {
      return res.status(400).json({ success: false, error: "Bingo ID is required" });
    }

    const { name, description, status, startDate, endDate, boardSize, teams } =
      req.body as Partial<BingoConfig>;

    const response: ApiResponse<BingoConfig> = {
      success: true,
      data: await updateBingo(id, {
        name,
        description,
        status,
        start: startDate,
        end: endDate,
        size: boardSize,
        teams,
      }),
      message: "Bingo updated successfully",
    };

    res.status(200).json(response);
  }),
);

// -------------------------------------------------------
// Players
// -------------------------------------------------------

// Get all players + snapshots for the active bingo
router.get(
  "/bingo/players",
  asyncHandler(async (req: Request, res: Response) => {
    const bingo = await getActiveBingo();
    if (!bingo?.id) return res.status(404).json({ success: false, error: "No active bingo found" });

    const [rows, sideAccountsByPlayer] = await Promise.all([
      getAllPlayerSnapshots(bingo.id),
      getAllSideAccounts(bingo.id),
    ]);
    const data = rows.map((row) => ({
      ...row,
      sideAccounts: sideAccountsByPlayer[row.player.id] ?? [],
    }));
    res.status(200).json({ success: true, data });
  }),
);

// Register a player to the active bingo and take their start snapshot
router.post(
  "/bingo/players",
  authorize("admin"),
  validateBody(playerRegistrationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { rsn, teamId } = req.body as { rsn: string; teamId?: string };

    const bingo = await getActiveBingo();
    if (!bingo?.id) return res.status(404).json({ success: false, error: "No active bingo found" });

    // Register the player
    const player = await registerBingoPlayer(bingo.id, rsn, teamId, getAuditUserId(req));

    // Fetch hiscores and save start snapshot (ignored if already exists)
    const hiscoreData = await hiscores(rsn);
    if (!hiscoreData) {
      // Still register the player but skip the snapshot — they can be refreshed later
      console.warn(`[admin] Player "${rsn}" not on hiscores at registration time — snapshot skipped.`);
      return res.status(201).json({
        success: true,
        data: { player, startSnapshot: null },
        message: `Player "${rsn}" registered but has no hiscore data yet. Ensure the RSN is correct and the account is ranked.`,
      });
    }
    const snapshot = await savePlayerSnapshot(player.id, "start", hiscoreData);
    // Also set current to match start on first registration
    await savePlayerSnapshot(player.id, "current", hiscoreData);

    res.status(201).json({ success: true, data: { player, startSnapshot: snapshot } });
  }),
);

// Remove a player from the active bingo
router.delete(
  "/bingo/players/:rsn",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const rsn = Array.isArray(req.params.rsn) ? req.params.rsn[0] : req.params.rsn;
    const bingo = await getActiveBingo();
    if (!bingo?.id) return res.status(404).json({ success: false, error: "No active bingo found" });

    await removeBingoPlayer(bingo.id, rsn);
    res.status(200).json({ success: true, message: `Player "${rsn}" removed` });
  }),
);

// Get snapshots for a specific player
router.get(
  "/bingo/players/:rsn",
  asyncHandler(async (req: Request, res: Response) => {
    const rsn = Array.isArray(req.params.rsn) ? req.params.rsn[0] : req.params.rsn;
    const bingo = await getActiveBingo();
    if (!bingo?.id) return res.status(404).json({ success: false, error: "No active bingo found" });

    const player = await getBingoPlayer(bingo.id, rsn);
    if (!player) return res.status(404).json({ success: false, error: `Player "${rsn}" not found` });

    const snapshots = await getPlayerSnapshots(player.id);
    res.status(200).json({ success: true, data: { player, ...snapshots } });
  }),
);

// Refresh the current snapshot for a specific player from the OSRS API
router.put(
  "/bingo/players/:rsn/refresh",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const rsn = Array.isArray(req.params.rsn) ? req.params.rsn[0] : req.params.rsn;
    const bingo = await getActiveBingo();
    if (!bingo?.id) return res.status(404).json({ success: false, error: "No active bingo found" });

    const player = await getBingoPlayer(bingo.id, rsn);
    if (!player) return res.status(404).json({ success: false, error: `Player "${rsn}" not found` });

    const hiscoreData = await hiscores(rsn);
    // RSN-change detection (TEAM-BRIEF.md Track A item 1) — this player is
    // already registered, so a 404 here means their on-file RSN went stale,
    // not that it was never validated.
    await checkRsnChange(player, Boolean(hiscoreData), "drafter");
    if (!hiscoreData) {
      return res.status(404).json({
        success: false,
        error: `Player "${rsn}" is not ranked on the OSRS hiscores. The RSN may be incorrect or the account may be too new/inactive to appear.`,
      });
    }
    const snapshot = await savePlayerSnapshot(player.id, "current", hiscoreData);
    res.status(200).json({ success: true, data: snapshot });
  }),
);

// Refresh current snapshots for ALL players in the active bingo
router.put(
  "/bingo/players/refresh/all",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const bingo = await getActiveBingo();
    if (!bingo?.id) return res.status(404).json({ success: false, error: "No active bingo found" });

    const players = await getBingoPlayers(bingo.id);
    if (!players.length) return res.status(200).json({ success: true, data: [], message: "No players to refresh" });

    const results = await mapWithConcurrency(players, HISCORE_CONCURRENCY, async (player) => {
      const hiscoreData = await hiscores(player.rsn);
      // RSN-change detection (TEAM-BRIEF.md Track A item 1) — same rule as
      // the single-player refresh route above.
      await checkRsnChange(player, Boolean(hiscoreData), "drafter");
      if (!hiscoreData) {
        throw new Error(`Player "${player.rsn}" is not ranked on the OSRS hiscores`);
      }
      return savePlayerSnapshot(player.id, "current", hiscoreData);
    });

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    res.status(200).json({
      success: true,
      message: `Refreshed ${succeeded} players${failed ? `, ${failed} failed` : ""}.`,
      data: { succeeded, failed },
    });
  }),
);

// -------------------------------------------------------
// Team draft — assign players to teams and reset
// -------------------------------------------------------

// Set or clear team captain (one captain per team)
router.patch(
  "/bingo/players/:rsn/captain",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const rsn = Array.isArray(req.params.rsn) ? req.params.rsn[0] : req.params.rsn;
    const { captainTeamId } = req.body as { captainTeamId?: string | null };

    const bingo = await getActiveBingo();
    if (!bingo?.id) return res.status(404).json({ success: false, error: "No active bingo found" });

    const player = await updatePlayerCaptain(bingo.id, rsn, captainTeamId ?? null);
    res.status(200).json({ success: true, data: player });
  }),
);

// Assign a player to a team (or unassign by passing teamId: null)
router.patch(
  "/bingo/players/:rsn/team",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const rsn = Array.isArray(req.params.rsn) ? req.params.rsn[0] : req.params.rsn;
    const { teamId } = req.body as { teamId: string | null };

    const bingo = await getActiveBingo();
    if (!bingo?.id) return res.status(404).json({ success: false, error: "No active bingo found" });

    const player = await updatePlayerTeam(bingo.id, rsn, teamId ?? null);
    res.status(200).json({ success: true, data: player });
  }),
);

// Submit the full draft: body is an array of { rsn, teamId } assignments
router.post(
  "/bingo/draft",
  authorize("admin"),
  validateBody(draftAssignmentsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const assignments = req.body as Array<{ rsn: string; teamId: string | null }>;

    const bingo = await getActiveBingo();
    if (!bingo?.id) return res.status(404).json({ success: false, error: "No active bingo found" });

    const results = await Promise.allSettled(
      assignments.map(({ rsn, teamId }) => updatePlayerTeam(bingo.id!, rsn, teamId ?? null)),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results
      .filter((r) => r.status === "rejected")
      .map((r) => (r as PromiseRejectedResult).reason?.message ?? "Unknown error");

    res.status(200).json({
      success: true,
      message: `Assigned ${succeeded} players${failed.length ? `, ${failed.length} failed` : ""}.`,
      data: { succeeded, failed },
    });
  }),
);

// Reset all team assignments for the active bingo
router.delete(
  "/bingo/draft",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const bingo = await getActiveBingo();
    if (!bingo?.id) return res.status(404).json({ success: false, error: "No active bingo found" });

    await resetPlayerTeams(bingo.id);
    res.status(200).json({ success: true, message: "All team assignments have been reset" });
  }),
);

// -------------------------------------------------------
// Side accounts
// -------------------------------------------------------

// Get side accounts for a player
router.get(
  "/bingo/players/:rsn/side-accounts",
  asyncHandler(async (req: Request, res: Response) => {
    const rsn = Array.isArray(req.params.rsn) ? req.params.rsn[0] : req.params.rsn;
    const bingo = await getActiveBingo();
    if (!bingo?.id) return res.status(404).json({ success: false, error: "No active bingo found" });

    const player = await getBingoPlayer(bingo.id, rsn);
    if (!player) return res.status(404).json({ success: false, error: `Player "${rsn}" not found` });

    const sideAccounts = await getSideAccounts(player.id);
    res.status(200).json({ success: true, data: sideAccounts });
  }),
);

// Add a side account to a player
router.post(
  "/bingo/players/:rsn/side-accounts",
  authorize("admin"),
  validateBody(sideAccountSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const rsn = Array.isArray(req.params.rsn) ? req.params.rsn[0] : req.params.rsn;
    const { rsn: sideRsn, notes } = req.body as { rsn: string; notes?: string };

    const bingo = await getActiveBingo();
    if (!bingo?.id) return res.status(404).json({ success: false, error: "No active bingo found" });

    const player = await getBingoPlayer(bingo.id, rsn);
    if (!player) return res.status(404).json({ success: false, error: `Player "${rsn}" not found` });

    const sideAccount = await addSideAccount(player.id, sideRsn, notes, getAuditUserId(req));
    res.status(201).json({ success: true, data: sideAccount });
  }),
);

// Remove a side account by ID
router.delete(
  "/bingo/players/:rsn/side-accounts/:sideAccountId",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const sideAccountId = Array.isArray(req.params.sideAccountId)
      ? req.params.sideAccountId[0]
      : req.params.sideAccountId;

    await removeSideAccount(sideAccountId);
    res.status(200).json({ success: true, message: "Side account removed" });
  }),
);

// -------------------------------------------------------
// Screenshot submissions (Discord ingest review queue)
// -------------------------------------------------------

// List pending screenshot submissions for the active bingo, each with a
// short-lived signed URL to the stored image.
router.get(
  "/bingo/screenshots/pending",
  asyncHandler(async (req: Request, res: Response) => {
    const bingo = await getActiveBingo();
    if (!bingo?.id) return res.status(404).json({ success: false, error: "No active bingo found" });

    const submissions = await getPendingSubmissions(bingo.id);
    const data = await Promise.all(
      submissions.map(async (submission) => ({
        id: submission.id,
        discordMessageId: submission.discord_message_id,
        notes: submission.notes,
        submittedBy:
          submission.notes?.match(/Submitted via Discord by (.+?) \(/)?.[1] ?? "Discord",
        submittedAt: submission.created_at,
        imageUrl: submission.image_path ? await getSignedScreenshotUrl(submission.image_path) : null,
      })),
    );

    res.status(200).json({ success: true, data });
  }),
);

// Approve a pending submission — admin assigns the tile + team it counts for.
router.post(
  "/bingo/screenshots/:id/approve",
  validateBody(screenshotApprovalSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) return res.status(400).json({ success: false, error: "Submission ID is required" });

    const { tileId, teamId, playerId } = req.body as {
      tileId: string;
      teamId: string;
      playerId?: string;
    };

    const submission = await getSubmissionById(id);
    if (!submission) return res.status(404).json({ success: false, error: "Submission not found" });
    if (submission.status !== "pending") {
      return res
        .status(409)
        .json({ success: false, error: `Submission has already been ${submission.status}` });
    }

    // playerId is optional, but per contract 2 must resolve to a
    // bingo_players.id on `teamId` within the submission's bingo when present.
    if (playerId !== undefined) {
      const rosterPlayers = await getBingoPlayers(submission.bingo_id);
      const validationError = validateApprovalPlayerId(playerId, teamId, rosterPlayers);
      if (validationError) {
        return res.status(400).json({ success: false, error: validationError });
      }
    }

    const updated = await approveSubmission(id, {
      tileId,
      teamId,
      playerId,
      reviewedBy: getAuditUserId(req),
    });

    if (updated.discord_message_id) {
      // Best-effort — a failed Discord reaction must not fail the review.
      reactToSubmissionMessage(updated.discord_message_id, "\u{1F44D}").catch((e) =>
        console.warn(`[admin] Failed to react to Discord message for submission ${id}:`, e),
      );
    }

    res.status(200).json({ success: true, data: updated, message: "Screenshot approved" });
  }),
);

// Deny a pending submission.
router.post(
  "/bingo/screenshots/:id/deny",
  asyncHandler(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) return res.status(400).json({ success: false, error: "Submission ID is required" });

    const submission = await getSubmissionById(id);
    if (!submission) return res.status(404).json({ success: false, error: "Submission not found" });
    if (submission.status !== "pending") {
      return res
        .status(409)
        .json({ success: false, error: `Submission has already been ${submission.status}` });
    }

    const updated = await denySubmission(id, { reviewedBy: getAuditUserId(req) });

    if (updated.discord_message_id) {
      // Best-effort — a failed Discord reaction must not fail the review.
      reactToSubmissionMessage(updated.discord_message_id, "\u{1F44E}").catch((e) =>
        console.warn(`[admin] Failed to react to Discord message for submission ${id}:`, e),
      );
    }

    res.status(200).json({ success: true, data: updated, message: "Screenshot denied" });
  }),
);

// -------------------------------------------------------
// Player stats (overview page) — contract 3
// -------------------------------------------------------

router.get(
  "/bingo/player-stats",
  asyncHandler(async (req: Request, res: Response) => {
    const bingo = await getActiveBingo();
    if (!bingo?.id) return res.status(404).json({ success: false, error: "No active bingo found" });

    const response: ApiResponse<PlayerStat[]> = {
      success: true,
      data: await getPlayerStats(bingo.id),
    };
    res.status(200).json(response);
  }),
);

// -------------------------------------------------------
// Manual snapshot refresh for all players
// -------------------------------------------------------

router.post(
  "/bingo/players/refresh/snapshots",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const { succeeded, failed } = await refreshAllPlayerSnapshots();

    const response: ApiResponse = {
      success: true,
      message: `Refreshed ${succeeded} player snapshot${succeeded !== 1 ? "s" : ""}${
        failed.length ? `; ${failed.length} failed: ${failed.join(", ")}` : ""
      }.`,
      data: { succeeded, failed },
    };

    res.status(200).json(response);
  }),
);

// -------------------------------------------------------
// Manually trigger a static data refresh (skills + activities)
router.post(
  "/static-data/refresh",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    // Run in background so the response returns immediately
    refreshStaticData().catch((e) =>
      console.error("[staticDataCron] Manual refresh error:", e)
    );
    res.status(202).json({
      success: true,
      message: "Static data refresh started. Skills and activities will be updated shortly.",
    });
  }),
);

// -------------------------------------------------------
// Dependency health (Track A item 4) — for the BingoOverview redesign's
// health section (Phase 2, not part of this sprint). Contract is frozen; see
// services/dependencyHealth.ts. Cached ~60s server-side so the UI can poll
// freely.
// -------------------------------------------------------

router.get(
  "/health/dependencies",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await getDependencyHealth();
    res.status(200).json(data);
  }),
);

export default router;
