import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: '../dist',
  },
  base: './Little-Town/',
  plugins: [react()],
  server: {
    port: 3000,
    open: '/Little-Town/',
  },
});
