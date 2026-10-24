import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import { SQL } from "bun";
import { execFileSync } from "node:child_process";
import type http from "node:http";
import { getDb } from "../../src/db/client.js";
import { hashPassword, loginUser } from "../../src/db/users.js";
import { signSession } from "../../src/lib/session.js";
import { protect, optionalAuth } from "../../src/middleware/auth.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import {
  createRecoveryRoutes,
  recoveryConfirmation,
} from "../../src/routes/accountRecovery.js";
import { adminUsersRoutes } from "../../src/routes/adminUsers.js";
import {
  consumeRecovery,
  digest,
  issueRecovery,
  recoveryStatus,
  requestRecovery,
  type RecoveryMessage,
} from "../../src/services/accountRecovery.js";
import {
  deleteTestUser,
  getLocalStackConfig,
  insertTestUser,
  jsonRequest,
  signTestToken,
  startTestServer,
  uniqueSuffix,
  withAllowDevAuth,
  type TestUser,
} from "./helpers.js";

process.env.JWT_SECRET ||= "account-recovery-local-test-only";
const stack = await getLocalStackConfig();
const users: TestUser[] = [];
const messages: RecoveryMessage[] = [];
let server: http.Server;
let port: number;
let account: TestUser;
let admin: TestUser;
let moderator: TestUser;
let email: string;
const password = "new correct horse password";
const rawToken = (url: string) =>
  new URLSearchParams(new URL(url).hash.slice(1)).get("token")!;
const post = (path: string, body: object) =>
  jsonRequest(port, "POST", `/api/auth/recovery/${path}`, { body });

beforeAll(async () => {
  if (!stack.reachable)
    throw new Error("Account recovery requires real local Supabase");
  for (const role of ["user", "admin", "moderator"] as const)
    users.push(await insertTestUser(role, "Recovery"));
  [account, admin, moderator] = users;
  email = `${account.username}@example.test`.toLowerCase();
  const app = express();
  app.use(express.json());
  app.use(
    "/api/auth/recovery",
    createRecoveryRoutes(async (message) => {
      messages.push(message);
    })
  );
  app.use("/api/admin/users", adminUsersRoutes);
  app.get("/private", protect, (req, res) => res.json({ id: req.user?.id }));
  app.get("/optional", optionalAuth, (req, res) =>
    res.json({ id: req.user?.id ?? null })
  );
  app.use(errorHandler);
  ({ server, port } = await startTestServer(app));
});
afterAll(async () => {
  server?.close();
  for (const user of users) await deleteTestUser(user.id);
  if (email)
    await getDb()
      .from("recovery_limits")
      .delete()
      .eq("key_hash", digest(email));
});

// All token and password assertions use real transactions and bcrypt.
describe("account recovery", () => {
  test("hashed at rest; new links invalidate old links; malformed and unknown tokens fail", async () => {
    const first = rawToken(await issueRecovery(account.id));
    const second = rawToken(await issueRecovery(account.id));
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toBe(second);
    const { data, error } = await getDb()
      .from("password_resets")
      .select("*")
      .eq("token_hash", digest(second))
      .single();
    expect(error).toBeNull();
    expect(JSON.stringify(data)).not.toContain(second);
    const rejected = await getDb().rpc("consume_password_reset", {
      p_token_hash: digest(second),
      p_password_hash: "dev:plaintext",
    });
    expect(rejected.error).not.toBeNull();
    expect(await recoveryStatus(second)).toBe("ready");
    expect(await recoveryStatus(first)).toBe("invalid");
    expect(await consumeRecovery(first, password)).toBe("invalid");
    expect(await consumeRecovery("0".repeat(64), password)).toBe("invalid");
    expect((await post("status", { token: "../secret" })).body.data.state).toBe(
      "invalid"
    );
  });
  test("atomic concurrent consumption, bcrypt shape, old session revocation and new login", async () => {
    const before = await getDb()
      .from("users")
      .select("session_version")
      .eq("id", account.id)
      .single();
    const oldSession = signSession({
      ...account,
      sessionVersion: before.data!.session_version,
    }).token;
    expect(
      (await jsonRequest(port, "GET", "/private", { token: oldSession })).status
    ).toBe(200);
    const token = rawToken(await issueRecovery(account.id));
    expect(
      (
        await Promise.all([
          consumeRecovery(token, password),
          consumeRecovery(token, password),
        ])
      ).sort()
    ).toEqual(["complete", "used"]);
    expect(await consumeRecovery(token, password)).toBe("used");
    expect(await recoveryStatus(token)).toBe("used");
    const { data } = await getDb()
      .from("users")
      .select("password_hash,session_version")
      .eq("id", account.id)
      .single();
    expect(data!.password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(data!.session_version).toBe(before.data!.session_version + 1);
    expect(await loginUser(account.username, "wrong password")).toBeNull();
    expect(
      (await jsonRequest(port, "GET", "/private", { token: oldSession })).status
    ).toBe(401);
    expect(
      (await jsonRequest(port, "GET", "/optional", { token: oldSession })).body
        .id
    ).toBeNull();
    const loggedIn = await loginUser(account.username, password);
    expect(loggedIn).not.toBeNull();
    expect(
      (
        await jsonRequest(port, "GET", "/private", {
          token: signSession(loggedIn!).token,
        })
      ).status
    ).toBe(200);
  });
  test("expiry and password changes by another route invalidate outstanding links", async () => {
    const token = rawToken(await issueRecovery(account.id));
    const { error } = await getDb()
      .from("password_resets")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("token_hash", digest(token));
    expect(error).toBeNull();
    expect(await recoveryStatus(token)).toBe("expired");
    expect(await consumeRecovery(token, password)).toBe("expired");
    const active = rawToken(await issueRecovery(account.id));
    await getDb()
      .from("users")
      .update({ password_hash: await hashPassword("changed by another route") })
      .eq("id", account.id);
    expect(await recoveryStatus(active)).toBe("invalid");
    expect(await consumeRecovery(active, password)).toBe("invalid");
    expect(await loginUser(account.username, password)).toBeNull();
  });
  test("expiry is checked after waiting for the user lock", async () => {
    const statusEnv = execFileSync(
      "bun",
      ["x", "supabase", "status", "-o", "env"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    const dbUrl =
      process.env.TEST_SUPABASE_DB_URL ||
      statusEnv.match(/^DB_URL="([^\"]*)"/m)?.[1];
    if (!dbUrl)
      throw new Error("Local Postgres URL required for lock-wait expiry test");
    const sql = new SQL(dbUrl, { max: 1 });
    const token = rawToken(await issueRecovery(account.id));
    const passwordHash = await hashPassword(password);
    let pending: PromiseLike<unknown> | undefined;
    let consumption: Promise<{ data: unknown; error: unknown }> | undefined;
    try {
      await sql.begin(async (transaction) => {
        await transaction`SELECT id FROM public.users WHERE id = ${account.id} FOR UPDATE`;
        await getDb()
          .from("password_resets")
          .update({ expires_at: new Date(Date.now() + 400).toISOString() })
          .eq("token_hash", digest(token));
        consumption = Promise.resolve(
          getDb().rpc("consume_password_reset", {
            p_token_hash: digest(token),
            p_password_hash: passwordHash,
          })
        );
        pending = consumption;
        await Bun.sleep(600);
      });
      expect(consumption).toBeDefined();
      const result = await consumption;
      expect(result?.error).toBeNull();
      expect(result?.data).toBe("expired");
    } finally {
      await pending;
      await sql.end();
    }
  });
  test("consume validates password limits without burning token and clears cookie after success", async () => {
    const token = rawToken(await issueRecovery(account.id));
    for (const value of ["short", "a".repeat(73), "🙂".repeat(19)]) {
      expect((await post("consume", { token, password: value })).status).toBe(
        400
      );
      expect(await recoveryStatus(token)).toBe("ready");
    }
    const result = await post("consume", { token, password });
    expect(result.status).toBe(200);
    expect(result.body.data.state).toBe("complete");
    expect(String(result.headers["set-cookie"])).toContain("Max-Age=0");
    expect((await post("consume", { token, password })).body.data.state).toBe(
      "used"
    );
  });
  test("admin fallback enforces real role, confirmation, email-less target, and impersonation rules", async () => {
    const body = { username: account.username, confirm: true };
    await withAllowDevAuth("false", async () => {
      expect(
        (await jsonRequest(port, "POST", "/api/admin/users/recovery", { body }))
          .status
      ).toBe(401);
    });
    await withAllowDevAuth("true", async () => {
      expect(
        (await jsonRequest(port, "POST", "/api/admin/users/recovery", { body }))
          .status
      ).toBe(403);
    });
    // Use a current real user session, so a 403 proves the role gate itself.
    const current = await loginUser(account.username, password);
    for (const callerToken of [
      signSession(current!).token,
      signTestToken(moderator),
    ]) {
      const response = await jsonRequest(
        port,
        "POST",
        "/api/admin/users/recovery",
        {
          body,
          token: callerToken,
          headers: { "X-Impersonate-User-Id": admin.id },
        }
      );
      expect(response.status).toBe(403);
      expect(response.body.data?.url).toBeUndefined();
    }
    const token = signTestToken(admin);
    expect(
      (
        await jsonRequest(port, "POST", "/api/admin/users/recovery", {
          token,
          body: { username: account.username },
        })
      ).status
    ).toBe(400);
    const response = await jsonRequest(
      port,
      "POST",
      "/api/admin/users/recovery",
      { token, body, headers: { "X-Impersonate-User-Id": moderator.id } }
    );
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(await recoveryStatus(rawToken(response.body.data.url))).toBe(
      "ready"
    );
    const { error } = await getDb()
      .from("users")
      .update({ email })
      .eq("id", account.id);
    expect(error).toBeNull();
    expect(
      (
        await jsonRequest(port, "POST", "/api/admin/users/recovery", {
          token,
          body,
        })
      ).status
    ).toBe(400);
  });
  test("email sink receives private link; per-account cap persists across requests", async () => {
    const delivered: RecoveryMessage[] = [];
    for (let i = 0; i < 5; i++)
      await requestRecovery(email, async (message) => {
        delivered.push(message);
      });
    expect(delivered).toHaveLength(3);
    expect(delivered[0].to).toBe(email);
    expect(await recoveryStatus(rawToken(delivered[0].url))).toBe("invalid");
    expect(await recoveryStatus(rawToken(delivered[2].url))).toBe("ready");
    await getDb()
      .from("recovery_limits")
      .delete()
      .eq("key_hash", digest(email));
  });
  test("identical request responses for existing, missing and email-less accounts; IP cap triggers", async () => {
    for (const value of [
      email.toUpperCase(),
      `${uniqueSuffix()}@example.test`,
      `${admin.username}@example.test`,
    ]) {
      const response = await post("request", { email: value });
      expect(response.status).toBe(202);
      expect(response.body).toEqual(recoveryConfirmation);
      expect(JSON.stringify(response.body)).not.toContain("#token=");
    }
    for (let i = 0; i < 2; i++)
      expect((await post("request", { email })).status).toBe(202);
    expect((await post("request", { email })).status).toBe(429);
    for (let i = 0; i < 100 && messages.length < 2; i++) await Bun.sleep(10);
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });
  test("timing stays independent of account lookup and blocked delivery", async () => {
    const timingUser = await insertTestUser("user", "RecoveryTiming");
    users.push(timingUser);
    const timingEmail = `${timingUser.username}@example.test`.toLowerCase();
    await getDb()
      .from("users")
      .update({ email: timingEmail })
      .eq("id", timingUser.id);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let deliveries = 0;
    const app = express();
    app.use(express.json());
    app.use(
      "/recovery",
      createRecoveryRoutes(async () => {
        deliveries++;
        await gate;
      })
    );
    const local = await startTestServer(app);
    const timings: number[] = [];
    try {
      for (const candidate of [
        timingEmail,
        "missing-timing@example.test",
        timingEmail.toUpperCase(),
        "other-missing@example.test",
      ]) {
        const started = performance.now();
        const response = await Promise.race([
          jsonRequest(local.port, "POST", "/recovery/request", {
            body: { email: candidate },
          }),
          Bun.sleep(250).then(() => {
            throw new Error("Public response waited on private recovery work");
          }),
        ]);
        timings.push(performance.now() - started);
        expect(response.status).toBe(202);
        expect(response.body).toEqual(recoveryConfirmation);
      }
      for (let i = 0; i < 100 && deliveries < 2; i++) await Bun.sleep(10);
      expect(deliveries).toBe(2); // Both requests returned while their delivery is still blocked.
      const difference = Math.abs(
        (timings[0] + timings[2]) / 2 - (timings[1] + timings[3]) / 2
      );
      expect(difference).toBeLessThan(75);
      console.info("[recovery timing test]", {
        samplesMs: timings.map((value) => Math.round(value)),
        meanDifferenceMs: Math.round(difference),
      });
    } finally {
      release();
      local.server.close();
      await Bun.sleep(25);
      for (const value of [
        timingEmail,
        "missing-timing@example.test",
        "other-missing@example.test",
      ]) {
        await getDb()
          .from("recovery_limits")
          .delete()
          .eq("key_hash", digest(value));
      }
    }
  });
  test("admin issuance has a per-real-user rate limit", async () => {
    let response;
    for (let i = 0; i < 11; i++)
      response = await jsonRequest(port, "POST", "/api/admin/users/recovery", {
        token: signTestToken(admin),
        body: { username: "not-an-account", confirm: true },
      });
    expect(response?.status).toBe(429);
  });
  test("status and consume share a tight IP rate limit", async () => {
    const responses = [];
    for (let i = 0; i < 11; i++)
      responses.push(await post("status", { token: "0".repeat(64) }));
    expect(responses.some((response) => response.status === 429)).toBe(true);
  });
});
