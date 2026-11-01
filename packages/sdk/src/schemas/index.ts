/**
 * Schemas for every request input and every response body of the Klaracase API, written with
 * `zod/mini`. Import them from `@klaracase/sdk/schemas`.
 *
 * Needs the optional peer dependency `zod` 4.1 or newer. The main entry `@klaracase/sdk` does not
 * import zod.
 *
 * Every object schema is loose: a key the schema does not list survives a parse, because the API
 * only adds keys within a major version. The inferred types are the types of the main entry.
 *
 * ```ts
 * import { searchDecisionsInputSchema } from "@klaracase/sdk/schemas";
 * import * as z from "zod/mini";
 *
 * const input = z.parse(searchDecisionsInputSchema, { query: "Untreue", limit: 5 });
 * ```
 */
export { countSchema, creditsSchema, open } from "./common.js";
export * from "./requests.js";
export * from "./responses.js";
export { toJsonSchema } from "./json-schema.js";
