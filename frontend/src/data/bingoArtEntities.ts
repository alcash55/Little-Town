/**
 * Curated boss/skill/item -> wiki-art mapping for bingo tiles (TEAM-BRIEF.md
 * Sprint 8, Track A items 1-2).
 *
 * This is the SINGLE hand-editable source of truth for bingo tile artwork:
 *  - `tools/download-bingo-art.ts` reads `wikiFile` from every entry to
 *    (re)download the actual image into
 *    `frontend/src/assets/Images/bosses/<slug>.png` (committed to the repo —
 *    the running app never hotlinks the OSRS wiki at runtime).
 *  - `frontend/src/data/bingoArt.ts` (the runtime resolver used by
 *    `BingoTile.tsx`) reads `canonical` + `aliases` to match a tile's
 *    free-text `task` to a `slug`, then loads the matching bundled image.
 *
 * This file has NO framework dependencies (no React, no `import.meta.glob`)
 * so it can be imported both by the Vite frontend build and directly by the
 * plain Bun download script.
 *
 * ## How to add or fix an entry
 *
 * 1. Find the image on the OSRS wiki (https://oldschool.runescape.wiki) —
 *    easiest way is the page's own infobox image (right-click it -> "Open
 *    image in new tab" and read the filename from the URL), or search
 *    `https://oldschool.runescape.wiki/w/Special:Search?search=<name>`.
 *    Copy the exact filename into `wikiFile` (spaces -> underscores;
 *    apostrophes/parens are kept as-is, the download script URL-encodes
 *    them for you).
 * 2. Pick a readable, stable, kebab-case `slug` — this becomes the
 *    committed asset's filename, so avoid renaming an existing one (it'll
 *    silently orphan the old file under assets/Images/bosses/).
 * 3. Set `canonical` to the EXACT string the admin board builder offers for
 *    this task — the real OSRS hiscores activity/skill name (see
 *    `GET /api/hiscores/activities/list` / `/skills/list`, or just open the
 *    board builder's autocomplete) — so a board-builder-picked tile always
 *    resolves without relying on an alias. For Drops tiles, `canonical` is
 *    the exact OSRS item name. Add any shorthand an admin might hand-type
 *    instead (e.g. "cox", "bandos") to `aliases`.
 * 4. Run `bun run tools/download-bingo-art.ts --only <slug>` (or with no
 *    `--only` to refresh everything) from the repo root to fetch the file.
 * 5. Unmatched tasks are NOT an error — BingoTile just falls back to the
 *    existing text-only tile design (see `resolveBingoArt` in
 *    `bingoArt.ts`). There's no need to cover every possible task; only
 *    add entries for things Alex's teams actually put on boards.
 */

export type BingoArtKind = 'boss' | 'skill' | 'item';

export interface BingoArtEntity {
  /** Asset filename (without extension) under assets/Images/bosses/. Stable — don't rename casually. */
  slug: string;
  kind: BingoArtKind;
  /**
   * The exact OSRS hiscores activity/skill name (Kill Count / Experience
   * tiles) or exact item name (Drops tiles) — the primary, highest-priority
   * match key.
   */
  canonical: string;
  /** Extra free-text shorthand an admin might hand-type instead of the canonical name (matched case-insensitively). */
  aliases?: string[];
  /** OSRS wiki file name this asset was sourced from (provenance + re-download key), e.g. "General_Graardor.png". */
  wikiFile: string;
}

export const BINGO_ART_ENTITIES: BingoArtEntity[] = [
  // ---------------------------------------------------------------------
  // Skills (Experience tiles) — skill cape "detail" renders, the same
  // clean, transparent, high-res image the wiki uses on its item infoboxes.
  // ---------------------------------------------------------------------
  { slug: 'skill-attack', kind: 'skill', canonical: 'Attack', wikiFile: 'Attack_cape_detail.png' },
  {
    slug: 'skill-defence',
    kind: 'skill',
    canonical: 'Defence',
    wikiFile: 'Defence_cape_detail.png',
  },
  {
    slug: 'skill-strength',
    kind: 'skill',
    canonical: 'Strength',
    wikiFile: 'Strength_cape_detail.png',
  },
  {
    slug: 'skill-hitpoints',
    kind: 'skill',
    canonical: 'Hitpoints',
    aliases: ['hp'],
    wikiFile: 'Hitpoints_cape_detail.png',
  },
  {
    slug: 'skill-ranged',
    kind: 'skill',
    canonical: 'Ranged',
    aliases: ['range'],
    wikiFile: 'Ranging_cape_detail.png',
  },
  { slug: 'skill-prayer', kind: 'skill', canonical: 'Prayer', wikiFile: 'Prayer_cape_detail.png' },
  {
    slug: 'skill-magic',
    kind: 'skill',
    canonical: 'Magic',
    aliases: ['mage'],
    wikiFile: 'Magic_cape_detail.png',
  },
  {
    slug: 'skill-cooking',
    kind: 'skill',
    canonical: 'Cooking',
    wikiFile: 'Cooking_cape_detail.png',
  },
  {
    slug: 'skill-woodcutting',
    kind: 'skill',
    canonical: 'Woodcutting',
    aliases: ['wc'],
    wikiFile: 'Woodcutting_cape_detail.png',
  },
  {
    slug: 'skill-fletching',
    kind: 'skill',
    canonical: 'Fletching',
    wikiFile: 'Fletching_cape_detail.png',
  },
  {
    slug: 'skill-fishing',
    kind: 'skill',
    canonical: 'Fishing',
    wikiFile: 'Fishing_cape_detail.png',
  },
  {
    slug: 'skill-firemaking',
    kind: 'skill',
    canonical: 'Firemaking',
    aliases: ['fm'],
    wikiFile: 'Firemaking_cape_detail.png',
  },
  {
    slug: 'skill-crafting',
    kind: 'skill',
    canonical: 'Crafting',
    wikiFile: 'Crafting_cape_detail.png',
  },
  {
    slug: 'skill-smithing',
    kind: 'skill',
    canonical: 'Smithing',
    wikiFile: 'Smithing_cape_detail.png',
  },
  { slug: 'skill-mining', kind: 'skill', canonical: 'Mining', wikiFile: 'Mining_cape_detail.png' },
  {
    slug: 'skill-herblore',
    kind: 'skill',
    canonical: 'Herblore',
    wikiFile: 'Herblore_cape_detail.png',
  },
  {
    slug: 'skill-agility',
    kind: 'skill',
    canonical: 'Agility',
    aliases: ['agi'],
    wikiFile: 'Agility_cape_detail.png',
  },
  {
    slug: 'skill-thieving',
    kind: 'skill',
    canonical: 'Thieving',
    wikiFile: 'Thieving_cape_detail.png',
  },
  { slug: 'skill-slayer', kind: 'skill', canonical: 'Slayer', wikiFile: 'Slayer_cape_detail.png' },
  {
    slug: 'skill-farming',
    kind: 'skill',
    canonical: 'Farming',
    wikiFile: 'Farming_cape_detail.png',
  },
  {
    slug: 'skill-runecraft',
    kind: 'skill',
    canonical: 'Runecraft',
    aliases: ['runecrafting', 'rc'],
    wikiFile: 'Runecraft_cape_detail.png',
  },
  { slug: 'skill-hunter', kind: 'skill', canonical: 'Hunter', wikiFile: 'Hunter_cape_detail.png' },
  {
    slug: 'skill-construction',
    kind: 'skill',
    canonical: 'Construction',
    aliases: ['con', 'con.'],
    wikiFile: 'Construct._cape_detail.png',
  },
  {
    slug: 'skill-sailing',
    kind: 'skill',
    canonical: 'Sailing',
    wikiFile: 'Sailing_cape_detail.png',
  },

  // ---------------------------------------------------------------------
  // Bosses / raids / minigames (Kill Count tiles) — `canonical` matches the
  // exact OSRS hiscores activity name (GET /api/hiscores/activities/list).
  // ---------------------------------------------------------------------
  {
    slug: 'abyssal-sire',
    kind: 'boss',
    canonical: 'Abyssal Sire',
    wikiFile: 'Abyssal_Sire_(phase_1).png',
  },
  {
    slug: 'alchemical-hydra',
    kind: 'boss',
    canonical: 'Alchemical Hydra',
    aliases: ['hydra'],
    wikiFile: 'Alchemical_Hydra_(serpentine).png',
  },
  { slug: 'amoxliatl', kind: 'boss', canonical: 'Amoxliatl', wikiFile: 'Amoxliatl.png' },
  { slug: 'araxxor', kind: 'boss', canonical: 'Araxxor', wikiFile: 'Araxxor.png' },
  { slug: 'artio', kind: 'boss', canonical: 'Artio', wikiFile: 'Artio.png' },
  // No single "Barrows" boss — six interchangeable brothers. Dharok is the
  // most widely recognized (brief: "use the six brothers or the
  // chest/tombstone render" — picking one clean brother render reads better
  // at tile size than a busy in-game screenshot of the crypt).
  {
    slug: 'barrows',
    kind: 'boss',
    canonical: 'Barrows Chests',
    aliases: ['barrows'],
    wikiFile: 'Dharok_the_Wretched.png',
  },
  { slug: 'brutus', kind: 'boss', canonical: 'Brutus', wikiFile: 'Brutus.png' },
  { slug: 'bryophyta', kind: 'boss', canonical: 'Bryophyta', wikiFile: 'Bryophyta.png' },
  { slug: 'callisto', kind: 'boss', canonical: 'Callisto', wikiFile: 'Callisto.png' },
  { slug: 'calvarion', kind: 'boss', canonical: "Calvar'ion", wikiFile: "Calvar'ion.png" },
  { slug: 'cerberus', kind: 'boss', canonical: 'Cerberus', wikiFile: 'Cerberus.png' },
  // Chambers of Xeric has no single boss render on the old board either —
  // the Great Olm (final boss) is THE recognizable CoX image; its render
  // even echoes the old board's green crystal/rock tile art.
  {
    slug: 'chambers-of-xeric',
    kind: 'boss',
    canonical: 'Chambers of Xeric',
    aliases: ['cox', 'chambers of xeric: challenge mode', 'cox cm', 'olm'],
    wikiFile: 'Great_Olm.png',
  },
  {
    slug: 'chaos-elemental',
    kind: 'boss',
    canonical: 'Chaos Elemental',
    wikiFile: 'Chaos_Elemental.png',
  },
  {
    slug: 'chaos-fanatic',
    kind: 'boss',
    canonical: 'Chaos Fanatic',
    wikiFile: 'Chaos_Fanatic.png',
  },
  {
    slug: 'commander-zilyana',
    kind: 'boss',
    canonical: 'Commander Zilyana',
    aliases: ['sara', 'saradomin', 'zilyana'],
    wikiFile: 'Commander_Zilyana.png',
  },
  {
    slug: 'corporeal-beast',
    kind: 'boss',
    canonical: 'Corporeal Beast',
    aliases: ['corp'],
    wikiFile: 'Corporeal_Beast.png',
  },
  {
    slug: 'crazy-archaeologist',
    kind: 'boss',
    canonical: 'Crazy Archaeologist',
    wikiFile: 'Crazy_archaeologist.png',
  },
  {
    slug: 'dagannoth-prime',
    kind: 'boss',
    canonical: 'Dagannoth Prime',
    wikiFile: 'Dagannoth_Prime.png',
  },
  {
    slug: 'dagannoth-rex',
    kind: 'boss',
    canonical: 'Dagannoth Rex',
    aliases: ['dks'],
    wikiFile: 'Dagannoth_Rex.png',
  },
  {
    slug: 'dagannoth-supreme',
    kind: 'boss',
    canonical: 'Dagannoth Supreme',
    wikiFile: 'Dagannoth_Supreme.png',
  },
  {
    slug: 'deranged-archaeologist',
    kind: 'boss',
    canonical: 'Deranged Archaeologist',
    wikiFile: 'Deranged_archaeologist.png',
  },
  {
    slug: 'doom-of-mokhaiotl',
    kind: 'boss',
    canonical: 'Doom of Mokhaiotl',
    aliases: ['doom'],
    wikiFile: 'Doom_of_Mokhaiotl.png',
  },
  {
    slug: 'duke-sucellus',
    kind: 'boss',
    canonical: 'Duke Sucellus',
    aliases: ['duke'],
    wikiFile: 'Duke_Sucellus.png',
  },
  {
    slug: 'general-graardor',
    kind: 'boss',
    canonical: 'General Graardor',
    aliases: ['bandos', 'graardor'],
    wikiFile: 'General_Graardor.png',
  },
  {
    slug: 'giant-mole',
    kind: 'boss',
    canonical: 'Giant Mole',
    aliases: ['mole'],
    wikiFile: 'Giant_Mole.png',
  },
  {
    slug: 'grotesque-guardians',
    kind: 'boss',
    canonical: 'Grotesque Guardians',
    aliases: ['gg', 'dusk', 'dawn'],
    wikiFile: 'Dawn.png',
  },
  { slug: 'hespori', kind: 'boss', canonical: 'Hespori', wikiFile: 'Hespori.png' },
  {
    slug: 'kalphite-queen',
    kind: 'boss',
    canonical: 'Kalphite Queen',
    aliases: ['kq'],
    wikiFile: 'Kalphite_Queen.png',
  },
  {
    slug: 'king-black-dragon',
    kind: 'boss',
    canonical: 'King Black Dragon',
    aliases: ['kbd'],
    wikiFile: 'King_Black_Dragon.png',
  },
  { slug: 'kraken', kind: 'boss', canonical: 'Kraken', wikiFile: 'Kraken.png' },
  {
    slug: 'kreearra',
    kind: 'boss',
    canonical: "Kree'Arra",
    aliases: ['arma', 'armadyl', 'kree'],
    wikiFile: "Kree'arra.png",
  },
  {
    slug: 'kril-tsutsaroth',
    kind: 'boss',
    canonical: "K'ril Tsutsaroth",
    aliases: ['zammy', 'zamorak', 'kril'],
    wikiFile: "K'ril_Tsutsaroth.png",
  },
  { slug: 'maggot-king', kind: 'boss', canonical: 'Maggot King', wikiFile: 'Maggot_King.png' },
  { slug: 'mimic', kind: 'boss', canonical: 'Mimic', wikiFile: 'Mimic_detail.png' },
  { slug: 'nex', kind: 'boss', canonical: 'Nex', wikiFile: 'Nex.png' },
  {
    slug: 'nightmare',
    kind: 'boss',
    canonical: 'Nightmare',
    aliases: ["phosani's nightmare", 'phosani', 'the nightmare'],
    wikiFile: 'The_Nightmare.png',
  },
  { slug: 'obor', kind: 'boss', canonical: 'Obor', wikiFile: 'Obor.png' },
  {
    slug: 'phantom-muspah',
    kind: 'boss',
    canonical: 'Phantom Muspah',
    aliases: ['muspah'],
    wikiFile: 'Phantom_Muspah_(ranged).png',
  },
  { slug: 'sarachnis', kind: 'boss', canonical: 'Sarachnis', wikiFile: 'Sarachnis.png' },
  { slug: 'scorpia', kind: 'boss', canonical: 'Scorpia', wikiFile: 'Scorpia.png' },
  { slug: 'scurrius', kind: 'boss', canonical: 'Scurrius', wikiFile: 'Scurrius.png' },
  {
    slug: 'shellbane-gryphon',
    kind: 'boss',
    canonical: 'Shellbane Gryphon',
    aliases: ['gryphon'],
    wikiFile: 'Shellbane_gryphon.png',
  },
  { slug: 'skotizo', kind: 'boss', canonical: 'Skotizo', wikiFile: 'Skotizo.png' },
  {
    slug: 'sol-heredit',
    kind: 'boss',
    canonical: 'Sol Heredit',
    aliases: ['colosseum', 'fortis colosseum'],
    wikiFile: 'Sol_Heredit.png',
  },
  { slug: 'spindel', kind: 'boss', canonical: 'Spindel', wikiFile: 'Spindel.png' },
  {
    slug: 'tempoross',
    kind: 'boss',
    canonical: 'Tempoross',
    aliases: ['tempo'],
    wikiFile: 'Tempoross.png',
  },
  {
    slug: 'the-gauntlet',
    kind: 'boss',
    canonical: 'The Gauntlet',
    aliases: ['gauntlet'],
    wikiFile: 'Crystalline_Hunllef.png',
  },
  {
    slug: 'the-corrupted-gauntlet',
    kind: 'boss',
    canonical: 'The Corrupted Gauntlet',
    aliases: ['corrupted gauntlet', 'cg'],
    wikiFile: 'Corrupted_Hunllef.png',
  },
  {
    slug: 'the-hueycoatl',
    kind: 'boss',
    canonical: 'The Hueycoatl',
    aliases: ['hueycoatl'],
    wikiFile: 'The_Hueycoatl.png',
  },
  {
    slug: 'the-leviathan',
    kind: 'boss',
    canonical: 'The Leviathan',
    aliases: ['leviathan', 'lev'],
    wikiFile: 'The_Leviathan.png',
  },
  {
    slug: 'the-royal-titans',
    kind: 'boss',
    canonical: 'The Royal Titans',
    aliases: ['royal titans', 'eldric', 'branda'],
    wikiFile: 'Eldric_the_Ice_King.png',
  },
  {
    slug: 'the-whisperer',
    kind: 'boss',
    canonical: 'The Whisperer',
    aliases: ['whisperer'],
    wikiFile: 'The_Whisperer.png',
  },
  // Theatre of Blood has no single "boss" either — Verzik Vitur (final boss)
  // is the room most players screenshot and matches the old board's
  // purple-and-yellow ToB tile art.
  {
    slug: 'theatre-of-blood',
    kind: 'boss',
    canonical: 'Theatre of Blood',
    aliases: ['tob', 'theatre of blood: hard mode', 'tob hmt', 'verzik'],
    wikiFile: 'Verzik_Vitur.png',
  },
  {
    slug: 'thermonuclear-smoke-devil',
    kind: 'boss',
    canonical: 'Thermonuclear Smoke Devil',
    aliases: ['tnsd', 'smoke devil'],
    wikiFile: 'Thermonuclear_smoke_devil.png',
  },
  // Tombs of Amascut: the Wardens (final boss room) are the recognizable
  // "raid entity" image, same idea as CoX/ToB above.
  {
    slug: 'tombs-of-amascut',
    kind: 'boss',
    canonical: 'Tombs of Amascut',
    aliases: ['toa', 'tombs of amascut: expert mode', 'toa expert', 'warden', 'wardens'],
    wikiFile: "Tumeken's_Warden.png",
  },
  {
    slug: 'tzkal-zuk',
    kind: 'boss',
    canonical: 'TzKal-Zuk',
    aliases: ['zuk', 'inferno'],
    wikiFile: 'TzKal-Zuk.png',
  },
  {
    slug: 'tztok-jad',
    kind: 'boss',
    canonical: 'TzTok-Jad',
    aliases: ['jad', 'fight caves', 'fight cave'],
    wikiFile: 'TzTok-Jad.png',
  },
  { slug: 'vardorvis', kind: 'boss', canonical: 'Vardorvis', wikiFile: 'Vardorvis.png' },
  { slug: 'venenatis', kind: 'boss', canonical: 'Venenatis', wikiFile: 'Venenatis.png' },
  { slug: 'vetion', kind: 'boss', canonical: "Vet'ion", wikiFile: "Vet'ion.png" },
  {
    slug: 'vorkath',
    kind: 'boss',
    canonical: 'Vorkath',
    aliases: ['vork'],
    wikiFile: 'Vorkath.png',
  },
  {
    slug: 'wintertodt',
    kind: 'boss',
    canonical: 'Wintertodt',
    aliases: ['wt'],
    wikiFile: 'Bruma_roots.png',
  },
  { slug: 'yama', kind: 'boss', canonical: 'Yama', wikiFile: 'Yama.png' },
  { slug: 'zalcano', kind: 'boss', canonical: 'Zalcano', wikiFile: 'Zalcano_(weakened).png' },
  { slug: 'zulrah', kind: 'boss', canonical: 'Zulrah', wikiFile: 'Zulrah_(serpentine).png' },

  // ---------------------------------------------------------------------
  // Notable drop items (Drops tiles) — the wiki's "detail" render, matching
  // the old board's item-icon style. Deliberately a small curated set of
  // common bingo drop targets, not the whole item DB (Drops tiles are free
  // text off the full ~4000-item OSRS price list — see BoardBuilder's
  // Autocomplete — so most Drops tiles will legitimately fall back to
  // text-only; add more entries here as Alex's boards need them).
  // ---------------------------------------------------------------------
  {
    slug: 'twisted-bow',
    kind: 'item',
    canonical: 'Twisted bow',
    aliases: ['tbow'],
    wikiFile: 'Twisted_bow_detail.png',
  },
  {
    slug: 'scythe-of-vitur',
    kind: 'item',
    canonical: 'Scythe of vitur',
    aliases: ['scythe'],
    wikiFile: 'Scythe_of_vitur_detail.png',
  },
  {
    slug: 'tumekens-shadow',
    kind: 'item',
    canonical: "Tumeken's shadow",
    aliases: ['shadow'],
    wikiFile: "Tumeken's_shadow_detail.png",
  },
  {
    slug: 'elysian-spirit-shield',
    kind: 'item',
    canonical: 'Elysian spirit shield',
    aliases: ['ely'],
    wikiFile: 'Elysian_spirit_shield_detail.png',
  },
  {
    slug: 'dragon-warhammer',
    kind: 'item',
    canonical: 'Dragon warhammer',
    aliases: ['dwh'],
    wikiFile: 'Dragon_warhammer_detail.png',
  },
  {
    slug: 'dragon-claws',
    kind: 'item',
    canonical: 'Dragon claws',
    aliases: ['d claws'],
    wikiFile: 'Dragon_claws_detail.png',
  },
  {
    slug: 'ancestral-hat',
    kind: 'item',
    canonical: 'Ancestral hat',
    aliases: ['ancestral'],
    wikiFile: 'Ancestral_hat_detail.png',
  },
  {
    slug: 'bandos-chestplate',
    kind: 'item',
    canonical: 'Bandos chestplate',
    wikiFile: 'Bandos_chestplate_detail.png',
  },
  {
    slug: 'armadyl-helmet',
    kind: 'item',
    canonical: 'Armadyl helmet',
    wikiFile: 'Armadyl_helmet_detail.png',
  },
  {
    slug: 'dinhs-bulwark',
    kind: 'item',
    canonical: "Dinh's bulwark",
    aliases: ['bulwark'],
    wikiFile: "Dinh's_bulwark_detail.png",
  },
  {
    slug: 'ghrazi-rapier',
    kind: 'item',
    canonical: 'Ghrazi rapier',
    aliases: ['rapier'],
    wikiFile: 'Ghrazi_rapier_detail.png',
  },
  {
    slug: 'avernic-defender-hilt',
    kind: 'item',
    canonical: 'Avernic defender hilt',
    aliases: ['avernic hilt'],
    wikiFile: 'Avernic_defender_hilt_detail.png',
  },
  {
    slug: 'kodai-insignia',
    kind: 'item',
    canonical: 'Kodai insignia',
    aliases: ['kodai'],
    wikiFile: 'Kodai_insignia_detail.png',
  },
  {
    slug: 'dragonfire-shield',
    kind: 'item',
    canonical: 'Dragonfire shield',
    aliases: ['dfs'],
    wikiFile: 'Dragonfire_shield_detail.png',
  },
  {
    slug: 'primordial-boots',
    kind: 'item',
    canonical: 'Primordial boots',
    aliases: ['prims'],
    wikiFile: 'Primordial_boots_detail.png',
  },
  {
    slug: 'occult-necklace',
    kind: 'item',
    canonical: 'Occult necklace',
    aliases: ['occult'],
    wikiFile: 'Occult_necklace_detail.png',
  },
  {
    slug: 'torva-full-helm',
    kind: 'item',
    canonical: 'Torva full helm',
    aliases: ['torva'],
    wikiFile: 'Torva_full_helm_detail.png',
  },
  {
    slug: 'justiciar-faceguard',
    kind: 'item',
    canonical: 'Justiciar faceguard',
    aliases: ['justiciar'],
    wikiFile: 'Justiciar_faceguard_detail.png',
  },
  { slug: 'voidwaker', kind: 'item', canonical: 'Voidwaker', wikiFile: 'Voidwaker_detail.png' },
  {
    slug: 'venator-bow',
    kind: 'item',
    canonical: 'Venator bow',
    wikiFile: 'Venator_bow_detail.png',
  },
  {
    slug: 'ancient-sceptre',
    kind: 'item',
    canonical: 'Ancient sceptre',
    wikiFile: 'Ancient_sceptre_detail.png',
  },
];
