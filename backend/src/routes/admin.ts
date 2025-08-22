import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { protect, authorize } from "../middleware/auth.js";
import { createBingo } from "../createBingo.js";
import { ApiResponse, BingoConfig } from "../types/index.js";

const router = Router();

// Apply authentication to all admin routes
router.use(protect);
router.use(authorize("admin", "moderator"));

// Create new bingo
router.post(
  "/bingo",
  asyncHandler(async (req: Request, res: Response) => {
    const bingoData: BingoConfig = req.body;

    // Basic validation
    if (!bingoData.name || !bingoData.startDate || !bingoData.endDate) {
      return res.status(400).json({
        success: false,
        error: "Name, start date, and end date are required",
      });
    }

    // Validate dates
    const startDate = new Date(bingoData.startDate);
    const endDate = new Date(bingoData.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid date format",
      });
    }

    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        error: "Start date must be before end date",
      });
    }

    try {
      const result = await createBingo(bingoData);

      const response: ApiResponse<BingoConfig> = {
        success: true,
        data: {
          ...bingoData,
          id: Date.now().toString(), // Replace with real ID generation
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        message: "Bingo created successfully",
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("Error creating bingo:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create bingo",
      });
    }
  })
);

// Get all bingos (admin only)
router.get(
  "/bingo",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    // TODO: Implement database query
    const mockBingos: BingoConfig[] = [
      {
        id: "1",
        name: "Sample Bingo",
        description: "A sample bingo game",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        teams: ["Team A", "Team B"],
        tasks: ["Task 1", "Task 2"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const response: ApiResponse<BingoConfig[]> = {
      success: true,
      data: mockBingos,
    };

    res.status(200).json(response);
  })
);

// Get specific bingo
router.get(
  "/bingo/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Bingo ID is required",
      });
    }

    // TODO: Implement database query
    const mockBingo: BingoConfig = {
      id,
      name: "Sample Bingo",
      description: "A sample bingo game",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      teams: ["Team A", "Team B"],
      tasks: ["Task 1", "Task 2"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const response: ApiResponse<BingoConfig> = {
      success: true,
      data: mockBingo,
    };

    res.status(200).json(response);
  })
);

// Update bingo
router.put(
  "/bingo/:id",
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

// Delete bingo (admin only)
router.delete(
  "/bingo/:id",
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Bingo ID is required",
      });
    }

    // TODO: Implement database deletion
    const response: ApiResponse = {
      success: true,
      message: "Bingo deleted successfully",
    };

    res.status(200).json(response);
  })
);

export default router;
