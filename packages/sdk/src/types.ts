/**
 * Types shared by every resource.
 *
 * Response types list the documented keys and nothing else. They carry no index signature, so a
 * misspelled key is a compile error. A key that a later API release adds still exists at run time:
 * read it with {@link getExtra}. Nothing in a response is renamed, reordered or cleaned.
 *
 * Request enums are strict unions taken from the API contract. Response enums are wrapped in
 * {@link Open}, because the API may add a value in a minor release.
 */

/** A string union that still accepts values the API may add later. */
export type Open<T extends string> = T | (string & {});

/** Court jurisdiction (Gerichtsbarkeit). It is not a legal subject area. */
export type Branch =
  | "ordentlich"
  | "verwaltung"
  | "sozial"
  | "arbeit"
  | "finanz"
  | "verfassung"
  | "patent"
  | "unbekannt";

/** Retrieval mode of a search. */
export type SearchMode = "keyword" | "semantic" | "hybrid";

/** Document type of a decision. */
export type DocumentType =
  "Urteil" | "Beschluss" | "Verfügung" | "Sonstige" | "Gerichtsbescheid" | "Schlussanträge";

/** Statutes the `cited_statutes` filter accepts. */
export type CitedStatute =
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
  | "StVO";

/** Direction of the citation graph around a decision. */
export type CitationDirection = "outgoing" | "incoming" | "both";

/** Verdict of one citation in a citation check. The list is in {@link CITATION_VERDICTS}. */
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
  /** The response headers of the final attempt. Header names are case-insensitive. */
  readonly headers: Headers;
}

/**
 * A parsed answer body with `meta` attached.
 *
 * `meta` is a non-enumerable property. `JSON.stringify(result)`, `Object.keys(result)` and a
 * spread copy therefore give the body exactly as the server sent it. Read `result.meta` directly.
 * The body itself stays mutable.
 */
export type WithMeta<T> = T & { readonly meta: ResponseMeta };

/** A count that may be a lower bound. */
export interface Count {
  value: number;
  is_floor: boolean;
}

/** Credit use of one call. `cost` and `credits_remaining` are `null` for an unmetered caller. */
export interface Credits {
  metered: boolean;
  cost: number | null;
  credits_remaining: number | null;
}

/** Keys that every operation body carries. */
export interface ApiEnvelope {
  api_version: string;
  changelog_url: string;
  credits: Credits;
  /** Present when the call sent arguments the server does not know. */
  ignored_parameters?: unknown;
}

/** Options that apply to one request. */
export interface RequestOptions {
  /** Abort the request. The abort reason is thrown as is and is never retried. */
  signal?: AbortSignal | undefined;
  /** Timeout in seconds for each attempt. Overrides the client option. */
  timeout?: number | undefined;
  /** Retries on 429, on 503 and (GET only) on transport errors. Overrides the client option. */
  maxRetries?: number | undefined;
  /**
   * Extra headers for this request. They win over the client's `defaultHeaders`. They cannot
   * replace `Authorization`.
   */
  headers?: Record<string, string> | undefined;
}
