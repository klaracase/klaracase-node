import type { DatapackageCreateParams } from "./resources/datapackages.js";
import type { CorpusCoverageOptions, CorpusFacetsOptions, FacetField } from "./resources/corpus.js";
import type {
  DecisionCitationsOptions,
  DecisionGetOptions,
  DecisionSearchFilters,
} from "./resources/decisions.js";
import type { NormGetOptions } from "./resources/norms.js";
import type { CrossTypeSearchFilters } from "./resources/search.js";

/**
 * Whole inputs of the operations, with the path or body argument in the same object as the
 * options. The `@klaracase/sdk/schemas` schemas validate these shapes, and the `@klaracase/sdk/tools`
 * tools take them as arguments.
 */

/** Input of `decisions.search`: the query and its filters. */
export interface SearchDecisionsInput extends DecisionSearchFilters {
  query: string;
}

/** Input of `search`: the query and its filters. */
export interface CrossTypeSearchInput extends CrossTypeSearchFilters {
  query: string;
}

/** Input of `decisions.get`: the id and the slice options. */
export interface GetDecisionInput extends DecisionGetOptions {
  /** A decision UUID, an Aktenzeichen or an ECLI. */
  id: string;
}

/** Input of `decisions.citations`: the id and the options. */
export interface GetCitationGraphInput extends DecisionCitationsOptions {
  /** A decision UUID, an Aktenzeichen or an ECLI. */
  id: string;
}

/** Input of `norms.get`: the reference and the options. */
export interface GetNormInput extends NormGetOptions {
  /** The norm as cited, for example `§ 535 BGB` or `Art. 6 DSGVO`. */
  reference: string;
}

/** Input of `datapackages.create`. */
export type AssembleDatapackageInput = DatapackageCreateParams;

/** Input of the citation check tool: a text, and optionally the date of the document. */
export interface CheckCitationsInput {
  /** The German legal text to check. */
  text: string;
  /** Document date, `YYYY-MM-DD`. */
  reference_date?: string | undefined;
}

/** Input of `citationChecks.get`. */
export interface GetCitationCheckInput {
  run_id: string;
}

/** Input of `citationCheckDocuments.get`. */
export interface GetDocumentInput {
  document_id: string;
}

/** Input of `corpus.coverage`. */
export type CorpusCoverageInput = CorpusCoverageOptions;

/** Input of `corpus.facets`: the field and the options. */
export interface ListFacetsInput extends CorpusFacetsOptions {
  field: FacetField;
}
