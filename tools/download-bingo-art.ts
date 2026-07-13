#!/usr/bin/env bun
/**
 * download-bingo-art.ts — fetches the curated boss/skill/item renders for
 * bingo tile artwork (TEAM-BRIEF.md Sprint 8, Track A item 1) from the OSRS
 * wiki into `frontend/src/assets/Images/bosses/`, where they're committed
 * to the repo and bundled at build time. The running app NEVER hotlinks
 * `oldschool.runescape.wiki` — this script is the only thing that talks to
 * it, and only when Alex re-runs it by hand.
 *
 * The curated entity -> wiki-file mapping lives in
 * `frontend/src/data/bingoArtEntities.ts` (a plain data module, hand-edited
 * — see the README note at the top of that file for how to add an entry).
 * This script is just the fetch step; it does no image sourcing decisions
 * of its own.
 *
 * Wiki file URLs follow the pattern
 *   https://oldschool.runescape.wiki/images/<File_Name>.png
 * (the same file the page's "File:<name>.png" media page points at —
 * see https://oldschool.runescape.wiki/w/General_Graardor#/media/File:General_Graardor.png
 * for the page-level equivalent). Requests are sequential with a short
 * delay and a descriptive User-Agent, per the wiki's fair-use expectations
 * for scripted access.
 *
 * Usage (run from the repo root):
 *   bun run tools/download-bingo-art.ts                  # (re)download everything
 *   bun run tools/download-bingo-art.ts --only zulrah,cox # only these slugs
 *   bun run tools/download-bingo-art.ts --skip-existing   # don't re-fetch files already on disk
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BINGO_ART_ENTITIES } from "../frontend/src/data/bingoArtEntities.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(REPO_ROOT, "frontend/src/assets/Images/bosses");

const WIKI_BASE = "https://oldschool.runescape.wiki/images/";
const USER_AGENT =
  "LittleTown-BingoArtBot/1.0 (https://littletown.gay/; contact: erikawilt3@gmail.com) - one-time curated asset fetch, see tools/download-bingo-art.ts";
const REQUEST_DELAY_MS = 350; // polite: sequential, small gap between requests

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function wikiFileUrl(wikiFile: string): string {
  // Encode each path segment so spaces/apostrophes/parens survive, but
  // don't touch the literal ".png"/".gif" extension or already-safe chars.
  return WIKI_BASE + wikiFile.split("/").map(encodeURIComponent).join("/");
}

interface DownloadResult {
  slug: string;
  status: "ok" | "skipped" | "failed";
  detail?: string;
}

async function downloadOne(
  entity: (typeof BINGO_ART_ENTITIES)[number],
  skipExisting: boolean,
): Promise<DownloadResult> {
  const ext = path.extname(entity.wikiFile) || ".png";
  const destPath = path.join(OUT_DIR, `${entity.slug}${ext}`);

  if (skipExisting && existsSync(destPath)) {
    return { slug: entity.slug, status: "skipped", detail: "already on disk" };
  }

  const url = wikiFileUrl(entity.wikiFile);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      return { slug: entity.slug, status: "failed", detail: `HTTP ${res.status} for ${url}` };
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 100) {
      // The wiki serves a tiny text/error body (not a real image) for a
      // missing file rather than always 404ing — guard against silently
      // committing a broken/placeholder asset.
      return { slug: entity.slug, status: "failed", detail: `suspiciously small response (${buf.byteLength} bytes) for ${url}` };
    }
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(destPath, buf);
    return { slug: entity.slug, status: "ok" };
  } catch (e) {
    return { slug: entity.slug, status: "failed", detail: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf("--only");
  const onlySlugs = onlyIdx !== -1 ? new Set(args[onlyIdx + 1].split(",").map((s) => s.trim())) : null;
  const skipExisting = args.includes("--skip-existing");

  const entities = onlySlugs ? BINGO_ART_ENTITIES.filter((e) => onlySlugs.has(e.slug)) : BINGO_ART_ENTITIES;

  if (onlySlugs) {
    const found = new Set(entities.map((e) => e.slug));
    for (const slug of onlySlugs) {
      if (!found.has(slug)) console.warn(`[download-bingo-art] no entity with slug "${slug}" in bingoArtEntities.ts`);
    }
  }

  console.log(`Fetching ${entities.length} asset(s) into ${path.relative(REPO_ROOT, OUT_DIR)}/ ...`);

  const results: DownloadResult[] = [];
  for (const entity of entities) {
    const result = await downloadOne(entity, skipExisting);
    results.push(result);
    const label = result.status === "ok" ? "OK" : result.status === "skipped" ? "skip" : "FAIL";
    console.log(`  [${label}] ${entity.slug} (${entity.wikiFile})${result.detail ? ` — ${result.detail}` : ""}`);
    if (result.status !== "skipped") await sleep(REQUEST_DELAY_MS);
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed");

  console.log(`\nDone: ${ok} downloaded, ${skipped} skipped, ${failed.length} failed.`);
  if (failed.length) {
    console.log("Failed entries (fix the wikiFile in bingoArtEntities.ts and re-run with --only):");
    for (const f of failed) console.log(`  - ${f.slug}: ${f.detail}`);
    process.exitCode = 1;
  }
}

main();
