import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..", "..", "..");

const FORBIDDEN: readonly RegExp[] = [
  /hallucinat/i,
  /halluzin/i,
  /fabricat/i,
  /fabrizier/i,
  /\bfake\b/i,
  /official source/i,
  /offizielle quelle/i,
  /amtlich/i,
];

/** The required disclaimer must say "fabricated" once. Only this exact sentence is exempt. */
const ALLOWED_SENTENCE = "it is not a claim that the citation is fabricated.";

function normalize(text: string): string {
  return text.replace(/\s+/g, " ");
}

/** Returns the forbidden patterns found in the text, after removing the allowed sentence. */
export function findForbidden(text: string): string[] {
  const cleaned = normalize(text).split(ALLOWED_SENTENCE).join("");
  return FORBIDDEN.filter((pattern) => pattern.test(cleaned)).map((pattern) => pattern.source);
}

function walk(dir: string, accept: (path: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, accept, out);
    else if (accept(path)) out.push(path);
  }
  return out;
}

function scannedFiles(): string[] {
  const files = [
    join(root, "README.md"),
    join(root, "CHANGELOG.md"),
    join(root, "api.md"),
    join(root, "package.json"),
    join(root, "packages", "ai-sdk", "README.md"),
  ];
  walk(join(root, "packages", "sdk", "examples"), (path) => path.endsWith(".mjs"), files);
  for (const pkg of ["sdk", "ai-sdk"]) {
    const dir = join(root, "packages", pkg);
    files.push(join(dir, "package.json"));
    walk(join(dir, "src"), (path) => path.endsWith(".ts"), files);
  }
  return files;
}

describe("copy lint", () => {
  it("finds no forbidden wording in README, CHANGELOG, manifests and source comments", () => {
    const hits = scannedFiles().flatMap((file) =>
      findForbidden(readFileSync(file, "utf8")).map(
        (pattern) => `${relative(root, file)}: ${pattern}`,
      ),
    );
    expect(hits).toEqual([]);
  });

  it("flags every forbidden pattern", () => {
    const samples = [
      "This stops hallucinations.",
      "Das verhindert Halluzinationen.",
      "The citation is Fabricated.",
      "Das ist fabriziert.",
      "A fake case.",
      "The official source of law.",
      "Die offizielle Quelle.",
      "Der amtliche Leitsatz.",
    ];
    for (const sample of samples) expect(findForbidden(sample)).not.toEqual([]);
  });

  it("allows the required disclaimer sentence and nothing around it", () => {
    const sentence =
      "A `not_found` verdict means the citation was not found in the corpus; it is not a claim\nthat the citation is fabricated.";
    expect(findForbidden(sentence)).toEqual([]);
    expect(findForbidden(`${sentence} It is fabricated.`)).not.toEqual([]);
    expect(findForbidden("A fake.")).not.toEqual([]);
  });
});
