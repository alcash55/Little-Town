import { afterAll, beforeAll, beforeEach, expect, mock, spyOn, test } from "bun:test";
import express from "express";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";

process.env.JWT_SECRET = "auth-diagnostics-test-secret";
process.env.ALLOW_DEV_AUTH = "false";
let lookupError: unknown = null;
let found = true;
let targetLookupError: unknown = null;
let queriedId = "";
const queriedIds: string[] = [];
const targetId = "11111111-1111-4111-8111-111111111111";
const row = {
  id: "test-user", username: "test-user", nickname: null, email: null,
  role: "admin", created_at: "2026-01-01", updated_at: "2026-01-01",
};
const query = {
  select: () => query,
  eq: (_column: string, id: string) => {
    queriedId = id;
    queriedIds.push(id);
    return query;
  },
  maybeSingle: async () => queriedId === row.id
    ? { data: found ? row : null, error: lookupError }
    : { data: null, error: targetLookupError },
};
mock.module("../../src/db/client.js", () => ({ getDb: () => ({ from: () => query }) }));
const { protect, optionalAuth } = await import("../../src/middleware/auth.js");
const { errorHandler } = await import("../../src/middleware/errorHandler.js");
const warnings = spyOn(console, "warn").mockImplementation(() => {});
const errors = spyOn(console, "error").mockImplementation(() => {});
let server: Server;
let url: string;
beforeAll(async () => {
  const app = express();
  app.get("/protected", protect, (req, res) => res.json({ id: req.user?.id }));
  app.get("/optional", optionalAuth, (req, res) => res.json({ id: req.user?.id }));
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP listener");
  url = `http://127.0.0.1:${address.port}`;
});
beforeEach(() => { warnings.mockClear(); errors.mockClear(); lookupError = null; found = true; targetLookupError = null; queriedIds.length = 0; });
afterAll(() => { server.close(); warnings.mockRestore(); errors.mockRestore(); });
const token = (payload: object = { id: row.id }) => jwt.sign(payload, process.env.JWT_SECRET!);
async function request(authToken?: string, path = "/protected", impersonateId?: string) {
  const headers: Record<string, string> = {};
  if (authToken) headers.cookie = `authToken=${authToken}`;
  if (impersonateId !== undefined) headers["X-Impersonate-User-Id"] = impersonateId;
  return fetch(`${url}${path}?sensitive-query=do-not-log`, {
    headers,
  });
}
function logged(reason: string) {
  expect(warnings).toHaveBeenCalledWith("[auth]", expect.objectContaining({ reason, method: "GET" }));
  expect(JSON.stringify(warnings.mock.calls)).not.toContain("sensitive-query");
}

test("blocked cookie reproduces login's following request failing, with no_token diagnosis", async () => {
  expect((await request()).status).toBe(401);
  logged("no_token");
  expect((await request(token())).status).toBe(200);
});

test("invalid, expired and missing-identity tokens have distinct safe diagnostics", async () => {
  for (const [value, reason] of [
    ["bad-secret-token", "verify_failure"],
    [token({ id: row.id, exp: 1 }), "token_expired"],
    [token({ username: "no-id" }), "invalid_claims"],
  ]) {
    warnings.mockClear();
    expect((await request(value)).status).toBe(401);
    logged(reason);
    expect(JSON.stringify(warnings.mock.calls)).not.toContain(value);
  }
});

test("missing user remains a 401; Supabase errors become retryable 503 without leaking credentials", async () => {
  found = false;
  expect((await request(token())).status).toBe(401);
  logged("user_not_found");
  lookupError = { code: "08006", message: "private-database-url-and-secret", details: "secret" };
  warnings.mockClear();
  const response = await request(token());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    error: "Authentication service unavailable. Please try again.", code: "AUTH_LOOKUP_FAILED",
  });
  logged("lookup_error");
  expect(warnings).toHaveBeenCalledWith("[auth]", { reason: "lookup_error", method: "GET", code: "08006" });
  expect(JSON.stringify([...warnings.mock.calls, ...errors.mock.calls])).not.toContain("private-database-url-and-secret");
});

for (const path of ["/protected", "/optional"]) {
  test(`${path}: target lookup failure returns a safe retryable 503 after resolving the real user`, async () => {
    targetLookupError = {
      code: "08006", message: "private-target-database-url-and-secret",
      details: "private-target-details", stack: "private-target-stack",
    };
    const response = await request(token(), path, targetId);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Authentication service unavailable. Please try again.", code: "AUTH_LOOKUP_FAILED",
    });
    expect(queriedIds).toEqual([row.id, targetId]);
    logged("lookup_error");
    expect(warnings).toHaveBeenCalledWith("[auth]", { reason: "lookup_error", method: "GET", code: "08006" });
    expect(JSON.stringify([...warnings.mock.calls, ...errors.mock.calls])).not.toContain("private-target");
  });

  test(`${path}: malformed target UUID returns 400 before a target database lookup`, async () => {
    targetLookupError = { code: "22P02", message: "private-invalid-uuid-driver-error" };
    const response = await request(token(), path, "not-a-uuid-private-header");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Impersonation target not found", code: "IMPERSONATION_TARGET_NOT_FOUND",
    });
    expect(queriedIds).toEqual([row.id]);
    expect(JSON.stringify([...warnings.mock.calls, ...errors.mock.calls])).not.toMatch(/private-invalid|private-header/);
  });
}
