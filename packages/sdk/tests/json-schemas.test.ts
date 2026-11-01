import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type * as z from "zod/mini";
import { describe, expect, it } from "vitest";
import * as schemaModule from "../src/schemas/index.js";
import { tools } from "../src/tools/index.js";

const dir = join(import.meta.dirname, "..", "schemas");
const { toJsonSchema, ...exported } = schemaModule;
const named = Object.entries(exported).filter(
  ([name, value]) => name.endsWith("Schema") && typeof value === "object" && value !== null,
) as Array<[string, z.ZodMiniType]>;

describe("generated JSON Schema files", () => {
  it("has one committed file per schema and no stray file", () => {
    const expected = named.map(([name]) => `${name.replace(/Schema$/, "")}.json`).sort();
    expect(readdirSync(dir).sort()).toEqual(expected);
    expect(expected.length).toBeGreaterThanOrEqual(30);
  });

  for (const [name, schema] of named) {
    it(`${name} matches its committed file (run "pnpm build" after a schema change)`, () => {
      const file = join(dir, `${name.replace(/Schema$/, "")}.json`);
      expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(toJsonSchema(name, schema));
    });
  }

  it("lists the keys of an input schema and refuses the rest", () => {
    const json = toJsonSchema(
      "searchDecisionsInputSchema",
      schemaModule.searchDecisionsInputSchema,
    );
    expect(json["additionalProperties"]).toBe(false);
    expect(json["required"]).toEqual(["query"]);
    expect(JSON.stringify(json)).not.toContain("readOnly");
  });

  it("keeps a response schema open", () => {
    const json = toJsonSchema("decisionResponseSchema", schemaModule.decisionResponseSchema);
    expect(json["additionalProperties"]).toEqual({});
  });

  it("gives the tools the generated input schemas", () => {
    for (const tool of tools) {
      const file = `${tool.name === "checkCitations" ? "checkCitations" : tool.name}Input.json`;
      expect(tool.inputSchema).toEqual(JSON.parse(readFileSync(join(dir, file), "utf8")));
    }
  });
});
