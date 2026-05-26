import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { protect, authorize } from "../middleware/auth.js";
import { ApiResponse, BingoConfig } from "../types/index.js";
import {
  getActiveBingo,
  getActiveBingoBoard,
  listBingos,
  saveActiveBingoBoard,
  saveBingoDetails,
  updateBingo,
} from "../db/bingos.js";
import { refreshStaticData } from "../services/staticDataCron.js";
import {
  registerBingoPlayer,
  getBingoPlayers,
  getBingoPlayer,
  removeBingoPlayer,
  savePlayerSnapshot,
  getPlayerSnapshots,
  getAllPlayerSnapshots,
} from "../db/players.js";
import { hiscores } from "../services/hiscores.js";

const router = Router();

router.use(protect);
router.use(authorize("admin", "moderator"));

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
      data: await saveBingoDetails({ name, start, end, size, teams, createdBy: req.user?.id }),
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
  asyncHandler(async (req: Request, res: Response) => {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ success: false, error: "Board must be an array of tiles" });
    }

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
  asyncHandler(async (req: Request, res: Response) => {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ success: false, error: "Board must be an array of tiles" });
    }

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
// /bingo/:id — must be after all /bingo/* static routes
// -------------------------------------------------------

router.put(
  "/bingo/:id",
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

    const data = await getAllPlayerSnapshots(bingo.id);
    res.status(200).json({ success: true, data });
  }),
);

// Register a player to the active bingo and take their start snapshot
router.post(
  "/bingo/players",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const { rsn, teamId } = req.body as { rsn?: string; teamId?: string };
    if (!rsn) return res.status(400).json({ success: false, error: "RSN is required" });

    const bingo = await getActiveBingo();
    if (!bingo?.id) return res.status(404).json({ success: false, error: "No active bingo found" });

    // Register the player
    const player = await registerBingoPlayer(bingo.id, rsn, teamId, req.user?.id);

    // Fetch hiscores and save start snapshot (ignored if already exists)
    const hiscoreData = await hiscores(rsn);
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
  asyncHandler(async (req: Request, res: Response) => {
    const rsn = Array.isArray(req.params.rsn) ? req.params.rsn[0] : req.params.rsn;
    const bingo = await getActiveBingo();
    if (!bingo?.id) return res.status(404).json({ success: false, error: "No active bingo found" });

    const player = await getBingoPlayer(bingo.id, rsn);
    if (!player) return res.status(404).json({ success: false, error: `Player "${rsn}" not found` });

    const hiscoreData = await hiscores(rsn);
    const snapshot = await savePlayerSnapshot(player.id, "current", hiscoreData);
    res.status(200).json({ success: true, data: snapshot });
  }),
);

// Refresh current snapshots for ALL players in the active bingo
router.put(
  "/bingo/players/refresh/all",
  asyncHandler(async (req: Request, res: Response) => {
    const bingo = await getActiveBingo();
    if (!bingo?.id) return res.status(404).json({ success: false, error: "No active bingo found" });

    const players = await getBingoPlayers(bingo.id);
    if (!players.length) return res.status(200).json({ success: true, data: [], message: "No players to refresh" });

    const results = await Promise.allSettled(
      players.map(async (player) => {
        const hiscoreData = await hiscores(player.rsn);
        return savePlayerSnapshot(player.id, "current", hiscoreData);
      }),
    );

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

export default router;
