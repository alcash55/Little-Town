import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import hiscoresRoutes from "./routes/hiscores.js";
import adminRoutes from "./routes/admin.js";
import { hiscores } from "./hiscores.js";
import scrapeOsrsSkills from "./utils/scrapeOsrsSkills.js";

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
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
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/hiscores", hiscoresRoutes);
app.use("/api/admin", adminRoutes);

// Legacy route support (for backward compatibility)
app.get("/api/skills", async (req, res) => {
  try {
    const skills = await scrapeOsrsSkills();
    const list = Array.isArray(skills) ? skills : [];
    return res.status(200).json({ success: true, data: list });
  } catch (error) {
    console.error("/api/skills error:", error);
    // Fail-soft in dev: return empty list instead of 500
    return res.status(200).json({ success: true, data: [] });
  }
});

app.get("/api/activities", (req, res) => {
  res
    .status(200)
    .json({ success: true, data: "Hello from Little Town Functions!" });
});

// Legacy hiscores route (unauthenticated, for backward compatibility)
app.put("/hiscores", async (req, res) => {
  try {
    const player = (req.query.player as string) || "";
    if (!player) {
      return res
        .status(400)
        .json({ success: false, error: "Player name is required" });
    }
    const data = await hiscores(player);
    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Player not found or no data available",
      });
    }
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Legacy hiscores error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch hiscores" });
  }
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// For Google Cloud Functions compatibility
export const LittleTownFunctions = app;

// For local development
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 8081;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}
