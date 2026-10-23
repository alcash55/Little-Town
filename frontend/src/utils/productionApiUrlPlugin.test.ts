// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, resolveConfig } from 'vite';

const configFile = fileURLToPath(new URL('../../vite.config.ts', import.meta.url));
let root: string;

beforeEach(async () => {
  vi.stubEnv('VITE_BASEURL', undefined);
  vi.stubEnv('NODE_ENV', 'production');
  root = await mkdtemp(join(tmpdir(), 'little-town-api-url-'));
  await writeFile(join(root, 'index.html'), '<!doctype html><html><body>Build test</body></html>');
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

// Load the real app config and run Vite, so removing the plugin registration
// or checking process.env instead of the resolved .env files fails this suite.
function buildFixture(mode = 'production') {
  return build({
    configFile,
    root,
    envDir: root,
    mode,
    logLevel: 'silent',
    build: { write: false },
  });
}

describe('production API build validation', () => {
  it.each([
    undefined,
    '',
    '   ',
    'http://localhost:8081',
    'https://LOCALHOST.:8081/api',
    'http://api.localhost:8081',
    'http://127.0.0.1:8081',
    'http://127.1:8081',
    'http://[::1]:8081',
    'http://0.0.0.0:8081',
    '/api',
    'not-a-url',
    'ftp://api.example.com',
  ])('rejects a production build with VITE_BASEURL=%s', async (value) => {
    vi.stubEnv('VITE_BASEURL', value);
    await expect(buildFixture()).rejects.toThrow(
      /VITE_BASEURL.*Cloudflare Pages Settings > Variables and Secrets.*Production and Preview.*frontend\/\.env\.production.*bun run preview/,
    );
  });

  it('accepts the API URL from .env.production', async () => {
    await writeFile(join(root, '.env.production'), 'VITE_BASEURL=https://little-town.onrender.com\n');
    await expect(buildFixture()).resolves.toBeDefined();
  });

  it('rejects localhost loaded from .env.production', async () => {
    await writeFile(join(root, '.env.production'), 'VITE_BASEURL=http://localhost:8081\n');
    await expect(buildFixture()).rejects.toThrow('Production build requires VITE_BASEURL');
  });

  it('honors the build host override ahead of .env.production', async () => {
    await writeFile(join(root, '.env.production'), 'VITE_BASEURL=http://localhost:8081\n');
    vi.stubEnv('VITE_BASEURL', 'https://little-town.onrender.com');
    await expect(buildFixture()).resolves.toBeDefined();
    vi.stubEnv('VITE_BASEURL', '');
    await expect(buildFixture()).rejects.toThrow('Production build requires VITE_BASEURL');
  });

  it('allows local preview builds while keeping production auth behavior', async () => {
    vi.stubEnv('VITE_BASEURL', 'http://localhost:8081');
    const config = await resolveConfig(
      { configFile, root, envDir: root, mode: 'local-preview' },
      'build',
    );
    expect(config.env.PROD).toBe(true);
    expect(config.env.DEV).toBe(false);
    expect(config.env.VITE_BASEURL).toBe('http://localhost:8081');
    await expect(buildFixture('local-preview')).resolves.toBeDefined();
  });

  it.each([undefined, 'http://localhost:8081'])(
    'allows the dev server with VITE_BASEURL=%s',
    async (value) => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('VITE_BASEURL', value);
      const config = await resolveConfig({ configFile, root, envDir: root }, 'serve');
      expect(config.env.DEV).toBe(true);
    },
  );
});
