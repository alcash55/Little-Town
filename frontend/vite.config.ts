import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: "/frontend/dist",
  },
  plugins: [react()],
  server: {
    port: 3000,
  },
});
