import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Minimal Vitest setup (TEAM-BRIEF.md Sprint 11 Track B #4 — the repo had no
// frontend test runner before this). Reuses the same `@vitejs/plugin-react`
// plugin as vite.config.ts so JSX/TS transform behavior matches the real
// build; kept in its own config file (rather than merged into
// vite.config.ts) so `vite build`/`vite dev` never pull in test-only
// tooling. happy-dom over jsdom: smaller/faster install, and nothing here
// needs jsdom-only APIs.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
