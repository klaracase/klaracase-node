import { encodePathSegment } from "../encoding.js";
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

/** Filters of `GET /decisions/search`. `query` is the first argument of the method. */
export interface DecisionSearchFilters {
  /** Court name as in `corpus.facets("court_name")`. */
  court?: string;
  branch?: Branch;
  document_type?: DocumentType;
  /** One canonical statute token, for example `§ 906 BGB`. */
  cited_norm?: string;
  /** Any section of these statutes. Sent as `cited_statutes[]=A&cited_statutes[]=B`. */
  cited_statutes?: readonly CitedStatute[];
  /** `YYYY-MM-DD`, inclusive. */
  date_from?: string;
  /** `YYYY-MM-DD`, inclusive. */
  date_to?: string;
  mode?: SearchMode;
  /** Default 20, which is also the cap. */
  limit?: number;
  /** 1 to 10. */
  page?: number;
  /** Let the server add curated legal-register terms before retrieval. Default true. */
  bridge?: boolean;
}

export interface Snippet {
  text: string;
  rn?: number;
  [key: string]: unknown;
}

export interface DecisionSearchResult {
  id: string;
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
  fortgeltung_checked: boolean;
  fortgeltung_note: string;
  confidence: Open<"high" | "medium" | "low"> | null;
  [key: string]: unknown;
}

export interface QueryExpansion {
  status: string;
  applied: boolean;
  reason: string | null;
  note: string | null;
  [key: string]: unknown;
}

/** Body of `GET /decisions/search`. */
export interface DecisionSearchResponse extends ApiEnvelope {
  results: DecisionSearchResult[];
  payload_truncated: boolean;
  total_available: Count;
  total_available_basis: string;
  candidate_pool: number;
  pool_exhaustive: boolean;
  truncated: boolean;
  page: number;
  limit: number;
  mode: SearchMode;
  frequently_cited_by_results: unknown[];
  query_expansion: QueryExpansion;
  top_confidence?: string | null;
}

/** Arguments of `GET /decisions/{id}`. */
export interface DecisionGetOptions {
  /** Minimum 500. Default 40000. */
  max_chars?: number;
  /** First Randnummer to return. */
  rn_from?: number;
  /** Last Randnummer to return, inclusive. */
  rn_to?: number;
  /** `Tenor`, `Leitsatz`, `Tatbestand` or `Gründe`, in any case. */
  section?: Open<"Tenor" | "Leitsatz" | "Tatbestand" | "Gründe">;
  /** Disambiguates an Aktenzeichen. Ignored for a UUID. */
  court?: string;
  /** `YYYY-MM-DD`. Disambiguates an Aktenzeichen. Ignored for a UUID. */
  date?: string;
}

export interface DecisionMetadata {
  document_type: string | null;
  ecli: string | null;
  file_numbers: string[];
  [key: string]: unknown;
}

export interface RnRange {
  rn_from: number | null;
  rn_to: number | null;
  rn_source: string | null;
  [key: string]: unknown;
}

/** Body of `GET /decisions/{id}`. */
export interface DecisionResponse extends ApiEnvelope {
  id: string;
  aktenzeichen: string | null;
  court: string | null;
  date: string | null;
  jurisdiction: string | null;
  metadata: DecisionMetadata;
  fortgeltung_checked: boolean;
  fortgeltung_note: string;
  full_text: string;
  text_length: number;
  truncated: boolean;
  rn_source: string | null;
  rn_source_note: string | null;
  available_sections: string[];
  available_range: RnRange | null;
  available_range_scope: string | null;
  has_rn_anchors: boolean;
}

/** Arguments of `GET /decisions/{id}/citations`. */
export interface DecisionCitationsOptions {
  /** `both` is the default. */
  direction?: Open<"outgoing" | "incoming" | "both">;
  /** 1 (default) or 2. */
  depth?: 1 | 2;
  /** Disambiguates an Aktenzeichen. */
  court?: string;
  /** `YYYY-MM-DD`. Disambiguates an Aktenzeichen. */
  date?: string;
  /** 1 to 20. Depth 1 only. */
  page?: number;
}

export interface CitationEdge {
  reference_canonical: string;
  reference_role: string | null;
  resolution_status: string;
  in_corpus: boolean;
  corpus: Record<string, unknown> | null;
  from_artifact_id: string;
  hop?: number;
  [key: string]: unknown;
}

export interface CitationPagination {
  page: number;
  page_size: number;
  max_page: number;
  [key: string]: unknown;
}

/** Body of `GET /decisions/{id}/citations`. */
export interface DecisionCitationsResponse extends ApiEnvelope {
  source: { id: string; aktenzeichen: string | null; court: string | null; date: string | null };
  references: CitationEdge[];
  referenced_by: CitationEdge[];
  served_direction: string;
  served_references_total: number;
  served_referenced_by_total: number;
  references_total: number;
  references_resolved_total: number;
  referenced_by_total: number;
  references_unresolved_total: number;
  references_withheld_reasons: unknown[];
  totals_scope: string;
  per_direction_cap: number;
  unresolved_cap: number;
  node_cap: number;
  truncated: boolean;
  nodes_omitted: number;
  payload_truncated: boolean;
  pagination: CitationPagination;
  fortgeltung_checked: boolean;
  fortgeltung_note: string;
}

export class Decisions {
  constructor(private readonly transport: Transport) {}

  /** Search decisions. Costs 1 credit. */
  search(
    query: string,
    filters: DecisionSearchFilters = {},
    request?: RequestOptions,
  ): Promise<WithMeta<DecisionSearchResponse>> {
    return this.transport.request(
      { method: "GET", path: "/decisions/search", query: { query, ...filters } },
      request,
    );
  }

  /** Read one decision by UUID, Aktenzeichen or ECLI. Costs 1 credit. */
  get(
    id: string,
    options: DecisionGetOptions = {},
    request?: RequestOptions,
  ): Promise<WithMeta<DecisionResponse>> {
    return this.transport.request(
      { method: "GET", path: `/decisions/${encodePathSegment(id)}`, query: options },
      request,
    );
  }

  /** Read the citation graph around one decision. Costs 2 credits. */
  citations(
    id: string,
    options: DecisionCitationsOptions = {},
    request?: RequestOptions,
  ): Promise<WithMeta<DecisionCitationsResponse>> {
    return this.transport.request(
      { method: "GET", path: `/decisions/${encodePathSegment(id)}/citations`, query: options },
      request,
    );
  }
}
