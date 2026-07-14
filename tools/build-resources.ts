#!/usr/bin/env bun
/**
 * build-resources.ts — repeatable transformer for the OSRS Resource Library.
 *
 * Lives in repo-root `tools/` rather than `backend/scripts/` (TEAM-BRIEF.md
 * Sprint 6, Track A item 4 — repo hygiene: top-level scripts/ shouldn't
 * stand alone): it has zero backend runtime dependencies (no Supabase, no
 * Discord API, no backend env vars) and both reads and writes repo-root/
 * frontend paths, so it doesn't belong inside backend/ either. Genuinely
 * cross-cutting, hence `tools/` per the brief's own carve-out rather than
 * `backend/scripts/` (where `dumpChannelToMarkdown.ts`, the actual Discord
 * dump tool, already lives — that one needs backend's Discord bot
 * credentials and is a true backend concern).
 *
 * Parses the raw Discord #resources export (repo-root `resources.md` +
 * `resourcesMedia/<discordMessageId>/NN-<name>.ext`) into the app's data
 * contract:
 *   - frontend/src/data/resources.json   (the manifest)
 *   - frontend/src/assets/Images/resources/<category-id>/<slug>.<ext>
 *
 * This is the tool used to produce that manifest from the original export.
 * It is NOT the ongoing edit workflow — once resources.json exists, hand-edit
 * it directly (see frontend/src/data/README.md). Re-running this script
 * overwrites the categories it processes, so don't run it over a manifest
 * that has since been hand-edited unless you mean to blow those edits away.
 *
 * Usage (run from the repo root):
 *   bun run tools/build-resources.ts                 # process every category
 *   bun run tools/build-resources.ts --only tob,toa   # process a subset only
 *                                                      # (merges into any
 *                                                      # existing manifest;
 *                                                      # categories not
 *                                                      # listed are left
 *                                                      # untouched)
 *
 * Source docs read from repo root: resources.md, resourcesMedia/.
 * Both are deleted once the full manifest has been generated and verified
 * (see the report the data-engineer agent produces after running this).
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  copyFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MD_PATH = path.join(REPO_ROOT, "resources.md");
const MEDIA_DIR = path.join(REPO_ROOT, "resourcesMedia");
const OUT_JSON = path.join(REPO_ROOT, "frontend/src/data/resources.json");
const ASSETS_DIR = path.join(REPO_ROOT, "frontend/src/assets/Images/resources");

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

// ---------------------------------------------------------------------------
// Category + section metadata (hand-curated display names / grouping / order)
// ---------------------------------------------------------------------------

interface CategoryMeta {
  id: string;
  name: string;
  group: string;
  order: number;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  "Raids - Theatre of Blood (ToB)": { id: "tob", name: "Theatre of Blood", group: "Raids", order: 1 },
  "Raids - Tombs of Amascut (ToA)": { id: "toa", name: "Tombs of Amascut", group: "Raids", order: 2 },
  "Raids - Chambers of Xeric (CoX)": { id: "cox", name: "Chambers of Xeric", group: "Raids", order: 3 },
  Yama: { id: "yama", name: "Yama", group: "Bosses", order: 4 },
  "The Colosseum": { id: "colosseum", name: "Fortis Colosseum", group: "Bosses", order: 5 },
  "Inferno and Fight Caves": { id: "inferno-fight-caves", name: "Inferno & Fight Caves", group: "Bosses", order: 6 },
  "Desert Treasure II Bosses": { id: "dt2-bosses", name: "Desert Treasure II Bosses", group: "Bosses", order: 7 },
  Nex: { id: "nex", name: "Nex", group: "Bosses", order: 8 },
  Gauntlet: { id: "gauntlet", name: "Gauntlet", group: "Bosses", order: 9 },
  "Nightmare Zone": { id: "nmz", name: "Nightmare Zone", group: "PvM & Slayer", order: 10 },
  "Slayer and General PvM": { id: "slayer-general-pvm", name: "Slayer & General PvM", group: "PvM & Slayer", order: 11 },
  "Skilling and Utility": { id: "skilling-utility", name: "Skilling & Utility", group: "Skilling", order: 12 },
  "Unsorted OSRS Resources": { id: "unsorted", name: "Unsorted", group: "Other", order: 13 },
};

const SECTION_META: Record<string, { kind: string; title: string }> = {
  "Guides and videos": { kind: "guides", title: "Guides & videos" },
  "Tile markers and setups": { kind: "tileMarkers", title: "Tile markers & setups" },
  "Data sheets and theory": { kind: "dataSheets", title: "Data sheets & theory" },
  "Media files": { kind: "media", title: "Media" },
  "Tools and plugins": { kind: "tools", title: "Tools & plugins" },
  "Text/config files": { kind: "text", title: "Text & config files" },
};

const LINK_KIND_BY_DOMAIN: [string, string][] = [
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
  ["streamable.com", "streamable"],
  ["imgur.com", "imgur"],
  ["googleusercontent.com", "sheet"],
  ["docs.google", "sheet"],
  ["runescape.wiki", "wiki"],
];

function linkKind(url: string): string {
  const lower = url.toLowerCase();
  for (const [domain, kind] of LINK_KIND_BY_DOMAIN) {
    if (lower.includes(domain)) return kind;
  }
  return "other";
}

// ---------------------------------------------------------------------------
// Judgment-pass overrides (see the delivery report for rationale on each).
// Keyed by the discord message id embedded in the source media path, or by
// exact original raw title when there's no media id to key off.
// ---------------------------------------------------------------------------

/** Cut entirely: no instructional/game value. */
const CUT_MESSAGE_IDS = new Set<string>([
  "1043971308586815549", // blank "NPC ID: 0" field screenshot, nothing shown
]);

/** Clearly mis-filed under "Unsorted" in the source dump; move to their real category. */
const RECATEGORIZE: Record<string, { categoryId: string; sectionKind: string; title?: string }> = {
  "1097072796045152296": {
    categoryId: "tob",
    sectionKind: "dataSheets",
    title: "Verzik P3 scythe/dawnbringer tick chart (5-scythe godbooking)",
  },
  "1308948919148871772": {
    categoryId: "toa",
    sectionKind: "tileMarkers",
    title: "ToA room layout reference (numbered position markers)",
  },
  "1019479695990984714": {
    categoryId: "toa",
    sectionKind: "dataSheets",
    title: "Raid level vs unique drop rate table",
  },
  "1189262940449280060": {
    categoryId: "gauntlet",
    sectionKind: "dataSheets",
    title: 'Gear vs Hunllef HP% swap-timing table ("no sweet before crystal")',
  },
};

/** Long sentence-as-title source messages: shorten the title, keep the full text as description. */
const RETITLE_BY_RAW_TITLE: Record<string, { title: string; description: string }> = {
  "Was curious and threw the tob mvp pts vs rate on a graph and was surprised it was a linear relationship. In 3's every mvp point is a +0.16% chance and 4's +0.13%. This means that 3s gives +2.24% extra chance and 4s +1.82% with all mvp pts. This is all assuming 0 deaths. Deaths are extremely bad every death is -0.65% in 3s and -0.51 in 4s, which is kinda fair ig.":
    {
      title: "ToB MVP points vs purple chance (linear relationship)",
      description:
        "MVP points vs purple chance is linear: each MVP point is +0.16% (trio) / +0.13% (duo). Trio gives +2.24% total, duo +1.82%, all assuming 0 deaths. Deaths hurt: -0.65% per death in trio, -0.51% in duo.",
    },
  "i've been playing around with radius markers and akkha has 4 different NPC ID's so you can tag them different colours if you happen to struggle noticing his prayer changes :3":
    {
      title: "Akkha radius markers by NPC ID (per prayer-switch phase)",
      description:
        "Akkha has 4 different NPC IDs across his phases, so you can give each one a different radius-marker colour to make his prayer switches easier to notice.",
    },
  "Not sure how accurate this is but according to this it doesn't matter how big your group is. One will always have same chance of obtaining purple and should be same gp/h to solo or group. Of course groups will receive purples more often but if they are also split it's same gp/h. Deaths are not that punishing (in solo).":
    {
      title: "ToA purple chance is independent of group size",
      description:
        "Per-player purple chance is the same solo or in a group (groups just see more purples overall since more players are rolling), so gp/h nets out the same when split. Deaths are not very punishing solo.",
    },
  "Visual metronome with 6 colours, blue on 3, green on 4. Optionally red on 2 but that fremennik dies right away. These numbers just mean that if you see one of these colours, you want to be moving or I guess pray on the next game tick to avoid frem damage. So you know when you can attack them freely.":
    {
      title: "Wave-start visual metronome (6-colour tick reference)",
      description:
        "Blue = move/pray on tick 3, green = tick 4, optional red = tick 2 (that fremennik dies immediately). Use it to know when it's safe to attack freely between fremennik spawns.",
    },
  "heres all the sounds u gotta remove from hydra + extra": {
    title: "Alchemical Hydra: sound effect IDs to mute",
    description: "Mute these sound effect IDs during Alchemical Hydra kills to cut down on audio clutter.",
  },
};

// ---------------------------------------------------------------------------
// Markdown parsing
// ---------------------------------------------------------------------------

interface RawImage {
  alt: string;
  target: string;
}
interface RawLink {
  label: string;
  target: string;
}
interface RawItem {
  rawTitle: string;
  images: RawImage[];
  links: RawLink[];
  embeddedFile?: string;
  fenceLang?: string;
  fenceContent?: string;
}
interface RawSection {
  heading: string;
  items: RawItem[];
}
interface RawCategory {
  heading: string;
  sections: RawSection[];
}

const IMAGE_ANGLE_RE = /^(\s*)- !\[([^\]]*)\]\(<([^>]+)>\)\s*$/;
const IMAGE_PLAIN_RE = /^(\s*)- !\[([^\]]*)\]\(([^)]+)\)\s*$/;
const LINK_ANGLE_RE = /^(\s*)- \[([^\]]*)\]\(<([^>]+)>\)\s*$/;
const LINK_PLAIN_RE = /^(\s*)- \[([^\]]*)\]\(([^)]+)\)\s*$/;
const BOLD_TITLE_RE = /^- \*\*(.+)\*\*\s*$/;
const PLAIN_TITLE_RE = /^- (.+)$/;
const EMBEDDED_FILE_RE = /^\s*<!-- embedded-file: (.+) -->\s*$/;
const FENCE_START_RE = /^\s*```(\w+)\s*$/;
const FENCE_END_RE = /^\s*```\s*$/;

function parseMarkdown(md: string): RawCategory[] {
  const lines = md.split("\n");
  const categories: RawCategory[] = [];
  let curCategory: RawCategory | null = null;
  let curSection: RawSection | null = null;
  let curItem: RawItem | null = null;
  let inFence = false;
  let fenceLines: string[] = [];

  const flushItem = () => {
    if (curItem && curSection) {
      if (fenceLines.length) curItem.fenceContent = fenceLines.join("\n");
      curSection.items.push(curItem);
    }
    curItem = null;
    fenceLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");

    if (inFence) {
      if (FENCE_END_RE.test(line)) {
        inFence = false;
        continue;
      }
      fenceLines.push(line.replace(/^  /, ""));
      continue;
    }

    let m: RegExpMatchArray | null;

    if ((m = line.match(/^## (.+)$/))) {
      flushItem();
      curCategory = { heading: m[1].trim(), sections: [] };
      categories.push(curCategory);
      curSection = null;
      continue;
    }
    if ((m = line.match(/^### (.+)$/))) {
      flushItem();
      curSection = { heading: m[1].trim(), items: [] };
      curCategory!.sections.push(curSection);
      continue;
    }
    if (line.startsWith("  ```") && (m = line.match(FENCE_START_RE))) {
      inFence = true;
      fenceLines = [];
      if (curItem) curItem.fenceLang = m[1];
      continue;
    }
    if (line.startsWith("  <!--") && (m = line.match(EMBEDDED_FILE_RE))) {
      if (curItem) curItem.embeddedFile = m[1].trim();
      continue;
    }
    // indented (sub-line) image
    if (((m = line.match(IMAGE_ANGLE_RE)) || (m = line.match(IMAGE_PLAIN_RE))) && m[1].length > 0) {
      if (curItem) curItem.images.push({ alt: m[2], target: m[3] });
      continue;
    }
    // indented (sub-line) link
    if (((m = line.match(LINK_ANGLE_RE)) || (m = line.match(LINK_PLAIN_RE))) && m[1].length > 0) {
      if (curItem) curItem.links.push({ label: m[2], target: m[3] });
      continue;
    }
    // top-level bare-image item title
    if (((m = line.match(IMAGE_ANGLE_RE)) || (m = line.match(IMAGE_PLAIN_RE))) && m[1].length === 0) {
      flushItem();
      curItem = { rawTitle: m[2], images: [{ alt: m[2], target: m[3] }], links: [] };
      continue;
    }
    // top-level bare-link item title (Open video/file/resource)
    if (((m = line.match(LINK_ANGLE_RE)) || (m = line.match(LINK_PLAIN_RE))) && m[1].length === 0) {
      flushItem();
      curItem = { rawTitle: m[2], images: [], links: [{ label: m[2], target: m[3] }] };
      continue;
    }
    // top-level bold title
    if ((m = line.match(BOLD_TITLE_RE))) {
      flushItem();
      curItem = { rawTitle: m[1], images: [], links: [] };
      continue;
    }
    // top-level plain title (fallback)
    if ((m = line.match(PLAIN_TITLE_RE))) {
      flushItem();
      curItem = { rawTitle: m[1], images: [], links: [] };
      continue;
    }
    // blank/other line -> ignore
  }
  flushItem();
  return categories;
}

// Special-case merge: the exporter split "the sound list" text message and its
// accompanying screenshot into two separate list items even though they're one
// logical resource (Slayer & General PvM > Media files). Merge the screenshot
// into the preceding text item.
function mergeKnownDuplicates(categories: RawCategory[]): void {
  const DUP_IMAGE_MESSAGE_ID = "1060237125729136711";
  for (const cat of categories) {
    for (const section of cat.sections) {
      for (let i = 0; i < section.items.length - 1; i++) {
        const next = section.items[i + 1];
        if (next.images.some((img) => img.target.includes(DUP_IMAGE_MESSAGE_ID))) {
          section.items[i].images.push(...next.images);
          section.items.splice(i + 1, 1);
        }
      }
    }
  }
}

function unescapeMd(s: string): string {
  return s
    .replace(/\\(.)/g, "$1")
    .replace(/[-\s]{3,}$/, "")
    .replace(/\s*\(embed-thumbnail\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Media resolution
// ---------------------------------------------------------------------------

interface ResolvedMedia {
  messageId: string;
  fileName: string;
  absPath: string;
}

function resolveMediaPath(target: string): ResolvedMedia | null {
  const m = target.match(/^media\/(\d+)\/(.+)$/);
  if (!m) return null;
  const messageId = m[1];
  const fileName = m[2];
  return { messageId, fileName, absPath: path.join(MEDIA_DIR, messageId, fileName) };
}

function detectImageExt(absPath: string): string | null {
  if (!existsSync(absPath)) return null;
  const fd = readFileSync(absPath);
  if (fd.length >= 4 && fd[0] === 0x89 && fd[1] === 0x50 && fd[2] === 0x4e && fd[3] === 0x47) return "png";
  if (fd.length >= 3 && fd[0] === 0xff && fd[1] === 0xd8 && fd[2] === 0xff) return "jpg";
  if (fd.length >= 6 && fd.slice(0, 4).toString("ascii") === "GIF8") return "gif";
  if (fd.length >= 12 && fd.slice(0, 4).toString("ascii") === "RIFF" && fd.slice(8, 12).toString("ascii") === "WEBP")
    return "webp";
  return null;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "item"
  );
}

// ---------------------------------------------------------------------------
// Manifest types (mirrors the DATA CONTRACT in TEAM-BRIEF-RESOURCES.md)
// ---------------------------------------------------------------------------

interface ManifestLink {
  label: string;
  url: string;
  kind: string;
}
interface ManifestRuneLite {
  label: string;
  kind: string;
  json: string;
}
interface ManifestItem {
  id: string;
  title: string;
  description?: string;
  images?: string[];
  links?: ManifestLink[];
  runelite?: ManifestRuneLite;
}
interface ManifestSection {
  kind: string;
  title: string;
  items: ManifestItem[];
}
interface ManifestCategory {
  id: string;
  name: string;
  group: string;
  order: number;
  sections: ManifestSection[];
}
interface Manifest {
  generatedAt: string;
  categories: ManifestCategory[];
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

interface CutLogEntry {
  category: string;
  section: string;
  title: string;
  reason: string;
}

function build(onlyCategoryIds: Set<string> | null) {
  const md = readFileSync(MD_PATH, "utf8");
  const rawCategories = parseMarkdown(md);
  mergeKnownDuplicates(rawCategories);

  const cutLog: CutLogEntry[] = [];
  const missingSourceLog: string[] = [];
  const usedIds = new Set<string>();
  const perCategorySlug = new Map<string, Set<string>>();
  let imageCount = 0;
  let itemCount = 0;

  function uniqueId(base: string): string {
    let id = base;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${base}-${n}`;
      n++;
    }
    usedIds.add(id);
    return id;
  }

  function uniqueSlug(categoryId: string, base: string): string {
    const set = perCategorySlug.get(categoryId) ?? new Set<string>();
    perCategorySlug.set(categoryId, set);
    let slug = base;
    let n = 2;
    while (set.has(slug)) {
      slug = `${base}-${n}`;
      n++;
    }
    set.add(slug);
    return slug;
  }

  // categoryId -> ManifestCategory (built fresh, only for processed categories)
  const builtCategories = new Map<string, ManifestCategory>();

  for (const rawCat of rawCategories) {
    const meta = CATEGORY_META[rawCat.heading];
    if (!meta) throw new Error(`Unknown category heading: "${rawCat.heading}" — add it to CATEGORY_META`);
    if (onlyCategoryIds && !onlyCategoryIds.has(meta.id)) continue;

    const category: ManifestCategory = { id: meta.id, name: meta.name, group: meta.group, order: meta.order, sections: [] };
    builtCategories.set(meta.id, category);

    // section kind -> ManifestSection (sections of the same kind that appear
    // more than once, e.g. after RECATEGORIZE inserts, get merged)
    const sectionsByKind = new Map<string, ManifestSection>();

    for (const rawSection of rawCat.sections) {
      const sMeta = SECTION_META[rawSection.heading];
      if (!sMeta) throw new Error(`Unknown section heading: "${rawSection.heading}" — add it to SECTION_META`);

      for (const item of rawSection.items) {
        let title = unescapeMd(item.rawTitle);
        let description: string | undefined;

        const retitle = RETITLE_BY_RAW_TITLE[item.rawTitle];
        if (retitle) {
          title = retitle.title;
          description = retitle.description;
        }

        // does this item reference a message id with a RECATEGORIZE override?
        const allTargets = [
          ...item.images.map((i) => i.target),
          ...item.links.map((l) => l.target),
          ...(item.embeddedFile ? [item.embeddedFile] : []),
        ];
        let destCategoryId = meta.id;
        let destSectionKind = sMeta.kind;
        let destSectionTitle = sMeta.title;
        for (const t of allTargets) {
          const resolved = resolveMediaPath(t);
          if (resolved && RECATEGORIZE[resolved.messageId]) {
            const override = RECATEGORIZE[resolved.messageId];
            destCategoryId = override.categoryId;
            destSectionKind = override.sectionKind;
            destSectionTitle = SECTION_META[
              Object.keys(SECTION_META).find((k) => SECTION_META[k].kind === override.sectionKind)!
            ].title;
            if (override.title) title = override.title;
            break;
          }
        }

        // resolve images (including local links that turn out to be images)
        type PendingImage = ResolvedMedia & { ext: string };
        const pendingImages: PendingImage[] = [];
        let droppedLocalFiles: string[] = [];
        let judgmentCut = false;

        for (const img of item.images) {
          const resolved = resolveMediaPath(img.target);
          if (!resolved) continue;
          if (CUT_MESSAGE_IDS.has(resolved.messageId)) {
            // cut the whole item, not just this image — a dangling "Image
            // source" link with no visible thumbnail is useless on its own
            judgmentCut = true;
            continue;
          }
          if (!existsSync(resolved.absPath)) {
            missingSourceLog.push(`${destCategoryId}/${destSectionKind} "${title}" — referenced media/${resolved.messageId}/${resolved.fileName} not present on disk (source dump gap), image skipped`);
            continue;
          }
          let ext = path.extname(resolved.fileName).slice(1).toLowerCase();
          if (!IMAGE_EXTS.has(ext)) {
            const sniffed = detectImageExt(resolved.absPath);
            if (!sniffed) continue;
            ext = sniffed;
          }
          pendingImages.push({ ...resolved, ext });
        }

        const linksOut: ManifestLink[] = [];
        for (const link of item.links) {
          const isLocal = !/^https?:\/\//i.test(link.target);
          if (isLocal) {
            const resolved = resolveMediaPath(link.target);
            if (!resolved) continue;
            if (!existsSync(resolved.absPath)) {
              missingSourceLog.push(`${destCategoryId}/${destSectionKind} "${title}" — referenced media/${resolved.messageId}/${resolved.fileName} not present on disk (source dump gap), link skipped`);
              continue;
            }
            let ext = path.extname(resolved.fileName).slice(1).toLowerCase();
            const realExt = IMAGE_EXTS.has(ext) ? ext : detectImageExt(resolved.absPath);
            if (realExt) {
              pendingImages.push({ ...resolved, ext: realExt });
            } else {
              droppedLocalFiles.push(resolved.fileName || "(no name)");
            }
          } else {
            const label = unescapeMd(link.label).replace(/^Youtube$/, "YouTube");
            // drop redundant youtube-thumbnail preview links that just
            // duplicate the adjacent YouTube link's thumbnail
            if (label === "i.ytimg.com") continue;
            linksOut.push({ label, url: link.target, kind: linkKind(link.target) });
          }
        }

        // runelite payload: prefer the sibling .txt file content verbatim
        let runelite: ManifestRuneLite | undefined;
        if (item.embeddedFile) {
          const resolved = resolveMediaPath(item.embeddedFile);
          if (resolved && existsSync(resolved.absPath)) {
            const raw = readFileSync(resolved.absPath, "utf8").trim();
            // "other" covers non-JSON RuneLite plugin config lines (e.g. the
            // Object Indicators plugin's `objectindicators.region_NNNN=[...]`
            // format) even though they happen to contain a "regionId" key —
            // only a bare JSON array/object gets classified as a marker kind.
            const looksLikeJson = raw.startsWith("[") || raw.startsWith("{");
            const kind = !looksLikeJson
              ? "other"
              : raw.includes('"npcId"')
                ? "npcMarkers"
                : raw.includes('"regionId"')
                  ? "tileMarkers"
                  : "other";
            runelite = { label: title, kind, json: raw };
          }
        }

        // inline txt fences that aren't a runelite payload (no embedded-file
        // sibling) become part of the description — this is content, not noise
        if (item.fenceContent && !item.embeddedFile && (item.fenceLang === "txt" || item.fenceLang === "text")) {
          const blurb = item.fenceContent.trim();
          description = description ? `${description}\n\n${blurb}` : blurb;
        }

        if (judgmentCut) {
          cutLog.push({
            category: destCategoryId,
            section: destSectionKind,
            title,
            reason: "judgment pass: no instructional value (blank/empty field screenshot) — whole item dropped, including its dangling source link",
          });
          continue;
        }

        const hasContent = pendingImages.length > 0 || linksOut.length > 0 || runelite;
        if (!hasContent) {
          cutLog.push({
            category: destCategoryId,
            section: destSectionKind,
            title,
            reason: droppedLocalFiles.length
              ? `local file(s) dropped (video/audio/archive, no external link): ${droppedLocalFiles.join(", ")}`
              : "no image/link/runelite content after parse",
          });
          continue;
        }

        // copy images into place
        const images: string[] = [];
        const baseSlug = slugify(title);
        for (let i = 0; i < pendingImages.length; i++) {
          const img = pendingImages[i];
          const slugBase = pendingImages.length > 1 ? `${baseSlug}-${i + 1}` : baseSlug;
          const slug = uniqueSlug(destCategoryId, slugBase);
          const destDir = path.join(ASSETS_DIR, destCategoryId);
          mkdirSync(destDir, { recursive: true });
          const destFile = `${slug}.${img.ext}`;
          copyFileSync(img.absPath, path.join(destDir, destFile));
          images.push(`${destCategoryId}/${destFile}`);
          imageCount++;
        }

        const manifestItem: ManifestItem = { id: uniqueId(`${destCategoryId}-${baseSlug}`), title };
        if (description) manifestItem.description = description;
        if (images.length) manifestItem.images = images;
        if (linksOut.length) manifestItem.links = linksOut;
        if (runelite) manifestItem.runelite = runelite;

        // destination category might not be the one currently being iterated
        // (RECATEGORIZE) — only build it if it's in scope for this run
        if (onlyCategoryIds && !onlyCategoryIds.has(destCategoryId)) continue;
        let destCategory = builtCategories.get(destCategoryId);
        if (!destCategory) {
          const destMeta = Object.values(CATEGORY_META).find((c) => c.id === destCategoryId)!;
          destCategory = { id: destMeta.id, name: destMeta.name, group: destMeta.group, order: destMeta.order, sections: [] };
          builtCategories.set(destCategoryId, destCategory);
        }
        let destSectionsByKind = sectionsByKindByCategory(destCategory);
        let destSection = destSectionsByKind.get(destSectionKind);
        if (!destSection) {
          destSection = { kind: destSectionKind, title: destSectionTitle, items: [] };
          destCategory.sections.push(destSection);
          destSectionsByKind.set(destSectionKind, destSection);
        }
        destSection.items.push(manifestItem);
        itemCount++;
      }
    }
  }

  return { builtCategories, cutLog, missingSourceLog, imageCount, itemCount };
}

const sectionsByKindCache = new WeakMap<ManifestCategory, Map<string, ManifestSection>>();
function sectionsByKindByCategory(category: ManifestCategory): Map<string, ManifestSection> {
  let map = sectionsByKindCache.get(category);
  if (!map) {
    map = new Map(category.sections.map((s) => [s.kind, s]));
    sectionsByKindCache.set(category, map);
  }
  return map;
}

function main() {
  const args = process.argv.slice(2);
  let onlyCategoryIds: Set<string> | null = null;
  const onlyIdx = args.indexOf("--only");
  if (onlyIdx !== -1) {
    onlyCategoryIds = new Set(args[onlyIdx + 1].split(",").map((s) => s.trim()));
  }

  const { builtCategories, cutLog, missingSourceLog, imageCount, itemCount } = build(onlyCategoryIds);

  // merge with any existing manifest (categories not processed this run are preserved)
  let existing: Manifest | null = null;
  if (existsSync(OUT_JSON)) {
    try {
      existing = JSON.parse(readFileSync(OUT_JSON, "utf8"));
    } catch {
      existing = null;
    }
  }
  const finalCategories = new Map<string, ManifestCategory>();
  if (existing) {
    for (const c of existing.categories) finalCategories.set(c.id, c);
  }
  for (const [id, c] of builtCategories) finalCategories.set(id, c);

  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    categories: [...finalCategories.values()].sort((a, b) => a.order - b.order),
  };

  mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(manifest, null, 2) + "\n");

  const totalItems = manifest.categories.reduce((n, c) => n + c.sections.reduce((m, s) => m + s.items.length, 0), 0);
  const totalImages = manifest.categories.reduce(
    (n, c) => n + c.sections.reduce((m, s) => m + s.items.reduce((k, i) => k + (i.images?.length ?? 0), 0), 0),
    0,
  );

  console.log(`Wrote ${OUT_JSON}`);
  console.log(`This run: ${builtCategories.size} categories, ${itemCount} items, ${imageCount} images copied.`);
  console.log(`Manifest total: ${manifest.categories.length} categories, ${totalItems} items, ${totalImages} images.`);
  console.log(`Cut ${cutLog.length} items this run:`);
  for (const c of cutLog) {
    console.log(`  - [${c.category}/${c.section}] "${c.title}" — ${c.reason}`);
  }
  if (missingSourceLog.length) {
    console.log(`${missingSourceLog.length} referenced media file(s) missing from resourcesMedia/ (source dump gap, not this script's doing):`);
    for (const m of missingSourceLog) console.log(`  - ${m}`);
  }
}

main();
