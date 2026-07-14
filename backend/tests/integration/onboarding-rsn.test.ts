/**
 * POST /api/onboarding/rsn (TEAM-BRIEF.md Sprint 11, Track A frozen
 * contract). Spins up a real Express app with the actual `protect`
 * middleware and the real onboarding router (same technique as
 * tests/integration/bingo-board.test.ts / impersonation.test.ts) so JWT
 * auth, canonicalization, the rsn_claims writes, and the bingo_players
 * create-or-find all run end-to-end against the local stack's real tables.
 * Only services/hiscores.ts (the real OSRS network call) is mocked, same
 * convention as activation-force.test.ts.
 *
 * Impersonation itself (X-Impersonate-User-Id swapping req.user) is
 * exercised generically by tests/integration/impersonation.test.ts against
 * a throwaway echo route — not re-tested here. This file only needs to
 * confirm the route reads `req.user.id` (which `protect` already resolves
 * to the effective/possibly-impersonated user), not re-prove impersonation
 * mechanics.
 *
 * "No active bingo" (-> 404 NO_ACTIVE_BINGO) is deliberately NOT covered
 * here: this route's fixture bingo must stay `status: 'draft'` (never
 * activated) to avoid uq_bingos_one_active fights with other test files on
 * the shared stack, and there is no reliable way to assert "getActiveBingo()
 * returns null" on a SHARED stack where other test files may leave their
 * own draft bingos around between runs -- asserting an empty result would
 * be inherently flaky. The 404 branch is a single `if (!bingo?.id)` guard
 * identical in shape to the one every other admin.ts player route already
 * has (see routes/admin.ts's `/bingo/players` handlers), so the risk here
 * is low; noted in the sprint report rather than chased into a flaky test.
 */
process.env.JWT_SECRET = "onboarding-rsn-test-secret-do-not-use-elsewhere";
// This file's fixtures alone make more than the route's default 10/min
// per-IP cap (every request comes from the same loopback test client) —
// raise it so functional assertions aren't flaky against the rate limiter.
// The limiter itself has its own dedicated-low-limit-and-assert-429 test
// coverage pattern already established by
// tests/unit/hiscoresRateLimit.test.ts for the sibling hiscores proxy
// limiter; not duplicated here since it's the same express-rate-limit
// wiring, just a different route/threshold.
process.env.ONBOARDING_RSN_RATE_LIMIT_MAX = "1000";

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";

import { getDb } from "../../src/db/client.js";
import { getJwtSecret } from "../../src/lib/jwt.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import type { HiscoreData } from "../../src/types/index.js";
import {
  getLocalStackConfig,
  insertTestBingo,
  deleteTestBingo,
  countBingoPlayerRows,
  uniqueSuffix,
  type BingoRow,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[onboarding-rsn.test.ts] skipping: ${stack.reason}`);
}

// -------------------------------------------------------
// Mock services/hiscores.ts — the only network-touching dependency of
// routes/onboarding.ts.
// -------------------------------------------------------

function fakeHiscoreData(name: string): HiscoreData {
  return {
    name,
    skills: [{ id: 0, name: "Overall", rank: 1, level: 1, xp: 0 }],
    activities: [],
    updatedAt: new Date(),
  };
}

/** RSNs (canonical form) in this set 404 on the mocked hiscores lookup. */
const unresolvableRsns = new Set<string>();
/** RSNs (canonical form) in this set make the mocked lookup throw (simulated OSRS outage). */
const downRsns = new Set<string>();

const hiscoresMock = mock(async (rsn: string): Promise<HiscoreData | null> => {
  if (downRsns.has(rsn)) throw new Error("simulated OSRS hiscores outage");
  if (unresolvableRsns.has(rsn)) return null;
  return fakeHiscoreData(rsn);
});

mock.module("../../src/services/hiscores.js", () => ({ hiscores: hiscoresMock }));

// Imported dynamically *after* the mock above is registered so
// onboarding.js resolves the mocked hiscores module.
const { default: onboardingRoutes } = await import("../../src/routes/onboarding.js");

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

async function insertTestUser(role: TestUser["role"] = "user"): Promise<TestUser> {
  const username = `OnboardRsnTest${role}${uniqueSuffix()}`;
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

async function getRsnClaimByUser(userId: string) {
  const { data, error } = await getDb().from("rsn_claims").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`Failed to fetch rsn_claims for ${userId}: ${error.message}`);
  return data as { id: string; user_id: string; rsn: string; rsn_normalized: string } | null;
}

async function insertRawBingoPlayer(bingoId: string, rsn: string) {
  const { data, error } = await getDb()
    .from("bingo_players")
    .insert({ bingo_id: bingoId, rsn })
    .select("id, team_id")
    .single();
  if (error || !data) throw new Error(`Failed to insert raw bingo_players row "${rsn}": ${error?.message}`);
  return data as { id: string; team_id: string | null };
}

let server: http.Server;
let port: number;

function post(path: string, token: string, body: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }));
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

beforeAll(async () => {
  if (!stack.reachable) return;
  const app = express();
  app.use(express.json());
  app.use("/api/onboarding", onboardingRoutes);
  app.use(errorHandler);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server?.close();
  if (!stack.reachable) return;
  // Bingos before users: bingo_players.registered_by -> users(id) has no
  // ON DELETE action (default NO ACTION), so a registering user can't be
  // deleted while a bingo_players row it registered still exists. Deleting
  // the bingo first cascades away the bingo_players row.
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
  await Promise.all(
    createdUserIds.map((id) => getDb().from("users").delete().eq("id", id).then(() => undefined, () => undefined)),
  );
});

describe.skipIf(!stack.reachable)("POST /api/onboarding/rsn", () => {
  let bingo: BingoRow;
  let userA: TestUser;
  let userB: TestUser;

  test("fixtures: draft bingo (never activated -> no uq_bingos_one_active risk), two users", async () => {
    bingo = await insertTestBingo(`test-onboarding-rsn-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    userA = await insertTestUser("user");
    userB = await insertTestUser("user");
  });

  test("happy path: valid RSN -> 200, tracked, not already tracked, claim + pool row created", async () => {
    const rsn = `OnboardHappy${uniqueSuffix()}`;
    const { status, body } = await post("/api/onboarding/rsn", signToken(userA), { rsn });

    expect(status).toBe(200);
    expect(body).toEqual({ rsn, tracked: true, alreadyTracked: false });

    const claim = await getRsnClaimByUser(userA.id);
    expect(claim?.rsn).toBe(rsn);
    expect(claim?.rsn_normalized).toBe(rsn.toLowerCase());

    expect(await countBingoPlayerRows(bingo.id, rsn)).toBe(1);
  });

  test("canonicalization: underscores become spaces, whitespace collapsed/trimmed", async () => {
    const suffix = uniqueSuffix();
    const rsn = `_Spacey_${suffix}_RSN_`; // canonical: "Spacey <suffix> RSN"
    const user = await insertTestUser("user");
    const { status, body } = await post("/api/onboarding/rsn", signToken(user), { rsn });

    expect(status).toBe(200);
    expect(body.rsn).toBe(`Spacey ${suffix} RSN`);
    expect(await countBingoPlayerRows(bingo.id, `Spacey ${suffix} RSN`)).toBe(1);
  });

  test("RSN not found on hiscores -> 422 RSN_NOT_FOUND, nothing persisted", async () => {
    const rsn = `OnboardMissing${uniqueSuffix()}`;
    unresolvableRsns.add(rsn);
    const user = await insertTestUser("user");

    const { status, body } = await post("/api/onboarding/rsn", signToken(user), { rsn });

    expect(status).toBe(422);
    expect(body.code).toBe("RSN_NOT_FOUND");
    expect(await getRsnClaimByUser(user.id)).toBeNull();
    expect(await countBingoPlayerRows(bingo.id, rsn)).toBe(0);
  });

  test("hiscores service down -> 503 HISCORES_SERVICE_UNAVAILABLE, nothing persisted", async () => {
    const rsn = `OnboardDown${uniqueSuffix()}`;
    downRsns.add(rsn);
    const user = await insertTestUser("user");

    const { status, body } = await post("/api/onboarding/rsn", signToken(user), { rsn });

    expect(status).toBe(503);
    expect(body.code).toBe("HISCORES_SERVICE_UNAVAILABLE");
    expect(await getRsnClaimByUser(user.id)).toBeNull();
  });

  test("implausible RSN shape (disallowed characters) -> 422 RSN_NOT_FOUND without calling the hiscores service", async () => {
    const user = await insertTestUser("user");
    const { status, body } = await post("/api/onboarding/rsn", signToken(user), {
      rsn: "Not@AValid#RSN!",
    });

    expect(status).toBe(422);
    expect(body.code).toBe("RSN_NOT_FOUND");
    expect(hiscoresMock).not.toHaveBeenCalled();
  });

  test("idempotent re-claim: same user, same RSN again -> 200 again, no duplicate claim row", async () => {
    const rsn = `OnboardIdempotent${uniqueSuffix()}`;
    const user = await insertTestUser("user");

    const first = await post("/api/onboarding/rsn", signToken(user), { rsn });
    expect(first.status).toBe(200);
    expect(first.body.alreadyTracked).toBe(false);

    const second = await post("/api/onboarding/rsn", signToken(user), { rsn });
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ rsn, tracked: true, alreadyTracked: true });

    // Exactly one claim row for this user, exactly one pool row for this RSN.
    const { count, error } = await getDb()
      .from("rsn_claims")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    expect(error).toBeNull();
    expect(count).toBe(1);
    expect(await countBingoPlayerRows(bingo.id, rsn)).toBe(1);
  });

  test("cross-user conflict: a different user claiming the same RSN -> 409 RSN_TAKEN, original claim untouched", async () => {
    const rsn = `OnboardConflict${uniqueSuffix()}`;

    const first = await post("/api/onboarding/rsn", signToken(userA), { rsn });
    expect(first.status).toBe(200);

    const second = await post("/api/onboarding/rsn", signToken(userB), { rsn });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("RSN_TAKEN");

    // userA still holds it; userB never got a claim row for it.
    const claimA = await getRsnClaimByUser(userA.id);
    expect(claimA?.rsn).toBe(rsn);
    const claimB = await getRsnClaimByUser(userB.id);
    expect(claimB?.rsn_normalized).not.toBe(rsn.toLowerCase());

    // Conflict is case-insensitive too (same identity, different casing).
    const thirdUser = await insertTestUser("user");
    const third = await post("/api/onboarding/rsn", signToken(thirdUser), { rsn: rsn.toUpperCase() });
    expect(third.status).toBe(409);
    expect(third.body.code).toBe("RSN_TAKEN");
  });

  test("changeable claim: same user claiming a NEW rsn moves their claim (still one row)", async () => {
    const user = await insertTestUser("user");
    const rsnOne = `OnboardChangeA${uniqueSuffix()}`;
    const rsnTwo = `OnboardChangeB${uniqueSuffix()}`;

    const first = await post("/api/onboarding/rsn", signToken(user), { rsn: rsnOne });
    expect(first.status).toBe(200);

    const second = await post("/api/onboarding/rsn", signToken(user), { rsn: rsnTwo });
    expect(second.status).toBe(200);

    const claim = await getRsnClaimByUser(user.id);
    expect(claim?.rsn).toBe(rsnTwo);

    // rsnOne is free again for someone else to claim.
    const otherUser = await insertTestUser("user");
    const reclaim = await post("/api/onboarding/rsn", signToken(otherUser), { rsn: rsnOne });
    expect(reclaim.status).toBe(200);
  });

  test("already-tracked player (admin-registered, different case) gets linked, not duplicated", async () => {
    const preRegistered = `OnboardPreReg${uniqueSuffix()}`;
    await insertRawBingoPlayer(bingo.id, preRegistered.toLowerCase());
    expect(await countBingoPlayerRows(bingo.id, preRegistered.toLowerCase())).toBe(1);

    const user = await insertTestUser("user");
    const { status, body } = await post("/api/onboarding/rsn", signToken(user), {
      rsn: preRegistered, // different capitalization than the pre-registered row
    });

    expect(status).toBe(200);
    expect(body.alreadyTracked).toBe(true);

    // Still exactly one pool row for this RSN (case-insensitively) — no
    // duplicate "OnboardPreRegXYZ" row alongside the original lowercase one.
    expect(await countBingoPlayerRows(bingo.id, preRegistered.toLowerCase())).toBe(1);
    expect(await countBingoPlayerRows(bingo.id, preRegistered)).toBe(0);
  });

  test("pool membership: claimed RSN is present in the active bingo's player pool with no team assigned", async () => {
    const rsn = `OnboardPoolCheck${uniqueSuffix()}`;
    const user = await insertTestUser("user");

    const { status } = await post("/api/onboarding/rsn", signToken(user), { rsn });
    expect(status).toBe(200);

    const { data, error } = await getDb()
      .from("bingo_players")
      .select("rsn, team_id, bingo_id")
      .eq("bingo_id", bingo.id)
      .eq("rsn", rsn)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect((data as { team_id: string | null }).team_id).toBeNull();
  });
});
