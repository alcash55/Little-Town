import type { HtmlTagDescriptor, Plugin } from 'vite';

// Cloudflare Web Analytics site token. It's public, meant to ship to every
// browser, unlike a secret key. One call site: vite.config.ts pulls this in
// via cloudflareAnalyticsPlugin() rather than hardcoding it a second time in
// index.html or anywhere else.
//
// #88's root cause: Cloudflare's automatic edge injection pinned an
// `integrity` hash to a versionless beacon URL. Any time Cloudflare shipped
// a newer beacon build, the hash check failed and logged a CORS and SRI
// error on every single page load. Edge injection is now off in the
// Cloudflare dashboard (Pages project, Speed, Web Analytics); this plugin is
// the replacement, committed in source per #109.
export const CF_BEACON_TOKEN = '48fad87e4a704c9b8f365e759da7b3bb';

const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

/**
 * Builds the beacon `<script>` tag Cloudflare's docs specify, deliberately
 * missing two things the edge-injected version had:
 *
 * - No `integrity` attribute. Cloudflare serves the beacon from a
 *   versionless URL, so a pinned hash goes stale the moment Cloudflare
 *   ships a new build and fails on every load after that (#88).
 * - `defer`, not `type="module"`. The issue's paste used `type="module"`,
 *   but module scripts fetch in CORS mode, the exact failure mode #88
 *   reported. `defer` gets the same "don't block parsing" behavior over a
 *   plain `<script src>` fetch, which isn't CORS-gated.
 */
export function cloudflareBeaconTag(token: string = CF_BEACON_TOKEN): HtmlTagDescriptor {
  return {
    tag: 'script',
    injectTo: 'head',
    attrs: {
      defer: true,
      src: BEACON_SRC,
      'data-cf-beacon': JSON.stringify({ token }),
    },
  };
}

/**
 * Injects the Cloudflare Web Analytics beacon into `index.html` for
 * production builds only. `apply: 'build'` is Vite's own command gate:
 * `transformIndexHtml` below never runs under `vite`/`bun run dev` (command
 * `serve`), only under `vite build` (command `build`). That keeps every
 * localhost session and agent browser run out of the analytics data, and
 * keeps the token defined in exactly one place.
 */
export function cloudflareAnalyticsPlugin(token: string = CF_BEACON_TOKEN): Plugin {
  return {
    name: 'cloudflare-web-analytics',
    apply: 'build',
    transformIndexHtml() {
      return [cloudflareBeaconTag(token)];
    },
  };
}
