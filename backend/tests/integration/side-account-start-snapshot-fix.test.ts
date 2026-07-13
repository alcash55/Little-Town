/**
 * Side-account start-snapshot fix (TEAM-BRIEF.md Sprint 7, Track A item 2)
 * — a side account added to a player on an ALREADY-ACTIVE bingo previously
 * never got a start snapshot: activation only snapshots side accounts that
 * existed at that moment, and retake-start-snapshots' "missing" filter only
 * ever looked at MAIN accounts, so a side account added later (whose parent
 * player already had a start snapshot) was never picked up by either flow.
 *
 * Two-part fix, both covered here:
 *   1. POST /api/admin/bingo/players/:rsn/side-accounts now takes an
 *      immediate best-effort start+current snapshot when the bingo is
 *      already 'active'.
 *   2. POST /api/admin/bingo/:bingoId/retake-start-snapshots now ALSO
 *      sweeps side accounts missing a start snapshot even when their
 *      parent player isn't itself "missing" — a safety net for a failed
 *      immediate snapshot (RSN not yet ranked) or a side account added
 *      before this fix shipped.
 *
 * Only services/hiscores.ts (the real OSRS network call) is mocked, same
 * technique as tests/integration/side-account-snapshots.test.ts.
 */
process.env.JWT_SECRET = "side-account-start-snapshot-fix-test-secret-do-not-use-elsewhere";

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";

import { getDb } from "../../src/db/client.js";
import { getJwtSecret } from "../../src/lib/jwt.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { registerBingoPlayer, getSideAccountsMissingStartSnapshot } from "../../src/db/players.js";
import type { HiscoreData } from "../../src/types/index.js";
import {
  getLocalStackConfig,
  hasPreexistingActiveBingo,
  insertTestBingo,
  deleteTestBingo,
  uniqueSuffix,
  type BingoRow,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[side-account-start-snapshot-fix.test.ts] skipping: ${stack.reason}`);
}
const preexistingActive = stack.reachable ? await hasPreexistingActiveBingo() : false;
if (stack.reachable && preexistingActive) {
  console.warn(
    "[side-account-start-snapshot-fix.test.ts] skipping: another bingo is already active in the shared local stack",
  );
}
const suite = stack.reachable && !preexistingActive;

// -------------------------------------------------------
// Mock services/hiscores.ts — the only network-touching dependency.
// -------------------------------------------------------

function fakeHiscoreData(name: string): HiscoreData {
  return {
    name,
    skills: [{ id: 0, name: "Overall", rank: 1, level: 1, xp: 1000 }],
    activities: [],
    updatedAt: new Date(),
  };
}

const unresolvableRsns = new Set<string>();

const hiscoresMock = mock(async (rsn: string): Promise<HiscoreData | null> => {
  if (unresolvableRsns.has(rsn)) return null;
  return fakeHiscoreData(rsn);
});

mock.module("../../src/services/hiscores.js", () => ({ hiscores: hiscoresMock }));

// Imported dynamically *after* the mock above is registered, so every
// module in its dependency chain (bingoActivation.ts, sideAccountSnapshots
// .ts) picks up the mocked hiscores() instead of the real network call.
const { default: adminRoutes } = await import("../../src/routes/admin.js");

beforeEach(() => {
  hiscoresMock.mockClear();
});

interface TestUser {
  id: string;
  username: string;
  role: "user" | "admin" | "moderator";
}

const createdUserIds: string[] = [];
const createdBingoIds: string[] = [];

async function insertTestUser(role: TestUser["role"]): Promise<TestUser> {
  const username = `SideFixTest${role}${uniqueSuffix()}`;
  const { data, error } = await getDb()
    .from("users")
    .insert({ username, password_hash: "x", role })
    .select("id, username, role")
    .single();
  if (error || !data) throw new Error(`Failed to insert test user "${username}": ${error?.message}`);
  createdUserIds.push((data as { id: string }).id);
  return data as TestUser;
}

function signToken(user: TestUser): string {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, getJwtSecret(), {
    expiresIn: "1h",
  });
}

async function countSideHiscoreRows(sideAccountId: string, type: "start" | "current"): Promise<number> {
  const { count, error } = await getDb()
    .from("bingo_player_hiscores")
    .select("id", { count: "exact", head: true })
    .eq("side_account_id", sideAccountId)
    .eq("type", type);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

let server: http.Server;
let port: number;

function post(path: string, token: string, body?: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let resBody = "";
        res.on("data", (chunk) => (resBody += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(resBody) }));
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

beforeAll(async () => {
  if (!suite) return;
  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRoutes);
  app.use(errorHandler);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server?.close();
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
  await Promise.all(
    createdUserIds.map((id) => getDb().from("users").delete().eq("id", id).then(() => undefined, () => undefined)),
  );
});

describe.skipIf(!suite)("side-account start-snapshot fix", () => {
  let admin: TestUser;
  let bingo: BingoRow;
  const mainRsn = `SideFixMain${uniqueSuffix()}`;

  test("fixtures: admin user + an ACTIVE bingo with one registered, already-snapshotted main player", async () => {
    admin = await insertTestUser("admin");
    bingo = await insertTestBingo(`test-side-fix-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(bingo.id);
    await registerBingoPlayer(bingo.id, mainRsn);

    // Give the main player its own start snapshot up front (mirrors what
    // real activation already does) so the side-account tests below aren't
    // confounded by the main account ALSO being "missing" — retake's main-
    // account phase would otherwise cover every side account too via its
    // own (unrelated) side-account phase, masking the extended sweep this
    // fix actually adds.
    const seed = await post(`/api/admin/bingo/${bingo.id}/retake-start-snapshots`, signToken(admin));
    expect(seed.status).toBe(200);
    expect(seed.body.message).toMatch(/retook start snapshots for 1 of 1/i);
  });

  test("adding a side account to a player on an already-active bingo takes an immediate start snapshot", async () => {
    const sideRsn = `SideFixGood${uniqueSuffix()}`;
    const { status, body } = await post(
      `/api/admin/bingo/players/${mainRsn}/side-accounts`,
      signToken(admin),
      { rsn: sideRsn },
    );
    expect(status).toBe(201);
    expect(body.data.rsn).toBe(sideRsn);
    // The fix's headline behavior: a start row exists WITHOUT ever calling
    // retake-start-snapshots or activation again.
    expect(body.snapshot).toBeDefined();
    expect(body.snapshot.ok).toBe(true);
    expect(await countSideHiscoreRows(body.data.id, "start")).toBe(1);
    expect(await countSideHiscoreRows(body.data.id, "current")).toBe(1);

    // Also gone from the "missing" sweep now that it has a start row.
    const stillMissing = await getSideAccountsMissingStartSnapshot(bingo.id);
    expect(stillMissing.find((p) => p.sideAccount.id === body.data.id)).toBeUndefined();
  });

  test("an unresolvable RSN's immediate snapshot fails but the side account is still added (not blocked)", async () => {
    const badRsn = `SideFixBad${uniqueSuffix()}`;
    unresolvableRsns.add(badRsn);

    const { status, body } = await post(
      `/api/admin/bingo/players/${mainRsn}/side-accounts`,
      signToken(admin),
      { rsn: badRsn },
    );
    expect(status).toBe(201); // add still succeeds
    expect(body.snapshot.ok).toBe(false);
    expect(await countSideHiscoreRows(body.data.id, "start")).toBe(0);

    // getSideAccountsMissingStartSnapshot picks it up for a later retry.
    const missing = await getSideAccountsMissingStartSnapshot(bingo.id);
    expect(missing.some((p) => p.sideAccount.id === body.data.id)).toBe(true);

    // fixing the RSN + running the extended retake-start-snapshots sweep resolves it.
    unresolvableRsns.delete(badRsn);
    const retake = await post(`/api/admin/bingo/${bingo.id}/retake-start-snapshots`, signToken(admin));
    expect(retake.status).toBe(200);
    expect(retake.body.data.sideResults.some((r: any) => r.sideAccountId === body.data.id && r.ok)).toBe(
      true,
    );
    expect(await countSideHiscoreRows(body.data.id, "start")).toBe(1);

    const missingAfter = await getSideAccountsMissingStartSnapshot(bingo.id);
    expect(missingAfter.some((p) => p.sideAccount.id === body.data.id)).toBe(false);
  });

  test("once everything has a start snapshot, retake-start-snapshots is a clean no-op", async () => {
    // Main player (seeded in fixtures) and both side accounts (good one from
    // the first test, bad-then-fixed one from the second) all have start
    // rows by now -> nothing left for either phase to touch.
    hiscoresMock.mockClear();
    const retake = await post(`/api/admin/bingo/${bingo.id}/retake-start-snapshots`, signToken(admin));
    expect(retake.status).toBe(200);
    expect(retake.body.message).toMatch(/no players or side accounts are missing/i);
    expect(hiscoresMock).not.toHaveBeenCalled();
  });
});
