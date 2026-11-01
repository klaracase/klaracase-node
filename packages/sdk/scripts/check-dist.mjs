// Checks that the built package loads as ESM and as CJS and ships its type files.
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const esm = await import(join(root, "dist", "index.js"));
const cjs = createRequire(import.meta.url)(join(root, "dist", "index.cjs"));

for (const [label, mod] of [
  ["ESM", esm],
  ["CJS", cjs],
]) {
  if (typeof mod.Klaracase !== "function" || typeof mod.KlaracaseError !== "function") {
    throw new Error(`${label} build does not export Klaracase and KlaracaseError.`);
  }
  if (mod.VERSION !== "0.1.0") throw new Error(`${label} build has the wrong version.`);
}
for (const file of ["index.d.ts", "index.d.cts"]) {
  if (!existsSync(join(root, "dist", file))) throw new Error(`dist/${file} is missing.`);
}
console.log("dist ok: ESM, CJS and types");
