# Resource Library data

`resources.json` is the **source of truth** for the OSRS Resource Library
page (`/Resources`). There is no database table and no build step required
to edit it — hand-edit the JSON directly and drop images into
`frontend/src/assets/Images/resources/<category-id>/`.

The original Discord export (`resources.md` + `resourcesMedia/`, previously
at the repo root) was a one-time source used to generate the first version
of this file via `tools/build-resources.ts`, then deleted. Don't recreate
it as the live data source — this JSON file is what the frontend reads and
what Alex should keep editing.

## Schema

```jsonc
{
  "generatedAt": "ISO-8601",           // informational only, not read by the frontend
  "categories": [
    {
      "id": "tob",                     // kebab-case, STABLE — used in image paths and the URL hash, don't rename casually
      "name": "Theatre of Blood",      // display name
      "group": "Raids",                // coarse grouping shown in category navigation (Raids, Bosses, PvM & Slayer, Skilling, Other)
      "order": 1,                      // display order within its group / overall list
      "sections": [
        {
          "kind": "guides",            // one of: guides | tileMarkers | dataSheets | media | tools | text
          "title": "Guides & videos",  // section heading shown in the UI
          "items": [
            {
              "id": "tob-bad-crabs",           // unique ACROSS THE WHOLE FILE, kebab-case
              "title": "Bad crabs (P2 crab pattern)",
              "description": "optional short blurb, keep it tight",
              "images": ["tob/bad-crabs.jpg"], // 0+ paths, RELATIVE to assets/Images/resources/ — omit the key entirely if there are none
              "links": [                        // 0+ external links — omit the key if there are none
                { "label": "YouTube", "url": "https://…", "kind": "youtube" }
              ],
              "runelite": {                      // omit entirely unless this item has a copy-paste RuneLite config
                "label": "HM Big Split — radius markers",
                "kind": "npcMarkers",             // npcMarkers | tileMarkers | other
                "json": "<the full raw payload, verbatim, as one string>"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

- `link.kind` drives which icon the frontend shows: `youtube | streamable |
  imgur | sheet | wiki | other`.
- `runelite.json` is a **string**, not a nested JSON object — it's the exact
  text a user pastes into RuneLite (or another plugin's config box), so keep
  it verbatim even if it isn't "pretty" JSON (e.g. some Object Indicators
  configs are a `key=[...]` line, not a bare array — that's fine, that's
  `kind: "other"`).
- Image paths never include `assets/Images/resources/` — that prefix is
  implied. `"tob/bad-crabs.jpg"` resolves to
  `frontend/src/assets/Images/resources/tob/bad-crabs.jpg`.

## How to add a resource

1. Drop the image(s) into
   `frontend/src/assets/Images/resources/<category-id>/`, named descriptively
   in kebab-case (`verzik-p3-tick-chart.png`, not `image1.png`). Only
   `png | jpg | jpeg | webp | gif` — no video/audio/zip in the bundle. If the
   source is a video, link out to YouTube/Streamable instead of embedding the
   file.
2. Add an entry to the matching category → section (by `kind`) in
   `resources.json`. Give the item a unique `id` (prefix it with the category
   id, e.g. `tob-...`, to keep collisions unlikely).
3. If it's a new category, add a new object to `categories` with a fresh
   `id`/`name`/`group`/`order`, and create the matching
   `assets/Images/resources/<new-id>/` folder when you add its first image.
4. Verify the JSON still parses (`bun -e "JSON.parse(require('fs').readFileSync('frontend/src/data/resources.json','utf8'))"`)
   and that every path under `images` exists on disk before committing.

No rebuild/regeneration step is needed — the frontend reads this file (and
resolves image paths via `import.meta.glob`) directly.

## Re-running the transformer

`tools/build-resources.ts` (repo root) is kept as a repeatable transformer
in case a future Discord re-dump needs processing the same way (parses a
`resources.md` + `resourcesMedia/` export at the repo root into this
contract). It is **not** part of the day-to-day edit workflow — running it
against a `resources.json` that has since been hand-edited will overwrite
whatever categories it processes. See the header comment in that file for
usage (`--only <category-id,...>` to limit which categories a run touches).

## Bingo tile artwork (`bingoArtEntities.ts`)

`bingoArtEntities.ts` is the hand-editable source of truth for the boss /
skill / item renders shown on bingo tiles (`BingoTile.tsx`, via the
`resolveBingoArt()` matcher in `bingoArt.ts`). Full instructions (how to
find a wiki file, pick a slug, add aliases) are in the doc comment at the
top of that file — short version:

1. Add an entry to the `BINGO_ART_ENTITIES` array with a stable kebab-case
   `slug`, the exact OSRS hiscores activity/skill/item name as `canonical`,
   and any shorthand an admin might type as `aliases`.
2. Run `bun run tools/download-bingo-art.ts --only <slug>` from the repo
   root to fetch the image into
   `frontend/src/assets/Images/bosses/<slug>.png` (committed to the repo —
   the app never hotlinks the wiki at runtime).
3. Unmapped tasks always degrade to the existing text-only tile design, so
   there's no need to cover every possible task — only add what Alex's
   boards actually use.
