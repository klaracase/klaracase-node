import { readFileSync } from "node:fs";

/** Parse `a.b[0]["x y"].c` into steps. */
export function parsePath(path: string): Array<string | number> {
  const steps: Array<string | number> = [];
  const pattern = /\[(\d+)\]|\["([^"]*)"\]|\.?([^.[\]]+)/g;
  for (const match of path.matchAll(pattern)) {
    if (match[1] !== undefined) steps.push(Number(match[1]));
    else if (match[2] !== undefined) steps.push(match[2]);
    else if (match[3] !== undefined) steps.push(match[3]);
  }
  return steps;
}

export function walk(root: unknown, steps: ReadonlyArray<string | number>): unknown {
  let current: unknown = root;
  for (const step of steps) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string | number, unknown>)[step];
  }
  return current;
}

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}
