import { describe, test } from "bun:test";
import { SupabaseClient } from "@supabase/supabase-js";
import { getDb } from "../../src/db/client.js";
import { getLocalStackConfig } from "./helpers.js";

const stack = await getLocalStackConfig();

describe.skipIf(!stack.reachable)("db/client.js module isolation", () => {
  test("guard: integration tests receive the real db/client.js (#108)", () => {
    if (!(getDb() instanceof SupabaseClient)) {
      throw new Error("db/client.js module mock leaked into integration tests. Run mock.module unit suites in isolated processes (#108).");
    }
  });
});
