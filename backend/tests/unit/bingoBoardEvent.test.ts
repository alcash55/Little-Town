import { test } from "bun:test";
import { runIsolatedUnitTests } from "./runIsolatedUnitTests.js";

test("public board event consistency in an isolated process", () => {
  runIsolatedUnitTests(new URL("./bingoBoardEvent.fixture.ts", import.meta.url));
}, 30_000);
