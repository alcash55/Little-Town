import { afterAll, describe, expect, test } from "bun:test";
import {
  registerBingoPlayer,
  updatePlayerRsn,
  getBingoPlayer,
} from "../../src/db/players.js";
import { findRsnClaimByUser, upsertRsnClaim } from "../../src/db/rsnClaims.js";
import {
  getLocalStackConfig,
  insertTestBingo,
  deleteTestBingo,
  insertTestUser,
  deleteTestUser,
  uniqueSuffix,
} from "./helpers.js";

const stack = await getLocalStackConfig();
const bingos: string[] = [];
const users: string[] = [];
afterAll(async () => {
  for (const id of bingos) await deleteTestBingo(id);
  for (const id of users) await deleteTestUser(id);
});
async function fixture() {
  const suffix = uniqueSuffix();
  const bingo = await insertTestBingo(`rename-${suffix}`);
  bingos.push(bingo.id);
  const user = await insertTestUser("user", "Rename");
  users.push(user.id);
  const oldRsn = `Old${suffix}`;
  const newRsn = `New${suffix}`;
  const player = await registerBingoPlayer(bingo.id, oldRsn);
  await upsertRsnClaim(user.id, oldRsn, oldRsn.toLowerCase());
  return { bingo, user, player, oldRsn, newRsn };
}
describe.skipIf(!stack.reachable)(
  "confirmed rename keeps ownership (#107)",
  () => {
    test("moves the claim while retaining its owner, timestamp and player identity", async () => {
      const f = await fixture();
      const before = await findRsnClaimByUser(f.user.id);
      const renamed = await updatePlayerRsn(
        f.player.id,
        f.oldRsn.toUpperCase(),
        f.newRsn
      );
      const claim = await findRsnClaimByUser(f.user.id);
      expect(renamed.id).toBe(f.player.id);
      expect(claim?.id).toBe(before?.id);
      expect(claim?.claimed_at).toBe(before?.claimed_at);
      expect(claim?.rsn).toBe(f.newRsn);
      expect(claim?.rsn_normalized).toBe(f.newRsn.toLowerCase());
      expect(await getBingoPlayer(f.bingo.id, f.oldRsn)).toBeNull();
    });
    test("conflicting destination ownership rolls back the player and claim", async () => {
      const f = await fixture();
      const other = await insertTestUser("user", "OtherRename");
      users.push(other.id);
      await upsertRsnClaim(other.id, f.newRsn, f.newRsn.toLowerCase());
      await expect(
        updatePlayerRsn(f.player.id, f.oldRsn, f.newRsn)
      ).rejects.toThrow();
      expect((await findRsnClaimByUser(f.user.id))?.rsn).toBe(f.oldRsn);
      expect((await getBingoPlayer(f.bingo.id, f.oldRsn))?.id).toBe(
        f.player.id
      );
    });
    test("stale confirmations cannot overwrite another rename", async () => {
      const f = await fixture();
      await expect(
        updatePlayerRsn(f.player.id, "Unrelated", f.newRsn)
      ).rejects.toThrow();
      expect((await findRsnClaimByUser(f.user.id))?.rsn).toBe(f.oldRsn);
    });
  }
);
