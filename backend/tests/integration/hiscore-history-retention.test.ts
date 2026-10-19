import { afterAll, describe, expect, test } from "bun:test";
import express from "express";
import { getDb } from "../../src/db/client.js";
import { deleteExpiredHiscoreHistory } from "../../src/services/bingoLifecycle.js";
import adminRouter from "../../src/routes/admin.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import {
  getLocalStackConfig, insertTestBingo, deleteTestBingo, uniqueSuffix,
  hasPreexistingActiveBingo, insertTestUser, deleteTestUser,
  signTestToken, startTestServer, jsonRequest,
} from "./helpers.js";

const stack = await getLocalStackConfig();
const ids: string[] = [];
const now = new Date("2026-10-19T12:00:00Z");
const fiveDaysAgo = "2026-10-14T12:00:00Z";

async function fixture(status: "complete" | "active" | "draft", endDate: string | null, updatedAt = fiveDaysAgo) {
  const bingo = await insertTestBingo(`retention-${uniqueSuffix()}`, { status, end_date: endDate });
  ids.push(bingo.id);
  const db = getDb();
  const updated = await db.from("bingos").update({ updated_at: updatedAt }).eq("id", bingo.id);
  if (updated.error) throw updated.error;
  const player = await db.from("bingo_players").insert({ bingo_id: bingo.id, rsn: `Retention${uniqueSuffix()}` }).select("id").single();
  if (player.error) throw player.error;
  const side = await db.from("bingo_player_side_accounts").insert({ player_id: player.data.id, rsn: `RetentionSide${uniqueSuffix()}` }).select("id").single();
  if (side.error) throw side.error;
  const history = await db.from("bingo_player_hiscore_history").insert([
    { player_id: player.data.id, side_account_id: null, type: "current", total_xp: 100, taken_at: fiveDaysAgo },
    { player_id: player.data.id, side_account_id: side.data.id, type: "current", total_xp: 200, taken_at: fiveDaysAgo },
  ]);
  if (history.error) throw history.error;
  return { bingoId: bingo.id, playerId: player.data.id };
}

async function historyCount(playerId: string) {
  const { count, error } = await getDb().from("bingo_player_hiscore_history").select("id", { count: "exact", head: true }).eq("player_id", playerId);
  if (error) throw error;
  return count;
}

afterAll(async () => { if (stack.reachable) for (const id of ids) await deleteTestBingo(id); });

describe.skipIf(!stack.reachable)("hiscore history retention", () => {
  test("deletes main and side history strictly after five days and repeats safely", async () => {
    const expired = await fixture("complete", "2026-10-14T11:59:59Z");
    const boundary = await fixture("complete", fiveDaysAgo);
    const recent = await fixture("complete", "2026-10-18T12:00:00Z");
    await deleteExpiredHiscoreHistory(now);
    expect(await historyCount(expired.playerId)).toBe(0);
    expect(await historyCount(boundary.playerId)).toBe(2);
    expect(await historyCount(recent.playerId)).toBe(2);
    expect(await deleteExpiredHiscoreHistory(now)).toBe(0);
    // Retention removes history only. Player and side-account records survive.
    const { count, error } = await getDb().from("bingo_player_side_accounts").select("id", { count: "exact", head: true }).eq("player_id", expired.playerId);
    expect(error).toBeNull();
    expect(count).toBe(1);
  });

  test("active and draft bingos survive retention even with old dates", async () => {
    const draft = await fixture("draft", "2026-01-01T00:00:00Z");
    let active: Awaited<ReturnType<typeof fixture>> | undefined;
    if (!(await hasPreexistingActiveBingo())) active = await fixture("active", "2026-01-01T00:00:00Z");
    try {
      await deleteExpiredHiscoreHistory(now);
      expect(await historyCount(draft.playerId)).toBe(2);
      if (active) expect(await historyCount(active.playerId)).toBe(2);
    } finally {
      if (active) { await deleteTestBingo(active.bingoId); ids.splice(ids.indexOf(active.bingoId), 1); }
    }
  });

  test("null end_date uses updated_at, while early completion with end_date keeps that date", async () => {
    const expired = await fixture("complete", null, "2026-10-13T12:00:00Z");
    const recent = await fixture("complete", null, "2026-10-18T12:00:00Z");
    const early = await fixture("complete", "2026-10-21T12:00:00Z", "2026-10-01T12:00:00Z");
    await deleteExpiredHiscoreHistory(now);
    expect(await historyCount(expired.playerId)).toBe(0);
    expect(await historyCount(recent.playerId)).toBe(2);
    expect(await historyCount(early.playerId)).toBe(2);
  });

  test("end_date edit delays actual deletion", async () => {
    const extended = await fixture("complete", "2026-10-13T12:00:00Z");
    const { error } = await getDb().from("bingos").update({ end_date: "2026-10-18T12:00:00Z" }).eq("id", extended.bingoId);
    if (error) throw error;
    await deleteExpiredHiscoreHistory(now);
    expect(await historyCount(extended.playerId)).toBe(2);
    await deleteExpiredHiscoreHistory(new Date("2026-10-23T12:00:00.001Z"));
    expect(await historyCount(extended.playerId)).toBe(0);
  });

  test("latest endpoint returns the live deletion date after completion and extension", async () => {
    const end = new Date(Date.now() - 86_400_000);
    const completed = await fixture("complete", end.toISOString());
    // Make this fixture latest even when another suite uses future created_at fixtures.
    const { error } = await getDb().from("bingos").update({ created_at: "2099-01-01T00:00:00Z" }).eq("id", completed.bingoId);
    if (error) throw error;
    const user = await insertTestUser("admin", "Retention");
    const app = express(); app.use(express.json()); app.use("/api/admin", adminRouter); app.use(errorHandler);
    const { server, port } = await startTestServer(app);
    try {
      const first = await jsonRequest(port, "GET", "/api/admin/bingo/latest", { token: signTestToken(user) });
      expect(first.status).toBe(200);
      expect(first.body.data.bingo.id).toBe(completed.bingoId);
      expect(first.body.data.historyDeletionAt).toBe(new Date(end.getTime() + 5 * 86_400_000).toISOString());
      const extended = new Date(end.getTime() + 3 * 86_400_000);
      const update = await getDb().from("bingos").update({ end_date: extended.toISOString() }).eq("id", completed.bingoId);
      if (update.error) throw update.error;
      const second = await jsonRequest(port, "GET", "/api/admin/bingo/latest", { token: signTestToken(user) });
      expect(second.body.data.historyDeletionAt).toBe(new Date(extended.getTime() + 5 * 86_400_000).toISOString());
    } finally { server.close(); await deleteTestUser(user.id); }
  });
});
