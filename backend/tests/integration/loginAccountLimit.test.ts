process.env.JWT_SECRET = "login-account-limit-test-secret-do-not-use-elsewhere";

import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import express from "express";
import rateLimit from "express-rate-limit";
import type http from "node:http";
import { SQL } from "bun";
import { randomUUID } from "node:crypto";
import authRoutes from "../../src/routes/auth.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { loginLimiterOptions } from "../../src/middleware/loginLimiter.js";
import { getDb } from "../../src/db/client.js";
import { hashPassword } from "../../src/db/users.js";
import {
  getLocalStackConfig,
  jsonRequest,
  resolveDbUrl,
  startTestServer,
  uniqueSuffix,
} from "./helpers.js";

const stack = await getLocalStackConfig();
const PASSWORD = "account budget regression password";
const servers: http.Server[] = [];
const ids: string[] = [];
const usernames: string[] = [];
const invalid = { success: false, error: "Invalid credentials" };
let ports: number[];

async function startApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use("/api/auth/login", rateLimit(loginLimiterOptions));
  app.use("/api/auth", authRoutes);
  app.use(errorHandler);
  const { server, port } = await startTestServer(app);
  servers.push(server);
  return port;
}

function attempt(
  port: number,
  username: unknown,
  ip: string,
  password: unknown = "wrong",
) {
  return jsonRequest(port, "POST", "/api/auth/login", {
    headers: { "X-Forwarded-For": ip },
    body: { username, password },
  });
}

beforeAll(async () => {
  if (!stack.reachable) return;
  const hash = await hashPassword(PASSWORD);
  for (let i = 0; i < 8; i++) {
    const username =
      i === 5 ? usernames[4].toLowerCase() : `Budget${uniqueSuffix()}${i}`;
    const { data, error } = await getDb()
      .from("users")
      .insert({ username, password_hash: hash, role: "user" })
      .select("id")
      .single();
    if (error || !data) throw new Error("Cannot seed login budget account");
    ids.push(data.id);
    usernames.push(username);
  }
  ports = await Promise.all([startApp(), startApp()]);
});
afterAll(async () => {
  servers.forEach((server) => server.close());
  if (ids.length) {
    const { error } = await getDb().from("users").delete().in("id", ids);
    expect(error).toBeNull();
    const { data, error: limitError } = await getDb()
      .from("login_account_limits")
      .select("user_id")
      .in("user_id", ids);
    expect(limitError).toBeNull();
    expect(data).toEqual([]);
  }
});

describe.skipIf(!stack.reachable)(
  "shared login account budget through real routes",
  () => {
    test("different IPs and independent app instances share a budget, including whitespace aliases", async () => {
      for (let i = 0; i < 10; i++) {
        const res = await attempt(
          ports[i % 2],
          i % 2 && i !== 9 ? ` ${usernames[0]} ` : usernames[0],
          `192.0.2.${i + 1}`,
          i === 9 ? PASSWORD : "wrong",
        );
        expect(res.status).toBe(i === 9 ? 200 : 401);
        if (i !== 9) expect(res.body).toEqual(invalid);
      }
      const blocked = await attempt(
        ports[1],
        usernames[0],
        "192.0.2.50",
        PASSWORD,
      );
      expect(blocked.status).toBe(401);
      expect(blocked.body).toEqual(invalid);
      expect(blocked.headers["set-cookie"]).toBeUndefined();
      expect(blocked.headers["retry-after"]).toBeUndefined();
      const unrelated = await attempt(
        ports[0],
        usernames[1],
        "192.0.2.50",
        PASSWORD,
      );
      expect(unrelated.status).toBe(200);
      expect(unrelated.body.data.user.id).toBe(ids[1]);
    });

    test("expiry allows retry and blocked attempts do not extend or grow the counter", async () => {
      const { error: seedError } = await getDb()
        .from("login_account_limits")
        .insert({
          user_id: ids[7],
          started_at: new Date().toISOString(),
          attempts: 10,
        });
      expect(seedError).toBeNull();
      const { data: before, error } = await getDb()
        .from("login_account_limits")
        .select("started_at,attempts")
        .eq("user_id", ids[7])
        .single();
      expect(error).toBeNull();
      expect(before?.attempts).toBe(10);
      const res = await attempt(ports[0], usernames[7], "192.0.2.51", PASSWORD);
      expect(res.status).toBe(401);
      const { data: after } = await getDb()
        .from("login_account_limits")
        .select("started_at,attempts")
        .eq("user_id", ids[7])
        .single();
      expect(after).toEqual(before);
      const { error: updateError } = await getDb()
        .from("login_account_limits")
        .update({ started_at: new Date(Date.now() - 901_000).toISOString() })
        .eq("user_id", ids[7]);
      expect(updateError).toBeNull();
      expect(
        (await attempt(ports[1], ` ${usernames[7]} `, "192.0.2.52", PASSWORD))
          .status,
      ).toBe(200);
      const { data: reset } = await getDb()
        .from("login_account_limits")
        .select("attempts")
        .eq("user_id", ids[7])
        .single();
      expect(reset?.attempts).toBe(1);
    });

    test("atomic parallel attempts admit at most ten, even across app instances", async () => {
      const results = await Promise.all(
        Array.from({ length: 14 }, (_, i) =>
          attempt(ports[i % 2], usernames[2], `198.51.100.${i + 1}`, PASSWORD),
        ),
      );
      expect(results.filter((res) => res.status === 200)).toHaveLength(10);
      expect(results.filter((res) => res.status === 401)).toHaveLength(4);
      const { data } = await getDb()
        .from("login_account_limits")
        .select("attempts")
        .eq("user_id", ids[2])
        .single();
      expect(data?.attempts).toBe(10);
    });

    test("IP limit still rejects attempt eleven across unrelated and malformed identifiers", async () => {
      for (let i = 0; i < 10; i++) {
        const res = await attempt(
          ports[0],
          `unknown${uniqueSuffix()}`,
          "203.0.113.10",
        );
        expect(res.status).toBe(401);
        expect(res.body).toEqual(invalid);
      }
      const blocked = await attempt(
        ports[0],
        usernames[3],
        "203.0.113.10",
        PASSWORD,
      );
      expect(blocked.status).toBe(429);
      expect(blocked.body.error).toContain(
        "Too many login attempts from this IP",
      );
      expect(blocked.headers["set-cookie"]).toBeUndefined();
      expect(
        (await attempt(ports[1], usernames[3], "203.0.113.11", PASSWORD))
          .status,
      ).toBe(200);
    });

    test("malformed inputs return 400 without spending the account budget", async () => {
      for (const [i, username] of [
        null,
        {},
        [],
        123,
        true,
        " ",
        "a".repeat(101),
      ].entries()) {
        const res = await attempt(ports[0], username, `203.0.113.${20 + i}`);
        expect(res.status).toBe(400);
        expect(res.headers["set-cookie"]).toBeUndefined();
      }
      for (const password of [null, {}, [], 123, true]) {
        expect(
          (await attempt(ports[1], usernames[4], "203.0.113.60", password))
            .status,
        ).toBe(400);
      }
      const { data, error } = await getDb()
        .from("login_account_limits")
        .select("user_id")
        .eq("user_id", ids[4]);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    test("RPC does not allocate unknown-account keys and public roles cannot use shared state", async () => {
      const dbUrl = await resolveDbUrl();
      if (!dbUrl)
        throw new Error("Local SQL connection required for login budget test");
      const sql = new SQL(dbUrl, { max: 1 });
      try {
        const [before] =
          await sql`select count(*)::int as n from public.login_account_limits`;
        const { data: unknownAllowed, error: unknownError } = await getDb().rpc(
          "take_login_account_limit",
          { p_user_id: randomUUID(), p_max: 10 },
        );
        expect(unknownError).toBeNull();
        expect(unknownAllowed).toBe(false);
        for (let i = 0; i < 20; i++) {
          expect(
            (
              await attempt(
                ports[i % 2],
                `missing${uniqueSuffix()}`,
                `203.0.113.${100 + i}`,
              )
            ).body,
          ).toEqual(invalid);
        }
        const [after] =
          await sql`select count(*)::int as n from public.login_account_limits`;
        expect(after.n).toBe(before.n);
        const [privileges] = await sql`select
        has_table_privilege('anon', 'public.login_account_limits', 'SELECT') as anon_read,
        has_table_privilege('authenticated', 'public.login_account_limits', 'UPDATE') as member_write,
        has_function_privilege('anon', 'public.take_login_account_limit(uuid,integer)', 'EXECUTE') as anon_rpc,
        has_function_privilege('authenticated', 'public.take_login_account_limit(uuid,integer)', 'EXECUTE') as member_rpc`;
        expect(Object.values(privileges)).toEqual([false, false, false, false]);
      } finally {
        await sql.end();
      }
    });

    test("existing accounts that differ by case remain distinct", async () => {
      for (let i = 0; i < 10; i++) {
        expect(
          (await attempt(ports[i % 2], usernames[4], `192.0.2.${100 + i}`))
            .status,
        ).toBe(401);
      }
      expect(
        (await attempt(ports[0], usernames[4], "192.0.2.120", PASSWORD)).status,
      ).toBe(401);
      const other = await attempt(
        ports[0],
        usernames[5],
        "192.0.2.121",
        PASSWORD,
      );
      expect(other.status).toBe(200);
      expect(other.body.data.user.id).toBe(ids[5]);
    });

    test("development override widens the account budget and production ignores it", async () => {
      const mode = process.env.NODE_ENV;
      const override = process.env.LOGIN_RATE_LIMIT_MAX_OVERRIDE;
      try {
        process.env.NODE_ENV = "development";
        process.env.LOGIN_RATE_LIMIT_MAX_OVERRIDE = "11";
        for (let i = 0; i < 10; i++) {
          expect(
            (await attempt(ports[i % 2], usernames[6], `198.51.100.${100 + i}`))
              .status,
          ).toBe(401);
        }
        expect(
          (await attempt(ports[1], usernames[6], "198.51.100.120", PASSWORD))
            .status,
        ).toBe(200);
        expect(
          (await attempt(ports[0], usernames[6], "198.51.100.121", PASSWORD))
            .status,
        ).toBe(401);
        process.env.NODE_ENV = "production";
        process.env.LOGIN_RATE_LIMIT_MAX_OVERRIDE = "300";
        expect(
          (await attempt(ports[1], usernames[6], "198.51.100.122", PASSWORD))
            .status,
        ).toBe(401);
      } finally {
        if (mode === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = mode;
        if (override === undefined)
          delete process.env.LOGIN_RATE_LIMIT_MAX_OVERRIDE;
        else process.env.LOGIN_RATE_LIMIT_MAX_OVERRIDE = override;
      }
    });

    test.each(["lookup", "limit", "unknown-lookup", "unknown-limit"])(
      "%s storage failure denies login with a bounded diagnostic",
      async (failure) => {
        // Substitute a real PostgREST missing-object error at the storage boundary.
        // The router, HTTP transport, client, and error serialization stay real.
        const db = getDb();
        const storage = failure.endsWith("limit")
          ? spyOn(db, "rpc").mockReturnValueOnce(
              db.rpc("missing_login_limit_test"),
            )
          : spyOn(db, "from").mockReturnValueOnce(
              db.from("missing_login_user_test"),
            );
        const diagnostic = spyOn(console, "warn").mockImplementation(() => {});
        try {
          const res = await attempt(
            ports[0],
            failure.startsWith("unknown")
              ? `missing${uniqueSuffix()}`
              : usernames[5],
            "198.51.100.200",
            PASSWORD,
          );
          expect(res.status).toBe(503);
          expect(res.body).toEqual({
            success: false,
            error: "Authentication service unavailable. Please try again.",
            code: "AUTH_LOGIN_UNAVAILABLE",
          });
          expect(res.headers["set-cookie"]).toBeUndefined();
          expect(diagnostic.mock.calls).toEqual([
            ["[auth]", { reason: "login_storage_unavailable", method: "POST" }],
          ]);
        } finally {
          storage.mockRestore();
          diagnostic.mockRestore();
        }
      },
    );
  },
);
