import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { clanBrandingPlugin } from './clanBrandingPlugin';
import { cloudflareAnalyticsPlugin, CF_BEACON_TOKEN } from './cloudflareAnalyticsPlugin';
import { resolveClanProfile } from '../config/clanProfiles';

afterEach(() => vi.unstubAllEnvs());

describe('clan deployment branding', () => {
  it('preserves Little Town by default and rejects unknown deployment profiles', () => {
    expect(resolveClanProfile(undefined).name).toBe('Little Town');
    expect(resolveClanProfile('little-town').showGangIcons).toBe(true);
    expect(resolveClanProfile('diamond-dogs').name).toBe('The Diamond Dogs');
    expect(resolveClanProfile('diamond-dogs').discordInviteUrl).toBeNull();
    expect(resolveClanProfile('little-town').discordInviteUrl).toBe(
      'https://discord.com/invite/NqzwU3TyUT',
    );
    expect(() => resolveClanProfile('unknown-clan')).toThrow('VITE_CLAN_ID');
  });

  it.each(['little-town', 'diamond-dogs'])(
    'builds %s metadata without mixing clan artwork or analytics',
    async (id) => {
      vi.stubEnv('VITE_CLAN_ID', id);
      const root = await mkdtemp(join(tmpdir(), 'clan-build-'));
      try {
        await mkdir(join(root, 'src/assets/Images'), { recursive: true });
        await mkdir(join(root, 'public'));
        await writeFile(join(root, 'src/assets/Images/Little_Town.ico'), 'local-icon');
        await writeFile(
          join(root, 'public/bingo.svg'),
          '<svg xmlns="http://www.w3.org/2000/svg"/>',
        );
        await writeFile(
          join(root, 'index.html'),
          '<html><head><title>Little Town</title><link rel="icon" href="./src/assets/Images/Little_Town.ico" /></head><body><div id="root"></div></body></html>',
        );
        const result = await build({
          configFile: false,
          envDir: false,
          root,
          plugins: [clanBrandingPlugin(), cloudflareAnalyticsPlugin()],
          logLevel: 'silent',
          build: { write: false },
        });
        if (Array.isArray(result) || !('output' in result))
          throw new Error('Expected one Vite output');
        const file = result.output.find(
          (item) => item.type === 'asset' && item.fileName === 'index.html',
        );
        if (!file || file.type !== 'asset' || typeof file.source !== 'string')
          throw new Error('Missing built HTML');
        const document = new DOMParser().parseFromString(file.source, 'text/html');
        expect(document.title).toBe(resolveClanProfile(id).name);
        if (id === 'diamond-dogs') {
          expect(document.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe(
            '/bingo.svg',
          );
          expect(file.source).not.toContain(CF_BEACON_TOKEN);
          expect(file.source).not.toContain('Little_Town');
        } else {
          expect(file.source).toContain(CF_BEACON_TOKEN);
          expect(document.querySelector('link[rel="icon"]')?.getAttribute('href')).not.toBe(
            '/bingo.svg',
          );
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );
});
