import { getDb } from "../db/client.js";
import { getStaticData } from "../db/staticData.js";
import { fetchHiscoreVocab } from "./hiscoreVocab.js";

// -------------------------------------------------------
// GET /api/admin/health/dependencies (TEAM-BRIEF.md Track A item 4).
// Contract is frozen — Phase 2 frontend builds against it:
//   { "services": [ { "id", "label", "status": "up"|"degraded"|"down"|"unknown",
//       "latencyMs", "detail"?, "checkedAt" } ] }
// -------------------------------------------------------

export type DependencyStatus = "up" | "degraded" | "down" | "unknown";

export interface ServiceHealth {
  id: string;
  label: string;
  status: DependencyStatus;
  latencyMs: number;
  detail?: string;
  checkedAt: string;
}

const CACHE_MS = 60_000;
const CHECK_TIMEOUT_MS = 5_000;
// A successful check slower than this is reported "degraded" rather than
// "up" — reachable, but not what you'd want to see in a hot path.
const DEGRADED_LATENCY_MS = 1_500;

const SUPABASE_STATUS_URL = "https://status.supabase.com/api/v2/status.json";
const CLOUDFLARE_STATUS_URL = "https://www.cloudflarestatus.com/api/v2/status.json";
const OSRS_HISCORES_PROBE_URL =
  "https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=Zezima";

interface CheckResult {
  status: DependencyStatus;
  detail?: string;
}

let cache: { data: { services: ServiceHealth[] }; expiresAt: number } | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Runs a single dependency check, timing it and normalizing any thrown error
 * into a "down" result — no individual check failure should ever propagate
 * up and 500 the whole endpoint.
 */
async function safeCheck(
  id: string,
  label: string,
  fn: () => Promise<CheckResult>,
  opts: { degradedLatencyMs?: number } = {},
): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const { status, detail } = await fn();
    const latencyMs = Date.now() - start;
    const finalStatus: DependencyStatus =
      status === "up" && opts.degradedLatencyMs !== undefined && latencyMs > opts.degradedLatencyMs
        ? "degraded"
        : status;
    return { id, label, status: finalStatus, latencyMs, detail, checkedAt: nowIso() };
  } catch (e) {
    return {
      id,
      label,
      status: "down",
      latencyMs: Date.now() - start,
      detail: e instanceof Error ? e.message : String(e),
      checkedAt: nowIso(),
    };
  }
}

/** Cheap query against Supabase Postgres via the service-role client. */
function checkSupabaseDb(): Promise<ServiceHealth> {
  return safeCheck(
    "supabase-db",
    "Supabase DB",
    async () => {
      const { error } = await getDb().from("bingos").select("id", { count: "exact", head: true }).limit(1);
      if (error) throw new Error(error.message);
      return { status: "up" };
    },
    { degradedLatencyMs: DEGRADED_LATENCY_MS },
  );
}

/** Maps a statuspage.io v2 status.json `indicator` to our status enum. */
function statusFromIndicator(indicator: string | undefined): DependencyStatus {
  switch (indicator) {
    case "none":
      return "up";
    case "minor":
      return "degraded";
    case "major":
    case "critical":
      return "down";
    default:
      return "unknown";
  }
}

async function checkStatuspage(id: string, label: string, url: string): Promise<ServiceHealth> {
  return safeCheck(id, label, async () => {
    const res = await fetch(url, { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { status?: { indicator?: string; description?: string } };
    return {
      status: statusFromIndicator(body.status?.indicator),
      detail: body.status?.description,
    };
  });
}

const checkSupabaseStatus = () => checkStatuspage("supabase-status", "Supabase Status", SUPABASE_STATUS_URL);
const checkCloudflareStatus = () =>
  checkStatuspage("cloudflare-status", "Cloudflare Status", CLOUDFLARE_STATUS_URL);

/**
 * Reachability probe against the OSRS hiscores API this app proxies
 * (services/hiscores.ts). Uses a well-known always-ranked RSN — a 404 for
 * that name would itself be a sign the API is misbehaving, but any response
 * (including a 404 for a *different* player) proves the upstream is up;
 * only a 5xx or network failure counts as down.
 */
function checkOsrsHiscores(): Promise<ServiceHealth> {
  return safeCheck("osrs-hiscores", "OSRS Hiscores", async () => {
    const res = await fetch(OSRS_HISCORES_PROBE_URL, { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
    if (res.status >= 500) throw new Error(`OSRS hiscores returned HTTP ${res.status}`);
    return { status: "up" };
  });
}

/** Trivially "up" if this handler is executing — reports process uptime for context. */
function checkSelf(): Promise<ServiceHealth> {
  return safeCheck("self", "Self / Render", async () => ({
    status: "up",
    detail: `uptime ${Math.round(process.uptime())}s`,
  }));
}

/**
 * Symmetric difference between two name lists, formatted for a human
 * reading a `detail` string — a name only on one side is exactly the drift
 * this check exists to catch (TEAM-BRIEF.md Sprint 16, Track B item 2).
 */
function diffNames(served: string[], authoritative: string[]): string[] {
  const servedSet = new Set(served);
  const authoritativeSet = new Set(authoritative);
  return [
    ...served.filter((n) => !authoritativeSet.has(n)).map((n) => `"${n}" served but not in hiscores`),
    ...authoritative.filter((n) => !servedSet.has(n)).map((n) => `"${n}" in hiscores but not served`),
  ];
}

/**
 * Drift check between the Board Builder's currently-served vocabulary
 * (`osrs_static_data`, refreshed by staticDataCron.ts from the same source
 * below) and a fresh, live hiscores probe (TEAM-BRIEF.md Sprint 16, Track B
 * item 2 — "detect drift instead of hoping"). Since Track B item 1 already
 * makes the hiscores API the sole source `staticDataCron.ts` writes from,
 * this is a defense-in-depth check for the gap that can still open even
 * with a single source: the DB row is a point-in-time snapshot from the
 * last successful refresh (cron runs every 24h), so if OSRS ships a new
 * skill/activity or renames one between refreshes, what's served can
 * legitimately lag what a fresh probe returns right now — exactly the kind
 * of silent mismatch this sprint is closing. A genuine mismatch is
 * console.warn'd (grep/alert-friendly) with the specific differing names,
 * not just reported "degraded" in the response.
 */
function checkHiscoreVocabDrift(): Promise<ServiceHealth> {
  return safeCheck("osrs-vocab-drift", "OSRS Vocab Drift", async () => {
    const [servedSkills, servedActivities, authoritative] = await Promise.all([
      getStaticData("skills"),
      getStaticData("activities"),
      fetchHiscoreVocab(),
    ]);

    // No served data yet (fresh DB, first cron tick hasn't landed) isn't
    // drift — there's nothing to compare, and /api/hiscores/skills/list
    // already reports that state itself via its own 503.
    if (servedSkills.length === 0 && servedActivities.length === 0) {
      return { status: "unknown", detail: "No static data served yet" };
    }

    const diff = [
      ...diffNames(servedSkills, authoritative.skills),
      ...diffNames(servedActivities, authoritative.activities),
    ];

    if (diff.length === 0) {
      return { status: "up" };
    }

    const detail = `Board Builder vocabulary drift: ${diff.join(", ")}`;
    console.warn(`[dependencyHealth] ${detail}`);
    return { status: "degraded", detail };
  });
}

/**
 * Runs (or serves a cached copy of) all dependency checks. Cached ~60s
 * server-side so the overview UI can poll freely without hammering upstream
 * status pages / the OSRS API / our own DB on every page view.
 */
export async function getDependencyHealth(): Promise<{ services: ServiceHealth[] }> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  const services = await Promise.all([
    checkSupabaseDb(),
    checkSupabaseStatus(),
    checkOsrsHiscores(),
    checkCloudflareStatus(),
    checkSelf(),
    checkHiscoreVocabDrift(),
  ]);

  const data = { services };
  cache = { data, expiresAt: Date.now() + CACHE_MS };
  return data;
}

/** Test-only: clears the module-level cache so each test starts fresh. */
export function _resetDependencyHealthCacheForTests(): void {
  cache = null;
}
