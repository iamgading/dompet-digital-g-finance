import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.vitest.ts"],
    sequence: {
      concurrent: false,
    },
    pool: "forks",
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
});
