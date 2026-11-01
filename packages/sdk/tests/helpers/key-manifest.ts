import type {
  CitationCheckRun,
  CorpusCoverageResponse,
  CorpusFacetsResponse,
  CrossTypeSearchResponse,
  DatapackageResponse,
  DecisionCitationsResponse,
  DecisionResponse,
  DecisionSearchResponse,
  DocumentReceipt,
  NormResponse,
} from "../../src/index.js";

/**
 * A key manifest lists every key a response type declares, nested the way the type nests.
 *
 * The type {@link Spec} is computed from the response type. A key that is missing from a manifest,
 * or one that the type does not declare, is a compile error. So the manifests cannot drift from
 * the types, and the run-time walk in `response-types.test.ts` compares the example bodies with
 * the manifests.
 *
 * - `"leaf"`: a scalar or an opaque value. The walk does not look inside.
 * - `["array", spec]`: every element has the spec.
 * - `["record", spec]`: every value of a free-form map has the spec.
 * - an object: one entry per declared key.
 */
export type Spec<V> = unknown extends V
  ? "leaf"
  : NonNullable<V> extends string | number | boolean
    ? "leaf"
    : NonNullable<V> extends readonly (infer U)[]
      ? readonly ["array", Spec<U>]
      : NonNullable<V> extends object
        ? string extends keyof NonNullable<V>
          ? readonly ["record", Spec<NonNullable<V>[string]>]
          : { readonly [K in keyof NonNullable<V>]-?: Spec<NonNullable<V>[K]> }
        : "leaf";

/** Typed identity: check a manifest against its response type. */
function manifest<T>(spec: Spec<T>): Spec<T> {
  return spec;
}

const L = "leaf" as const;
const count = { value: L, is_floor: L } as const;
const envelope = {
  api_version: L,
  changelog_url: L,
  credits: {
    metered: L,
    cost: L,
    credits_remaining: L,
    api_budget: { cents: L, rate_cents_per_credit: L, credits_at_rate: L },
  },
  ignored_parameters: L,
} as const;
const snippet = { text: L, rn: L } as const;
const queryExpansion = { status: L, applied: L, reason: L, note: L } as const;
const corpusRef = {
  artifact_id: L,
  court: L,
  date: L,
  az: L,
  document_type: L,
  ecli: L,
  corpus_url: L,
} as const;
const citationEdge = {
  reference_canonical: L,
  reference_role: L,
  resolution_status: L,
  in_corpus: L,
  corpus: corpusRef,
  from_artifact_id: L,
  hop: L,
} as const;
const sectionTotal = {
  total_available: count,
  total_available_basis: L,
  candidate_pool: L,
  pool_exhaustive: L,
  truncated: L,
} as const;
const courtRow = { court: L, count, earliest: L, latest: L } as const;

export const documentReceiptKeys = manifest<DocumentReceipt>({
  ...envelope,
  id: L,
  filename: L,
  format: L,
  status: L,
  char_count: L,
  page_count: L,
  pages_without_text_layer: L,
  check_max_chars: L,
  quoted_credits: L,
  error_code: L,
  expires_at: L,
  created_at: L,
});

export const citationCheckRunKeys = manifest<CitationCheckRun>({
  ...envelope,
  id: L,
  status: L,
  source: L,
  progress: { citations_total: L, citations_checked: L, unique_citations_total: L },
  verdict_counts: ["record", L],
  partial: L,
  unverified_count: L,
  reason_counts: ["array", { category: L, count: L }],
  unique_citations: [
    "array",
    {
      key_basis: L,
      target_artifact_id: L,
      canonical: L,
      spellings: ["array", L],
      occurrences: L,
      verdict: L,
      reference_type: L,
    },
  ],
  extraction: {
    detected: L,
    dropped: L,
    dropped_unreadable: L,
    dropped_truncation: L,
    dropped_trailing_noun: L,
    dropped_stacked_subdivision: L,
    dropped_refused_collision: L,
    dropped_by_token: ["array", L],
    dropped_unreadable_texts: ["array", L],
    refused_contract_collision: ["array", L],
    not_verifiable: L,
    not_verifiable_by_type: ["array", L],
    possible_citations_unparsed: L,
    possible_citations_unparsed_texts: ["array", L],
  },
  notes: ["array", L],
  findings_unavailable_reason: L,
  findings_purged_at: L,
  findings: [
    "array",
    {
      id: L,
      raw_text: L,
      canonical: L,
      type: L,
      role: L,
      verdict: L,
      external_status: L,
      start_offset: L,
      end_offset: L,
      occurrence_index: L,
      confidence: L,
      matched_decision: { artifact_id: L, ecli: L, court: L, date: L },
      subdivision_check: L,
      subdivision_advisory: L,
      check_scope: {
        subdivision: L,
        article_text_available: L,
        article_text_read: L,
        court: L,
      },
      ambiguity_advisory: L,
      coverage: ["record", L],
      coverage_boundary: ["record", L],
      coverage_advisory: L,
      evidence: { reason: L, match_strength: L },
      disputed_at: L,
    },
  ],
  submitted_at: L,
  completed_at: L,
  created_at: L,
  payload_truncated: L,
});

export const corpusCoverageKeys = manifest<CorpusCoverageResponse>({
  ...envelope,
  total_decisions: count,
  branches: [
    "array",
    {
      branch: L,
      count,
      earliest: L,
      latest: L,
      court_founding_year: L,
      court_founding_basis: L,
      has_dates_below_floor: L,
      instance_mix: {
        federal: count,
        appellate: count,
        first_instance_and_regional: count,
        other: count,
        note: L,
      },
      top_courts: ["array", courtRow],
    },
  ],
  courts: [
    "array",
    {
      ...courtRow,
      branch: L,
      court_founding_year: L,
      court_founding_basis: L,
      has_dates_below_floor: L,
    },
  ],
  courts_returned: L,
  courts_total: L,
  corpus_floors: L,
  coverage_ranges: {
    note: L,
    scope: L,
    verified_at: L,
    ranges: [
      "array",
      {
        bucket: L,
        court: L,
        label: L,
        from: L,
        until: L,
        sources: ["array", L],
        exhaustive: L,
        ocr: L,
        note: L,
        holdings_earliest: L,
      },
    ],
  },
  as_of: L,
  filter_coverage_caveats: L,
  law_coverage: { note: L, eu: ["array", L], international: ["array", L] },
});

export const corpusFacetsKeys = manifest<CorpusFacetsResponse>({
  ...envelope,
  field: L,
  applies_to: L,
  values: ["record", count],
  total_values: L,
  truncated: L,
  value_limit: L,
  count_basis: L,
  as_of: L,
  norm: L,
});

export const datapackageKeys = manifest<DatapackageResponse>({
  ...envelope,
  decisions: [
    "array",
    {
      id: L,
      aktenzeichen: L,
      court: L,
      date: L,
      document_type: L,
      ecli: L,
      jurisdiction: L,
      excerpt: L,
      excerpt_span: L,
      text_length: L,
      truncated: L,
      fortgeltung_checked: L,
      fortgeltung_note: L,
    },
  ],
  citation_edges: ["array", citationEdge],
  edge_accounting: [
    "array",
    {
      from_artifact_id: L,
      unit: L,
      edges_total: L,
      edges_included: L,
      edges_resolved_included: L,
      edges_unresolved_included: L,
      edges_resolved_total: L,
      edges_unresolved_total: L,
      targets_resolved_included: L,
      targets_resolved_total: L,
    },
  ],
  per_source_resolved_target_cap: L,
  per_source_unresolved_edge_row_cap: L,
  requested: L,
  included: L,
  deduped: L,
  text_mode: L,
  max_chars: L,
  truncated: L,
  payload_truncated: L,
  assembled_at: L,
});

export const decisionCitationsKeys = manifest<DecisionCitationsResponse>({
  ...envelope,
  source: { id: L, aktenzeichen: L, court: L, date: L },
  references: ["array", citationEdge],
  referenced_by: ["array", citationEdge],
  served_direction: L,
  served_references_total: L,
  served_referenced_by_total: L,
  references_total: L,
  references_resolved_total: L,
  referenced_by_total: L,
  references_unresolved_total: L,
  references_withheld_reasons: ["array", L],
  totals_scope: L,
  per_direction_cap: L,
  unresolved_cap: L,
  node_cap: L,
  truncated: L,
  nodes_omitted: L,
  payload_truncated: L,
  pagination: {
    page: L,
    page_size: L,
    max_page: L,
    reachable_distinct_max: L,
    references_pages: L,
    referenced_by_pages: L,
    has_more_references: L,
    has_more_referenced_by: L,
    applies_at_depth: L,
  },
  fortgeltung_checked: L,
  fortgeltung_note: L,
});

export const decisionSearchKeys = manifest<DecisionSearchResponse>({
  ...envelope,
  results: [
    "array",
    {
      id: L,
      aktenzeichen: L,
      court: L,
      date: L,
      document_type: L,
      title: L,
      snippet: L,
      snippets: ["array", snippet],
      chunk_title: L,
      rn_range: L,
      fundstelle: L,
      fortgeltung_checked: L,
      fortgeltung_note: L,
      confidence: L,
    },
  ],
  payload_truncated: L,
  total_available: count,
  total_available_basis: L,
  candidate_pool: L,
  pool_exhaustive: L,
  truncated: L,
  page: L,
  limit: L,
  mode: L,
  frequently_cited_by_results: ["array", L],
  query_expansion: queryExpansion,
  top_confidence: L,
});

export const decisionKeys = manifest<DecisionResponse>({
  ...envelope,
  id: L,
  aktenzeichen: L,
  court: L,
  date: L,
  jurisdiction: L,
  metadata: { document_type: L, ecli: L, file_numbers: ["array", L] },
  fortgeltung_checked: L,
  fortgeltung_note: L,
  full_text: L,
  text_length: L,
  truncated: L,
  rn_source: L,
  rn_source_note: L,
  available_sections: ["array", L],
  available_range: { rn_from: L, rn_to: L, rn_source: L },
  available_range_scope: L,
  has_rn_anchors: L,
  returned_range: { section_heading: L, rn_from: L, rn_to: L },
});

export const normKeys = manifest<NormResponse>({
  ...envelope,
  reference: L,
  requested_reference: L,
  law: {
    id: L,
    abbreviation: L,
    source_abbreviation: L,
    official_name: L,
    law_level: L,
    jurisdiction: L,
    source_url: L,
    upstream_status: L,
    upstream_last_seen_at: L,
    upstream_missing_since: L,
  },
  norm: {
    number: L,
    title: L,
    lifecycle: L,
    text: L,
    absatz_identifiers: ["array", L],
    chars: L,
  },
  requested_qualifiers: ["array", { type: L, value: L, checked: L, present: L }],
  version: {
    id: L,
    last_amendment_date: L,
    last_amendment_date_basis: L,
    source_fetched_at: L,
    source_last_seen_at: L,
  },
  neighbours: { previous: L, next: L },
  links: {
    decisions_citing: { tool: L, arguments: { cited_norm: L } },
    decisions_citing_url: L,
    self_url: L,
  },
});

export const crossTypeSearchKeys = manifest<CrossTypeSearchResponse>({
  ...envelope,
  sections: {
    laws: [
      "array",
      {
        id: L,
        title: L,
        snippet: L,
        snippets: ["array", snippet],
        chunk_title: L,
        rn_range: L,
        fundstelle: L,
        confidence: L,
        artifact_type: L,
        aktenzeichen: L,
        court: L,
        date: L,
        document_type: L,
        breadcrumb: L,
        abbreviation: L,
        law_type: L,
        jurisdiction: L,
      },
    ],
    decisions: [
      "array",
      {
        id: L,
        title: L,
        snippet: L,
        snippets: ["array", snippet],
        chunk_title: L,
        rn_range: L,
        fundstelle: L,
        confidence: L,
        artifact_type: L,
        aktenzeichen: L,
        court: L,
        date: L,
        document_type: L,
        fortgeltung_checked: L,
        fortgeltung_note: L,
      },
    ],
  },
  section_totals: { laws: sectionTotal, decisions: sectionTotal },
  limit: L,
  total_available: count,
  total_available_basis: L,
  pool_exhaustive: L,
  truncated: L,
  mode: L,
  query_expansion: queryExpansion,
  frequently_cited_by_results: ["array", L],
  norms_cited_by_decision_results: ["array", L],
  top_confidence: L,
});

/**
 * Paths of keys in `value` that `spec` does not declare. An empty list means every key of the body
 * is declared. Opaque values (`"leaf"`) are not entered.
 */
export function undeclaredKeys(value: unknown, spec: unknown, path = "$"): string[] {
  if (spec === "leaf" || value === null || typeof value !== "object") return [];
  if (Array.isArray(spec)) {
    const [kind, inner] = spec as unknown as readonly [string, unknown];
    if (kind === "array") {
      if (!Array.isArray(value)) return [`${path} is not an array`];
      return value.flatMap((item, index) => undeclaredKeys(item, inner, `${path}[${index}]`));
    }
    return Object.entries(value).flatMap(([key, item]) =>
      undeclaredKeys(item, inner, `${path}.${key}`),
    );
  }
  const declared = spec as Record<string, unknown>;
  return Object.entries(value).flatMap(([key, item]) => {
    if (!(key in declared)) return [`${path}.${key}`];
    return undeclaredKeys(item, declared[key], `${path}.${key}`);
  });
}
