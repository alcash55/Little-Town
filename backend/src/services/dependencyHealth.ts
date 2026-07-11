import { getDb } from "../db/client.js";

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
  ]);

  const data = { services };
  cache = { data, expiresAt: Date.now() + CACHE_MS };
  return data;
}

/** Test-only: clears the module-level cache so each test starts fresh. */
export function _resetDependencyHealthCacheForTests(): void {
  cache = null;
}
