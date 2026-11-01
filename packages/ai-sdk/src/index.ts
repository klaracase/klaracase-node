import {
  checkCitationsInputSchema,
  getDecisionInputSchema,
  getNormInputSchema,
  searchDecisionsInputSchema,
} from "@klaracase/sdk/schemas";
import {
  callTool,
  tools,
  type CallToolOptions,
  type ToolClient,
  type ToolName,
} from "@klaracase/sdk/tools";
import { jsonSchema, tool, type JSONSchema7, type Tool } from "ai";
import * as z from "zod/mini";

/** The parts of the Klaracase client that the tools call. A test double can stand in for it. */
export type KlaracaseToolClient = ToolClient;

export type { CallToolOptions, ToolBudget, ToolName } from "@klaracase/sdk/tools";
/** The name of one of the four tools. */
export type KlaracaseToolName = ToolName;

/** Input schema of the `searchDecisions` tool. Mirrors `GET /decisions/search`. */
export const searchDecisionsInput: typeof searchDecisionsInputSchema = searchDecisionsInputSchema;
/** Input schema of the `getDecision` tool. Mirrors `GET /decisions/{id}`. */
export const getDecisionInput: typeof getDecisionInputSchema = getDecisionInputSchema;
/** Input schema of the `getNorm` tool. Mirrors `GET /norms/{reference}`. */
export const getNormInput: typeof getNormInputSchema = getNormInputSchema;
/** Input schema of the `checkCitations` tool. Mirrors `POST /citation-checks` with `text`. */
export const checkCitationsInput: typeof checkCitationsInputSchema = checkCitationsInputSchema;

/**
 * Options of {@link klaracaseTools}. `maxChars` and `budget` are the options of `callTool`.
 */
export interface KlaracaseToolsOptions<K extends ToolName = ToolName> extends Pick<
  CallToolOptions,
  "maxChars" | "budget" | "timeout" | "maxRetries" | "headers"
> {
  /** Names of the tools to return. Default: all four. */
  tools?: readonly K[] | undefined;
}

function definitionOf(name: ToolName) {
  const definition = tools.find((candidate) => candidate.name === name);
  if (definition === undefined) throw new Error(`Unknown Klaracase tool: ${name}`);
  return definition;
}

/**
 * The input schema of a tool for the AI SDK: the JSON Schema that ships with
 * `@klaracase/sdk/tools`, and the zod schema to validate the arguments the model produced.
 * The JSON Schema comes from the shipped files because the AI SDK cannot convert the open enums
 * of the zod schemas.
 */
function inputSchemaOf<S extends z.ZodMiniType>(name: ToolName, schema: S) {
  return jsonSchema<z.infer<S>>(definitionOf(name).inputSchema as JSONSchema7, {
    validate: (value) => {
      const parsed = z.safeParse(schema, value);
      if (parsed.success) return { success: true, value: parsed.data };
      return { success: false, error: new Error(z.prettifyError(parsed.error)) };
    },
  });
}

/** The four tools, typed by the zod schemas of their input. */
export interface KlaracaseTools {
  searchDecisions: Tool<z.infer<typeof searchDecisionsInputSchema>, unknown>;
  getDecision: Tool<z.infer<typeof getDecisionInputSchema>, unknown>;
  getNorm: Tool<z.infer<typeof getNormInputSchema>, unknown>;
  checkCitations: Tool<z.infer<typeof checkCitationsInputSchema>, unknown>;
}

function buildTools(client: ToolClient, options: CallToolOptions): KlaracaseTools {
  /** Run the tool through `callTool`. The AI SDK abort signal cancels the request. */
  const run = (name: ToolName, input: unknown, abortSignal: AbortSignal | undefined) =>
    callTool(client, name, input, { ...options, signal: abortSignal });

  return {
    searchDecisions: tool({
      description: definitionOf("searchDecisions").description,
      inputSchema: inputSchemaOf("searchDecisions", searchDecisionsInput),
      execute: async (input, { abortSignal }) => run("searchDecisions", input, abortSignal),
    }),
    getDecision: tool({
      description: definitionOf("getDecision").description,
      inputSchema: inputSchemaOf("getDecision", getDecisionInput),
      execute: async (input, { abortSignal }) => run("getDecision", input, abortSignal),
    }),
    getNorm: tool({
      description: definitionOf("getNorm").description,
      inputSchema: inputSchemaOf("getNorm", getNormInput),
      execute: async (input, { abortSignal }) => run("getNorm", input, abortSignal),
    }),
    checkCitations: tool({
      description: definitionOf("checkCitations").description,
      inputSchema: inputSchemaOf("checkCitations", checkCitationsInput),
      execute: async (input, { abortSignal }) => run("checkCitations", input, abortSignal),
    }),
  };
}

/**
 * Vercel AI SDK tools over a Klaracase client. A thin wrapper over `@klaracase/sdk/tools`: the
 * descriptions, the input schemas and the dispatch come from there.
 *
 * ```ts
 * const tools = klaracaseTools(new Klaracase(), { tools: ["searchDecisions", "getNorm"] });
 * ```
 *
 * Each tool returns what `callTool` returns: the API body, trimmed to `maxChars` where it is long
 * (`checkCitations` returns a slim object). A failure from the API comes back as
 * `{ error: { code, detail, retry_after_seconds } }`, so the model can read it and decide. The AI
 * SDK `abortSignal` cancels the request. `cited_statutes` takes at most 5 statutes, like the
 * server. Cite only what a tool returned. A `not_found` verdict means the citation was not found
 * in the corpus; it does not mean it is invented.
 */
export function klaracaseTools<K extends ToolName = ToolName>(
  client: ToolClient,
  options: KlaracaseToolsOptions<K> = {},
): Pick<KlaracaseTools, K> {
  const { tools: names, ...callOptions } = options;
  const all = buildTools(client, callOptions);
  const picked = {} as Pick<KlaracaseTools, K>;
  for (const name of names ?? (Object.keys(all) as K[])) {
    if (!(name in all)) throw new Error(`Unknown Klaracase tool: ${String(name)}`);
    picked[name] = all[name];
  }
  return picked;
}
