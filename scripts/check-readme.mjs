// Compiles every ```ts block of the README under the strictest settings (exactOptionalPropertyTypes).
// A block is extracted to readme-check/, which is git-ignored. Mark a block ```ts skip to leave it out.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "readme-check");
const readme = readFileSync(join(root, "README.md"), "utf8");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const fence = /^```(ts|typescript)([^\n]*)\n([\s\S]*?)^```$/gm;
let count = 0;
for (const match of readme.matchAll(fence)) {
  if (match[2].includes("skip")) continue;
  count += 1;
  let code = match[3];
  if (!/^(import|export) /m.test(code)) code += "\nexport {};\n";
  const name = `example-${String(count).padStart(2, "0")}.ts`;
  writeFileSync(join(outDir, name), code);
}
if (count < 5) {
  console.error(`Only ${count} README code blocks found. Expected at least 5.`);
  process.exit(1);
}

const tsc = join(root, "node_modules", ".bin", "tsc");
const result = spawnSync(tsc, ["-p", join(root, "tsconfig.readme.json"), "--noEmit"], {
  stdio: "inherit",
  cwd: root,
});
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`README ok: ${count} code blocks compile with exactOptionalPropertyTypes`);
