/**
 * resolveMyBingoPlayer() (src/db/players.ts) — regression coverage for the
 * bug-report investigation's H2 finding: GET /api/bingo/my-team-data and
 * GET /api/bingo/board used to resolve "which player is the caller" via a
 * bare `bingo_players.registered_by = req.user.id` lookup. That column
 * records who RAN the registration, not who the player IS — the Team
 * Drafter's admin "add player" flow (routes/admin.ts POST /bingo/players)
 * sets registered_by to the ADMIN's id for every player they add, which is
 * how MOST players end up in a bingo. Two concrete failures that produced:
 *
 *   1. A user whose own player row was admin-registered could never see
 *      their own team/progress (registered_by pointed at the admin, not
 *      them) — even after Sprint 11's rsn_claims-based onboarding claim
 *      flow shipped, because nothing consulted rsn_claims at team-resolution
 *      time.
 *   2. An admin who registered several players via the Team Drafter had
 *      registered_by = themselves on every one of those rows — a `.limit(1)`
 *      query would non-deterministically resolve "my team" to whichever
 *      unrelated player's row the DB happened to return first.
 *
 * Fixed by trying rsn_claims first (an explicit, unambiguous user -> RSN
 * link), falling back to registered_by only when it resolves to EXACTLY one
 * row.
 */
import { afterAll, describe, expect, test } from "bun:test";

import { getDb } from "../../src/db/client.js";
import { resolveMyBingoPlayer } from "../../src/db/players.js";
import { upsertRsnClaim } from "../../src/db/rsnClaims.js";
import { canonicalizeRsn, normalizeRsn } from "../../src/lib/rsn.js";
import { getLocalStackConfig, insertTestBingo, deleteTestBingo, uniqueSuffix, type BingoRow } from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[resolve-my-bingo-player.test.ts] skipping: ${stack.reason}`);
}
const suite = stack.reachable;

const createdUserIds: string[] = [];
const createdBingoIds: string[] = [];

async function insertTestUser(role: "user" | "admin" = "user"): Promise<string> {
  const username = `ResolveMeTest${role}${uniqueSuffix()}`;
  const { data, error } = await getDb()
    .from("users")
    .insert({ username, password_hash: "x", role })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to insert test user "${username}": ${error?.message}`);
  const id = (data as { id: string }).id;
  createdUserIds.push(id);
  return id;
}

async function insertRawPlayer(
  bingoId: string,
  rsn: string,
  registeredBy: string | null,
): Promise<{ id: string; team_id: string | null }> {
  const { data, error } = await getDb()
    .from("bingo_players")
    .insert({ bingo_id: bingoId, rsn, registered_by: registeredBy })
    .select("id, team_id")
    .single();
  if (error || !data) throw new Error(`Failed to insert player "${rsn}": ${error?.message}`);
  return data as { id: string; team_id: string | null };
}

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
  await Promise.all(
    createdUserIds.map((id) => getDb().from("users").delete().eq("id", id).then(() => undefined, () => undefined)),
  );
});

describe.skipIf(!suite)("resolveMyBingoPlayer", () => {
  let bingo: BingoRow;

  test("fixtures: a draft bingo", async () => {
    bingo = await insertTestBingo(`test-resolve-me-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
  });

  test("no claim, no registered_by match -> null (never guesses)", async () => {
    const user = await insertTestUser();
    const result = await resolveMyBingoPlayer(bingo.id, user);
    expect(result).toBeNull();
  });

  test("no claim, exactly one registered_by match -> resolves to that row (self-registration, unambiguous)", async () => {
    const user = await insertTestUser();
    const rsn = `ResolveMeSelf${uniqueSuffix()}`;
    const player = await insertRawPlayer(bingo.id, rsn, user);

    const result = await resolveMyBingoPlayer(bingo.id, user);
    expect(result?.id).toBe(player.id);
  });

  // Regression for failure mode 1: the admin registers a player FOR someone
  // else via the Team Drafter (registered_by = admin), and that player's
  // real owner later claims the RSN through onboarding — rsn_claims must
  // win over the stale/irrelevant registered_by on the pool row.
  test("admin-registered player + a real claim from a DIFFERENT user -> resolves via the claim, not registered_by", async () => {
    const admin = await insertTestUser("admin");
    const realOwner = await insertTestUser("user");
    const rsn = `ResolveMeClaimed${uniqueSuffix()}`;
    const player = await insertRawPlayer(bingo.id, rsn, admin); // admin-registered, NOT the real owner

    // Admin's own bare registered_by lookup would find this row (single
    // match) if we didn't check rsn_claims first — confirm the admin does
    // NOT get treated as "me" for a player they only administratively added.
    const asAdmin = await resolveMyBingoPlayer(bingo.id, admin);
    expect(asAdmin?.id).toBe(player.id); // (expected: admin has no claim, single registered_by match is still theirs to fall back on)

    const canonical = canonicalizeRsn(rsn);
    await upsertRsnClaim(realOwner, canonical, normalizeRsn(canonical));

    const asRealOwner = await resolveMyBingoPlayer(bingo.id, realOwner);
    expect(asRealOwner?.id).toBe(player.id);
  });

  // Case-insensitive: onboarding's create-or-find keeps the pool row's
  // original casing, but a claim is stored in whatever casing the user
  // typed it in.
  test("claim resolves to the pool row case-insensitively", async () => {
    const owner = await insertTestUser("user");
    const rsn = `ResolveMeCaseFold${uniqueSuffix()}`;
    const player = await insertRawPlayer(bingo.id, rsn.toLowerCase(), null);

    const canonical = canonicalizeRsn(rsn); // original casing
    await upsertRsnClaim(owner, canonical, normalizeRsn(canonical));

    const result = await resolveMyBingoPlayer(bingo.id, owner);
    expect(result?.id).toBe(player.id);
  });

  // Regression for failure mode 2: an admin who registered MULTIPLE players
  // via the Team Drafter must not have "my team" resolve to an arbitrary
  // one of them.
  test("registered_by matches MULTIPLE players (admin drafted several) -> null, not an arbitrary pick", async () => {
    const admin = await insertTestUser("admin");
    await insertRawPlayer(bingo.id, `ResolveMeMulti1_${uniqueSuffix()}`, admin);
    await insertRawPlayer(bingo.id, `ResolveMeMulti2_${uniqueSuffix()}`, admin);
    await insertRawPlayer(bingo.id, `ResolveMeMulti3_${uniqueSuffix()}`, admin);

    const result = await resolveMyBingoPlayer(bingo.id, admin);
    expect(result).toBeNull();
  });

  test("a claim that isn't in THIS bingo's pool falls back to registered_by", async () => {
    const user = await insertTestUser();
    const claimedRsn = `ResolveMeElsewhere${uniqueSuffix()}`;
    const canonical = canonicalizeRsn(claimedRsn);
    await upsertRsnClaim(user, canonical, normalizeRsn(canonical)); // claim exists, but no pool row for it in `bingo`

    // Fallback: registered_by still resolves unambiguously.
    const selfRsn = `ResolveMeFallback${uniqueSuffix()}`;
    const player = await insertRawPlayer(bingo.id, selfRsn, user);

    const result = await resolveMyBingoPlayer(bingo.id, user);
    expect(result?.id).toBe(player.id);
  });
});
