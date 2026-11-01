import * as z from "zod/mini";
import {
  BRANCHES,
  CITATION_DIRECTIONS,
  CITED_STATUTES,
  DECISION_SECTIONS,
  DOCUMENT_TYPES,
  FACET_FIELDS,
  MAX_CITED_STATUTES,
  SEARCH_MODES,
} from "../enums.js";
import { described, isoDate, open } from "./common.js";

/** Court jurisdiction (Gerichtsbarkeit), not the legal subject area. */
export const branchSchema = described(
  z.enum(BRANCHES),
  "Court jurisdiction (Gerichtsbarkeit), not the legal subject area.",
);
/** Retrieval mode of a search. */
export const searchModeSchema = described(z.enum(SEARCH_MODES), "Retrieval mode. Default hybrid.");
/** Document type of a decision. */
export const documentTypeSchema = described(
  z.enum(DOCUMENT_TYPES),
  "Restrict to one document type.",
);
/** A statute the `cited_statutes` filter accepts. */
export const citedStatuteSchema = z.enum(CITED_STATUTES);
/** Direction of the citation graph. */
export const citationDirectionSchema = z.enum(CITATION_DIRECTIONS);
/** A named section of a decision text. */
export const decisionSectionSchema = open(DECISION_SECTIONS, "Return only this section.");
/** A facet field. */
export const facetFieldSchema = open(FACET_FIELDS, "The facet field to count.");

const query = described(
  z.string().check(z.minLength(2), z.maxLength(500)),
  "Search query in German legal-concept phrasing, 2 to 500 characters.",
);
const court = described(
  z.string().check(z.maxLength(100)),
  "Court name as list_facets gives it, for example BGH.",
);
const citedNorm = described(
  z.string().check(z.maxLength(120)),
  "Decisions that cite this norm, for example § 906 BGB.",
);
const citedStatutes = described(
  z.readonly(z.array(citedStatuteSchema).check(z.maxLength(MAX_CITED_STATUTES))),
  `Decisions that cite any section of these statutes. At most ${MAX_CITED_STATUTES}.`,
);
const bridge = described(
  z.boolean(),
  "Let the server add legal-register terms to the query. Default true.",
);

const searchFiltersShape = {
  court: z.optional(court),
  branch: z.optional(branchSchema),
  document_type: z.optional(documentTypeSchema),
  cited_norm: z.optional(citedNorm),
  cited_statutes: z.optional(citedStatutes),
  date_from: z.optional(isoDate("Earliest decision date, YYYY-MM-DD.")),
  date_to: z.optional(isoDate("Latest decision date, YYYY-MM-DD.")),
  mode: z.optional(searchModeSchema),
  limit: z.optional(
    described(z.int().check(z.gte(1), z.lte(20)), "Maximum results. Default and cap: 20."),
  ),
  page: z.optional(described(z.int().check(z.gte(1), z.lte(10)), "Page number, 1 to 10.")),
  bridge: z.optional(bridge),
} as const;

/** Filters of `GET /decisions/search`. */
export const decisionSearchFiltersSchema = z.looseObject(searchFiltersShape);

/** Input of `decisions.search`. */
export const searchDecisionsInputSchema = z.looseObject({
  query,
  ...searchFiltersShape,
});

/** Filters of `GET /search`. */
export const crossTypeSearchFiltersSchema = z.looseObject({
  jurisdiction: z.optional(
    open(["DE", "EU", "XI"] as const, "Narrows the laws section only (DE, EU or XI)."),
  ),
  court: z.optional(court),
  branch: z.optional(branchSchema),
  date_from: z.optional(isoDate("Earliest decision date, YYYY-MM-DD.")),
  date_to: z.optional(isoDate("Latest decision date, YYYY-MM-DD.")),
  mode: z.optional(searchModeSchema),
  document_type: z.optional(documentTypeSchema),
  cited_norm: z.optional(citedNorm),
  cited_statutes: z.optional(citedStatutes),
  limit: z.optional(
    described(z.int().check(z.gte(1), z.lte(10)), "Results per section. Default 5, at most 10."),
  ),
  bridge: z.optional(bridge),
});

/** Input of `search` (laws and decisions together). */
export const crossTypeSearchInputSchema = z.looseObject({
  query,
  ...crossTypeSearchFiltersSchema.shape,
});

const decisionId = described(
  z.string().check(z.minLength(1)),
  "A decision UUID, an Aktenzeichen or an ECLI.",
);
const decisionDisambiguation = {
  court: z.optional(described(z.string(), "Court short form, to disambiguate an Aktenzeichen.")),
  date: z.optional(isoDate("Decision date, to disambiguate an Aktenzeichen.")),
} as const;

const decisionGetShape = {
  max_chars: z.optional(
    described(z.int().check(z.gte(500)), "Maximum characters of text. Minimum 500, default 40000."),
  ),
  rn_from: z.optional(described(z.int().check(z.gte(1)), "First Randnummer to return.")),
  rn_to: z.optional(described(z.int().check(z.gte(1)), "Last Randnummer to return, inclusive.")),
  section: z.optional(decisionSectionSchema),
  ...decisionDisambiguation,
} as const;

/** Options of `GET /decisions/{id}`. */
export const decisionGetOptionsSchema = z.looseObject(decisionGetShape);

/** Input of `decisions.get`. */
export const getDecisionInputSchema = z.looseObject({ id: decisionId, ...decisionGetShape });

const citationOptionsShape = {
  direction: z.optional(
    described(citationDirectionSchema, "Which citations to follow. Default both."),
  ),
  depth: z.optional(
    described(
      z.union([z.literal(1), z.literal(2)]),
      "1 (default): direct neighbours. 2: neighbours of neighbours, a bounded sample.",
    ),
  ),
  ...decisionDisambiguation,
  page: z.optional(described(z.int().check(z.gte(1), z.lte(20)), "Page 1 to 20. Depth 1 only.")),
} as const;

/** Options of `GET /decisions/{id}/citations`. */
export const decisionCitationsOptionsSchema = z.looseObject(citationOptionsShape);

/** Input of `decisions.citations`. */
export const getCitationGraphInputSchema = z.looseObject({
  id: decisionId,
  ...citationOptionsShape,
});

const jurisdictionDeEu = open(
  ["DE", "EU"] as const,
  "Only used when the abbreviation is ambiguous.",
);

/** Options of `GET /norms/{reference}`. */
export const normGetOptionsSchema = z.looseObject({ jurisdiction: z.optional(jurisdictionDeEu) });

/** Input of `norms.get`. */
export const getNormInputSchema = z.looseObject({
  reference: described(
    z.string().check(z.minLength(1), z.maxLength(120)),
    "The norm as cited, for example § 535 BGB or Art. 6 DSGVO.",
  ),
  jurisdiction: z.optional(jurisdictionDeEu),
});

/** Body of `POST /datapackages`. */
export const datapackageCreateParamsSchema = z.looseObject({
  ids: described(
    z.readonly(z.array(z.string()).check(z.minLength(1), z.maxLength(10))),
    "1 to 10 decision ids (UUID or Aktenzeichen). The size budget drops ids from the end.",
  ),
  include_citations: z.optional(
    described(z.boolean(), "Include each decision's outgoing citation edges. Default true."),
  ),
  full_text: z.optional(
    described(z.boolean(), "Serve whole judgments instead of excerpts. Default false."),
  ),
  max_chars: z.optional(
    described(
      z.int().check(z.gte(500), z.lte(200000)),
      "Per-decision text cap when full_text is true. Default 60000.",
    ),
  ),
});

const referenceDate = z.optional(
  isoDate("Document date, YYYY-MM-DD. Applied to statute citations that name no date."),
);

/** Input of the citation check tool: a text and, optionally, the document date. */
export const checkCitationsInputSchema = z.looseObject({
  text: described(
    z.string().check(z.minLength(50), z.maxLength(20000)),
    "The German legal text to check, 50 to 20,000 characters.",
  ),
  reference_date: referenceDate,
});

/** Body of `POST /citation-checks`: exactly one of `text` and `document_id`. */
export const citationCheckCreateParamsSchema = z.union([
  z.looseObject({
    text: z.string(),
    document_id: z.optional(z.never()),
    reference_date: referenceDate,
  }),
  z.looseObject({
    document_id: z.string(),
    text: z.optional(z.never()),
    reference_date: referenceDate,
  }),
]);

/** Input of `citationChecks.get`. */
export const getCitationCheckInputSchema = z.looseObject({
  run_id: described(z.string(), "The id of a citation check run."),
});

/** Input of `citationCheckDocuments.get`. */
export const getDocumentInputSchema = z.looseObject({
  document_id: described(z.string(), "The id of an uploaded document."),
});

const coverageShape = {
  branch: z.optional(branchSchema),
  top: z.optional(
    described(z.int().check(z.gte(1), z.lte(100)), "Cap on the per-court rows. Default 20."),
  ),
} as const;

/** Options of `GET /corpus/coverage`. */
export const corpusCoverageOptionsSchema = z.looseObject(coverageShape);

const facetsShape = {
  type: z.optional(
    described(z.enum(["decision", "law"]), "Restrict the counts to one artifact type."),
  ),
  norm: z.optional(
    described(z.string(), "Required for the field cited_norms: the norm whose family to list."),
  ),
  prefix: z.optional(described(z.string(), "Case-insensitive prefix filter on the value.")),
} as const;

/** Options of `GET /corpus/facets/{field}`. */
export const corpusFacetsOptionsSchema = z.looseObject(facetsShape);

/** Input of `corpus.facets`. */
export const listFacetsInputSchema = z.looseObject({ field: facetFieldSchema, ...facetsShape });
