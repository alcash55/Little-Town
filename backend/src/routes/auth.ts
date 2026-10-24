import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { protect } from "../middleware/auth.js";
import { signSession, setAuthCookie, clearAuthCookie } from "../lib/session.js";
import {
  ApiResponse,
  LoginResponse,
  User,
} from "../types/index.js";
import { loginUser } from "../db/users.js";
import { z } from "zod";

const router = Router();
const loginInput = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1),
});

// Login route
router.post(
  "/login",
  asyncHandler(async (req: Request, res: Response) => {
    const input = loginInput.safeParse(req.body);
    if (!input.success) {
      return res.status(400).json({
        success: false,
        error: "Username and password are required",
      });
    }

    let user: User | null;
    try {
      user = await loginUser(input.data.username, input.data.password);
    } catch {
      // Never send raw driver errors or request data to the global logger.
      console.warn("[auth]", {
        reason: "login_storage_unavailable",
        method: "POST",
      });
      return res.status(503).json({
        success: false,
        error: "Authentication service unavailable. Please try again.",
        code: "AUTH_LOGIN_UNAVAILABLE",
      });
    }

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
  })
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
  })
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
  })
);

export default router;
