import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../lib/jwt.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { protect } from "../middleware/auth.js";
import {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  User,
} from "../types/index.js";
import { loginUser } from "../db/users.js";

const router = Router();

// Login route
router.post(
  "/login",
  asyncHandler(async (req: Request, res: Response) => {
    const { username, password }: LoginRequest = req.body;

    // Basic validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "Username and password are required",
      });
    }

    const user = await loginUser(username, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      getJwtSecret(),
      { expiresIn: "24h" },
    );

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        user,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    };

    res.status(200).json(response);
  }),
);

// Get current user
router.get(
  "/me",
  protect,
  asyncHandler(async (req: Request, res: Response) => {
    const response: ApiResponse<User> = {
      success: true,
      data: req.user!,
    };

    res.status(200).json(response);
  }),
);

// Logout route (client-side token removal)
router.post(
  "/logout",
  protect,
  asyncHandler(async (req: Request, res: Response) => {
    const response: ApiResponse = {
      success: true,
      message: "Logged out successfully",
    };

    res.status(200).json(response);
  }),
);

export default router;
