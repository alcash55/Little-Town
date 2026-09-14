/**
 * Schema-level proof for #78/#47: 20260910000000_bingo_players_citext_rsn.sql
 * moves `bingo_players.rsn` from `TEXT` to `CITEXT`, so case-insensitive RSN
 * matching is a database guarantee rather than something `findBingoPlayerCaseInsensitive`
 * (`src/db/players.ts`'s `ILIKE` workaround) has to paper over in application code.
 *
 * Every assertion below goes through `getBingoPlayer` (a plain `.eq()` lookup)
 * or a raw insert, never `findBingoPlayerCaseInsensitive` — the whole point is
 * proving the guarantee holds without it, so it's safe to remove once this
 * file is green. See TEAM-BRIEF-unblocked.md's two-PR split: this file ships
 * in PR 1, the removal itself waits on PR 2 (draft) until prod's own citext
 * migration is confirmed.
 *
 * `bingo_player_side_accounts.rsn` stays plain `TEXT` (its own, separate
 * `UNIQUE (player_id, rsn)`) — the coexistence tests below prove that
 * boundary holds too: a citext primary column and a text side-account column
 * living side by side, each keeping its own comparison semantics.
 */
import { describe, test, expect, afterAll } from "bun:test";

import { getDb } from "../../src/db/client.js";
import { getBingoPlayer, registerBingoPlayer, addSideAccount } from "../../src/db/players.js";
import {
  getLocalStackConfig,
  insertTestBingo,
  deleteTestBingo,
  countBingoPlayerRows,
  getBingoPlayerRsnSpellings,
  uniqueSuffix,
  type BingoRow,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[bingo-players-citext-rsn.test.ts] skipping: ${stack.reason}`);
}

const createdBingoIds: string[] = [];

describe.skipIf(!stack.reachable)("bingo_players.rsn is citext (#78/#47)", () => {
  let bingo: BingoRow;

  test("fixtures: draft bingo", async () => {
    bingo = await insertTestBingo(`test-citext-rsn-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
  });

  test("getBingoPlayer (plain .eq()) matches regardless of case, with no ILIKE workaround involved", async () => {
    const rsn = `Zezima${uniqueSuffix()}`;
    await registerBingoPlayer(bingo.id, rsn);

    const byLower = await getBingoPlayer(bingo.id, rsn.toLowerCase());
    const byUpper = await getBingoPlayer(bingo.id, rsn.toUpperCase());
    const byOriginal = await getBingoPlayer(bingo.id, rsn);

    expect(byLower?.rsn).toBe(rsn);
    expect(byUpper?.rsn).toBe(rsn);
    expect(byOriginal?.rsn).toBe(rsn);
    // Storage preserves the original casing citext was written with — the
    // column is case-insensitive to COMPARE against, not lossy to store.
    expect(byLower?.id).toBe(byUpper?.id);
  });

  test("UNIQUE (bingo_id, rsn) rejects a case-variant duplicate at the schema level, not just via app-level upsert", async () => {
    const rsn = `Woox${uniqueSuffix()}`;
    await registerBingoPlayer(bingo.id, rsn);

    // Raw insert (not registerBingoPlayer's ignoreDuplicates upsert) so a
    // collision surfaces as a real unique-violation instead of a silent
    // no-op — this is what proves the constraint itself is case-insensitive,
    // independent of any application-level dedupe logic.
    const { error } = await getDb()
      .from("bingo_players")
      .insert({ bingo_id: bingo.id, rsn: rsn.toUpperCase() });

    expect(error).not.toBeNull();
    expect((error as { code?: string } | null)?.code).toBe("23505");
    expect(await countBingoPlayerRows(bingo.id, rsn)).toBe(1);
  });

  test("registerBingoPlayer's insert-if-absent upsert reuses the existing row across a case change instead of erroring", async () => {
    const rsn = `Cammy${uniqueSuffix()}`;
    const first = await registerBingoPlayer(bingo.id, rsn);

    const second = await registerBingoPlayer(bingo.id, rsn.toLowerCase());
    expect(second.id).toBe(first.id);
    expect(await countBingoPlayerRows(bingo.id, rsn)).toBe(1);
    // Original spelling wins — the row is reused, not renamed to the
    // second call's casing.
    expect(await getBingoPlayerRsnSpellings(bingo.id, rsn)).toEqual([rsn]);
  });

  test("primary/side-account coexistence: a side account under bingo_player_side_accounts' plain-TEXT uniqueness is untouched by citext", async () => {
    const primaryRsn = `Primary${uniqueSuffix()}`;
    const player = await registerBingoPlayer(bingo.id, primaryRsn);

    // bingo_player_side_accounts.UNIQUE(player_id, rsn) is still plain TEXT
    // (case-sensitive) — two case-variant spellings under the SAME player
    // are distinct rows, the opposite of bingo_players' new citext behavior.
    const lower = await addSideAccount(player.id, `Casing${uniqueSuffix()}`.toLowerCase());
    const upperRsn = lower.rsn.toUpperCase();
    const upper = await addSideAccount(player.id, upperRsn);
    expect(upper.id).not.toBe(lower.id);

    const { count, error } = await getDb()
      .from("bingo_player_side_accounts")
      .select("id", { count: "exact", head: true })
      .eq("player_id", player.id);
    expect(error).toBeNull();
    expect(count).toBe(2);
  });

  test("primary/side-account coexistence: a side account can carry the exact same rsn string as an unrelated primary player, no cross-table collision", async () => {
    const sharedRsn = `Shared${uniqueSuffix()}`;
    const primaryOwner = await registerBingoPlayer(bingo.id, sharedRsn);
    const otherPlayer = await registerBingoPlayer(bingo.id, `Other${uniqueSuffix()}`);

    // bingo_players and bingo_player_side_accounts have independent unique
    // constraints (bingo_id, rsn) vs (player_id, rsn) — a side account is
    // free to reuse an rsn string that already exists as someone else's
    // primary account, since the two tables never compare against each
    // other.
    const sideAccount = await addSideAccount(otherPlayer.id, sharedRsn);
    expect(sideAccount.rsn).toBe(sharedRsn);
    expect((await getBingoPlayer(bingo.id, sharedRsn))?.id).toBe(primaryOwner.id);
  });
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
