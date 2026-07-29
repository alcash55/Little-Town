/**
 * Authoritative skill/activity name vocabulary for the Board Builder
 * (TEAM-BRIEF.md Sprint 16, Track B — "one vocabulary, not two").
 *
 * Previously, the Board Builder's autocomplete was fed by scrapeWiki.ts, a
 * scrape of a MediaWiki page's <pre> blocks — and pointed at runescape.wiki
 * (RS3), not oldschool.runescape.wiki, on top of that. services/completionEngine.ts
 * matches tile task text against a completely different vocabulary: the
 * real OSRS hiscores lite API, via player snapshots (buildHiscoreVocab()).
 * These two lists happened to mostly agree, until they didn't: verified
 * 2026-07-28, they diverged on exactly 2 of 115 names (`runecrafting` vs.
 * the real `Runecraft`; `cal'varion` vs. the real `Calvar'ion`) — an admin
 * who picked the wiki's spelling from the autocomplete got a tile that
 * could never auto-complete.
 *
 * This module makes the hiscores API the single source for both: every
 * OSRS account returns the identical fixed skill/activity name list (only
 * the values differ), so a single successful lookup is authoritative — the
 * exact same property buildHiscoreVocab() already relies on. Fetching a
 * real player's snapshot IS fetching the vocabulary; a name offered by the
 * Board Builder is then structurally guaranteed to be a name the
 * completion engine can resolve, because they're now the same lookup.
 *
 * Note on the "fix scrapeWiki's domain" option considered for this sprint:
 * confirmed live (read-only GET, not a Supabase call) that
 * oldschool.runescape.wiki has no equivalent
 * "Application_programming_interface" page — the corrected-domain URL
 * 404s ("missingtitle"). There is no working wiki-scrape fallback to keep;
 * scrapeWiki.ts has been removed rather than "fixed" into a URL that still
 * doesn't resolve. See the Sprint 16 backend report for the verification.
 */
import { hiscores } from "./hiscores.js";

/**
 * A well-known, permanently-ranked RSN used purely as a vocabulary probe —
 * never displayed to a user or stored anywhere. Same precedent as
 * dependencyHealth.ts's OSRS_HISCORES_PROBE_URL, which already probes this
 * exact account for reachability. Any account works equally well for this
 * purpose (only the values differ, never the name list); Zezima just needs
 * to always resolve, not to mean anything.
 */
export const VOCAB_PROBE_RSN = "Zezima";

export interface HiscoreVocabLists {
  skills: string[];
  activities: string[];
}

/**
 * Fetches the authoritative skill/activity name lists straight from the
 * real OSRS hiscores lite API, in the order the API returns them. Throws
 * if the probe lookup fails or the probe account is (implausibly)
 * unranked — callers decide how to degrade; staticDataCron.ts's
 * refreshStaticData() leaves the previously-served (still authoritative,
 * just possibly a refresh cycle stale) data in place rather than serving
 * anything non-authoritative.
 */
export async function fetchHiscoreVocab(): Promise<HiscoreVocabLists> {
  const data = await hiscores(VOCAB_PROBE_RSN);
  if (!data) {
    throw new Error(
      `Hiscore vocabulary probe RSN "${VOCAB_PROBE_RSN}" returned no data (unranked or not found) — cannot derive vocabulary`,
    );
  }
  return {
    skills: data.skills.map((s) => s.name),
    activities: data.activities.map((a) => a.name),
  };
}
