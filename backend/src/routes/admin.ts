import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { protect, authorize } from "../middleware/auth.js";
import { createBingo } from "../createBingo.js";
import { ApiResponse, BingoConfig } from "../types/index.js";

const router = Router();

// Apply authentication to all admin routes
router.use(protect);
router.use(authorize("admin", "moderator"));

// Add new bingo
router.post(
  "/bingo",
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200);
  })
);

// Get the current bingo
router.get(
  "/bingo",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200);
  })
);

// Update the current bingo
router.put(
  "/bingo",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData: Partial<BingoConfig> = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Bingo ID is required",
      });
    }

    // TODO: Implement database update
    const response: ApiResponse<BingoConfig> = {
      success: true,
      data: {
        id,
        name: updateData.name || "Updated Bingo",
        description: updateData.description,
        startDate: updateData.startDate || new Date().toISOString(),
        endDate:
          updateData.endDate ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        teams: updateData.teams || [],
        tasks: updateData.tasks || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      message: "Bingo updated successfully",
    };

    res.status(200).json(response);
  })
);

// Add bingo details
router.post(
  "/bingo/details",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200);
  })
);

// Update bingo details
router.post(
  "/bingo/details",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200);
  })
);

// get the bingo details
router.get(
  "/bingo/details",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200);
  })
);

// add the bingo board
router.post(
  "/bingo/board",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200);
  })
);

// update the bingo board
router.put(
  "/bingo/board",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200);
  })
);

// get the bingo board
router.get(
  "/bingo/board",
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200);
  })
);

export default router;
