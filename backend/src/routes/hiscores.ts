import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { protect } from "../middleware/auth.js";
import { hiscores } from "../hiscores.js";
import { scrapeOsrsSkills } from "../utils/scrapeOsrsSkills.js";
import { activities as activitiesList } from "../utils/responseList.js";
import { ApiResponse, HiscoreData } from "../types/index.js";

const router = Router();

// Get hiscores for a specific player
router.get(
  "/:player",
  protect,
  asyncHandler(async (req: Request, res: Response) => {
    const { player } = req.params;

    if (!player || typeof player !== "string") {
      return res.status(400).json({
        success: false,
        error: "Player name is required",
      });
    }

    try {
      const data = await hiscores(player);

      if (!data) {
        return res.status(404).json({
          success: false,
          error: "Player not found or no data available",
        });
      }

      const response: ApiResponse<HiscoreData> = {
        success: true,
        data,
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Error fetching hiscores:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch hiscores",
      });
    }
  })
);

// Get available skills data
router.get(
  "/skills/list",
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const skills = await scrapeOsrsSkills();

      const response: ApiResponse<string | null> = {
        success: true,
        data: skills,
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Error fetching skills data:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch skills data",
      });
    }
  })
);

// Get available activities data
router.get(
  "/activities/list",
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const list = Array.isArray(activitiesList) ? activitiesList : [];

      const response: ApiResponse<string[]> = {
        success: true,
        data: list,
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Error fetching activities data:", error);
      // Fail-soft in dev: return empty list instead of 500
      res.status(200).json({
        success: true,
        data: [],
      });
    }
  })
);

// Update hiscores (PUT method for historical reasons)
router.put(
  "/:player",
  protect,
  asyncHandler(async (req: Request, res: Response) => {
    const { player } = req.params;

    if (!player || typeof player !== "string") {
      return res.status(400).json({
        success: false,
        error: "Player name is required",
      });
    }

    try {
      const data = await hiscores(player);

      if (!data) {
        return res.status(404).json({
          success: false,
          error: "Player not found or no data available",
        });
      }

      const response: ApiResponse<HiscoreData> = {
        success: true,
        data,
        message: "Hiscores updated successfully",
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Error updating hiscores:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update hiscores",
      });
    }
  })
);

export default router;
