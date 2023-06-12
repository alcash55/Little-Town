import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/Little-Town/",
  plugins: [react()],
  server: {
    port: 3000,
  },
});
