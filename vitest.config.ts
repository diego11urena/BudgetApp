import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    // tests/e2e/*.spec.ts are @playwright/test specs (run via `npm run
    // test:e2e`), not vitest ones — same ".spec.ts" suffix vitest's
    // default include pattern would otherwise pick up. Spread vitest's own
    // defaults first so this doesn't silently drop them (node_modules,
    // dist, .git, etc.).
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
  },
});
