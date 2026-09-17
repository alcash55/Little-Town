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
