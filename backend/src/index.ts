import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import hiscoresRoutes from "./routes/hiscores.js";
import adminRoutes from "./routes/admin.js";
import bingoRoutes from "./routes/bingo.js";
import { adminInviteRoutes, publicInviteRoutes } from "./routes/invites.js";
import { adminUsersRoutes } from "./routes/adminUsers.js";
import onboardingRoutes from "./routes/onboarding.js";
import { startStaticDataCron, stopStaticDataCron, refreshStaticData } from "./services/staticDataCron.js";
import { startPlayerSnapshotCron, stopPlayerSnapshotCron } from "./services/playerSnapshotCron.js";
import { startDiscordScreenshotService, stopDiscordScreenshotService } from "./services/discordScreenshots.js";

const app = express();
app.set("trust proxy", 1);

if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_URL) {
  throw new Error("FRONTEND_URL must be set in production");
}

const configuredCorsOrigins = [
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN,
]
  .flatMap((value) => value?.split(",") ?? [])
  .map((value) => value.trim())
  .filter(Boolean);

const devCorsOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const allowedCorsOrigins =
  process.env.NODE_ENV === "production"
    ? configuredCorsOrigins
    : Array.from(new Set([...configuredCorsOrigins, ...devCorsOrigins]));

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedCorsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // X-Impersonate-User-Id: the "view as user" override header (TEAM-BRIEF.md
    // Sprint 6, Track A item 2) — must be allowlisted or the browser's CORS
    // preflight strips it on every cross-origin request (frontend and
    // backend run on different origins even in local dev).
    allowedHeaders: ["Content-Type", "Authorization", "X-Impersonate-User-Id"],
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
});
app.use("/api/", limiter);

// Stricter limiter on the login route to slow down credential stuffing/brute
// force — fixed 15 min window regardless of RATE_LIMIT_WINDOW_MS.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // limit each IP to 10 login attempts per 15 minutes
  message: {
    error: "Too many login attempts from this IP, please try again later.",
  },
});
app.use("/api/auth/login", loginLimiter);

// Public invite lookup/accept has no auth of its own beyond the token
// itself — same brute-force/abuse posture as login, so it gets the same
// treatment (a fixed 15 min window regardless of RATE_LIMIT_WINDOW_MS).
const inviteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    error: "Too many invite requests from this IP, please try again later.",
  },
});
app.use("/api/invites", inviteLimiter);

// Body parsing middleware
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/hiscores", hiscoresRoutes);
// These two must be registered BEFORE the generic /api/admin mount below:
// adminRoutes applies protect + authorize("admin", "moderator") at the
// ROUTER level (i.e. to every /api/admin/* request, whether or not any of
// its own routes match), which would run — and, while impersonating, wrongly
// gate on the impersonated req.user — before ever reaching these routers'
// own auth if Express tried adminRoutes first. Express tries mounted
// middleware in registration order, so putting the more specific paths
// first means a matching request is fully handled here and never reaches
// adminRoutes at all.
app.use("/api/admin/invites", adminInviteRoutes);
app.use("/api/admin/users", adminUsersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bingo", bingoRoutes);
app.use("/api/invites", publicInviteRoutes);
app.use("/api/onboarding", onboardingRoutes);

// 404 handler
app.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  startStaticDataCron();
  startPlayerSnapshotCron();
  startDiscordScreenshotService();
});

// Graceful shutdown
process.on('SIGTERM', () => { stopStaticDataCron(); stopPlayerSnapshotCron(); stopDiscordScreenshotService(); process.exit(0); });
process.on('SIGINT', () => { stopStaticDataCron(); stopPlayerSnapshotCron(); stopDiscordScreenshotService(); process.exit(0); });
