import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: './dist',
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
