import { Router, Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
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
    const expiresIn = (process.env.JWT_EXPIRES_IN || "24h") as SignOptions["expiresIn"];
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      getJwtSecret(),
      { expiresIn },
    );

    // Read the actual `exp` claim back off the token so expiresAt always
    // matches what was signed, regardless of JWT_EXPIRES_IN's format.
    const decoded = jwt.decode(token) as { exp?: number } | null;
    const expiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        user,
        token,
        expiresAt,
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
