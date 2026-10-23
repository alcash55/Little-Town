/**
 * Proof for #49's getLatestBingo() isolation helper (helpers.ts's
 * `withGetLatestBingoLock`).
 *
 * getLatestBingo() picks the single most-recently-created row across the
 * whole `bingos` table, so two tests racing to insert-then-assert against
 * it are only safe if something serializes them — including across two
 * separate `bun test` processes sharing the local stack, per
 * TEAM-BRIEF.md's "one shared database" contract. This file proves both
 * halves of that helper: two real OS processes contending for the lock
 * actually serialize, and a holder that never releases fails a waiter
 * loudly within its timeout rather than hanging the run.
 */
import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { SQL } from "bun";

import {
  _acquireStuckGetLatestBingoLockForTests,
  getLocalStackConfig,
  withGetLatestBingoLock,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[getLatestBingoLock.test.ts] skipping: ${stack.reason}`);
}

const BACKEND_DIR = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const WORKER_PATH = path.resolve(fileURLToPath(import.meta.url), "..", "fixtures", "getLatestBingoLockWorker.ts");

interface WorkerResult {
  start: number;
  end: number;
}

async function runLockWorker(holdMs: number): Promise<WorkerResult> {
  const proc = Bun.spawn(["bun", "run", WORKER_PATH, String(holdMs)], {
    cwd: BACKEND_DIR,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`getLatestBingoLockWorker exited ${exitCode}: ${stderr || "(no stderr)"}`);
  }
  const lastLine = stdout.trim().split("\n").pop();
  if (!lastLine) throw new Error(`getLatestBingoLockWorker produced no output; stderr: ${stderr}`);
  return JSON.parse(lastLine) as WorkerResult;
}

describe.skipIf(!stack.reachable)("withGetLatestBingoLock", () => {
  test(
    "latest-bingo route suites wait for the lock and pass in separate concurrent processes",
    async () => {
      const dbUrl = process.env.TEST_SUPABASE_DB_URL ?? execFileSync(
        "bun", ["x", "supabase", "status", "-o", "env"],
        { cwd: BACKEND_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ).match(/^DB_URL="([^"]*)"/m)?.[1];
      if (!dbUrl) throw new Error("Could not resolve the local Postgres URL");
      const sql = new SQL(dbUrl, { max: 1 });
      const results: Promise<{ file: string; exitCode: number; output: string }>[] = [];
      const applicationNames: string[] = [];
      const runId = crypto.randomUUID();
      const completed: { file: string; exitCode: number; output: string }[] = [];
      try {
        await withGetLatestBingoLock(async () => {
          for (const file of ["bingo-latest", "bingo-board-ended", "review-after-complete"]) {
            const applicationName = `${runId}:${file}`;
            applicationNames.push(applicationName);
            const child = Bun.spawn(["bun", "test", `tests/integration/${file}.test.ts`], {
              cwd: BACKEND_DIR,
              env: {
                ...process.env,
                TEST_SUPABASE_URL: stack.url,
                TEST_SUPABASE_SERVICE_ROLE_KEY: stack.serviceRoleKey,
                TEST_SUPABASE_DB_URL: dbUrl,
                TEST_GET_LATEST_BINGO_LOCK_APPLICATION_NAME: applicationName,
              },
              stdout: "pipe",
              stderr: "pipe",
            });
            results.push(Promise.all([
              child.exited,
              new Response(child.stdout).text(),
              new Response(child.stderr).text(),
            ]).then(([exitCode, stdout, stderr]) => {
              const result = { file, exitCode, output: stdout + stderr };
              completed.push(result);
              return result;
            }));
          }

          // All three real suites must wait before setting up their fixtures.
          // A suite that omits the wrapper finishes while this lock is held.
          // Other runs can wait on this key too, so match each child's unique tag.
          const deadline = Date.now() + 12_000;
          while (true) {
            const waiters = await sql<{ application_name: string }[]>`
              SELECT activity.application_name
              FROM pg_locks AS locks
              JOIN pg_stat_activity AS activity ON activity.pid = locks.pid
              WHERE locks.locktype = 'advisory' AND locks.classid = 0
                AND locks.objid = 49102602 AND locks.objsubid = 1 AND NOT locks.granted
            `;
            if (applicationNames.every(name => waiters.some(row => row.application_name === name))) break;
            expect(completed, "a route suite ran without waiting for the held lock").toEqual([]);
            expect(Date.now(), "all three route suites must wait for the lock").toBeLessThan(deadline);
            await Bun.sleep(25);
          }
        });

        for (const result of await Promise.all(results)) {
          expect(result.exitCode, `${result.file}: ${result.output}`).toBe(0);
          expect(result.output).not.toContain("(skip)");
          expect(result.output).toContain("0 fail");
        }
      } finally {
        await Promise.all(results);
        await sql.end();
      }
    },
    30_000,
  );

  test(
    "two concurrent processes serialize instead of overlapping",
    async () => {
      const [a, b] = await Promise.all([runLockWorker(400), runLockWorker(400)]);

      // One held window must fully finish before the other starts — if
      // both processes ran the lock's critical section unserialized, their
      // windows would overlap instead.
      const serialized = a.end <= b.start || b.end <= a.start;
      expect(serialized).toBe(true);
    },
    15_000,
  );

  test(
    "a stuck holder fails the waiter loudly instead of hanging",
    async () => {
      const stuckHolder = await _acquireStuckGetLatestBingoLockForTests();
      try {
        const start = Date.now();
        await expect(withGetLatestBingoLock(async () => {}, { timeoutMs: 1_000 })).rejects.toThrow(
          /failed to acquire the getLatestBingo\(\) isolation lock/,
        );
        // Fails close to the requested timeout, not after some unrelated
        // longer delay and not by hanging until the test framework's own
        // timeout kills it.
        expect(Date.now() - start).toBeLessThan(5_000);
      } finally {
        await stuckHolder.release();
      }
    },
    15_000,
  );
});
