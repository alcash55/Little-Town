#!/usr/bin/env bun
/**
 * check-pages-doc.ts — fails if root README.md's Pages table drifts from
 * the actual route list in Routes.tsx.
 *
 * Issue #76: the README table and a second copy in CLAUDE.md quietly fell
 * out of sync (six routes missing from the README) because both were
 * hand-maintained. CLAUDE.md now just points at the README instead of
 * keeping its own table, which removes one of the two things that could
 * drift — but the README itself can still drift from the code whenever a
 * route is added or renamed without anyone updating the doc. This script
 * is the second half of the fix: it parses the real route list out of
 * Routes.tsx and checks every one is documented, so that drift fails CI
 * instead of waiting for someone to notice by hand again.
 *
 * Usage (from repo root): bun run tools/check-pages-doc.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");
const routesPath = join(repoRoot, "frontend/src/components/Routes/Routes.tsx");
const readmePath = join(repoRoot, "README.md");

const routesSource = readFileSync(routesPath, "utf8");
const readme = readFileSync(readmePath, "utf8");

// Every documented page hangs directly off the single top-level
// `<Route path="/" element={<Providers />}>` wrapper, so a child route's
// full path is always "/" + its own `path` attribute. The regex excludes
// paths starting with "/" (that top-level wrapper itself) and "*" (the
// catch-all 404 page, not a page worth documenting). `index` covers "/"
// itself and is added separately since it has no `path` attribute at all.
const routes = new Set<string>(["/"]);
for (const match of routesSource.matchAll(/<Route\s+path="([^"/*][^"]*)"/g)) {
  routes.add(`/${match[1]}`);
}

const missing = [...routes].filter((route) => !readme.includes(`\`${route}\``));

if (missing.length > 0) {
  console.error(
    `README.md's Pages table is missing ${missing.length} route(s) that exist in Routes.tsx:\n` +
      missing.map((route) => `  - ${route}`).join("\n") +
      `\n\nAdd each to the Pages table in README.md (see CLAUDE.md's pointer to it).`,
  );
  process.exit(1);
}

console.log(`OK: all ${routes.size} routes in Routes.tsx are documented in README.md's Pages table.`);
