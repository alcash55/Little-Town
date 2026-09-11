import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { protect } from "../middleware/auth.js";
import { signSession, setAuthCookie, clearAuthCookie } from "../lib/session.js";
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

    // Issue #53: the token travels only as an httpOnly cookie, never in the
    // response body — a script running on the page (XSS, a compromised
    // dependency, a browser extension) cannot read an httpOnly cookie the
    // way it could read localStorage.
    const { token, expiresAt } = signSession(user);
    setAuthCookie(res, token);

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        user,
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

// Logout route — clears the httpOnly auth cookie server-side. Required now
// that the token isn't in localStorage: the frontend has no other way to
// drop a cookie it can't read (issue #53).
router.post(
  "/logout",
  protect,
  asyncHandler(async (req: Request, res: Response) => {
    clearAuthCookie(res);

    const response: ApiResponse = {
      success: true,
      message: "Logged out successfully",
    };

    res.status(200).json(response);
  }),
);

export default router;
