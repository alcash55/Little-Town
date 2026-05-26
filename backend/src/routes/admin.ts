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

export default router;
