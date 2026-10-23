import type { Plugin } from 'vite';

// Validate Vite's resolved env so .env files and build-host overrides use
// exactly the same value as import.meta.env.VITE_BASEURL in the bundle.
export function productionApiUrlPlugin(): Plugin {
  return {
    name: 'production-api-url',
    configResolved(config) {
      if (config.command !== 'build' || config.mode !== 'production') return;

      const message =
        'Production build requires VITE_BASEURL to be an absolute HTTP(S) backend URL, not localhost or a loopback address. ' +
        'Set VITE_BASEURL in Cloudflare Pages Settings > Variables and Secrets for both Production and Preview, ' +
        'or in frontend/.env.production for a local production build. ' +
        'Use bun run dev or bun run preview to work with a local backend.';

      let url: URL;
      try {
        url = new URL(config.env.VITE_BASEURL);
      } catch {
        throw new Error(message);
      }

      const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname.startsWith('127.') ||
        hostname === '[::1]' ||
        hostname === '0.0.0.0' ||
        hostname === '[::]'
      ) {
        throw new Error(message);
      }
    },
  };
}
