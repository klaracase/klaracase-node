import * as z from "zod/mini";
import { BRANCHES, DOCUMENT_TYPES, FACET_FIELDS, SEARCH_MODES } from "../enums.js";
import {
  countSchema,
  envelopeShape,
  nullableNumber,
  nullableString,
  open,
  stringList,
  unknownList,
} from "./common.js";

const L = z.looseObject;
const nullable = z.nullable;
const optional = z.optional;

const branchOpen = open(BRANCHES);
const documentTypeOpen = open(DOCUMENT_TYPES);
const modeOpen = open(SEARCH_MODES);
const confidence = open(["high", "medium", "low"] as const);

/** The verdicts of one citation. */
export const citationVerdictSchema = open([
  "verified_corpus",
  "verified_external",
  "not_found",
  "out_of_coverage",
  "ambiguous",
  "unverifiable",
  "discrepancy",
] as const);

const snippetSchema = L({ text: z.string(), rn: optional(z.number()) });
const queryExpansionSchema = L({
  status: open(["abstained", "applied"] as const),
  applied: z.boolean(),
  reason: nullable(open(["no_lay_term"] as const)),
  note: nullableString,
});

/** Body of `POST /citation-check-documents` and `GET /citation-check-documents/{document}`. */
export const documentReceiptSchema = L({
  ...envelopeShape,
  id: z.string(),
  filename: z.string(),
  format: open(["pdf", "docx", "md", "txt"] as const),
  status: open(["uploaded", "extracting", "ocr_pending", "ready", "failed"] as const),
  char_count: nullableNumber,
  page_count: nullableNumber,
  pages_without_text_layer: nullableNumber,
  check_max_chars: z.number(),
  quoted_credits: nullableNumber,
  error_code: nullable(
    open([
      "document_too_long",
      "unsupported_format_pending",
      "corrupted_document",
      "zip_bomb_rejected",
      "encrypted_pdf",
      "scanned_pdf",
      "pdf_text_garbled",
      "extraction_failed",
    ] as const),
  ),
  expires_at: z.string(),
  created_at: z.string(),
});

/** Body of `POST /citation-checks` and `GET /citation-checks/{run}`. */
export const citationCheckRunSchema = L({
  ...envelopeShape,
  id: z.string(),
  status: open([
    "pending",
    "gating",
    "extracting",
    "resolving",
    "checking_external",
    "complete",
    "rejected",
    "failed",
  ] as const),
  source: open(["api_v1"] as const),
  progress: L({
    citations_total: z.number(),
    citations_checked: z.number(),
    unique_citations_total: z.number(),
  }),
  verdict_counts: z.record(z.string(), z.number()),
  partial: z.boolean(),
  unverified_count: z.number(),
  reason_counts: z.array(L({ category: open(["statute_unknown"] as const), count: z.number() })),
  unique_citations: z.array(
    L({
      key_basis: open(["matched_decision", "canonical"] as const),
      target_artifact_id: nullableString,
      canonical: nullableString,
      spellings: stringList,
      occurrences: z.number(),
      verdict: citationVerdictSchema,
      reference_type: open(["case", "statute"] as const),
    }),
  ),
  extraction: L({
    detected: z.number(),
    dropped: z.number(),
    dropped_unreadable: z.number(),
    dropped_truncation: z.number(),
    dropped_trailing_noun: z.number(),
    dropped_stacked_subdivision: z.number(),
    dropped_refused_collision: z.number(),
    dropped_by_token: unknownList,
    dropped_unreadable_texts: unknownList,
    refused_contract_collision: unknownList,
    not_verifiable: z.number(),
    not_verifiable_by_type: unknownList,
    possible_citations_unparsed: z.number(),
    possible_citations_unparsed_texts: stringList,
  }),
  notes: unknownList,
  findings_unavailable_reason: nullableString,
  findings_purged_at: nullableString,
  findings: z.array(
    L({
      id: z.string(),
      raw_text: z.string(),
      canonical: nullableString,
      type: open(["case", "statute"] as const),
      role: nullableString,
      verdict: citationVerdictSchema,
      external_status: open(["skipped"] as const),
      start_offset: z.number(),
      end_offset: z.number(),
      occurrence_index: z.number(),
      confidence: nullableNumber,
      matched_decision: nullable(
        L({
          artifact_id: z.string(),
          ecli: nullableString,
          court: nullableString,
          date: nullableString,
        }),
      ),
      subdivision_check: open(["not_checked"] as const),
      subdivision_advisory: nullableString,
      check_scope: L({
        subdivision: open(["not_applicable"] as const),
        article_text_available: nullable(z.boolean()),
        article_text_read: z.boolean(),
        court: open(["checked"] as const),
      }),
      ambiguity_advisory: nullableString,
      coverage: nullable(z.record(z.string(), z.unknown())),
      coverage_boundary: nullable(z.record(z.string(), z.unknown())),
      coverage_advisory: nullableString,
      evidence: L({
        reason: open(["exact_match"] as const),
        match_strength: open(["exact"] as const),
      }),
      disputed_at: nullableString,
    }),
  ),
  submitted_at: nullableString,
  completed_at: nullableString,
  created_at: z.string(),
  payload_truncated: z.boolean(),
});

const courtRow = {
  court: z.string(),
  count: countSchema,
  earliest: z.string(),
  latest: z.string(),
} as const;

/** Body of `GET /corpus/coverage`. */
export const corpusCoverageResponseSchema = L({
  ...envelopeShape,
  total_decisions: countSchema,
  branches: z.array(
    L({
      branch: branchOpen,
      count: countSchema,
      earliest: z.string(),
      latest: z.string(),
      court_founding_year: nullableNumber,
      court_founding_basis: open(["branch_wide_weakest_court_floor"] as const),
      has_dates_below_floor: z.boolean(),
      instance_mix: L({
        federal: countSchema,
        appellate: countSchema,
        first_instance_and_regional: countSchema,
        other: countSchema,
        note: z.string(),
      }),
      top_courts: z.array(L(courtRow)),
    }),
  ),
  courts: z.array(
    L({
      ...courtRow,
      branch: branchOpen,
      court_founding_year: nullableNumber,
      court_founding_basis: open(["court_floor"] as const),
      has_dates_below_floor: z.boolean(),
    }),
  ),
  courts_returned: z.number(),
  courts_total: z.number(),
  corpus_floors: z.string(),
  coverage_ranges: L({
    note: z.string(),
    scope: open(["all"] as const),
    verified_at: z.string(),
    ranges: z.array(
      L({
        bucket: z.string(),
        court: z.string(),
        label: z.string(),
        from: z.string(),
        until: nullableString,
        sources: stringList,
        exhaustive: z.boolean(),
        ocr: z.boolean(),
        note: z.string(),
        holdings_earliest: nullableString,
      }),
    ),
  }),
  as_of: z.string(),
  filter_coverage_caveats: z.string(),
  law_coverage: L({ note: z.string(), eu: stringList, international: stringList }),
});

/** Body of `GET /corpus/facets/{field}`. */
export const corpusFacetsResponseSchema = L({
  ...envelopeShape,
  field: open(FACET_FIELDS),
  applies_to: open(["DECISION", "LAW"] as const),
  values: z.record(z.string(), countSchema),
  total_values: z.number(),
  truncated: z.boolean(),
  value_limit: z.number(),
  count_basis: open(["indexed_passages"] as const),
  as_of: z.string(),
  norm: optional(z.string()),
});

const citationEdgeSchema = L({
  reference_canonical: z.string(),
  reference_role: nullable(open(["leitentscheidung"] as const)),
  resolution_status: open(["resolved", "unresolved"] as const),
  in_corpus: z.boolean(),
  corpus: nullable(
    L({
      artifact_id: z.string(),
      court: nullableString,
      date: nullableString,
      az: nullableString,
      document_type: nullableString,
      ecli: nullableString,
      corpus_url: z.string(),
    }),
  ),
  from_artifact_id: z.string(),
  hop: optional(z.number()),
});

/** Body of `POST /datapackages`. */
export const datapackageResponseSchema = L({
  ...envelopeShape,
  decisions: z.array(
    L({
      id: z.string(),
      aktenzeichen: nullableString,
      court: nullableString,
      date: nullableString,
      document_type: nullable(documentTypeOpen),
      ecli: nullableString,
      jurisdiction: nullableString,
      excerpt: nullableString,
      excerpt_span: nullable(open(["document_start"] as const)),
      text_length: z.number(),
      truncated: z.boolean(),
      fortgeltung_checked: z.boolean(),
      fortgeltung_note: z.string(),
    }),
  ),
  citation_edges: z.array(citationEdgeSchema),
  edge_accounting: z.array(
    L({
      from_artifact_id: z.string(),
      unit: open(["edge_rows"] as const),
      edges_total: z.number(),
      edges_included: z.number(),
      edges_resolved_included: z.number(),
      edges_unresolved_included: z.number(),
      edges_resolved_total: z.number(),
      edges_unresolved_total: z.number(),
      targets_resolved_included: z.number(),
      targets_resolved_total: z.number(),
    }),
  ),
  per_source_resolved_target_cap: z.number(),
  per_source_unresolved_edge_row_cap: z.number(),
  requested: z.number(),
  included: z.number(),
  deduped: z.number(),
  text_mode: open(["excerpt", "full_text"] as const),
  max_chars: z.number(),
  truncated: z.boolean(),
  payload_truncated: z.boolean(),
  assembled_at: z.string(),
});

/** Body of `GET /decisions/{id}/citations`. */
export const decisionCitationsResponseSchema = L({
  ...envelopeShape,
  source: L({
    id: z.string(),
    aktenzeichen: nullableString,
    court: nullableString,
    date: nullableString,
  }),
  references: z.array(citationEdgeSchema),
  referenced_by: z.array(citationEdgeSchema),
  served_direction: open(["outgoing", "incoming", "both"] as const),
  served_references_total: z.number(),
  served_referenced_by_total: z.number(),
  references_total: z.number(),
  references_resolved_total: z.number(),
  referenced_by_total: z.number(),
  references_unresolved_total: z.number(),
  references_withheld_reasons: unknownList,
  totals_scope: open(["source_decision_hop_1"] as const),
  per_direction_cap: z.number(),
  unresolved_cap: z.number(),
  node_cap: z.number(),
  truncated: z.boolean(),
  nodes_omitted: z.number(),
  payload_truncated: z.boolean(),
  pagination: L({
    page: z.number(),
    page_size: z.number(),
    max_page: z.number(),
    reachable_distinct_max: z.number(),
    references_pages: z.number(),
    referenced_by_pages: z.number(),
    has_more_references: z.boolean(),
    has_more_referenced_by: z.boolean(),
    applies_at_depth: z.union([z.literal(1), z.literal(2)]),
  }),
  fortgeltung_checked: z.boolean(),
  fortgeltung_note: z.string(),
});

/** Body of `GET /decisions/search`. */
export const decisionSearchResponseSchema = L({
  ...envelopeShape,
  results: z.array(
    L({
      id: z.string(),
      aktenzeichen: nullableString,
      court: nullableString,
      date: nullableString,
      document_type: nullable(documentTypeOpen),
      title: nullableString,
      snippet: nullableString,
      snippets: z.array(snippetSchema),
      chunk_title: nullableString,
      rn_range: nullableString,
      fundstelle: nullableString,
      fortgeltung_checked: z.boolean(),
      fortgeltung_note: z.string(),
      confidence: nullable(confidence),
    }),
  ),
  payload_truncated: z.boolean(),
  total_available: countSchema,
  total_available_basis: open(["matching_indexed_passages_lexical_arm"] as const),
  candidate_pool: z.number(),
  pool_exhaustive: z.boolean(),
  truncated: z.boolean(),
  page: z.number(),
  limit: z.number(),
  mode: modeOpen,
  frequently_cited_by_results: unknownList,
  query_expansion: queryExpansionSchema,
  top_confidence: optional(nullable(confidence)),
});

/** Body of `GET /decisions/{id}`. */
export const decisionResponseSchema = L({
  ...envelopeShape,
  id: z.string(),
  aktenzeichen: nullableString,
  court: nullableString,
  date: nullableString,
  jurisdiction: nullableString,
  metadata: L({
    document_type: nullable(documentTypeOpen),
    ecli: nullableString,
    file_numbers: stringList,
  }),
  fortgeltung_checked: z.boolean(),
  fortgeltung_note: z.string(),
  full_text: z.string(),
  text_length: z.number(),
  truncated: z.boolean(),
  rn_source: nullable(open(["printed"] as const)),
  rn_source_note: nullableString,
  available_sections: stringList,
  available_range: nullable(
    L({
      rn_from: nullableNumber,
      rn_to: nullableNumber,
      rn_source: nullable(open(["printed"] as const)),
    }),
  ),
  available_range_scope: nullable(open(["decision"] as const)),
  has_rn_anchors: z.boolean(),
  returned_range: optional(
    L({
      section_heading: optional(nullableString),
      rn_from: optional(nullableNumber),
      rn_to: optional(nullableNumber),
    }),
  ),
});

/** Body of `GET /norms/{reference}`. */
export const normResponseSchema = L({
  ...envelopeShape,
  reference: z.string(),
  requested_reference: z.string(),
  law: L({
    id: z.string(),
    abbreviation: z.string(),
    source_abbreviation: nullableString,
    official_name: nullableString,
    law_level: nullable(open(["BUND", "EU"] as const)),
    jurisdiction: nullable(open(["DE", "EU"] as const)),
    source_url: nullableString,
    upstream_status: nullable(open(["confirmed"] as const)),
    upstream_last_seen_at: nullableString,
    upstream_missing_since: nullableString,
  }),
  norm: L({
    number: z.string(),
    title: nullableString,
    lifecycle: nullable(open(["current"] as const)),
    text: z.string(),
    absatz_identifiers: stringList,
    chars: z.number(),
  }),
  requested_qualifiers: z.array(
    L({ type: z.string(), value: z.string(), checked: z.boolean(), present: z.boolean() }),
  ),
  version: L({
    id: z.string(),
    last_amendment_date: nullableString,
    last_amendment_date_basis: nullable(open(["source_stand"] as const)),
    source_fetched_at: nullableString,
    source_last_seen_at: nullableString,
  }),
  neighbours: L({ previous: nullableString, next: nullableString }),
  links: L({
    decisions_citing: L({ tool: z.string(), arguments: L({ cited_norm: z.string() }) }),
    decisions_citing_url: z.string(),
    self_url: z.string(),
  }),
});

const crossTypeBase = {
  id: z.string(),
  title: nullableString,
  snippet: nullableString,
  snippets: z.array(snippetSchema),
  chunk_title: nullableString,
  rn_range: nullableString,
  fundstelle: nullableString,
  confidence: nullable(confidence),
} as const;

const sectionTotalSchema = L({
  total_available: countSchema,
  total_available_basis: z.string(),
  candidate_pool: z.number(),
  pool_exhaustive: z.boolean(),
  truncated: z.boolean(),
});

/** Body of `GET /search`. */
export const crossTypeSearchResponseSchema = L({
  ...envelopeShape,
  sections: L({
    laws: z.array(
      L({
        ...crossTypeBase,
        artifact_type: z.literal("LAW"),
        aktenzeichen: z.null(),
        court: z.null(),
        date: z.null(),
        document_type: z.null(),
        breadcrumb: nullableString,
        abbreviation: z.string(),
        law_type: z.string(),
        jurisdiction: nullableString,
      }),
    ),
    decisions: z.array(
      L({
        ...crossTypeBase,
        artifact_type: z.literal("DECISION"),
        aktenzeichen: nullableString,
        court: nullableString,
        date: nullableString,
        document_type: nullable(documentTypeOpen),
        fortgeltung_checked: z.boolean(),
        fortgeltung_note: z.string(),
      }),
    ),
  }),
  section_totals: L({ laws: sectionTotalSchema, decisions: sectionTotalSchema }),
  limit: z.number(),
  total_available: countSchema,
  total_available_basis: z.string(),
  pool_exhaustive: z.boolean(),
  truncated: z.boolean(),
  mode: modeOpen,
  query_expansion: queryExpansionSchema,
  frequently_cited_by_results: unknownList,
  norms_cited_by_decision_results: unknownList,
  top_confidence: optional(nullable(confidence)),
});
