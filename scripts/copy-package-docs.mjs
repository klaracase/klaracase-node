// Run by `prepack` in each package. Copies the license and the changelog from the repo root.
// The sdk package also gets the root README. The copies are git-ignored.
import { copyFileSync } from "node:fs";
import { basename, join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const packageDir = process.cwd();
const files = ["LICENSE", "CHANGELOG.md"];
if (basename(packageDir) === "sdk") files.push("README.md");
for (const file of files) copyFileSync(join(root, file), join(packageDir, file));
