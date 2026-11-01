/**
 * Types shared by every resource.
 *
 * Response types list the documented top-level keys and keep every other key: each one has an
 * index signature, so a key that a later API release adds is readable without a cast. Nothing in a
 * response is renamed, reordered or cleaned.
 */

/** A string union that still accepts values the API may add later. */
export type Open<T extends string> = T | (string & {});

/** Court jurisdiction (Gerichtsbarkeit). It is not a legal subject area. */
export type Branch = Open<
  | "ordentlich"
  | "verwaltung"
  | "sozial"
  | "arbeit"
  | "finanz"
  | "verfassung"
  | "patent"
  | "unbekannt"
>;

/** Retrieval mode of a search. */
export type SearchMode = Open<"keyword" | "semantic" | "hybrid">;

/** Document type of a decision. */
export type DocumentType = Open<
  "Urteil" | "Beschluss" | "Verfügung" | "Sonstige" | "Gerichtsbescheid" | "Schlussanträge"
>;

/** Statutes the `cited_statutes` filter accepts. */
export type CitedStatute = Open<
  | "StGB"
  | "StPO"
  | "InsO"
  | "DSGVO"
  | "GDPR"
  | "BDSG"
  | "BauGB"
  | "BBauG"
  | "BauNVO"
  | "StVG"
  | "StVO"
>;

/** Verdict of one citation in a citation check. */
export type CitationVerdict = Open<
  | "verified_corpus"
  | "verified_external"
  | "not_found"
  | "out_of_coverage"
  | "ambiguous"
  | "unverifiable"
  | "discrepancy"
>;

/** Status of a citation check run. */
export type CitationCheckStatus = Open<
  | "pending"
  | "gating"
  | "extracting"
  | "resolving"
  | "checking_external"
  | "complete"
  | "rejected"
  | "failed"
>;

/** Status of an uploaded document. `ready` and `failed` are terminal. */
export type DocumentStatus = Open<"uploaded" | "extracting" | "ocr_pending" | "ready" | "failed">;

/** Why an upload failed. */
export type DocumentErrorCode = Open<
  | "document_too_long"
  | "unsupported_format_pending"
  | "corrupted_document"
  | "zip_bomb_rejected"
  | "encrypted_pdf"
  | "scanned_pdf"
  | "pdf_text_garbled"
  | "extraction_failed"
>;

/** Facts about the HTTP answer. Not part of the body. */
export interface ResponseMeta {
  /** HTTP status of the answer: 200 or 202. */
  readonly status: number;
  /** Value of `X-Klaracase-Api-Release`, or `null` when the header was absent. */
  readonly api_release: string | null;
  /**
   * Seconds the final HTTP attempt took, from request start to the end of the body. Earlier
   * attempts and retry waits are not counted.
   */
  readonly request_duration: number;
}

/**
 * A parsed answer body with `meta` attached.
 *
 * `meta` is a non-enumerable property. `JSON.stringify(result)`, `Object.keys(result)` and a
 * spread copy therefore give the body exactly as the server sent it. Read `result.meta` directly.
 */
export type WithMeta<T> = T & { readonly meta: ResponseMeta };

/** Credit use of one call. `cost` and `credits_remaining` are `null` for an unmetered caller. */
export interface Credits {
  metered: boolean;
  cost: number | null;
  credits_remaining: number | null;
  [key: string]: unknown;
}

/** Keys that every operation body carries. */
export interface ApiEnvelope {
  api_version: string;
  changelog_url: string;
  credits: Credits;
  /** Present when the call sent arguments the server does not know. */
  ignored_parameters?: unknown;
  [key: string]: unknown;
}

/** A count that may be a lower bound. */
export interface Count {
  value: number;
  is_floor: boolean;
  [key: string]: unknown;
}

/** Options that apply to one request. */
export interface RequestOptions {
  /** Abort the request. The abort reason is thrown as is and is never retried. */
  signal?: AbortSignal;
  /** Timeout in seconds for each attempt. Overrides the client option. */
  timeout?: number;
  /** Retries on 429, on 503 and (GET only) on transport errors. Overrides the client option. */
  maxRetries?: number;
}
