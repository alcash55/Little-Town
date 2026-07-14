/**
 * RSN canonicalization, shared by the onboarding claim route and its DB
 * layer (db/rsnClaims.ts).
 *
 * The OSRS hiscore lite endpoint (services/hiscores.ts) is NOT a source of
 * canonical capitalization — it echoes back whatever `player` query string
 * it was called with in its `name` field (verified against the live API:
 * `?player=zezima` returns `"name":"zezima"`, `?player=ZEZIMA` returns
 * `"name":"ZEZIMA"`), not the account's true on-file capitalization. So
 * "canonical form" here means "cleaned up", not "matches Jagex's records":
 * trim, collapse internal whitespace, and treat underscores as spaces (OSRS
 * URLs commonly use `_` in place of a space) — NOT lowercased, so the
 * caller's own capitalization is preserved for display/storage in
 * `bingo_players.rsn`.
 *
 * `normalizeRsn` goes one step further (lowercased) — this is the identity
 * key used for uniqueness/lookup in rsn_claims, matching the existing
 * case-insensitive RSN-comparison convention in
 * services/rsnChangeDetection.ts.
 */

/**
 * Real OSRS RSNs are capped at 12 characters, but this pattern deliberately
 * does NOT enforce that: the actual authoritative "is this a real RSN"
 * check per the frozen contract is the live hiscores lookup itself
 * (routes/onboarding.ts calls this ONLY to skip that network round trip for
 * obviously-not-a-name input — empty, wildly long, or containing characters
 * no RSN can contain). Hardcoding 12 here risks a false-negative if that
 * limit is ever wrong/changed, for a check whose only job is "cheap
 * pre-filter", not "the real validation" — so the cap here just matches
 * validateBody's rsnClaimSchema max (40) instead.
 */
const RSN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9 -]{0,38}[A-Za-z0-9])?$/;

export function canonicalizeRsn(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeRsn(canonical: string): string {
  return canonical.toLowerCase();
}

/** True if `canonical` (already run through canonicalizeRsn) is a plausible RSN shape. */
export function isPlausibleRsn(canonical: string): boolean {
  return RSN_PATTERN.test(canonical);
}
