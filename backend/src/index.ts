import "dotenv/config";
import { assertEnvironmentSafety } from "./config/envGuard.js";
import { CORS_ALLOWED_HEADERS } from "./config/cors.js";
assertEnvironmentSafety();
import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { errorHandler } from "./middleware/errorHandler.js";
import { rateLimitKey } from "./middleware/rateLimitKey.js";
import { loginLimiter } from "./middleware/loginLimiter.js";
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
import { completeEndedBingos } from "./services/bingoLifecycle.js";

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
    // See src/config/cors.ts — every custom request header the frontend sends
    // must be allowlisted or the browser's preflight strips it.
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
  }),
);

// Rate limiting
//
// keyGenerator (TEAM-BRIEF.md Sprint 16, Track C): an authenticated caller
// gets their own bucket keyed by user id (rateLimitKey verifies the bearer
// token itself, since `protect` — and therefore req.user — hasn't run yet
// at this point in the middleware chain); an unauthenticated caller, or one
// whose token fails verification, keys by IP exactly as before. This stops
// several admins behind one shared office/VPN IP from draining a single
// bucket amongst themselves.
//
// The budget also has to cover an admin sitting on the panel, not just
// casual page views: ScreenshotSubmission and BingoOverview each poll on a
// 45s timer (3 requests/tick between them), which alone burns ~60 requests
// per 15 min window before the admin clicks anything. A 100-request ceiling
// left submits like POST /bingo/draft failing with 429 on an idle-ish tab
// (2026-07-28 report). Per-user keying makes that budget per-admin rather
// than shared, but the ceiling still had to clear the polling floor.
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
  keyGenerator: rateLimitKey,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  // In local dev every request arrives from the same loopback address, so a
  // shared bucket makes the limiter fire on normal use while protecting
  // nothing. Production keeps the limit.
  skip: (req) =>
    process.env.NODE_ENV !== "production" &&
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.ip ?? ""),
});
app.use("/api/", limiter);

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
  // Discord service is started BEFORE the boot-time lifecycle check below so
  // a bingo that ended while this instance was asleep (Render free-tier
  // instances sleep after inactivity) has the best chance of its one-time
  // "still N pending" notification (product decision 4b) actually reaching
  // the channel — the notification is still best-effort/skips cleanly if the
  // bot isn't configured or hasn't finished logging in yet.
  startDiscordScreenshotService();
  // Boot-time lifecycle check (TEAM-BRIEF.md Sprint 15, Track A item 1):
  // completeEndedBingos() also runs on every startPlayerSnapshotCron() tick
  // (including that cron's own immediate first tick), but a dedicated,
  // independently-testable call here means a bingo that ended hours ago on a
  // sleeping instance is closed out the moment this instance wakes, not
  // "eventually, whenever the cron machinery gets to it." Idempotent —
  // running again moments later via the cron's first tick is a no-op.
  completeEndedBingos().catch((e) =>
    console.error("[bingoLifecycle] Boot-time lifecycle check failed:", e),
  );
  startPlayerSnapshotCron();
});

// Graceful shutdown
process.on('SIGTERM', () => { stopStaticDataCron(); stopPlayerSnapshotCron(); stopDiscordScreenshotService(); process.exit(0); });
process.on('SIGINT', () => { stopStaticDataCron(); stopPlayerSnapshotCron(); stopDiscordScreenshotService(); process.exit(0); });
