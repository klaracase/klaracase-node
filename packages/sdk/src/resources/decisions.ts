import { encodePathSegment } from "../encoding.js";
import { ValidationError } from "../errors.js";
import type { Transport } from "../http.js";
import {
  CITATIONS_MAX_PAGES,
  SEARCH_MAX_PAGES,
  lastPageToFetch,
  type PageOptions,
} from "../pagination.js";
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
  /** @internal */
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

  /**
   * Search decisions page by page, as an async iterator of pages. Each page is a separate call and
   * costs 1 credit, so `maxPages` is required. It stops when a page has no results or after
   * `maxPages` pages, and never goes past page 10. A `page` in `filters` is the first page.
   *
   * ```ts
   * for await (const page of client.decisions.searchAll("Untreue", { court: "BGH" }, { maxPages: 3 })) {
   *   for (const hit of page.results) console.log(hit.aktenzeichen);
   * }
   * ```
   *
   * @throws {ValidationError} `maxPages` is missing or below 1.
   */
  searchAll(
    query: string,
    filters: DecisionSearchFilters = {},
    options: PageOptions,
  ): AsyncGenerator<WithMeta<DecisionSearchResponse>, void, undefined> {
    const { maxPages, ...request } = options ?? {};
    const first = filters.page ?? 1;
    const last = lastPageToFetch(maxPages, first, SEARCH_MAX_PAGES);
    return this.#searchPages(query, filters, first, last, request);
  }

  async *#searchPages(
    query: string,
    filters: DecisionSearchFilters,
    first: number,
    last: number,
    request: RequestOptions,
  ): AsyncGenerator<WithMeta<DecisionSearchResponse>, void, undefined> {
    for (let page = first; page <= last; page++) {
      const answer = await this.search(query, { ...filters, page }, request);
      if (answer.results.length === 0) return;
      yield answer;
    }
  }

  /**
   * Read the citation graph around one decision page by page, as an async iterator of pages. Each
   * page is a separate call and costs 2 credits, so `maxPages` is required. It stops when no
   * direction has another page, when a page is empty, or after `maxPages` pages, and never goes
   * past page 20. A `page` in `options` is the first page. Paging works at depth 1 only.
   *
   * ```ts
   * for await (const page of client.decisions.citationsAll("VIII ZR 271/17", {}, { maxPages: 2 })) {
   *   console.log(page.references.length, page.referenced_by.length);
   * }
   * ```
   *
   * @throws {ValidationError} `maxPages` is missing or below 1, or `depth` is 2.
   */
  citationsAll(
    id: string,
    options: DecisionCitationsOptions = {},
    paging: PageOptions,
  ): AsyncGenerator<WithMeta<DecisionCitationsResponse>, void, undefined> {
    if (options.depth === 2) {
      throw new ValidationError({
        title: "Invalid arguments",
        detail: "Citation pages exist at depth 1 only. Leave out `depth`, or use `citations`.",
        code: "client_validation",
      });
    }
    const { maxPages, ...request } = paging ?? {};
    const first = options.page ?? 1;
    const last = lastPageToFetch(maxPages, first, CITATIONS_MAX_PAGES);
    return this.#citationPages(id, options, first, last, request);
  }

  async *#citationPages(
    id: string,
    options: DecisionCitationsOptions,
    first: number,
    last: number,
    request: RequestOptions,
  ): AsyncGenerator<WithMeta<DecisionCitationsResponse>, void, undefined> {
    for (let page = first; page <= last; page++) {
      const answer = await this.citations(id, { ...options, page }, request);
      if (answer.references.length === 0 && answer.referenced_by.length === 0) return;
      yield answer;
      const more =
        answer.pagination.has_more_references || answer.pagination.has_more_referenced_by;
      if (!more) return;
    }
  }
}
