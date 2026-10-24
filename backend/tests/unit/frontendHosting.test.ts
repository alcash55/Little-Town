import { afterAll, beforeAll, expect, test } from "bun:test";
import express from "express";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { mountFrontend } from "../../src/config/frontend.js";

let directory: string;
let server: Server;
let origin: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "clan-frontend-"));
  await mkdir(join(directory, "assets"));
  await writeFile(
    join(directory, "index.html"),
    "<title>The Diamond Dogs</title><div id='root'></div>"
  );
  await writeFile(join(directory, "assets/app.js"), "console.log('app')");
  await writeFile(join(directory, ".env"), "not-public");
  const app = express();
  app.get("/api/health", (_req, res) => res.json({ status: "OK" }));
  mountFrontend(app, directory);
  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test port");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
});
test("serves the built app on initial load and direct client routes", async () => {
  for (const path of [
    "/",
    "/BingoBoard",
    "/recover#token=unused",
    "/AdminPanel/BingoDetails",
  ]) {
    const res = await fetch(origin + path, {
      headers: { accept: "text/html" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(await res.text()).toContain("The Diamond Dogs");
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("connect-src 'self' https://prices.runescape.wiki");
    expect(csp).toContain("script-src 'self'");
  }
});
test("API routes and API misses never become frontend HTML", async () => {
  expect(await (await fetch(origin + "/api/health")).json()).toEqual({
    status: "OK",
  });
  for (const path of ["/api/missing", "/API/missing", "/api"]) {
    const res = await fetch(origin + path, {
      headers: { accept: "text/html" },
    });
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
  }
});
test("serves assets but never turns missing files, JSON requests or writes into HTML", async () => {
  expect(await (await fetch(origin + "/assets/app.js")).text()).toContain(
    "console.log"
  );
  for (const path of ["/assets/missing.js", "/missing.svg"]) {
    expect(
      (await fetch(origin + path, { headers: { accept: "text/html" } })).status
    ).toBe(404);
  }
  expect(
    (
      await fetch(origin + "/BingoBoard", {
        headers: { accept: "application/json" },
      })
    ).status
  ).toBe(404);
  expect((await fetch(origin + "/BingoBoard", { method: "POST" })).status).toBe(
    404
  );
  expect(await (await fetch(origin + "/.env")).text()).not.toContain(
    "not-public"
  );
});
test("hosting is opt-in and an incomplete frontend build fails before listening", () => {
  expect(() => mountFrontend(express(), undefined)).not.toThrow();
  expect(() => mountFrontend(express(), join(directory, "missing"))).toThrow(
    "FRONTEND_DIST_DIR"
  );
});
