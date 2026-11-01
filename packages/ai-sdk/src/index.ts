import type { Klaracase } from "@klaracase/sdk";
import { tool } from "ai";
import { z } from "zod";

/** The parts of the Klaracase client that the tools call. A mock can stand in for it. */
export interface KlaracaseToolClient {
  decisions: Pick<Klaracase["decisions"], "search" | "get">;
  norms: Pick<Klaracase["norms"], "get">;
  citationChecks: Pick<Klaracase["citationChecks"], "create">;
}

export type KlaracaseToolName = "searchDecisions" | "getDecision" | "getNorm" | "checkCitations";

export interface KlaracaseToolsOptions<K extends KlaracaseToolName = KlaracaseToolName> {
  /** Names of the tools to return. Default: all four. */
  tools?: readonly K[];
}

const branch = z.enum([
  "ordentlich",
  "verwaltung",
  "sozial",
  "arbeit",
  "finanz",
  "verfassung",
  "patent",
  "unbekannt",
]);

const date = (what: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe(what);

/** Input of the `searchDecisions` tool. Mirrors `GET /decisions/search`. */
export const searchDecisionsInput = z.object({
  query: z
    .string()
    .min(2)
    .max(500)
    .describe("Search query in German legal-concept phrasing, 2 to 500 characters."),
  court: z.string().max(100).optional().describe("Court name, for example BGH."),
  branch: branch
    .optional()
    .describe("Court jurisdiction (Gerichtsbarkeit), not the legal subject area."),
  document_type: z
    .enum(["Urteil", "Beschluss", "Verfügung", "Sonstige", "Gerichtsbescheid", "Schlussanträge"])
    .optional()
    .describe("Restrict to one document type."),
  cited_norm: z
    .string()
    .max(120)
    .optional()
    .describe("Decisions that cite this norm, for example § 906 BGB."),
  cited_statutes: z
    .array(
      z.enum([
        "StGB",
        "StPO",
        "InsO",
        "DSGVO",
        "GDPR",
        "BDSG",
        "BauGB",
        "BBauG",
        "BauNVO",
        "StVG",
        "StVO",
      ]),
    )
    .optional()
    .describe("Decisions that cite any section of these statutes."),
  date_from: date("Earliest decision date, YYYY-MM-DD.").optional(),
  date_to: date("Latest decision date, YYYY-MM-DD.").optional(),
  mode: z
    .enum(["keyword", "semantic", "hybrid"])
    .optional()
    .describe("Retrieval mode. Default hybrid."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe("Maximum results. Default and cap: 20."),
  page: z.number().int().min(1).max(10).optional().describe("Page number, 1 to 10."),
  bridge: z
    .boolean()
    .optional()
    .describe("Let the server add legal-register terms to the query. Default true."),
});

/** Input of the `getDecision` tool. Mirrors `GET /decisions/{id}`. */
export const getDecisionInput = z.object({
  id: z.string().min(1).describe("A decision UUID, an Aktenzeichen or an ECLI."),
  section: z
    .enum(["Tenor", "Leitsatz", "Tatbestand", "Gründe"])
    .optional()
    .describe("Return only this section."),
  rn_from: z.number().int().min(1).optional().describe("First Randnummer to return."),
  rn_to: z.number().int().min(1).optional().describe("Last Randnummer to return, inclusive."),
  max_chars: z
    .number()
    .int()
    .min(500)
    .optional()
    .describe("Maximum characters of text. Default 40000."),
  court: z.string().optional().describe("Court short form, to disambiguate an Aktenzeichen."),
  date: date("Decision date, to disambiguate an Aktenzeichen.").optional(),
});

/** Input of the `getNorm` tool. Mirrors `GET /norms/{reference}`. */
export const getNormInput = z.object({
  reference: z
    .string()
    .min(1)
    .max(120)
    .describe("The norm as cited, for example § 535 BGB or Art. 6 DSGVO."),
  jurisdiction: z
    .enum(["DE", "EU"])
    .optional()
    .describe("Only used when the abbreviation is ambiguous."),
});

/** Input of the `checkCitations` tool. Mirrors `POST /citation-checks` with `text`. */
export const checkCitationsInput = z.object({
  text: z
    .string()
    .min(50)
    .max(20000)
    .describe("The German legal text to check, 50 to 20,000 characters."),
  reference_date: date(
    "Document date, YYYY-MM-DD. Applied to statute citations that name no date.",
  ).optional(),
});

function buildTools(client: KlaracaseToolClient) {
  return {
    searchDecisions: tool({
      description:
        "Search German court decisions. Phrase the query as German legal concepts. Costs 1 credit per distinct search and month. Returns results with Aktenzeichen, court, date and snippets.",
      inputSchema: searchDecisionsInput,
      execute: async ({ query, ...filters }) => client.decisions.search(query, filters),
    }),
    getDecision: tool({
      description:
        "Read one decision by UUID, Aktenzeichen or ECLI, in full or as one section or Randnummer window. Costs 1 credit per decision and month.",
      inputSchema: getDecisionInput,
      execute: async ({ id, ...slice }) => client.decisions.get(id, slice),
    }),
    getNorm: tool({
      description:
        "Read the current text of one German or EU norm by its citation, for example § 535 BGB. Costs 1 credit per norm and month.",
      inputSchema: getNormInput,
      execute: async ({ reference, ...rest }) => client.norms.get(reference, rest),
    }),
    checkCitations: tool({
      description:
        "Check every court-decision and statute citation in a German legal text against the corpus. One verdict per citation, with offsets into the text. not_found means not found in the corpus, not invented. Costs 2 to 4 credits by length.",
      inputSchema: checkCitationsInput,
      execute: async ({ text, reference_date }) =>
        client.citationChecks.create(
          reference_date === undefined ? { text } : { text, reference_date },
        ),
    }),
  };
}

type AllTools = ReturnType<typeof buildTools>;

/**
 * Vercel AI SDK tools over a Klaracase client.
 *
 * ```ts
 * const tools = klaracaseTools(new Klaracase(), { tools: ["searchDecisions", "getNorm"] });
 * ```
 *
 * Each tool returns the parsed API body. A tool that fails throws a `KlaracaseError`; the AI SDK
 * reports it to the model as a tool error. Cite only what a tool returned. A `not_found` verdict
 * means the citation was not found in the corpus; it does not mean it is invented.
 */
export function klaracaseTools<K extends KlaracaseToolName = KlaracaseToolName>(
  client: KlaracaseToolClient,
  options: KlaracaseToolsOptions<K> = {},
): Pick<AllTools, K> {
  const all = buildTools(client);
  const names = options.tools ?? (Object.keys(all) as K[]);
  const picked = {} as Pick<AllTools, K>;
  for (const name of names) {
    if (!(name in all)) throw new Error(`Unknown Klaracase tool: ${String(name)}`);
    picked[name] = all[name];
  }
  return picked;
}
