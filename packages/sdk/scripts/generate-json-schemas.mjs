// Writes one JSON Schema file per schema of `@klaracase/sdk/schemas` into packages/sdk/schemas/.
// It reads the built entry dist/schemas.js, so run `tsdown` first. The `build` script does that:
// build, generate, build again (the second build inlines the files into `@klaracase/sdk/tools`).
// The generated files are committed. A test fails when they differ from the source schemas.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "schemas");
const { toJsonSchema, ...schemas } = await import(join(root, "dist", "schemas.js"));

mkdirSync(outDir, { recursive: true });
for (const file of readdirSync(outDir)) {
  if (file.endsWith(".json")) rmSync(join(outDir, file));
}
let count = 0;
for (const [name, value] of Object.entries(schemas)) {
  if (!name.endsWith("Schema") || value === null || typeof value !== "object") continue;
  const file = join(outDir, `${name.replace(/Schema$/, "")}.json`);
  writeFileSync(file, `${JSON.stringify(toJsonSchema(name, value), null, 2)}\n`);
  count += 1;
}
console.log(`wrote ${count} JSON Schema files to schemas/`);
