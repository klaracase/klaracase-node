export { Klaracase, type KlaracaseOptions } from "./client.js";
export { VERSION } from "./version.js";
export {
  resetDeprecationWarnings,
  type DeprecationHandler,
  type DeprecationInfo,
} from "./deprecation.js";
export {
  ApiError,
  AuthenticationError,
  ConfigurationError,
  ConflictError,
  DocumentFailedError,
  DocumentTimeoutError,
  InsufficientCreditsError,
  KlaracaseError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  ServiceUnavailableError,
  TimeoutError,
  TransportError,
  ValidationError,
  type DocumentReceiptLike,
  type ErrorCode,
  type KlaracaseErrorCode,
  type ProblemInit,
} from "./errors.js";
export type * from "./types.js";
export type * from "./resources/decisions.js";
export type * from "./resources/search.js";
export type * from "./resources/norms.js";
export type * from "./resources/datapackages.js";
export type * from "./resources/citation-checks.js";
export type * from "./resources/citation-check-documents.js";
export type * from "./resources/corpus.js";
