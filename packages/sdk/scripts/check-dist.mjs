// Checks that the built package loads as ESM and as CJS, in every entry, and ships its type files.
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const load = async (name) => ({
  esm: await import(join(root, "dist", `${name}.js`)),
  cjs: require(join(root, "dist", `${name}.cjs`)),
});

const main = await load("index");
const schemas = await load("schemas");
const tools = await load("tools");

for (const [label, mod] of Object.entries(main)) {
  if (typeof mod.Klaracase !== "function" || typeof mod.KlaracaseError !== "function") {
    throw new Error(`${label} build does not export Klaracase and KlaracaseError.`);
  }
  if (mod.VERSION !== "0.1.0") throw new Error(`${label} build has the wrong version.`);
}
for (const [label, mod] of Object.entries(schemas)) {
  if (typeof mod.toJsonSchema !== "function" || mod.decisionResponseSchema === undefined) {
    throw new Error(`${label} schemas build is incomplete.`);
  }
}
for (const [label, mod] of Object.entries(tools)) {
  if (mod.tools?.length !== 4 || typeof mod.callTool !== "function") {
    throw new Error(`${label} tools build is incomplete.`);
  }
}

// The dual package hazard: an error from the CJS build is not an instance of the ESM class, but
// KlaracaseError.is sees both.
const fromCjs = new main.cjs.NotFoundError({ status: 404 });
if (fromCjs instanceof main.esm.NotFoundError) throw new Error("ESM and CJS share a class.");
if (!main.esm.KlaracaseError.is(fromCjs)) throw new Error("KlaracaseError.is misses a CJS error.");

for (const file of [
  "index.d.ts",
  "index.d.cts",
  "schemas.d.ts",
  "schemas.d.cts",
  "tools.d.ts",
  "tools.d.cts",
]) {
  if (!existsSync(join(root, "dist", file))) throw new Error(`dist/${file} is missing.`);
}
console.log("dist ok: ESM, CJS and types for index, schemas and tools");
