/**
 * Throwaway fixture for the Sprint 17 Track B browser verification.
 *
 * Seeds a realistic active bingo into the LOCAL stack so /TeamData and
 * /AdminPanel/BoardBuilder can be driven in a real browser: a 16-tile board,
 * two teams, three players on the first team, and two user accounts covering
 * the branches the B3 callout distinguishes:
 *
 *   linked   — has an rsn_claims row matching a drafted player -> sees the table
 *   unlinked — no claim, no player row                         -> sees the callout
 *
 * Prints the JWTs so the driver script can inject them as `localStorage.authToken`.
 * Run from backend/:  bun run tests/manual-seed-browser-verify.ts
 */
import {
  getLocalStackConfig,
  insertTestBingo,
  insertTestTeam,
  insertTestTile,
  insertTestUser,
  signTestToken,
} from "./integration/helpers.js";
import { getDb } from "../src/db/client.js";

const TILES: Array<{ type: "Kill Count" | "Experience" | "Drops"; task: string; points: number; target: number | null }> = [
  { type: "Kill Count", task: "Zulrah", points: 10, target: 25 },
  { type: "Kill Count", task: "Vorkath", points: 10, target: 20 },
  { type: "Kill Count", task: "General Graardor", points: 15, target: 30 },
  { type: "Kill Count", task: "Kree'arra", points: 15, target: 30 },
  { type: "Experience", task: "Slayer", points: 20, target: 500_000 },
  { type: "Experience", task: "Runecraft", points: 20, target: 250_000 },
  { type: "Experience", task: "Farming", points: 10, target: 300_000 },
  { type: "Experience", task: "Hitpoints", points: 10, target: 400_000 },
  { type: "Drops", task: "Dragon Warhammer", points: 30, target: null },
  { type: "Drops", task: "Twisted Bow", points: 50, target: null },
  { type: "Drops", task: "Abyssal Whip", points: 10, target: null },
  { type: "Drops", task: "Bandos Chestplate", points: 20, target: null },
  { type: "Kill Count", task: "Cerberus", points: 10, target: 40 },
  { type: "Kill Count", task: "Alchemical Hydra", points: 20, target: 15 },
  { type: "Experience", task: "Mining", points: 10, target: 200_000 },
  { type: "Drops", task: "Elysian Spirit Shield", points: 50, target: null },
];

const cfg = await getLocalStackConfig();
if (!cfg.reachable) throw new Error(`local stack unreachable: ${cfg.reason}`);
if (!cfg.url.includes("127.0.0.1") && !cfg.url.includes("localhost")) {
  throw new Error(`refusing to seed a non-local target: ${cfg.url}`);
}

const db = getDb();

// Re-runnable: clear prior fixture rows first. Only one bingo may be active
// (uq_bingos_one_active), and rsn_claims is UNIQUE on rsn_normalized, so a
// second run collides on both unless the previous run's rows are removed.
const { data: stale } = await db.from("bingos").select("id").like("name", "Browser Verify%");
for (const row of stale ?? []) await db.from("bingos").delete().eq("id", row.id);

for (const prefix of ["Linkeduser%", "Unlinkeduser%", "Adminadmin%"]) {
  const { data: users } = await db.from("users").select("id").like("username", prefix);
  // rsn_claims cascades on users.id, which is what frees "zezima" for re-seeding.
  for (const u of users ?? []) await db.from("users").delete().eq("id", u.id);
}

const day = 86_400_000;
const bingo = await insertTestBingo("Browser Verify Round 1", {
  status: "active",
  // 25-tile board holding 16 tiles: leaves the Board Builder's "Add Tile"
  // enabled (it disables at board_size) so the B4b clear-after-add behaviour
  // is reachable, while still giving TeamData 16 rows to lay out for B5.
  board_size: 25,
  start_date: new Date(Date.now() - 2 * day).toISOString(),
  end_date: new Date(Date.now() + 7 * day).toISOString(),
});

for (const [i, t] of TILES.entries()) {
  await insertTestTile(bingo.id, {
    position: i,
    type: t.type,
    task: t.task,
    points: t.points,
    ...(t.target !== null ? { targetValue: t.target } : {}),
  });
}

const gold = await insertTestTeam(bingo.id, "Gold Team");
const blue = await insertTestTeam(bingo.id, "Blue Team");

const ROSTER = ["Zezima", "B0aty", "Woox"];
for (const rsn of ROSTER) {
  const { error } = await db
    .from("bingo_players")
    .insert({ bingo_id: bingo.id, team_id: gold.id, rsn });
  if (error) throw new Error(`seed player ${rsn}: ${error.message}`);
}
const { error: blueErr } = await db
  .from("bingo_players")
  .insert({ bingo_id: bingo.id, team_id: blue.id, rsn: "Lynx Titan" });
if (blueErr) throw new Error(`seed blue player: ${blueErr.message}`);

// linked: claim resolves to Zezima on Gold Team
const linked = await insertTestUser("user", "Linked");
const { error: claimErr } = await db
  .from("rsn_claims")
  .insert({ user_id: linked.id, rsn: "Zezima", rsn_normalized: "zezima" });
if (claimErr) throw new Error(`seed claim: ${claimErr.message}`);

// unlinked: deliberately no claim and no bingo_players row
const unlinked = await insertTestUser("user", "Unlinked");
const admin = await insertTestUser("admin", "Admin");

console.log(
  JSON.stringify(
    {
      bingoId: bingo.id,
      goldTeamId: gold.id,
      linked: { username: linked.username, token: signTestToken(linked) },
      unlinked: { username: unlinked.username, token: signTestToken(unlinked) },
      admin: { username: admin.username, token: signTestToken(admin) },
    },
    null,
    2,
  ),
);
