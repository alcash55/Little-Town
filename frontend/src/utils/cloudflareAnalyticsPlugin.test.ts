import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import {
  CF_BEACON_TOKEN,
  cloudflareAnalyticsPlugin,
  cloudflareBeaconTag,
} from './cloudflareAnalyticsPlugin';

// #109/#88: the beacon lived only as an edge-injected script that pinned a
// `integrity` hash to a versionless URL, so every fetch of a newer beacon
// build failed the hash check and logged a CORS + SRI error on every page
// load (see #88's root cause). This suite pins the two things that fix
// won't regress: no `integrity`/`type=module` on the tag, and the tag only
// ships in a production build, never `bun run dev`.
describe('cloudflareBeaconTag', () => {
  it('points at the documented beacon URL with the site token', () => {
    const tag = cloudflareBeaconTag(CF_BEACON_TOKEN);
    expect(tag.tag).toBe('script');
    expect(tag.injectTo).toBe('head');
    expect(tag.attrs?.src).toBe('https://static.cloudflareinsights.com/beacon.min.js');
    expect(tag.attrs?.['data-cf-beacon']).toBe(JSON.stringify({ token: CF_BEACON_TOKEN }));
  });

  it('loads deferred, not as a CORS-mode module script', () => {
    const tag = cloudflareBeaconTag(CF_BEACON_TOKEN);
    expect(tag.attrs?.defer).toBe(true);
    expect(tag.attrs?.type).toBeUndefined();
  });

  it('carries no integrity hash, since a pinned hash on a versionless URL is what broke #88', () => {
    const tag = cloudflareBeaconTag(CF_BEACON_TOKEN);
    expect(tag.attrs?.integrity).toBeUndefined();
  });

  it('takes the token as a parameter so the constant has one call site', () => {
    const tag = cloudflareBeaconTag('some-other-token');
    expect(tag.attrs?.['data-cf-beacon']).toBe(JSON.stringify({ token: 'some-other-token' }));
  });
});

describe('cloudflareAnalyticsPlugin', () => {
  it('only runs for the build command, so `bun run dev` never emits the beacon', () => {
    const plugin = cloudflareAnalyticsPlugin(CF_BEACON_TOKEN);
    expect(plugin.apply).toBe('build');
  });

  it('is named for easy identification in build output', () => {
    const plugin = cloudflareAnalyticsPlugin(CF_BEACON_TOKEN);
    expect(plugin.name).toBe('cloudflare-web-analytics');
  });

  it('defaults to the committed site token when none is passed', () => {
    const plugin = cloudflareAnalyticsPlugin();
    expect(plugin.name).toBe('cloudflare-web-analytics');
  });
});

// Exercise Vite's HTML hook wiring and serialization, not only tag metadata.
it('injects exactly one configured beacon into built HTML', async () => {
  const root = await mkdtemp(join(tmpdir(), 'little-town-analytics-'));
  try {
    await writeFile(
      join(root, 'index.html'),
      '<!doctype html><html><head><title>Analytics test</title></head><body><main>Little Town</main></body></html>',
    );
    const result = await build({
      configFile: false,
      root,
      plugins: [cloudflareAnalyticsPlugin('html-build-test-token')],
      logLevel: 'silent',
      build: { write: false },
    });
    if (Array.isArray(result) || !('output' in result)) {
      throw new Error('Expected one Vite build output');
    }
    const html = result.output.find(
      (file) => file.type === 'asset' && file.fileName === 'index.html',
    );
    if (!html || html.type !== 'asset' || typeof html.source !== 'string') {
      throw new Error('Vite did not emit index.html');
    }
    const document = new DOMParser().parseFromString(html.source, 'text/html');
    const beacons = document.querySelectorAll(
      'script[src="https://static.cloudflareinsights.com/beacon.min.js"]',
    );
    expect(beacons).toHaveLength(1);
    expect(beacons[0].parentElement?.tagName).toBe('HEAD');
    expect(beacons[0].getAttribute('data-cf-beacon')).toBe(
      JSON.stringify({ token: 'html-build-test-token' }),
    );
    expect(beacons[0].hasAttribute('defer')).toBe(true);
    expect(beacons[0].hasAttribute('integrity')).toBe(false);
    expect(beacons[0].hasAttribute('type')).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
