import type { Transport } from "../http.js";
import type {
  ApiEnvelope,
  Branch,
  CitedStatute,
  Count,
  DocumentType,
  Open,
  RequestOptions,
  SearchMode,
  WithMeta,
} from "../types.js";
import type { QueryExpansion, Snippet } from "./decisions.js";

/** Filters of `GET /search`. `query` is the first argument of the method. */
export interface CrossTypeSearchFilters {
  /** Narrows the laws section only. `DE`, `EU` or `XI`. */
  jurisdiction?: Open<"DE" | "EU" | "XI">;
  court?: string;
  branch?: Branch;
  /** `YYYY-MM-DD`, inclusive. */
  date_from?: string;
  /** `YYYY-MM-DD`, inclusive. */
  date_to?: string;
  mode?: SearchMode;
  document_type?: DocumentType;
  cited_norm?: string;
  cited_statutes?: readonly CitedStatute[];
  /** Results per section. Default 5, at most 10. */
  limit?: number;
  bridge?: boolean;
}

export interface CrossTypeResult {
  id: string;
  artifact_type: Open<"LAW" | "DECISION">;
  aktenzeichen: string | null;
  court: string | null;
  date: string | null;
  document_type: string | null;
  title: string | null;
  snippet: string | null;
  snippets: Snippet[];
  chunk_title: string | null;
  rn_range: string | null;
  fundstelle: string | null;
  confidence: string | null;
  [key: string]: unknown;
}

/** Body of `GET /search`. */
export interface CrossTypeSearchResponse extends ApiEnvelope {
  sections: { laws: CrossTypeResult[]; decisions: CrossTypeResult[]; [key: string]: unknown };
  section_totals: Record<string, unknown>;
  limit: number;
  total_available: Count;
  total_available_basis: string;
  pool_exhaustive: boolean;
  truncated: boolean;
  mode: SearchMode;
  query_expansion: QueryExpansion;
  frequently_cited_by_results: unknown[];
  norms_cited_by_decision_results: unknown[];
  top_confidence?: string | null;
}

/** `GET /search`: statutes and decisions together. Costs 1 credit. */
export function crossTypeSearch(
  transport: Transport,
  query: string,
  filters: CrossTypeSearchFilters = {},
  request?: RequestOptions,
): Promise<WithMeta<CrossTypeSearchResponse>> {
  return transport.request(
    { method: "GET", path: "/search", query: { query, ...filters } },
    request,
  );
}
