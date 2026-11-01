import * as z from "zod/mini";

/** Make every object in a JSON Schema list its keys and refuse the rest. */
function forbidExtraKeys(node: unknown): void {
  if (Array.isArray(node)) return node.forEach(forbidExtraKeys);
  if (node === null || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  if (record["type"] === "object" && record["properties"] !== undefined) {
    record["additionalProperties"] = false;
  }
  for (const value of Object.values(record)) forbidExtraKeys(value);
}

/** `readOnly` comes from `z.readonly()` on arrays. It means nothing to a tool caller. */
function dropReadOnly(node: unknown): void {
  if (Array.isArray(node)) return node.forEach(dropReadOnly);
  if (node === null || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  delete record["readOnly"];
  for (const value of Object.values(record)) dropReadOnly(value);
}

/**
 * The JSON Schema of one schema of this module, in the form the SDK ships in `schemas/*.json`.
 *
 * An input schema (a name that ends in `Input`, `Options`, `Filters` or `Params`) describes what a
 * caller may send, so every object in it lists its keys and sets `additionalProperties` to
 * `false`. A response schema stays open, like the parse. The `title` is the export name without the
 * `Schema` suffix.
 *
 * @param name The export name, for example `searchDecisionsInputSchema`.
 * @param schema The schema.
 */
export function toJsonSchema(name: string, schema: z.ZodMiniType): Record<string, unknown> {
  const isInput = /(Input|Options|Filters|Params)Schema$/.test(name);
  const json = z.toJSONSchema(schema, {
    unrepresentable: "any",
    io: isInput ? "input" : "output",
  }) as Record<string, unknown>;
  dropReadOnly(json);
  if (isInput) forbidExtraKeys(json);
  json["title"] = name.replace(/Schema$/, "");
  return json;
}
