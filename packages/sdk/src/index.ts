export { Klaracase, type KlaracaseOptions } from "./client.js";
export { VERSION } from "./version.js";
export { LOG_ENV_VAR, LOG_LEVELS, type LogLevel, type Logger } from "./log.js";
export {
  resetDeprecationWarnings,
  type DeprecationHandler,
  type DeprecationInfo,
} from "./deprecation.js";
export {
  ApiError,
  AuthenticationError,
  ConfigurationError,
  CitationCheckIncompleteError,
  ConflictError,
  DocumentFailedError,
  DocumentTimeoutError,
  InsufficientCreditsError,
  KlaracaseError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  ServerError,
  ServiceUnavailableError,
  TimeoutError,
  TransportError,
  ValidationError,
  type AmbiguousCandidate,
  type CitationCheckRunLike,
  type DocumentReceiptLike,
  type ErrorCode,
  type KlaracaseErrorCode,
  type ProblemInit,
} from "./errors.js";
export type * from "./types.js";
export { getExtra } from "./response.js";
export {
  assertComplete,
  excerpt,
  groupByVerdict,
  type CompleteCitationCheckRun,
  type FindingsByVerdict,
} from "./helpers.js";
export { CITATIONS_MAX_PAGES, SEARCH_MAX_PAGES, type PageOptions } from "./pagination.js";
export { CITATION_VERDICTS, isKnownVerdict, type KnownCitationVerdict } from "./verdicts.js";
export type * from "./resources/decisions.js";
export type * from "./resources/search.js";
export type * from "./resources/norms.js";
export type * from "./resources/datapackages.js";
export type * from "./resources/citation-checks.js";
export type * from "./resources/citation-check-documents.js";
export type * from "./resources/corpus.js";
export type * from "./inputs.js";
