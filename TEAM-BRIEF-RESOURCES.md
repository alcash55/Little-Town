# TEAM BRIEF — Resource Library (OSRS boss/activity resources page)

Goal: turn the raw Discord #resources export into a polished, browsable,
extensible Resource Library in the app. Source material (repo root,
untracked): `resources.md` (6085 lines) and `resourcesMedia/` (84 folders,
~332 MB, named by Discord message id). Two roles, disjoint file ownership.
Nobody touches TEAM-BRIEF.md (a different sprint's brief),
TEAM-BRIEF-RESOURCES.md, todo.md, or .env.

## Product intent (from Alex)
- Grouped by boss/activity. There is a LOT of boss data — the UI must NOT be
  overwhelming: easy to scan, drill into one boss at a time, find a thing
  fast.
- Designed so Alex can keep ADDING/EDITING resources over time — the data is
  a documented, hand-editable JSON file; adding a resource = drop an image in
  the assets folder + add a JSON entry.
- RuneLite JSON (tile markers / NPC radius markers) is meant to be
  copy-pasted into RuneLite. The UI must NOT dump the full JSON on the page —
  show a labeled control with a one-click **Copy** that puts the full JSON on
  the clipboard. A collapsed/preview affordance is fine; the raw blob must not
  bloat the layout.
- Should look designed by a senior product designer — clean, calm, OSRS-
  appropriate but not garish; consistent with the app's existing dark theme.

## THE DATA CONTRACT (both roles build to this — do not drift)

Manifest file: `frontend/src/data/resources.json`
Images: `frontend/src/assets/Images/resources/<category-id>/<slug>.<ext>`
  (png/jpg/jpeg/webp/gif only — see media rules). Image field values in JSON
  are the path RELATIVE to `.../assets/Images/resources/`, e.g.
  `"tob/hm-big-split-markers.jpg"`.

```jsonc
{
  "generatedAt": "ISO-8601",
  "categories": [
    {
      "id": "tob",                 // kebab, stable, used in image paths + URL hash
      "name": "Theatre of Blood",
      "group": "Raids",            // optional coarse grouping label (Raids, Solo PvM, Skilling, Other)
      "order": 1,
      "sections": [
        {
          "kind": "guides",        // one of: guides | tileMarkers | dataSheets | media | tools | text
          "title": "Guides & videos",
          "items": [
            {
              "id": "tob-bad-crabs",          // unique across the whole file
              "title": "Bad crabs (P2 crab pattern)",
              "description": "optional short human blurb; keep it tight",
              "images": ["tob/bad-crabs.jpg"], // 0+; omit key if none
              "links": [                        // 0+; omit key if none
                { "label": "YouTube", "url": "https://…", "kind": "youtube" }
              ],
              "runelite": {                     // optional; present only for copy-paste configs
                "label": "HM Big Split — radius markers",
                "kind": "npcMarkers",           // npcMarkers | tileMarkers | other
                "json": "<the FULL raw json string, verbatim>"
              }
            }
          ]
        }
      ]
    }
  ]
}
```
link `kind`: youtube | streamable | imgur | sheet | wiki | other (drives the
icon the frontend shows).

## Story R1 — data-engineer: content transform + media
Owns: `frontend/src/assets/Images/resources/**` (new), `frontend/src/data/resources.json`
(new), `frontend/src/data/README.md` (new — schema + "how to add a resource"),
`scripts/build-resources.ts` (new, repo-root scripts/), and DELETING the root
`resources.md` + `resourcesMedia/` when done. Touch nothing in
frontend/src/components.

a. Parse resources.md's 14 categories (ToB, ToA, CoX, Yama, Colosseum,
   Inferno & Fight Caves, DT2 Bosses, Nex, Gauntlet, NMZ, Slayer & General
   PvM, Skilling & Utility, Unsorted) into the manifest. Map its subsection
   headings to the six `kind`s. Give each category a clean display name +
   stable kebab id + group.
b. Rename & move media: from `resourcesMedia/<discordId>/NN-<name>.ext` to
   `frontend/src/assets/Images/resources/<category-id>/<descriptive-slug>.<ext>`.
   Slugs are human-readable and derived from the item title, de-duplicated.
c. **Media rules**: only png/jpg/jpeg/webp/gif go into assets. Video (mp4,
   mkv), audio (wav), archives (zip) are NOT committed to the bundle — if the
   item has an external link (YouTube/Streamable/imgur), keep the item with
   the link and drop the heavy local file; if it is ONLY a heavy local file
   with no external source, drop the item and list it in your report so Alex
   can decide later. `.txt` files are RuneLite JSON payloads — inline their
   contents verbatim into the item's `runelite.json` (they are referenced in
   the md as embedded-file message.txt near the ```json blocks).
d. **Game-relevance pass (judgment)**: cut obvious noise — base64/garbage-
   named data fragments that aren't readable, duplicate embed-thumbnails,
   one-off screenshots with no instructional value, non-OSRS/off-topic
   messages. Keep guides, setups, tile/NPC markers, useful data sheets/DPS
   sheets, tools/plugins. When unsure, keep but write a tight description.
   Report roughly how many items you cut and why.
e. `scripts/build-resources.ts`: the repeatable transformer you used, so a
   future re-dump can be re-processed. But document in the README that the
   ongoing edit workflow is hand-editing resources.json + dropping an image —
   resources.json is the source of truth from here on, resources.md is not
   kept.
f. Deliver a SMALL slice FIRST and report its path early if you can (e.g. ToB
   fully done: its images moved + its JSON entries) so the frontend can wire
   real data before you finish all 14 — then complete the rest.
g. Verify the JSON parses (`bun -e "JSON.parse(...)"`) and every image path in
   it exists on disk; report counts (categories, items, images, cut items).

## Story R2 — frontend: the Resource Library page (USE A REAL BROWSER)
Owns: `frontend/src/components/Pages/Resources/**` (replace the 10-line stub),
nothing else — the route (`/Resources`, public) and the sidebar entry already
exist.

a. Image loader: resolve JSON image paths → bundled URLs via
   `import.meta.glob('/src/assets/Images/resources/**/*.{png,jpg,jpeg,webp,gif}',
   { eager: true, import: 'default' })`, keyed by the path after `resources/`.
   A missing image degrades to a placeholder, never a broken img.
b. Layout: category-first navigation (sidebar/rail or a category grid) so the
   user picks a boss, then sees that boss's sections. Within a category, group
   items by section kind with clear headers. Must stay scannable with 14
   categories and dozens of items — lazy-render offscreen content, don't dump
   everything at once.
c. Search/filter across titles + descriptions (client-side), and it should be
   obvious how to jump between categories.
d. Item cards: title, optional description, image thumbnail(s) that open in a
   lightbox/zoom (reuse the app's existing image-zoom pattern if there is
   one), external links rendered as labeled buttons with an icon per `kind`.
e. RuneLite configs: a compact control (e.g. a card row "RuneLite: HM Big
   Split — radius markers" + a **Copy** button) that copies `runelite.json` to
   the clipboard via navigator.clipboard, with a "Copied!" confirmation. Do
   NOT render the full JSON inline; an optional collapsed "preview first line"
   is fine. Multiple configs per category are common.
f. Empty/loading states, responsive, keyboard-accessible, matches the app's
   dark theme (reuse theme tokens; the Select-contrast fix already landed).
   Strict TS, no `any`.
g. Build order: implement everything against a 3–4 item inline fixture (define
   it matching the DATA CONTRACT exactly; for sample images copy 2–3 existing
   files from src/assets/Images into a temp path you own under the Resources
   folder, or reference existing bundled assets) so you can fully drive
   interactions before R1's real data lands. The real resources.json + images
   get wired at integration by the lead.
h. VERIFY IN A REAL BROWSER. The Playwright MCP server needs system Chrome,
   which isn't installed here; use the cached Chromium Playwright runtime
   instead (chromium at ~/.cache/ms-playwright/chromium-1228; pattern:
   `bun add playwright@1.61.1` in a scratch dir, launch chromium headless,
   drive http://localhost:3000/Resources). The frontend dev server is on
   :3000. Screenshot the page, exercise: category switch, search, image
   lightbox, and the RuneLite Copy button (assert the clipboard got the full
   JSON). Report with screenshots described and zero console errors.

## Done-criteria
Both branches merge; lead swaps the fixture for the real manifest, drives the
real page in a browser, qa-reviewer verifies. tsc + build clean; no `any`;
root resources.md / resourcesMedia removed; repo not bloated with video/zip.
