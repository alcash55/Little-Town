/**
 * CORS request-header allowlist.
 *
 * Lives here rather than inline in index.ts so it can be asserted on without
 * importing index.ts, which boots the HTTP server and the cron jobs as a side
 * effect of being imported.
 *
 * Any custom (non-CORS-safelisted) request header the frontend sends MUST be
 * listed here, or the browser's preflight strips it and the server sees the
 * request without it. Frontend and backend are on different origins in every
 * environment — Cloudflare vs Render in production, :3000 vs :8081 locally —
 * so this is never a "prod-only" concern that local testing would surface.
 *
 * This is exactly how `X-Confirm-Delete` shipped broken in Sprint 17: the
 * delete route requires it as half of its force+header double gate, but it was
 * never allowlisted, so a real browser could not send it and the endpoint
 * always refused with 409 BINGO_ACTIVE. Every server-side test passed the whole
 * time, because tests call the route directly and never run a preflight — see
 * tests/unit/cors.test.ts, which closes that gap.
 */
export const CORS_ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  // The "view as user" impersonation override (Sprint 6, Track A item 2).
  "X-Impersonate-User-Id",
  // The typed bingo-name half of DELETE /api/admin/bingo/:id's double gate
  // (Sprint 17, Track A2).
  "X-Confirm-Delete",
] as const;

/**
 * Custom headers the API refuses to work without. Kept separate from the list
 * above so a test can state *why* each one must be present, rather than just
 * pinning the array's current contents.
 */
export const REQUIRED_CUSTOM_HEADERS: ReadonlyArray<{ header: string; usedBy: string }> = [
  { header: "X-Impersonate-User-Id", usedBy: "admin impersonation ('view as user')" },
  { header: "X-Confirm-Delete", usedBy: "DELETE /api/admin/bingo/:bingoId confirmation gate" },
];
