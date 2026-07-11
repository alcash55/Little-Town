/**
 * Cap on concurrent OSRS hiscore lookups, shared by every fan-out call site
 * (activation, refresh-all, the snapshot cron, and side-account polling —
 * see services/sideAccountSnapshots.ts). Defined here rather than in
 * services/bingoActivation.ts so both it and sideAccountSnapshots.ts can
 * import the same budget without a circular import between the two.
 */
export const HISCORE_CONCURRENCY = 5;

/**
 * Runs `fn` over `items` with at most `limit` calls in flight at once,
 * mirroring the shape of `Promise.allSettled` (results are returned in the
 * same order as `items`, and one failure never aborts the rest).
 *
 * Used to cap concurrent OSRS hiscore lookups so bulk operations (bingo
 * activation, refresh-all, the snapshot cron) don't hammer the OSRS API.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        const value = await fn(items[index], index);
        results[index] = { status: "fulfilled", value };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));

  return results;
}
