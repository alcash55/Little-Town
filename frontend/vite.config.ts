import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: './dist',
  },
  resolve: {
    // Force a single module instance for @emotion/react and @emotion/styled.
    // @mui/material, @mui/x-data-grid and @mui/x-date-pickers each declare their
    // own semver-range peer dependency on these packages; without `dedupe`, Vite's
    // dev pre-bundling (and Rollup's production chunking, since pages are
    // React.lazy-split) can resolve/bundle a package more than once even when
    // node_modules only has one physical copy on disk, which is what triggers
    // emotion's "You are loading @emotion/react when it is already loaded"
    // runtime warning ("multiple builds of the same version"). Deduping pins
    // every consumer to the same resolved instance everywhere.
    dedupe: ['@emotion/react', '@emotion/styled'],
  },
  plugins: [react()],
  server: {
    port: 3000,
    open: '/',
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
  preview: {
    port: 3000,
    open: '/',
  },
});
