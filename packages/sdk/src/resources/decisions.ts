import { encodePathSegment } from "../encoding.js";
import type { Transport } from "../http.js";
import type {
  ApiEnvelope,
  Branch,
  CitationDirection,
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
  court?: string | undefined;
  branch?: Branch | undefined;
  document_type?: DocumentType | undefined;
  /** One canonical statute token, for example `§ 906 BGB`. */
  cited_norm?: string | undefined;
  /** Any section of these statutes. Sent as `cited_statutes[]=A&cited_statutes[]=B`. */
  cited_statutes?: readonly CitedStatute[] | undefined;
  /** `YYYY-MM-DD`, inclusive. */
  date_from?: string | undefined;
  /** `YYYY-MM-DD`, inclusive. */
  date_to?: string | undefined;
  mode?: SearchMode | undefined;
  /** Default 20, which is also the cap. */
  limit?: number | undefined;
  /** 1 to 10. */
  page?: number | undefined;
  /** Let the server add curated legal-register terms before retrieval. Default true. */
  bridge?: boolean | undefined;
}

/** One passage of a search result. `rn` is the Randnummer of the passage when it has one. */
export interface Snippet {
  text: string;
  rn?: number;
}

/** How the server rewrote a lay query into legal terms. */
export interface QueryExpansion {
  status: Open<"abstained" | "applied">;
  applied: boolean;
  reason: Open<"no_lay_term"> | null;
  note: string | null;
}

/** One hit of `GET /decisions/search`. */
export interface DecisionSearchResult {
  id: string;
  aktenzeichen: string | null;
  court: string | null;
  date: string | null;
  document_type: Open<DocumentType> | null;
  title: string | null;
  snippet: string | null;
  snippets: Snippet[];
  chunk_title: string | null;
  rn_range: string | null;
  fundstelle: string | null;
  fortgeltung_checked: boolean;
  fortgeltung_note: string;
  confidence: Open<"high" | "medium" | "low"> | null;
}

/** Body of `GET /decisions/search`. */
export interface DecisionSearchResponse extends ApiEnvelope {
  results: DecisionSearchResult[];
  payload_truncated: boolean;
  total_available: Count;
  total_available_basis: Open<"matching_indexed_passages_lexical_arm">;
  candidate_pool: number;
  pool_exhaustive: boolean;
  truncated: boolean;
  page: number;
  limit: number;
  mode: Open<SearchMode>;
  frequently_cited_by_results: unknown[];
  query_expansion: QueryExpansion;
  top_confidence?: Open<"high" | "medium" | "low"> | null;
}

/** Arguments of `GET /decisions/{id}`. */
export interface DecisionGetOptions {
  /** Minimum 500. Default 40000. */
  max_chars?: number | undefined;
  /** First Randnummer to return. */
  rn_from?: number | undefined;
  /** Last Randnummer to return, inclusive. */
  rn_to?: number | undefined;
  /** `Tenor`, `Leitsatz`, `Tatbestand` or `Gründe`, in any case. */
  section?: Open<"Tenor" | "Leitsatz" | "Tatbestand" | "Gründe"> | undefined;
  /** Disambiguates an Aktenzeichen. Ignored for a UUID. */
  court?: string | undefined;
  /** `YYYY-MM-DD`. Disambiguates an Aktenzeichen. Ignored for a UUID. */
  date?: string | undefined;
}

/** Body of `GET /decisions/{id}`. */
export interface DecisionResponse extends ApiEnvelope {
  id: string;
  aktenzeichen: string | null;
  court: string | null;
  date: string | null;
  jurisdiction: string | null;
  metadata: {
    document_type: Open<DocumentType> | null;
    ecli: string | null;
    file_numbers: string[];
  };
  fortgeltung_checked: boolean;
  fortgeltung_note: string;
  full_text: string;
  text_length: number;
  truncated: boolean;
  rn_source: Open<"printed"> | null;
  rn_source_note: string | null;
  available_sections: string[];
  available_range: {
    rn_from: number | null;
    rn_to: number | null;
    rn_source: Open<"printed"> | null;
  } | null;
  available_range_scope: Open<"decision"> | null;
  has_rn_anchors: boolean;
  /** Present when the call asked for a section or a Randnummer window. */
  returned_range?: {
    section_heading?: string | null;
    rn_from?: number | null;
    rn_to?: number | null;
  };
}

/** Arguments of `GET /decisions/{id}/citations`. */
export interface DecisionCitationsOptions {
  /** `both` is the default. */
  direction?: CitationDirection | undefined;
  /** 1 (default) or 2. */
  depth?: 1 | 2 | undefined;
  /** Disambiguates an Aktenzeichen. */
  court?: string | undefined;
  /** `YYYY-MM-DD`. Disambiguates an Aktenzeichen. */
  date?: string | undefined;
  /** 1 to 20. Depth 1 only. */
  page?: number | undefined;
}

/** The decision a citation edge resolves to inside the corpus. */
export interface CitationCorpusRef {
  artifact_id: string;
  court: string | null;
  date: string | null;
  az: string | null;
  document_type: string | null;
  ecli: string | null;
  corpus_url: string;
}

/** One edge of the citation graph. */
export interface CitationEdge {
  reference_canonical: string;
  reference_role: Open<"leitentscheidung"> | null;
  resolution_status: Open<"resolved" | "unresolved">;
  in_corpus: boolean;
  corpus: CitationCorpusRef | null;
  from_artifact_id: string;
  /** Present at depth 2: how many steps from the source decision. */
  hop?: number;
}

/** Page state of `GET /decisions/{id}/citations`. */
export interface CitationPagination {
  page: number;
  page_size: number;
  max_page: number;
  reachable_distinct_max: number;
  references_pages: number;
  referenced_by_pages: number;
  has_more_references: boolean;
  has_more_referenced_by: boolean;
  applies_at_depth: 1 | 2;
}

/** Body of `GET /decisions/{id}/citations`. */
export interface DecisionCitationsResponse extends ApiEnvelope {
  source: { id: string; aktenzeichen: string | null; court: string | null; date: string | null };
  references: CitationEdge[];
  referenced_by: CitationEdge[];
  served_direction: Open<CitationDirection>;
  served_references_total: number;
  served_referenced_by_total: number;
  references_total: number;
  references_resolved_total: number;
  referenced_by_total: number;
  references_unresolved_total: number;
  references_withheld_reasons: unknown[];
  totals_scope: Open<"source_decision_hop_1">;
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
