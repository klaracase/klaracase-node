import { encodePathSegment } from "../encoding.js";
import type { Transport } from "../http.js";
import type { ApiEnvelope, Branch, Count, Open, RequestOptions, WithMeta } from "../types.js";

/** Arguments of `GET /corpus/coverage`. */
export interface CorpusCoverageOptions {
  branch?: Branch;
  /** Cap on the per-court rows, 1 to 100. Default 20. */
  top?: number;
}

/** Body of `GET /corpus/coverage`. */
export interface CorpusCoverageResponse extends ApiEnvelope {
  total_decisions: Count;
  branches: Array<{ branch: string; count: number; [key: string]: unknown }>;
  courts: Array<{ court: string; branch: string; count: number; [key: string]: unknown }>;
  courts_returned: number;
  courts_total: number;
  corpus_floors: string;
  coverage_ranges: Record<string, unknown>;
  as_of: string;
  filter_coverage_caveats: string;
  law_coverage: Record<string, unknown>;
}

/** The facet fields the API serves. */
export type FacetField = Open<
  "court_name" | "court_branch" | "document_type" | "jurisdiction" | "law_type" | "cited_norms"
>;

/** Arguments of `GET /corpus/facets/{field}`. */
export interface CorpusFacetsOptions {
  type?: Open<"decision" | "law">;
  /** Required for the field `cited_norms`: the norm whose family to list. */
  norm?: string;
  /** Case-insensitive prefix filter on the facet value. */
  prefix?: string;
}

/** Body of `GET /corpus/facets/{field}`. */
export interface CorpusFacetsResponse extends ApiEnvelope {
  field: string;
  applies_to: string;
  values: Record<string, Count>;
  total_values: number;
  truncated: boolean;
  value_limit: number;
  count_basis: string;
  as_of: string;
}

export class Corpus {
  constructor(private readonly transport: Transport) {}

  /** Report what the corpus covers. Free. */
  coverage(
    options: CorpusCoverageOptions = {},
    request?: RequestOptions,
  ): Promise<WithMeta<CorpusCoverageResponse>> {
    return this.transport.request(
      { method: "GET", path: "/corpus/coverage", query: options },
      request,
    );
  }

  /** Count the values of one facet field. Free. */
  facets(
    field: FacetField,
    options: CorpusFacetsOptions = {},
    request?: RequestOptions,
  ): Promise<WithMeta<CorpusFacetsResponse>> {
    return this.transport.request(
      { method: "GET", path: `/corpus/facets/${encodePathSegment(field)}`, query: options },
      request,
    );
  }
}
