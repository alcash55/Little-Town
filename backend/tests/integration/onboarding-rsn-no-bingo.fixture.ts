import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import express from "express";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";
import { getDb } from "../../src/db/client.js";
import { getLocalStackConfig } from "./helpers.js";
import { getJwtSecret } from "../../src/lib/jwt.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";

process.env.JWT_SECRET = crypto.randomUUID();
process.env.ALLOW_DEV_AUTH = "false";
process.env.ONBOARDING_RSN_RATE_LIMIT_MAX = "1000";
const stack = await getLocalStackConfig();
if (!stack.reachable)
  throw new Error(`Local database required: ${stack.reason}`);

// Isolated process: no shared module mocks or destructive database setup.
mock.module("../../src/db/bingos.js", () => ({
  getActiveBingo: async () => null,
}));
mock.module("../../src/services/hiscores.js", () => ({
  hiscores: async (rsn: string) => {
    if (rsn === "Missing") return null;
    if (rsn === "Unavailable") throw new Error("Hiscores unavailable");
    return { name: rsn, skills: [], activities: [], updatedAt: new Date() };
  },
}));
const { default: routes } = await import("../../src/routes/onboarding.js");
const users: Array<{ id: string; username: string; role: "user" }> = [];
let server: Server;
let url: string;
const rsn = `Link${crypto.randomUUID().replaceAll("-", "").slice(0, 7)}`;

beforeAll(async () => {
  for (let i = 0; i < 2; i++) {
    const username = `rsn-link-${crypto.randomUUID()}`;
    const { data, error } = await getDb()
      .from("users")
      .insert({ username, password_hash: "unused", role: "user" })
      .select("id")
      .single();
    if (error || !data) throw new Error("Could not create local test user");
    users.push({ id: data.id, username, role: "user" });
  }
  const app = express();
  app.use(express.json());
  app.use("/api/onboarding", routes);
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test server port");
  url = `http://127.0.0.1:${address.port}/api/onboarding/rsn`;
});

afterAll(async () => {
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const user of users) {
    const { error } = await getDb().from("users").delete().eq("id", user.id);
    if (error) throw new Error("Could not remove local test user");
  }
});

async function claim(index: number, name: string) {
  const user = users[index];
  if (!user) throw new Error("Missing fixture user");
  const token = jwt.sign(user, getJwtSecret(), { expiresIn: "5m" });
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rsn: name }),
  });
  const body: unknown = await response.json();
  return { status: response.status, body };
}

async function storedClaim(index: number) {
  const user = users[index];
  if (!user) throw new Error("Missing fixture user");
  const { data, error } = await getDb()
    .from("rsn_claims")
    .select("rsn,rsn_normalized")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error("Could not read local RSN link");
  return data;
}

test("valid name is saved to the account with no event or player-pool row", async () => {
  expect(await claim(0, rsn)).toEqual({
    status: 200,
    body: { rsn, tracked: false, alreadyTracked: false },
  });
  expect(await storedClaim(0)).toEqual({
    rsn,
    rsn_normalized: rsn.toLowerCase(),
  });
  const { count, error } = await getDb()
    .from("bingo_players")
    .select("id", { count: "exact", head: true })
    .eq("rsn", rsn);
  expect(error).toBeNull();
  expect(count).toBe(0);
});

test("repeating a connection is idempotent", async () => {
  expect((await claim(0, rsn)).status).toBe(200);
  const user = users[0];
  if (!user) throw new Error("Missing fixture user");
  const { count, error } = await getDb()
    .from("rsn_claims")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  expect(error).toBeNull();
  expect(count).toBe(1);
});

test("another account cannot take the linked name even without an event", async () => {
  const result = await claim(1, rsn.toLowerCase());
  expect(result.status).toBe(409);
  expect(result.body).toMatchObject({ code: "RSN_TAKEN" });
  expect(await storedClaim(1)).toBeNull();
});

test("unknown names and service outages do not create an account link", async () => {
  const missing = await claim(1, "Missing");
  expect(missing.status).toBe(422);
  expect(missing.body).toMatchObject({ code: "RSN_NOT_FOUND" });
  const unavailable = await claim(1, "Unavailable");
  expect(unavailable.status).toBe(503);
  expect(unavailable.body).toMatchObject({
    code: "HISCORES_SERVICE_UNAVAILABLE",
  });
  expect(await storedClaim(1)).toBeNull();
});

test("changing the name updates the account link and frees the old name", async () => {
  const next = rsn + "A";
  expect((await claim(0, next)).status).toBe(200);
  expect(await storedClaim(0)).toEqual({
    rsn: next,
    rsn_normalized: next.toLowerCase(),
  });
  expect((await claim(1, rsn)).status).toBe(200);
  expect(await storedClaim(1)).toEqual({
    rsn,
    rsn_normalized: rsn.toLowerCase(),
  });
});
