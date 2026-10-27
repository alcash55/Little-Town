import { test } from "bun:test";
import { runIsolatedUnitTests } from "./runIsolatedUnitTests.js";

test("my-team-data keeps one event per request", () => {
  runIsolatedUnitTests(
    new URL("./myTeamDataEventConsistency.fixture.ts", import.meta.url)
  );
}, 30_000);
