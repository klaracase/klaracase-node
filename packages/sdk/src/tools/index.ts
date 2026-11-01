/**
 * Tool definitions and a dispatcher for LLM agents. Import them from `@klaracase/sdk/tools`.
 *
 * This entry has no runtime dependency. The input schemas are plain JSON Schema, generated from
 * the zod schemas of `@klaracase/sdk/schemas` at build time. Use them with any framework that
 * takes JSON Schema tools: Anthropic, OpenAI, MCP hosts, your own loop.
 *
 * ```ts
 * import { callTool, tools } from "@klaracase/sdk/tools";
 *
 * const definitions = tools.map((tool) => ({
 *   name: tool.name,
 *   description: tool.description,
 *   input_schema: tool.inputSchema,
 * }));
 * const result = await callTool(client, "searchDecisions", { query: "Untreue" });
 * ```
 */
import checkCitationsInputJson from "../../schemas/checkCitationsInput.json";
import getDecisionInputJson from "../../schemas/getDecisionInput.json";
import getNormInputJson from "../../schemas/getNormInput.json";
import searchDecisionsInputJson from "../../schemas/searchDecisionsInput.json";
import type { Klaracase } from "../client.js";
import { KlaracaseError } from "../errors.js";
import type {
  CheckCitationsInput,
  GetDecisionInput,
  GetNormInput,
  SearchDecisionsInput,
} from "../inputs.js";
import type { RequestOptions } from "../types.js";

/** A JSON Schema document. */
export type JsonSchema = Record<string, unknown>;

/** The names of the tools. */
export type ToolName = "searchDecisions" | "getDecision" | "getNorm" | "checkCitations";

/** One tool, in a shape that maps onto every agent framework. */
export interface ToolDefinition {
  readonly name: ToolName;
  readonly description: string;
  /** JSON Schema of the arguments. */
  readonly inputSchema: JsonSchema;
}

/** The arguments each tool takes, by tool name. */
export interface ToolArguments {
  searchDecisions: SearchDecisionsInput;
  getDecision: GetDecisionInput;
  getNorm: GetNormInput;
  checkCitations: CheckCitationsInput;
}

/**
 * The tools. Each description tells the model what the tool is for, what it costs and what a
 * result does and does not prove. `not_found` is absence of evidence in the corpus, never a claim
 * that a citation is invented.
 */
export const tools: readonly ToolDefinition[] = [
  {
    name: "searchDecisions",
    description:
      "Search German court decisions. Phrase the query as German legal concepts. Costs 1 credit per distinct search and month. Returns results with Aktenzeichen, court, date and snippets.",
    inputSchema: searchDecisionsInputJson,
  },
  {
    name: "getDecision",
    description:
      "Read one decision by UUID, Aktenzeichen or ECLI, in full or as one section or Randnummer window. Costs 1 credit per decision and month.",
    inputSchema: getDecisionInputJson,
  },
  {
    name: "getNorm",
    description:
      "Read the current text of one German or EU norm by its citation, for example § 535 BGB. Costs 1 credit per norm and month.",
    inputSchema: getNormInputJson,
  },
  {
    name: "checkCitations",
    description:
      "Check every court-decision and statute citation in a German legal text against the corpus. One verdict per citation, with offsets into the text. not_found means not found in the corpus, not invented. Costs 2 to 4 credits by length.",
    inputSchema: checkCitationsInputJson,
  },
];

/** The parts of the client that the tools call. A test double can stand in for it. */
export interface ToolClient {
  decisions: Pick<Klaracase["decisions"], "search" | "get">;
  norms: Pick<Klaracase["norms"], "get">;
  citationChecks: Pick<Klaracase["citationChecks"], "create">;
}

/** A credit allowance for a series of calls. `callTool` lowers `credits` as calls cost credits. */
export interface ToolBudget {
  /** Credits left. Mutated by `callTool`, so one object can cap a whole agent run. */
  credits: number;
}

/** Options of {@link callTool}. */
export interface CallToolOptions extends RequestOptions {
  /**
   * Cap on the characters of text a result carries. Default 4000. It sets the default and the cap
   * of `max_chars` for `getDecision`, and cuts the text of `getNorm`. The API minimum for
   * `max_chars` is 500, so a value below 500 acts as 500.
   */
  maxChars?: number | undefined;
  /** Stop the agent from spending more than this. A call that would not fit is not sent. */
  budget?: ToolBudget | undefined;
}

/** What `callTool` returns when a call fails in a way the model can read and act on. */
export interface ToolError {
  error: {
    code: string;
    detail: string;
    retry_after_seconds: number | null;
  };
}

/** The slim result of `checkCitations`. */
export interface SlimCitationCheck {
  id: string;
  status: string;
  verdict_counts: Record<string, number>;
  unique_citations: unknown[];
  findings: Array<{
    id: string;
    canonical: string | null;
    verdict: string;
    raw_text: string;
    start_offset: number;
    end_offset: number;
  }>;
}

const DEFAULT_MAX_CHARS = 4000;
const API_MIN_MAX_CHARS = 500;

/**
 * Run one tool call and return a result that is safe to hand to a model.
 *
 * - `getDecision` gets `max_chars` 4000 unless the call or `maxChars` says otherwise, and never
 *   more than `maxChars`.
 * - `getNorm` cuts the norm text to `maxChars` characters and sets `text_truncated` when it did.
 * - `checkCitations` returns a slim object: `id`, `status`, `verdict_counts`, `unique_citations`
 *   and, for each finding, `id`, `canonical`, `verdict`, `raw_text` and the two offsets. Read
 *   `status` before you trust the verdicts.
 * - A failure that comes from the API or the network returns `{ error: { code, detail,
 *   retry_after_seconds } }` instead of throwing, so the model can read it. Bad arguments and an
 *   unknown tool name return the same shape. Other errors, such as an abort, are thrown.
 * - With a `budget`, a call whose price does not fit is not sent and returns the error
 *   `budget_exceeded`. The cost of each answer is taken off `budget.credits`.
 *
 * @param client A `Klaracase` client, or anything with the methods the tools call.
 * @param name The tool name.
 * @param args The arguments, as the model produced them.
 */
export async function callTool(
  client: ToolClient,
  name: string,
  args: unknown,
  options: CallToolOptions = {},
): Promise<unknown> {
  const tool = tools.find((candidate) => candidate.name === name);
  if (tool === undefined) {
    return toolError("unknown_tool", `There is no tool named "${name}".`);
  }
  const problem = checkArguments(tool, args);
  if (problem !== null) return toolError("invalid_arguments", problem);
  const input = args as Record<string, unknown>;

  const { maxChars: maxCharsOption, budget, ...request } = options;
  const maxChars = Math.max(API_MIN_MAX_CHARS, maxCharsOption ?? DEFAULT_MAX_CHARS);

  const price = estimatePrice(tool.name, input);
  if (budget !== undefined && price > budget.credits) {
    return toolError(
      "budget_exceeded",
      `This call can cost up to ${price} credits, and the budget has ${budget.credits} left. Nothing was sent.`,
    );
  }

  try {
    const answer = await dispatch(client, tool.name, input, maxChars, request);
    const cost = (answer.body as { credits?: { cost?: unknown } }).credits?.cost;
    if (budget !== undefined && typeof cost === "number") budget.credits -= cost;
    return answer.result;
  } catch (error) {
    if (KlaracaseError.is(error)) {
      return toolError(error.code ?? "unknown", error.detail, error.retryAfterSeconds);
    }
    throw error;
  }
}

async function dispatch(
  client: ToolClient,
  name: ToolName,
  input: Record<string, unknown>,
  maxChars: number,
  request: RequestOptions,
): Promise<{ body: object; result: unknown }> {
  switch (name) {
    case "searchDecisions": {
      const { query, ...filters } = input as unknown as SearchDecisionsInput;
      const body = await client.decisions.search(query, filters, request);
      return { body, result: body };
    }
    case "getDecision": {
      const { id, ...slice } = input as unknown as GetDecisionInput;
      const wanted = slice.max_chars ?? maxChars;
      const max_chars = Math.max(API_MIN_MAX_CHARS, Math.min(wanted, maxChars));
      const body = await client.decisions.get(id, { ...slice, max_chars }, request);
      return { body, result: body };
    }
    case "getNorm": {
      const { reference, ...rest } = input as unknown as GetNormInput;
      const body = await client.norms.get(reference, rest, request);
      const characters = Array.from(body.norm.text);
      if (characters.length <= maxChars) return { body, result: body };
      const norm = {
        ...body.norm,
        text: characters.slice(0, maxChars).join(""),
        text_truncated: true,
      };
      return { body, result: { ...body, norm } };
    }
    case "checkCitations": {
      const { text, reference_date } = input as unknown as CheckCitationsInput;
      const body = await client.citationChecks.create(
        reference_date === undefined ? { text } : { text, reference_date },
        request,
      );
      const slim: SlimCitationCheck = {
        id: body.id,
        status: body.status,
        verdict_counts: body.verdict_counts,
        unique_citations: body.unique_citations,
        findings: body.findings.map((finding) => ({
          id: finding.id,
          canonical: finding.canonical,
          verdict: finding.verdict,
          raw_text: finding.raw_text,
          start_offset: finding.start_offset,
          end_offset: finding.end_offset,
        })),
      };
      return { body, result: slim };
    }
  }
}

/** Credits a call can cost at most. A repeat in the same month costs 0, so this is an upper bound. */
function estimatePrice(name: ToolName, input: Record<string, unknown>): number {
  if (name !== "checkCitations") return 1;
  const text = typeof input["text"] === "string" ? input["text"] : "";
  return Math.max(2, Math.ceil(Array.from(text).length / 5000));
}

/** Check the arguments against the `required` and `properties` of the tool's schema. */
function checkArguments(tool: ToolDefinition, args: unknown): string | null {
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    return "The arguments must be a JSON object.";
  }
  const input = args as Record<string, unknown>;
  const required = (tool.inputSchema["required"] ?? []) as string[];
  for (const key of required) {
    if (input[key] === undefined || input[key] === null)
      return `The argument "${key}" is required.`;
  }
  const properties = (tool.inputSchema["properties"] ?? {}) as Record<string, { type?: string }>;
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    const declared = properties[key]?.type;
    if (declared === "string" && typeof value !== "string")
      return `The argument "${key}" must be a string.`;
    if (declared === "integer" && !Number.isInteger(value))
      return `The argument "${key}" must be a whole number.`;
    if (declared === "boolean" && typeof value !== "boolean")
      return `The argument "${key}" must be true or false.`;
    if (declared === "array" && !Array.isArray(value))
      return `The argument "${key}" must be a list.`;
  }
  return null;
}

function toolError(
  code: string,
  detail: string,
  retryAfterSeconds: number | null = null,
): ToolError {
  return { error: { code, detail, retry_after_seconds: retryAfterSeconds } };
}
