import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const sdk = (path: string) => fileURLToPath(new URL(`../sdk/src/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    // Test against the sources of the sibling package, so the tests need no build first.
    alias: [
      { find: /^@klaracase\/sdk\/schemas$/, replacement: sdk("schemas/index.ts") },
      { find: /^@klaracase\/sdk\/tools$/, replacement: sdk("tools/index.ts") },
      { find: /^@klaracase\/sdk$/, replacement: sdk("index.ts") },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 15_000,
  },
});
