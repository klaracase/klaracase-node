/**
 * The values of the request enums, as const lists. The types in `types.ts` come from these lists,
 * and so do the schemas in `@klaracase/sdk/schemas`. One list, one source.
 */

/** Court jurisdictions (Gerichtsbarkeit). A branch is not a legal subject area. */
export const BRANCHES = [
  "ordentlich",
  "verwaltung",
  "sozial",
  "arbeit",
  "finanz",
  "verfassung",
  "patent",
  "unbekannt",
] as const;

/** Retrieval modes of a search. */
export const SEARCH_MODES = ["keyword", "semantic", "hybrid"] as const;

/** Document types of a decision. */
export const DOCUMENT_TYPES = [
  "Urteil",
  "Beschluss",
  "Verfügung",
  "Sonstige",
  "Gerichtsbescheid",
  "Schlussanträge",
] as const;

/** Statutes the `cited_statutes` filter accepts. */
export const CITED_STATUTES = [
  "StGB",
  "StPO",
  "InsO",
  "DSGVO",
  "GDPR",
  "BDSG",
  "BauGB",
  "BBauG",
  "BauNVO",
  "StVG",
  "StVO",
] as const;

/** Directions of the citation graph around a decision. */
export const CITATION_DIRECTIONS = ["outgoing", "incoming", "both"] as const;

/** The named sections of a decision text. The API reads them in any case. */
export const DECISION_SECTIONS = ["Tenor", "Leitsatz", "Tatbestand", "Gründe"] as const;

/** The facet fields the API serves. */
export const FACET_FIELDS = [
  "court_name",
  "court_branch",
  "document_type",
  "jurisdiction",
  "law_type",
  "cited_norms",
] as const;

/** The most statutes the `cited_statutes` filter takes in one call. */
export const MAX_CITED_STATUTES = 5;
