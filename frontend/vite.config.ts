import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
      },
      "/vnc": {
        target: "http://localhost:6080",
        ws: true,
        rewrite: (path) => path.replace(/^\/vnc/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
