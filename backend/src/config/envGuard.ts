/**
 * Startup environment safety guard (TEAM-BRIEF.md Sprint 16, Track A item
 * A3). This is the backstop for the root cause behind three separate
 * incidents (Sprint 14 real Discord ingestion, Sprint 15 a local `bun run
 * dev` writing to prod, 2026-07-28 a local frontend reading live prod data):
 * `backend/.env` used to point straight at the hosted production Supabase
 * project, so any casually started local backend talked to prod.
 *
 * Splitting `.env` from `.env.production` (item A1) and defaulting `bun run
 * dev` to the local stack (item A2) close the common paths, but this guard
 * is what actually stops the process from booting against a remote database
 * outside production, regardless of how it got misconfigured.
 */

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function isLocalSupabaseUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;
  try {
    return LOCAL_HOSTNAMES.has(new URL(rawUrl).hostname);
  } catch {
    // Malformed/unparsable URL is never treated as local — fail closed.
    return false;
  }
}

/** Throws if this process is about to talk to a remote DB outside production. */
export function assertEnvironmentSafety(): void {
  // Render (and any real production deploy) must always boot normally — this
  // guard exists to catch local/dev processes pointed at prod, not to gate
  // production itself.
  if (process.env.NODE_ENV === "production") return;

  if (isLocalSupabaseUrl(process.env.SUPABASE_URL)) return;

  const supabaseUrl = process.env.SUPABASE_URL || "(unset)";

  if (process.env.ALLOW_REMOTE_DB === "true") {
    console.warn(
      [
        "=".repeat(72),
        "WARNING: ALLOW_REMOTE_DB=true — this process is connecting to a",
        `REMOTE database (SUPABASE_URL=${supabaseUrl}) while NODE_ENV is`,
        `"${process.env.NODE_ENV || "(unset)"}", not "production".`,
        "Any reads/writes this process makes touch REAL data.",
        "=".repeat(72),
      ].join("\n"),
    );
    return;
  }

  throw new Error(
    [
      `Refusing to start: SUPABASE_URL (${supabaseUrl}) is not a local address,`,
      `and NODE_ENV ("${process.env.NODE_ENV || "(unset)"}") is not "production".`,
      "",
      "backend/.env used to default to the hosted production Supabase project,",
      "so a plain local `bun run dev` would silently read and write real data",
      "(TEAM-BRIEF.md Sprint 16). This guard stops that.",
      "",
      "Fix:",
      "  - Local dev (the default): `bun run dev` — targets the local Supabase",
      "    stack via backend/dev-local.sh.",
      "  - Deliberately connect to production: `bun run dev:remote` —",
      "    backend/dev-remote.sh requires typed confirmation and sets",
      "    ALLOW_REMOTE_DB=true for you.",
      "See backend/README.md for details.",
    ].join("\n"),
  );
}
