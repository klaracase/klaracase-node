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
  jurisdiction?: Open<"DE" | "EU" | "XI"> | undefined;
  court?: string | undefined;
  branch?: Branch | undefined;
  /** `YYYY-MM-DD`, inclusive. */
  date_from?: string | undefined;
  /** `YYYY-MM-DD`, inclusive. */
  date_to?: string | undefined;
  mode?: SearchMode | undefined;
  document_type?: DocumentType | undefined;
  cited_norm?: string | undefined;
  cited_statutes?: readonly CitedStatute[] | undefined;
  /** Results per section. Default 5, at most 10. */
  limit?: number | undefined;
  bridge?: boolean | undefined;
}

interface CrossTypeBase {
  id: string;
  title: string | null;
  snippet: string | null;
  snippets: Snippet[];
  chunk_title: string | null;
  rn_range: string | null;
  fundstelle: string | null;
  confidence: Open<"high" | "medium" | "low"> | null;
}

/** A statute hit of `GET /search`. It has no court, date or Aktenzeichen. */
export interface CrossTypeLaw extends CrossTypeBase {
  artifact_type: "LAW";
  aktenzeichen: null;
  court: null;
  date: null;
  document_type: null;
  breadcrumb: string | null;
  abbreviation: string;
  law_type: string;
  jurisdiction: string | null;
}

/** A decision hit of `GET /search`. */
export interface CrossTypeDecision extends CrossTypeBase {
  artifact_type: "DECISION";
  aktenzeichen: string | null;
  court: string | null;
  date: string | null;
  document_type: Open<DocumentType> | null;
  fortgeltung_checked: boolean;
  fortgeltung_note: string;
}

/** Counts of one section of `GET /search`. */
export interface SectionTotal {
  total_available: Count;
  total_available_basis: string;
  candidate_pool: number;
  pool_exhaustive: boolean;
  truncated: boolean;
}

/** Body of `GET /search`. */
export interface CrossTypeSearchResponse extends ApiEnvelope {
  sections: { laws: CrossTypeLaw[]; decisions: CrossTypeDecision[] };
  section_totals: { laws: SectionTotal; decisions: SectionTotal };
  limit: number;
  total_available: Count;
  total_available_basis: string;
  pool_exhaustive: boolean;
  truncated: boolean;
  mode: Open<SearchMode>;
  query_expansion: QueryExpansion;
  frequently_cited_by_results: unknown[];
  norms_cited_by_decision_results: unknown[];
  top_confidence?: Open<"high" | "medium" | "low"> | null;
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
