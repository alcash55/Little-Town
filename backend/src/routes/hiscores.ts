import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { protect } from "../middleware/auth.js";
import { hiscores } from "../services/hiscores.js";
import { getStaticData } from "../db/staticData.js";
import { ApiResponse, HiscoreData } from "../types/index.js";

const router = Router();

// Get available skills — must be before /:player to avoid wildcard match
router.get(
  "/skills/list",
  asyncHandler(async (req: Request, res: Response) => {
    const skills = await getStaticData("skills");
    if (!skills.length) {
      return res.status(503).json({ success: false, error: "Skills data not yet available, try again shortly" });
    }
    res.status(200).json(skills);
  }),
);

// Get available activities — must be before /:player to avoid wildcard match
router.get(
  "/activities/list",
  asyncHandler(async (req: Request, res: Response) => {
    const activities = await getStaticData("activities");
    if (!activities.length) {
      return res.status(503).json({ success: false, error: "Activities data not yet available, try again shortly" });
    }
    res.status(200).json(activities);
  }),
);

// Get hiscores for a specific player
router.get(
  "/:player",
  asyncHandler(async (req: Request, res: Response) => {
    const { player } = req.params;

    if (!player || typeof player !== "string") {
      return res.status(400).json({
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
      res.status(200).json(data);
    } catch (error) {
      console.error("Error fetching hiscores:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch hiscores",
      });
    }
  }),
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
  }),
);

export default router;
