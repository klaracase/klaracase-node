import { buildQuery, type QueryParams } from "./encoding.js";
import { surfaceDeprecation, type DeprecationHandler } from "./deprecation.js";
import type { KlaracaseError } from "./errors.js";
import type { Log } from "./log.js";
import {
  ApiError,
  AuthenticationError,
  ConflictError,
  InsufficientCreditsError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  ServerError,
  ServiceUnavailableError,
  TimeoutError,
  TransportError,
  ValidationError,
  type ProblemInit,
} from "./errors.js";
import type { RequestOptions, ResponseMeta, WithMeta } from "./types.js";

/** Waits longer than this many seconds are never slept. The error is raised instead. */
const MAX_SERVER_WAIT_SECONDS = 30;
/** Cap for the computed exponential backoff, in seconds. */
const MAX_BACKOFF_SECONDS = 8;
const BASE_BACKOFF_SECONDS = 0.5;
/** Longest raw body kept in `detail` for an answer that is not a problem body. */
const MAX_RAW_DETAIL_CHARS = 1000;

export interface TransportConfig {
  /** Base URL without a trailing slash. */
  baseUrl: string;
  /** Seconds per attempt. */
  timeout: number;
  maxRetries: number;
  userAgent: string;
  fetch: typeof fetch;
  /** Wait for this many seconds. Tests replace it. */
  sleep: (seconds: number) => Promise<void>;
  /** The clock in seconds. Tests replace it. */
  now: () => number;
  /** A number in [0, 1) for the backoff jitter. */
  random: () => number;
  onDeprecation: DeprecationHandler;
  /** Headers sent with every request. A per-request header wins. */
  defaultHeaders: Readonly<Record<string, string>>;
  log: Log;
}

export interface HttpRequest {
  method: "GET" | "POST";
  /** Path below the base URL, with every parameter already encoded. */
  path: string;
  query?: QueryParams;
  /** A JSON body. */
  json?: unknown;
  /** A multipart body. The runtime sets the content type and the boundary. */
  form?: FormData;
}

type JsonObject = Record<string, unknown>;

/** The one place where requests leave the process: retries, errors, `meta` and deprecations. */
export class Transport {
  /** An ES private field: it does not show up when the client is logged or inspected. */
  readonly #token: string;

  constructor(
    private readonly config: TransportConfig,
    token: string,
  ) {
    this.#token = token;
  }

  async request<T extends object>(
    request: HttpRequest,
    options: RequestOptions = {},
  ): Promise<WithMeta<T>> {
    const maxRetries = options.maxRetries ?? this.config.maxRetries;
    const timeout = options.timeout ?? this.config.timeout;
    const url = this.buildUrl(request);
    const isGet = request.method === "GET";

    for (let attempt = 0; ; attempt++) {
      const canRetry = attempt < maxRetries;
      const started = this.config.now();
      let response: Response;
      let text: string;
      try {
        ({ response, text } = await this.send(
          url,
          request,
          timeout,
          options.signal,
          options.headers,
        ));
      } catch (error) {
        if (!(error instanceof TransportError)) throw error;
        if (!(isGet && canRetry)) throw error;
        const wait = this.backoff(attempt);
        this.logRetry(request, null, attempt, wait);
        await this.config.sleep(wait);
        continue;
      }
      const duration = Math.max(0, this.config.now() - started);

      surfaceDeprecation(response.headers, this.config.onDeprecation);

      this.config.log.info(`${request.method} ${request.path} ${response.status}`, {
        status: response.status,
        duration_ms: Math.round(duration * 1000),
      });
      if (response.ok) return this.parseSuccess<T>(response, text, duration);

      const error = this.buildError(response, text);
      const retryable =
        (response.status === 429 || response.status === 503) && error.code !== "volume_cap";
      if (!(retryable && canRetry)) throw error;

      const stated = this.statedWait(text, response.headers);
      if (stated !== null && stated > MAX_SERVER_WAIT_SECONDS) throw error;
      const wait = stated ?? this.backoff(attempt);
      this.logRetry(request, response.status, attempt, wait);
      await this.config.sleep(wait);
    }
  }

  /** One debug line per retry. It carries no token, no header and no query string. */
  private logRetry(
    request: HttpRequest,
    status: number | null,
    attempt: number,
    waitSeconds: number,
  ): void {
    this.config.log.debug("retry", {
      method: request.method,
      path: request.path,
      status,
      attempt: attempt + 1,
      wait_seconds: Math.round(waitSeconds * 1000) / 1000,
    });
  }

  private buildUrl(request: HttpRequest): string {
    const query = buildQuery(request.query);
    return `${this.config.baseUrl}${request.path}${query === "" ? "" : `?${query}`}`;
  }

  /** One attempt. Throws {@link TransportError} (or {@link TimeoutError}), or the caller's abort reason. */
  private async send(
    url: string,
    request: HttpRequest,
    timeout: number,
    userSignal: AbortSignal | undefined,
    extraHeaders: Readonly<Record<string, string>> | undefined,
  ): Promise<{ response: Response; text: string }> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": this.config.userAgent,
    };
    mergeHeaders(headers, this.config.defaultHeaders);
    mergeHeaders(headers, extraHeaders);
    headers["Authorization"] = `Bearer ${this.#token}`;
    let body: string | FormData | undefined;
    if (request.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(request.json);
    }
    if (request.form !== undefined) body = request.form;

    const timeoutSignal = AbortSignal.timeout(Math.ceil(timeout * 1000));
    const signal = userSignal ? AbortSignal.any([userSignal, timeoutSignal]) : timeoutSignal;
    try {
      const init: RequestInit = { method: request.method, headers, signal };
      if (body !== undefined) init.body = body;
      const response = await this.config.fetch(url, init);
      const text = await response.text();
      return { response, text };
    } catch (cause) {
      if (userSignal?.aborted) throw userSignal.reason;
      if (timeoutSignal.aborted) {
        throw new TimeoutError({
          detail: `The request took longer than ${timeout} seconds.`,
          cause,
        });
      }
      throw new TransportError({ detail: describeCause(cause), cause });
    }
  }

  private parseSuccess<T extends object>(
    response: Response,
    text: string,
    duration: number,
  ): WithMeta<T> {
    const apiRelease = response.headers.get("x-klaracase-api-release");
    const body = parseJson(text);
    if (!isObject(body)) {
      throw new ApiError({
        title: "Invalid response",
        detail: truncate(text),
        status: response.status,
        code: "unknown",
        api_release: apiRelease,
      });
    }
    const meta: ResponseMeta = {
      status: response.status,
      api_release: apiRelease,
      request_duration: duration,
      headers: response.headers,
    };
    Object.defineProperty(body, "meta", { value: meta, enumerable: false });
    return body as WithMeta<T>;
  }

  private buildError(response: Response, text: string): KlaracaseError {
    const status = response.status;
    const apiRelease = response.headers.get("x-klaracase-api-release");
    const body = parseJson(text);
    const init = isProblem(body)
      ? problemInit(body, status, apiRelease, response.headers)
      : ({
          type: "about:blank",
          title: `HTTP ${status}`,
          status,
          detail: truncate(text),
          code: "unknown",
          api_release: apiRelease,
          headers: response.headers,
        } satisfies ProblemInit);

    if (status === 401) return new AuthenticationError(init);
    if (status === 402) return new InsufficientCreditsError(init);
    if (status === 403) return new PermissionError(init);
    if (status === 404) return new NotFoundError(init);
    if (status === 409) return new ConflictError(init);
    if (status === 422) return new ValidationError(init);
    if (status === 429) {
      return new RateLimitError({
        ...init,
        retry_after_seconds: parseWholeSeconds(response.headers.get("retry-after")),
      });
    }
    if (status === 503) return new ServiceUnavailableError(init);
    if (status >= 500) return new ServerError(init);
    return new ApiError(init);
  }

  /** The wait the server states: the body value first, then the `Retry-After` header. */
  private statedWait(text: string, headers: Headers): number | null {
    const body = parseJson(text);
    if (isObject(body) && typeof body["retry_after_seconds"] === "number") {
      return body["retry_after_seconds"];
    }
    return parseWholeSeconds(headers.get("retry-after"));
  }

  /** Full jitter: a random wait between 0 and `min(8, 0.5 * 2^n)` seconds. */
  private backoff(attempt: number): number {
    const ceiling = Math.min(MAX_BACKOFF_SECONDS, BASE_BACKOFF_SECONDS * 2 ** attempt);
    return this.config.random() * ceiling;
  }
}

/** Headers the SDK owns. A caller header with one of these names is ignored. */
const PROTECTED_HEADERS = new Set(["authorization", "content-type", "content-length", "host"]);

/**
 * Copy `extra` into `target`. Names match case-insensitively: a caller header replaces the SDK
 * default of the same name, except for the protected ones.
 */
function mergeHeaders(
  target: Record<string, string>,
  extra: Readonly<Record<string, string>> | undefined,
): void {
  if (extra === undefined) return;
  for (const [name, value] of Object.entries(extra)) {
    const lower = name.toLowerCase();
    if (PROTECTED_HEADERS.has(lower)) continue;
    for (const existing of Object.keys(target)) {
      if (existing.toLowerCase() === lower) delete target[existing];
    }
    target[name] = value;
  }
}

function problemInit(
  body: JsonObject,
  status: number,
  apiRelease: string | null,
  headers: Headers,
): ProblemInit {
  const { type, title, status: _status, detail, code, ...extra } = body;
  return {
    type: typeof type === "string" ? type : "about:blank",
    title: typeof title === "string" ? title : `HTTP ${status}`,
    status,
    detail: typeof detail === "string" ? detail : undefined,
    code: code as string,
    api_release: apiRelease,
    extra,
    headers,
    retry_after_seconds: parseWholeSeconds(headers.get("retry-after")),
  };
}

/** A body is a problem when it is a JSON object with a string `code`. */
function isProblem(body: unknown): body is JsonObject {
  return isObject(body) && typeof body["code"] === "string";
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function parseWholeSeconds(header: string | null): number | null {
  if (header === null || !/^\d+$/.test(header.trim())) return null;
  return Number(header.trim());
}

function truncate(text: string): string {
  if (text.length <= MAX_RAW_DETAIL_CHARS) return text;
  const characters = Array.from(text);
  if (characters.length <= MAX_RAW_DETAIL_CHARS) return text;
  return characters.slice(0, MAX_RAW_DETAIL_CHARS).join("");
}

function describeCause(cause: unknown): string {
  if (cause instanceof Error) {
    const inner = cause.cause;
    if (inner instanceof Error && inner.message !== "") return `${cause.message}: ${inner.message}`;
    return cause.message;
  }
  return String(cause);
}
