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

/**
 * Brand of every {@link KlaracaseError}. `Symbol.for` returns the same symbol in every copy of
 * this package, so {@link KlaracaseError.is} works when an app loads both the ESM and the CJS
 * build, or two versions of the package (the dual package hazard).
 */
const KLARACASE_ERROR: unique symbol = Symbol.for("klaracase.error");

const CONFIGURATION_ERROR_BRAND: unique symbol = Symbol.for("klaracase.configuration_error");

/** One decision that matches an ambiguous Aktenzeichen (`code` `ambiguous_aktenzeichen`). */
export interface AmbiguousCandidate {
  id: string;
  court: string | null;
  date: string | null;
  aktenzeichen: string | null;
}

/** The members of an RFC 9457 problem body that the SDK reads as typed fields. */
export interface ProblemInit {
  type?: string | undefined;
  title?: string | undefined;
  status?: number | null | undefined;
  detail?: string | undefined;
  code?: ErrorCode | null | undefined;
  api_release?: string | null | undefined;
  /** Every member of the problem body except `type`, `title`, `status`, `detail` and `code`. */
  extra?: Record<string, unknown> | undefined;
  /** The response headers, for an error that came with an HTTP answer. */
  headers?: Headers | null | undefined;
  /** Wait from the `Retry-After` header, when the body names none. */
  retry_after_seconds?: number | null | undefined;
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
  /** The response headers of the failed answer, or `null` when there was no answer. */
  readonly headers: Headers | null;
  /** The decisions that share the Aktenzeichen, for `ambiguous_aktenzeichen`. */
  readonly candidates: AmbiguousCandidate[] | undefined;
  /** The statute that replaced the cited one, for `statute_superseded`. */
  readonly successor: string | undefined;
  /** What the cap counts (for example `rows`), for `volume_cap`. */
  readonly unit: string | undefined;
  /** The size of the cap, for `volume_cap`. */
  readonly cap: number | undefined;
  /** When the cap resets, an ISO 8601 time, for `volume_cap`. */
  readonly resets_at: string | undefined;
  /**
   * True when sending the same request again later can succeed: a 429 (wait first), a 503, any
   * other 5xx, or a transport error. False for every other 4xx. The client already retried
   * `maxRetries` times before it threw.
   */
  readonly retryable: boolean;
  /** Seconds the server asked you to wait: the body value, else `Retry-After`, else `null`. */
  readonly retryAfterSeconds: number | null;

  constructor(init: ProblemInit = {}) {
    const detail = init.detail ?? init.title ?? "Klaracase error";
    super(detail, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = "KlaracaseError";
    this.type = init.type ?? "about:blank";
    this.title = init.title ?? "";
    this.status = init.status ?? null;
    this.detail = detail;
    this.code = init.code ?? null;
    this.api_release = init.api_release ?? null;
    this.extra = init.extra ?? {};
    this.headers = init.headers ?? null;
    this.candidates = candidatesOf(this.extra["candidates"]);
    this.successor = stringOrUndefined(this.extra["successor"]);
    this.unit = stringOrUndefined(this.extra["unit"]);
    this.cap = numberOrUndefined(this.extra["cap"]);
    this.resets_at = stringOrUndefined(this.extra["resets_at"]);
    this.retryAfterSeconds =
      numberOrUndefined(this.extra["retry_after_seconds"]) ?? init.retry_after_seconds ?? null;
    this.retryable = isRetryableStatus(this.status, this instanceof TransportError);
  }

  /**
   * True for any {@link KlaracaseError}, also one made by another copy of this package. Prefer it
   * to `instanceof` when your app may load the ESM and the CJS build, or two versions.
   */
  static is(error: unknown): error is KlaracaseError {
    return typeof error === "object" && error !== null && KLARACASE_ERROR in error;
  }
}

Object.defineProperty(KlaracaseError.prototype, KLARACASE_ERROR, {
  value: true,
  enumerable: false,
});

/** 401. The token is missing, expired or revoked. */
export class AuthenticationError extends KlaracaseError {
  override name = "AuthenticationError";
}

/** 402. The organization has too few credits. Never retried. */
export class InsufficientCreditsError extends KlaracaseError {
  override name = "InsufficientCreditsError";
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
  override name = "PermissionError";
  /** The ability the endpoint needs, when the code is `token_ability_missing`. */
  readonly required_ability: string | null;

  constructor(init: ProblemInit = {}) {
    super(init);
    const ability = this.extra["required_ability"];
    this.required_ability = typeof ability === "string" ? ability : null;
  }
}

/** 404. */
export class NotFoundError extends KlaracaseError {
  override name = "NotFoundError";
}

/** 409. */
export class ConflictError extends KlaracaseError {
  override name = "ConflictError";
}

/**
 * 422 from the API, or a client-side check that failed before any request (`code` is then
 * `client_validation` and `status` is `null`).
 */
export class ValidationError extends KlaracaseError {
  override name = "ValidationError";
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
  override name = "RateLimitError";
  /** Seconds to wait: the body value, else the `Retry-After` header, else `null`. */
  readonly retry_after_seconds: number | null;

  constructor(init: ProblemInit & { retry_after_seconds?: number | null | undefined } = {}) {
    super(init);
    const fromBody = this.extra["retry_after_seconds"];
    this.retry_after_seconds =
      typeof fromBody === "number" ? fromBody : (init.retry_after_seconds ?? null);
  }
}

/** 503. */
export class ServiceUnavailableError extends KlaracaseError {
  override name = "ServiceUnavailableError";
}

/** Any other error status. */
export class ApiError extends KlaracaseError {
  override name = "ApiError";
}

/** 500, 502, 504 and every other 5xx except 503. The SDK does not retry these. */
export class ServerError extends ApiError {
  override name = "ServerError";
}

/** No usable answer: refused connection, DNS, TLS, a dropped socket. Wraps the cause. */
export class TransportError extends KlaracaseError {
  override name = "TransportError";
  constructor(init: ProblemInit = {}) {
    super({ title: "Transport error", ...init });
  }
}

/** The answer took longer than the `timeout` option. */
export class TimeoutError extends TransportError {
  override name = "TimeoutError";
  constructor(init: ProblemInit = {}) {
    super({ title: "Timeout", ...init });
  }
}

/** The shape of an upload receipt, as far as the wait helper and the errors read it. */
export interface DocumentReceiptLike {
  id: string;
  status: string;
  error_code: string | null;
}

/** `waitUntilReady` saw the upload end in the `failed` status. */
export class DocumentFailedError extends KlaracaseError {
  override name = "DocumentFailedError";
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
  override name = "DocumentTimeoutError";
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
  /** True for any {@link ConfigurationError}, also one made by another copy of this package. */
  static is(error: unknown): error is ConfigurationError {
    return typeof error === "object" && error !== null && CONFIGURATION_ERROR_BRAND in error;
  }

  /** `client_validation` when the setup is unsafe or invalid for this host, else `null`. */
  readonly code: string | null;

  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "ConfigurationError";
    this.code = code;
  }
}

Object.defineProperty(ConfigurationError.prototype, CONFIGURATION_ERROR_BRAND, {
  value: true,
  enumerable: false,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function candidatesOf(value: unknown): AmbiguousCandidate[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter(isRecord).map((item) => ({
    id: String(item["id"] ?? ""),
    court: stringOrNull(item["court"]),
    date: stringOrNull(item["date"]),
    aktenzeichen: stringOrNull(item["aktenzeichen"]),
  }));
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isRetryableStatus(status: number | null, isTransport: boolean): boolean {
  if (isTransport) return true;
  if (status === null) return false;
  return status === 429 || status >= 500;
}
