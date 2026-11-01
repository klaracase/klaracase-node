import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node22",
  platform: "neutral",
  fixedExtension: false,
  outExtensions: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js", dts: format === "cjs" ? ".d.cts" : ".d.ts" }),
});
