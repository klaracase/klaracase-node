/**
 * Error classes.
 *
 * Every error that comes from the API or from the network extends {@link KlaracaseError}.
 * {@link ConfigurationError} is outside that hierarchy on purpose: it means the client was set up
 * wrong, before any request left the process.
 *
 * Data members use the wire names of the API (`api_release`, `required_ability`), as the response
 * types do. Nothing is renamed.
 */

/** Error codes the API and the SDK use. Unknown codes are possible, so the type stays open. */
export type KlaracaseErrorCode =
  | "unauthenticated"
  | "personal_access_token_required"
  | "token_org_missing"
  | "token_org_membership_lost"
  | "pseudonymizer_token_refused"
  | "two_factor_required"
  | "token_ability_missing"
  | "validation_failed"
  | "rate_limited"
  | "volume_cap"
  | "insufficient_credits"
  | "backend_unavailable"
  | "service_unavailable"
  | "internal_error"
  | "bad_request"
  | "forbidden"
  | "not_found"
  | "not_found_under_filter"
  | "method_not_allowed"
  | "conflict"
  | "payload_too_large"
  | "unsupported_media_type"
  | "client_error"
  | "statute_superseded"
  | "section_not_in_current_text"
  | "document_unavailable"
  | "search_timeout"
  | "index_unavailable"
  | "norm_family_unavailable"
  | "ambiguous_aktenzeichen"
  | "ids_unresolved"
  | "page_undefined_at_this_depth"
  | "text_too_long"
  | "not_german_legal_text"
  | "unrecognisable_norm_token"
  | "invalid_reference"
  | "range_not_supported"
  | "historical_version_unavailable"
  | "ambiguous"
  | "sections_unavailable"
  | "section_not_found"
  | "rn_range_not_found"
  | "official_headnote_not_located"
  | "document_leitsatz_not_located"
  | "client_validation"
  | "wait_timeout"
  | "unknown";

/** A `code` value: a known code, or any other string the API may add later. */
export type ErrorCode = KlaracaseErrorCode | (string & {});

/** The members of an RFC 9457 problem body that the SDK reads as typed fields. */
export interface ProblemInit {
  type?: string;
  title?: string;
  status?: number | null;
  detail?: string;
  code?: ErrorCode | null;
  api_release?: string | null;
  /** Every member of the problem body except `type`, `title`, `status`, `detail` and `code`. */
  extra?: Record<string, unknown>;
  cause?: unknown;
}

/** Base class of every error from the API or the network. */
export class KlaracaseError extends Error {
  /** Problem type URI. `about:blank` when the answer was not a problem body. */
  readonly type: string;
  readonly title: string;
  /** HTTP status, or `null` when there was no answer or the error is raised on the client. */
  readonly status: number | null;
  readonly detail: string;
  readonly code: ErrorCode | null;
  /** Value of the `X-Klaracase-Api-Release` header, or `null` when it was absent. */
  readonly api_release: string | null;
  /** Every problem member that is not `type`, `title`, `status`, `detail` or `code`. */
  readonly extra: Record<string, unknown>;

  constructor(init: ProblemInit = {}) {
    const detail = init.detail ?? init.title ?? "Klaracase error";
    super(detail, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = new.target.name;
    this.type = init.type ?? "about:blank";
    this.title = init.title ?? "";
    this.status = init.status ?? null;
    this.detail = detail;
    this.code = init.code ?? null;
    this.api_release = init.api_release ?? null;
    this.extra = init.extra ?? {};
  }
}

/** 401. The token is missing, expired or revoked. */
export class AuthenticationError extends KlaracaseError {}

/** 402. The organization has too few credits. Never retried. */
export class InsufficientCreditsError extends KlaracaseError {
  readonly cost: number | null;
  readonly balance: number | null;

  constructor(init: ProblemInit = {}) {
    super(init);
    this.cost = numberOrNull(this.extra["cost"]);
    this.balance = numberOrNull(this.extra["balance"]);
  }
}

/** 403. The token lacks an ability, or the organization refuses it. */
export class PermissionError extends KlaracaseError {
  /** The ability the endpoint needs, when the code is `token_ability_missing`. */
  readonly required_ability: string | null;

  constructor(init: ProblemInit = {}) {
    super(init);
    const ability = this.extra["required_ability"];
    this.required_ability = typeof ability === "string" ? ability : null;
  }
}

/** 404. */
export class NotFoundError extends KlaracaseError {}

/** 409. */
export class ConflictError extends KlaracaseError {}

/**
 * 422 from the API, or a client-side check that failed before any request (`code` is then
 * `client_validation` and `status` is `null`).
 */
export class ValidationError extends KlaracaseError {
  /** Map from field name to a list of messages. Empty when the server sent none. */
  readonly errors: Record<string, string[]>;

  constructor(init: ProblemInit = {}) {
    super(init);
    const errors = this.extra["errors"];
    this.errors = isRecord(errors) ? (errors as Record<string, string[]>) : {};
  }
}

/** 429. Includes the daily `volume_cap`. */
export class RateLimitError extends KlaracaseError {
  /** Seconds to wait: the body value, else the `Retry-After` header, else `null`. */
  readonly retry_after_seconds: number | null;

  constructor(init: ProblemInit & { retry_after_seconds?: number | null } = {}) {
    super(init);
    const fromBody = this.extra["retry_after_seconds"];
    this.retry_after_seconds =
      typeof fromBody === "number" ? fromBody : (init.retry_after_seconds ?? null);
  }
}

/** 503. */
export class ServiceUnavailableError extends KlaracaseError {}

/** Any other error status. */
export class ApiError extends KlaracaseError {}

/** No usable answer: refused connection, DNS, TLS, a dropped socket. Wraps the cause. */
export class TransportError extends KlaracaseError {
  constructor(init: ProblemInit = {}) {
    super({ title: "Transport error", ...init });
  }
}

/** The answer took longer than the `timeout` option. */
export class TimeoutError extends TransportError {
  constructor(init: ProblemInit = {}) {
    super({ title: "Timeout", ...init });
  }
}

/** The shape of an upload receipt, as far as the wait helper and the errors read it. */
export interface DocumentReceiptLike {
  id: string;
  status: string;
  error_code: string | null;
  [key: string]: unknown;
}

/** `waitUntilReady` saw the upload end in the `failed` status. */
export class DocumentFailedError extends KlaracaseError {
  /** The reason the upload failed, for example `encrypted_pdf`. Same as `code`. */
  readonly error_code: string | null;
  /** The last receipt. */
  readonly document: DocumentReceiptLike;

  constructor(document: DocumentReceiptLike) {
    super({
      title: "Document failed",
      detail: `The uploaded document ${document.id} failed: ${document.error_code ?? "unknown reason"}.`,
      code: document.error_code ?? "document_failed",
    });
    this.error_code = document.error_code;
    this.document = document;
  }
}

/** `waitUntilReady` ran out of time before the upload reached a terminal status. */
export class DocumentTimeoutError extends KlaracaseError {
  /** The last receipt. */
  readonly document: DocumentReceiptLike;

  constructor(document: DocumentReceiptLike, timeoutSeconds: number) {
    super({
      title: "Wait timeout",
      detail: `The uploaded document ${document.id} was still "${document.status}" after ${timeoutSeconds} seconds.`,
      code: "wait_timeout",
    });
    this.document = document;
  }
}

/**
 * The client was set up wrong: no token, an empty token or an invalid base URL. Not a
 * {@link KlaracaseError}. Raised by the constructor, before any request.
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}
