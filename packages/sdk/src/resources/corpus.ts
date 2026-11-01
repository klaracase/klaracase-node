import { encodePathSegment } from "../encoding.js";
import type { Transport } from "../http.js";
import type { ApiEnvelope, Branch, Count, Open, RequestOptions, WithMeta } from "../types.js";

/** Arguments of `GET /corpus/coverage`. */
export interface CorpusCoverageOptions {
  branch?: Branch | undefined;
  /** Cap on the per-court rows, 1 to 100. Default 20. */
  top?: number | undefined;
}

/** Share of a branch by instance level. */
export interface InstanceMix {
  federal: Count;
  appellate: Count;
  first_instance_and_regional: Count;
  other: Count;
  note: string;
}

/** One court with its count and date span. */
export interface CourtRow {
  court: string;
  count: Count;
  earliest: string;
  latest: string;
}

/** A court row of the coverage report. */
export interface CoverageCourt extends CourtRow {
  branch: Open<Branch>;
  court_founding_year: number | null;
  court_founding_basis: Open<"court_floor">;
  has_dates_below_floor: boolean;
}

/** A branch row of the coverage report. */
export interface CoverageBranch {
  branch: Open<Branch>;
  count: Count;
  earliest: string;
  latest: string;
  court_founding_year: number | null;
  court_founding_basis: Open<"branch_wide_weakest_court_floor">;
  has_dates_below_floor: boolean;
  instance_mix: InstanceMix;
  top_courts: CourtRow[];
}

/** A date range for which the corpus is known to be complete or not. */
export interface CoverageRange {
  bucket: string;
  court: string;
  label: string;
  from: string;
  until: string | null;
  sources: string[];
  exhaustive: boolean;
  ocr: boolean;
  note: string;
  holdings_earliest: string | null;
}

/** Body of `GET /corpus/coverage`. */
export interface CorpusCoverageResponse extends ApiEnvelope {
  total_decisions: Count;
  branches: CoverageBranch[];
  courts: CoverageCourt[];
  courts_returned: number;
  courts_total: number;
  corpus_floors: string;
  coverage_ranges: {
    note: string;
    scope: Open<"all">;
    verified_at: string;
    ranges: CoverageRange[];
  };
  as_of: string;
  filter_coverage_caveats: string;
  law_coverage: { note: string; eu: string[]; international: string[] };
}

/** The facet fields the API serves. */
export type FacetField = Open<
  "court_name" | "court_branch" | "document_type" | "jurisdiction" | "law_type" | "cited_norms"
>;

/** Arguments of `GET /corpus/facets/{field}`. */
export interface CorpusFacetsOptions {
  type?: "decision" | "law" | undefined;
  /** Required for the field `cited_norms`: the norm whose family to list. */
  norm?: string | undefined;
  /** Case-insensitive prefix filter on the facet value. */
  prefix?: string | undefined;
}

/** Body of `GET /corpus/facets/{field}`. */
export interface CorpusFacetsResponse extends ApiEnvelope {
  field: FacetField;
  applies_to: Open<"DECISION" | "LAW">;
  values: Record<string, Count>;
  total_values: number;
  truncated: boolean;
  value_limit: number;
  count_basis: Open<"indexed_passages">;
  as_of: string;
  /** The canonical norm, echoed back. Present for the field `cited_norms`. */
  norm?: string;
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
