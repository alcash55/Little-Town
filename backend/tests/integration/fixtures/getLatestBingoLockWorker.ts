/**
 * Child-process worker for getLatestBingoLock.test.ts's serialization proof.
 *
 * Acquires the getLatestBingo() isolation lock, holds it for the requested
 * duration, then prints one JSON line with its held-window timestamps. Run
 * as its own OS process (not imported directly) so the proof is against two
 * real, separate database sessions — the actual scenario TEAM-BRIEF.md's
 * "one shared database" contract describes, not two promises racing inside
 * one event loop.
 */
import { withGetLatestBingoLock } from "../helpers.js";

const holdMs = Number(process.argv[2] ?? "300");

await withGetLatestBingoLock(async () => {
  const start = Date.now();
  await Bun.sleep(holdMs);
  const end = Date.now();
  console.log(JSON.stringify({ start, end }));
});
