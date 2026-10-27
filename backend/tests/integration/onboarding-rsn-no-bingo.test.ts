import { test } from "bun:test";
import { runIsolatedUnitTests } from "../unit/runIsolatedUnitTests.js";

test("RSN account links without a bingo, using the real database", () => {
  runIsolatedUnitTests(
    new URL("./onboarding-rsn-no-bingo.fixture.ts", import.meta.url)
  );
}, 30_000);
