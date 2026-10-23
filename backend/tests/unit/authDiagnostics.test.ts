import { test } from "bun:test";
import { runIsolatedUnitTests } from "./runIsolatedUnitTests.js";

test("auth diagnostics with an isolated database boundary", () => {
  runIsolatedUnitTests(new URL("./authDiagnostics.fixture.ts", import.meta.url));
}, 30_000);
