/**
 * Regression coverage for #101.
 *
 * `tests/unit/dependencyHealth.test.ts` mocks `globalThis.fetch` to a narrow
 * stub that only answers three unrelated hostnames (status.supabase.com,
 * cloudflarestatus.com, runescape.com) and rejects everything else. If that
 * mock is active the first time `getLocalStackConfig()` runs its own
 * reachability probe — which happens once per process, its result cached
 * forever in `cachedConfig` — the probe used to reject against the stub,
 * mark the local Supabase stack unreachable, and skip every integration
 * test for the rest of the run. QA reproduced the real cross-file version
 * of this on 2026-09-13.
 *
 * Real file-interleave timing isn't reliably reproducible from a test body,
 * so this file covers the defect two ways: a controlled simulation of the
 * leak against `getLocalStackConfig()` directly, and an unconditional guard
 * that re-checks the actual shared cached verdict every other integration
 * file trusts, so a real leak fails loudly instead of silently.
 */
import { afterEach, describe, expect, test } from "bun:test";

import { _resetLocalStackConfigForTests, getLocalStackConfig, probeStackReachableNow } from "./helpers.js";

const realStack = await getLocalStackConfig();

/**
 * Runs unconditionally, not gated on `realStack.reachable` — the whole
 * point is to catch a false "unreachable" cached verdict, the exact
 * scenario a `skipIf(!reachable)` gate would otherwise skip silently.
 */
test("guard: the shared cached reachability verdict holds under a fresh, independent probe (#101)", async () => {
  if (realStack.reachable) return; // cache already agrees the stack is up — nothing to guard against
  const liveReachable = await probeStackReachableNow(realStack);
  expect(liveReachable).toBe(false);
});

describe.skipIf(!realStack.reachable)("getLocalStackConfig vs. a leaked fetch mock", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    _resetLocalStackConfigForTests();
  });

  /** Same shape as dependencyHealth.test.ts's stubFetch({}). */
  function installLeakedFetchMock(): void {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (
        url.includes("status.supabase.com") ||
        url.includes("cloudflarestatus.com") ||
        url.includes("runescape.com")
      ) {
        return new Response("{}", { status: 200 });
      }
      throw new Error(`unexpected fetch in test: ${url}`);
    }) as typeof fetch;
  }

  test("still resolves reachable:true against the real stack even while globalThis.fetch is stubbed to an unrelated mock", async () => {
    _resetLocalStackConfigForTests();
    installLeakedFetchMock();

    const config = await getLocalStackConfig();

    expect(config.reachable).toBe(true);
  });
});
