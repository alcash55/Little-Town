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

const router = Router();

// Apply authentication to all admin routes
router.use(protect);
router.use(authorize("admin", "moderator"));

// Add new bingo
router.post(
  "/bingo",
  asyncHandler(async (req: Request, res: Response) => {
    const { name, description, startDate, endDate, teams, tasks } =
      req.body as Partial<BingoConfig>;

    if (!name) {
      return res
        .status(400)
        .json({ success: false, error: "Bingo name is required" });
    }

    const bingo = await saveBingoDetails({
      name,
      start: startDate,
      end: endDate,
      teams,
      createdBy: req.user?.id,
    });

    const response: ApiResponse<BingoConfig> = {
      success: true,
      data: { ...bingo, description, tasks: tasks ?? bingo.tasks },
      message: "Bingo created successfully",
    };

    res.status(201).json(response);
  }),
);

// Get the current bingo
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

// Update the current bingo
router.put(
  "/bingo/:id?",
  asyncHandler(async (req: Request, res: Response) => {
    const rawId = req.params.id ?? req.body?.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: "Bingo ID is required" });
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
// Add bingo details
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
      return res
        .status(400)
        .json({ success: false, error: "Bingo name is required" });
    }

    const response: ApiResponse<BingoConfig> = {
      success: true,
      data: await saveBingoDetails({
        name,
        start,
        end,
        size,
        teams,
        createdBy: req.user?.id,
      }),
      message: "Bingo details saved successfully",
    };

    res.status(201).json(response);
  }),
);

// Update bingo details
router.put(
  "/bingo/details",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    res
      .status(405)
      .json({
        success: false,
        error: "Use POST /api/admin/bingo/details to create new details.",
      });
  }),
);

// get the bingo details
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

// add the bingo board
router.post(
  "/bingo/board",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!Array.isArray(req.body)) {
      return res
        .status(400)
        .json({ success: false, error: "Board must be an array of tiles" });
    }

    const response: ApiResponse = {
      success: true,
      data: await saveActiveBingoBoard(req.body),
      message: "Bingo board saved successfully",
    };

    res.status(201).json(response);
  }),
);

// update the bingo board
router.put(
  "/bingo/board",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!Array.isArray(req.body)) {
      return res
        .status(400)
        .json({ success: false, error: "Board must be an array of tiles" });
    }

    const response: ApiResponse = {
      success: true,
      data: await saveActiveBingoBoard(req.body),
      message: "Bingo board updated successfully",
    };

    res.status(200).json(response);
  }),
);

// get the bingo board
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

export default router;
