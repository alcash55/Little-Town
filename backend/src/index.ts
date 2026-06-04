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
import { startStaticDataCron, stopStaticDataCron, refreshStaticData } from "./services/staticDataCron.js";
import { startPlayerSnapshotCron, stopPlayerSnapshotCron } from "./services/playerSnapshotCron.js";

const app = express();

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
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
});
app.use("/api/", limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/hiscores", hiscoresRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bingo", bingoRoutes);

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
});

// Graceful shutdown
process.on('SIGTERM', () => { stopStaticDataCron(); stopPlayerSnapshotCron(); process.exit(0); });
process.on('SIGINT', () => { stopStaticDataCron(); stopPlayerSnapshotCron(); process.exit(0); });
