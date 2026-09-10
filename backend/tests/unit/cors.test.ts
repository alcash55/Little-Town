/**
 * CORS preflight regression tests.
 *
 * These exist because of a real Sprint 17 defect: DELETE /api/admin/bingo/:id
 * requires an `X-Confirm-Delete` header as half of its double gate, but that
 * header was never added to the CORS allowlist. A browser's preflight therefore
 * stripped it on every cross-origin request — which is *every* request, since
 * frontend and backend are on different origins in all environments — so the
 * gate could never be satisfied and delete always refused with 409.
 *
 * Every server-side test passed the entire time, because they build an express
 * app and call the route directly: no browser, no preflight, no stripping. The
 * only thing that caught it was driving a real browser.
 *
 * So these tests deliberately run an actual OPTIONS preflight through the same
 * `cors()` middleware configuration the server uses, and assert on the response
 * headers a browser would act on.
 */
import { describe, test, expect, afterAll } from "bun:test";
import express from "express";
import cors from "cors";
import http from "node:http";

import { CORS_ALLOWED_HEADERS, REQUIRED_CUSTOM_HEADERS, buildDevCorsOrigins, DEV_CORS_PORT_RANGE } from "../../src/config/cors.js";
import { startTestServer } from "../integration/helpers.js";

const ORIGIN = "http://localhost:3000";

/** Mirrors index.ts's cors() options for the fields these tests assert on. */
function buildCorsApp() {
  const app = express();
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origin === ORIGIN) return callback(null, true);
        callback(new Error(`CORS origin not allowed: ${origin}`));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [...CORS_ALLOWED_HEADERS],
    }),
  );
  app.delete("/api/admin/bingo/:id", (_req, res) => res.json({ success: true }));
  return app;
}

/** Fires a real preflight and returns the raw response headers. */
function preflight(
  port: number,
  requestHeaders: string,
  method = "DELETE",
): Promise<{ status: number; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/api/admin/bingo/some-id",
        method: "OPTIONS",
        headers: {
          Origin: ORIGIN,
          "Access-Control-Request-Method": method,
          "Access-Control-Request-Headers": requestHeaders,
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

const started = await startTestServer(buildCorsApp());
afterAll(() => started.server.close());

/** The header names a browser would actually be permitted to send. */
async function allowedByPreflight(requestHeaders: string): Promise<string[]> {
  const res = await preflight(started.port, requestHeaders);
  return (res.headers["access-control-allow-headers"] ?? "")
    .toString()
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

describe("CORS preflight — custom request headers", () => {
  test.each(REQUIRED_CUSTOM_HEADERS.map((h) => [h.header, h.usedBy] as const))(
    "%s is allowlisted (required by: %s)",
    async (header) => {
      const allowed = await allowedByPreflight(`${header},Authorization,Content-Type`);
      expect(allowed).toContain(header.toLowerCase());
    },
  );

  test("the delete confirmation gate's header survives a real preflight", async () => {
    // The exact regression: a browser asks whether it may send X-Confirm-Delete
    // on a cross-origin DELETE. If the answer omits it, the header is dropped
    // and the route's force+header gate can never be satisfied from a browser.
    const allowed = await allowedByPreflight("X-Confirm-Delete,Authorization,Content-Type");
    expect(allowed).toContain("x-confirm-delete");
  });

  test("DELETE is an allowed method on the preflight", async () => {
    const res = await preflight(started.port, "Authorization", "DELETE");
    const methods = (res.headers["access-control-allow-methods"] ?? "")
      .toString()
      .split(",")
      .map((m) => m.trim().toUpperCase());
    expect(methods).toContain("DELETE");
  });

  test("an un-allowlisted custom header is NOT echoed back", async () => {
    // Proves the assertions above are meaningful — the middleware echoes its
    // own configured allowlist, not whatever the client happened to ask for.
    const allowed = await allowedByPreflight("X-Not-A-Real-Header");
    expect(allowed).not.toContain("x-not-a-real-header");
  });
});

/**
 * Dev CORS origin allowlist (issue #49). index.ts hardcoded :3000, which
 * CORS-blocked any second dev frontend on another port. buildDevCorsOrigins()
 * replaced that with a bounded localhost port range -- still an allowlist,
 * never a blanket allow, so an out-of-range origin must still be rejected.
 */
function buildRangeApp(origins: string[]) {
  const app = express();
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS origin not allowed: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.get('/ping', (_req, res) => res.json({ ok: true }));
  return app;
}

function originHeader(port: number, origin: string): Promise<{ status: number; allowOrigin?: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: '/ping', method: 'GET', headers: { Origin: origin } },
      (res) => {
        res.resume();
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            allowOrigin: res.headers['access-control-allow-origin'] as string | undefined,
          }),
        );
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('buildDevCorsOrigins (issue #49)', () => {
  test('covers every port in the bounded range on both localhost and 127.0.0.1', () => {
    const origins = buildDevCorsOrigins();
    for (let port = DEV_CORS_PORT_RANGE.start; port <= DEV_CORS_PORT_RANGE.end; port++) {
      expect(origins).toContain(`http://localhost:${port}`);
      expect(origins).toContain(`http://127.0.0.1:${port}`);
    }
  });

  test('does not include a port outside the declared range', () => {
    const origins = buildDevCorsOrigins();
    expect(origins).not.toContain(`http://localhost:${DEV_CORS_PORT_RANGE.end + 1}`);
    expect(origins).not.toContain('http://localhost:4000');
  });

  test('an origin within the range is allowed by a real cross-origin request', async () => {
    const started = await startTestServer(buildRangeApp(buildDevCorsOrigins()));
    try {
      const inRangePort = DEV_CORS_PORT_RANGE.start + 1;
      const res = await originHeader(started.port, `http://localhost:${inRangePort}`);
      expect(res.status).toBe(200);
      expect(res.allowOrigin).toBe(`http://localhost:${inRangePort}`);
    } finally {
      started.server.close();
    }
  });

  test('an origin outside the range is still rejected, not blanket-allowed', async () => {
    const started = await startTestServer(buildRangeApp(buildDevCorsOrigins()));
    try {
      const res = await originHeader(started.port, 'http://localhost:4000');
      expect(res.allowOrigin).toBeUndefined();
    } finally {
      started.server.close();
    }
  });
});
