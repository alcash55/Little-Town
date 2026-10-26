import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import express from "express";
import type { Server } from "node:http";
import {
  setAuthCookie,
  clearAuthCookie,
  getSameSiteAuthHost,
  getRequestToken,
} from "../../src/lib/session.js";

const originalEnv = { ...process.env };
let server: Server;
let baseUrl: string;
beforeAll(async () => {
  const app = express();
  app.get("/token", (req, res) => {
    res.json({ token: getRequestToken(req) ?? null });
  });
  app.post("/login", (_req, res) => {
    setAuthCookie(res, "test-token");
    res.sendStatus(200);
  });
  app.post("/logout", (_req, res) => {
    clearAuthCookie(res);
    res.sendStatus(200);
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Expected TCP listener");
  baseUrl = `http://127.0.0.1:${address.port}`;
});
afterAll(() => server.close());
afterEach(() => {
  for (const key of [
    "NODE_ENV",
    "AUTH_SAME_SITE_HOST",
    "FRONTEND_DIST_DIR",
    "FRONTEND_URL",
  ]) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

async function cookie(host: string, path = "/login", forwardedHost?: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      host,
      ...(forwardedHost ? { "x-forwarded-host": forwardedHost } : {}),
    },
  });
  expect(res.status).toBe(200);
  return res.headers.get("set-cookie") ?? "";
}

test("same-site host gets Lax; legacy host retains None before and after opt-in", async () => {
  process.env.NODE_ENV = "production";
  delete process.env.AUTH_SAME_SITE_HOST;
  expect(await cookie("little-town.onrender.com")).toContain("SameSite=None");
  process.env.AUTH_SAME_SITE_HOST = "api.littletown.gay";
  const firstParty = await cookie("api.littletown.gay");
  expect(firstParty).toContain("SameSite=Lax");
  expect(firstParty).toContain("Secure");
  expect(firstParty).toContain("HttpOnly");
  expect(firstParty).toContain("Path=/");
  expect(firstParty).not.toContain("Domain=");
  expect(await cookie("little-town.onrender.com")).toContain("SameSite=None");
  expect(
    await cookie("little-town.onrender.com", "/login", "api.littletown.gay")
  ).toContain("SameSite=None");
});

test("logout expires the same host-only cookie with the same attributes", async () => {
  process.env.NODE_ENV = "production";
  process.env.AUTH_SAME_SITE_HOST = "api.littletown.gay";
  for (const host of ["api.littletown.gay", "little-town.onrender.com"]) {
    const cleared = await cookie(host, "/logout");
    expect(cleared).toContain("Max-Age=0");
    expect(cleared).toContain(
      host.startsWith("api.") ? "SameSite=Lax" : "SameSite=None"
    );
    expect(cleared).toContain("Secure");
    expect(cleared).toContain("HttpOnly");
    expect(cleared).not.toContain("Domain=");
  }
});

test("local HTTP keeps Lax without Secure", async () => {
  process.env.NODE_ENV = "development";
  const local = await cookie("localhost:8081");
  expect(local).toContain("SameSite=Lax");
  expect(local).not.toContain("Secure");
});

test("session cookie headers retain their exact values and attributes", async () => {
  process.env.NODE_ENV = "production";
  process.env.AUTH_SAME_SITE_HOST = "api.littletown.gay";
  expect(await cookie("api.littletown.gay")).toBe(
    "authToken=test-token; Path=/; HttpOnly; Secure; SameSite=Lax"
  );
  expect(await cookie("little-town.onrender.com", "/logout")).toBe(
    "authToken=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None"
  );
});

test("request cookies preserve decoding, duplicate precedence and bearer fallback", async () => {
  for (const [header, expected] of [
    [
      "other=ignored; authToken=header%2Epayload%2Esignature",
      "header.payload.signature",
    ],
    ["authToken=first; authToken=second", "first"],
    ['authToken="header%2Epayload%2Esignature"', "header.payload.signature"],
    ["authToken=; authToken=second", "fallback"],
    ["authToken=%invalid", "%invalid"],
    ["other=ignored", "fallback"],
  ]) {
    const response = await fetch(`${baseUrl}/token`, {
      headers: { cookie: header, authorization: "Bearer fallback" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token: expected });
  }
  const response = await fetch(`${baseUrl}/token`);
  expect(await response.json()).toEqual({ token: null });
});

test("bundled clan deployment uses Lax only for its configured origin", async () => {
  process.env.NODE_ENV = "production";
  delete process.env.AUTH_SAME_SITE_HOST;
  process.env.FRONTEND_DIST_DIR = "../frontend/dist";
  process.env.FRONTEND_URL = "https://diamond-dogs.example.test";
  const firstParty = await cookie("diamond-dogs.example.test");
  expect(firstParty).toContain("SameSite=Lax");
  expect(firstParty).toContain("HttpOnly");
  expect(firstParty).toContain("Secure");
  expect(firstParty).not.toContain("Domain=");
  expect(
    await cookie(
      "little-town.onrender.com",
      "/login",
      "diamond-dogs.example.test"
    )
  ).toContain("SameSite=None");
  for (const invalid of [
    "http://diamond-dogs.example.test",
    "https://user:pass@example.test",
    "https://example.test/path",
  ]) {
    process.env.FRONTEND_URL = invalid;
    expect(getSameSiteAuthHost).toThrow("Bundled frontend");
  }
});

test("configuration rejects an unrelated hostname or URL before startup", () => {
  for (const host of [
    "little-town.onrender.com",
    "https://api.littletown.gay",
    "api.example.com",
  ]) {
    process.env.AUTH_SAME_SITE_HOST = host;
    expect(getSameSiteAuthHost).toThrow(
      "AUTH_SAME_SITE_HOST must be api.littletown.gay or unset"
    );
  }
});
