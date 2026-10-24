import express, { type Express } from "express";
import { existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import helmet from "helmet";

/** Optional single-origin deployment. API-only hosts never mount this router. */
export function mountFrontend(
  app: Express,
  directory: string | undefined
): void {
  if (!directory) return;
  const root = resolve(directory);
  const index = resolve(root, "index.html");
  if (!existsSync(index)) {
    throw new Error(
      "FRONTEND_DIST_DIR must contain the built frontend index.html"
    );
  }
  const security = helmet({
    contentSecurityPolicy: {
      directives: {
        // OSRS artwork and user-submitted screenshots come from HTTPS hosts.
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://prices.runescape.wiki"],
      },
    },
  });
  app.use((req, res, next) => {
    if (
      req.path.toLowerCase() === "/api" ||
      req.path.toLowerCase().startsWith("/api/")
    ) {
      next();
      return;
    }
    security(req, res, next);
  });
  // Keep API paths out of both static file serving and the SPA fallback.
  const router = express.Router();
  router.use((req, res, next) => {
    if (
      req.path.toLowerCase() === "/api" ||
      req.path.toLowerCase().startsWith("/api/")
    ) {
      next("router");
      return;
    }
    next();
  });
  router.use(express.static(root, { index: false, dotfiles: "deny" }));
  router.use((req, res, next) => {
    if (
      !["GET", "HEAD"].includes(req.method) ||
      extname(req.path) ||
      !req.accepts("html")
    ) {
      next();
      return;
    }
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(index);
  });
  app.use(router);
}
