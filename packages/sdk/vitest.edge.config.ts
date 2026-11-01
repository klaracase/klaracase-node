import { defineConfig } from "vitest/config";

/** The Vercel Edge lane: the whole suite runs inside the Edge runtime sandbox. */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "edge-runtime",
    testTimeout: 15_000,
  },
});
