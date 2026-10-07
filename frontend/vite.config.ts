import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { parseBackendOrigin } from "./src/lib/backend";

// Resolve sibling files by URL rather than node:path/__dirname - this project
// has no @types/node, and import.meta.url is already typed via vite/client.
const entry = (file: string) => new URL(file, import.meta.url).pathname;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, entry("."), "VITE_");
  // Fail hosted builds instead of shipping a frontend with no working API.
  parseBackendOrigin(env.VITE_API_BASE_URL, ["vercel", "pages"].includes(mode));
  return {
    plugins: [react(), tailwindcss()],
    server: { proxy: { "/api": "http://localhost:8000" } },
    build: {
      rollupOptions: {
        input: {
          main: entry("./index.html"),
          admin: entry("./admin.html"),
          tiktok: entry("./tiktokvideodownloader.html"),
          reddit: entry("./redditvideodownloader.html"),
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/test/setup.ts",
      css: false,
    },
  };
});
