import { test } from "bun:test";
import { runIsolatedUnitTests } from "./runIsolatedUnitTests.js";

// This suite uses process-wide mock.module replacements. Keep them out of
// the combined runner so integration tests always import real modules.
test("hiscoresRateLimit unit tests in an isolated process", () => {
  runIsolatedUnitTests(new URL("./hiscoresRateLimit.fixture.ts", import.meta.url));
}, 30_000);
