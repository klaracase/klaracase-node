import { deprecationMessage, type DeprecationHandler } from "./deprecation.js";
import { ConfigurationError } from "./errors.js";
import { Transport } from "./http.js";
import { Log, resolveLogLevel, type Logger, type LogLevel } from "./log.js";
import { detectRuntime, isBrowser, readEnv } from "./runtime.js";
import { CitationCheckDocuments } from "./resources/citation-check-documents.js";
import { CitationChecks } from "./resources/citation-checks.js";
import { Corpus } from "./resources/corpus.js";
import { Datapackages } from "./resources/datapackages.js";
import { Decisions } from "./resources/decisions.js";
import { Norms } from "./resources/norms.js";
import {
  crossTypeSearch,
  type CrossTypeSearchFilters,
  type CrossTypeSearchResponse,
} from "./resources/search.js";
import type { RequestOptions, WithMeta } from "./types.js";
import { VERSION } from "./version.js";

const DEFAULT_BASE_URL = "https://klaracase.de/api/v1";
const DEFAULT_TIMEOUT_SECONDS = 30;
const DEFAULT_MAX_RETRIES = 2;
const TOKEN_ENV_VAR = "KLARACASE_API_TOKEN";

export interface KlaracaseOptions {
  /** API token (`klc_...`). Falls back to the `KLARACASE_API_TOKEN` environment variable. */
  token?: string | undefined;
  /** Default `https://klaracase.de/api/v1`. */
  baseUrl?: string | undefined;
  /** Seconds to wait for each attempt. Default 30. */
  timeout?: number | undefined;
  /** Retries on 429, on 503 and (GET only) on transport errors. Default 2. */
  maxRetries?: number | undefined;
  /** Appended to the User-Agent header, after a space. */
  userAgentSuffix?: string | undefined;
  /**
   * Headers sent with every request, for example a tracing header. A header passed to one call
   * wins. `Authorization` and `Content-Type` cannot be replaced.
   */
  defaultHeaders?: Record<string, string> | undefined;
  /**
   * What the client logs: `off`, `error`, `warn`, `info` or `debug`. Default `warn`, or the value
   * of the `KLARACASE_LOG` environment variable. `debug` logs every retry (method, path, status,
   * attempt, wait). The token, the headers and the query string are never logged.
   */
  logLevel?: LogLevel | undefined;
  /** Where log lines go. Default `console`. Any object with `error`, `warn`, `info`, `debug`. */
  logger?: Logger | undefined;
  /** A replacement for the global `fetch`. */
  fetch?: typeof fetch | undefined;
  /**
   * Called once per process when an answer carries a `Deprecation` or `Sunset` header. The default
   * logs one line at level `warn` through the logger.
   */
  onDeprecation?: DeprecationHandler | undefined;
  /**
   * Allow the client to be built in a browser page. Off by default. The token is an organization
   * secret: anyone who can open the page can read it. Keep the token on your server and point the
   * `fetch` option at your own route instead.
   */
  dangerouslyAllowBrowser?: boolean | undefined;
  /**
   * Wait for this many seconds. For tests. Default: a timer.
   * @internal
   */
  sleep?: ((seconds: number) => Promise<void>) | undefined;
  /**
   * The clock in seconds. For tests. Default: a monotonic clock.
   * @internal
   */
  now?: (() => number) | undefined;
}

/**
 * The Klaracase API client.
 *
 * ```ts
 * const client = new Klaracase({ token: "klc_your_token_here" });
 * const found = await client.decisions.search("Vermögensbetreuungspflicht", { limit: 5 });
 * ```
 *
 * Every method returns the parsed body with a non-enumerable `meta` property (HTTP status, API
 * release, request duration). Errors extend `KlaracaseError`.
 */
export class Klaracase {
  readonly decisions: Decisions;
  readonly norms: Norms;
  readonly datapackages: Datapackages;
  readonly citationChecks: CitationChecks;
  readonly citationCheckDocuments: CitationCheckDocuments;
  readonly corpus: Corpus;

  private readonly transport: Transport;

  /** Resolved options, kept for {@link Klaracase.withOptions}. ES private: not logged or inspected. */
  readonly #options: KlaracaseOptions;

  constructor(options: KlaracaseOptions = {}) {
    if (isBrowser() && options.dangerouslyAllowBrowser !== true) {
      throw new ConfigurationError(
        "The Klaracase token is an organization secret and must stay on the server. " +
          "This looks like a browser. Call the API from your own backend and give the client a " +
          "`fetch` that points at your route, or pass { dangerouslyAllowBrowser: true } if you " +
          "accept that anyone who opens the page can read the token.",
        "client_validation",
      );
    }
    const token = options.token ?? readEnv(TOKEN_ENV_VAR);
    if (token === undefined || token.trim() === "") {
      throw new ConfigurationError(
        `No API token. Pass { token } or set the ${TOKEN_ENV_VAR} environment variable.`,
      );
    }
    const timeout = options.timeout ?? DEFAULT_TIMEOUT_SECONDS;
    if (!(timeout > 0) || !Number.isFinite(timeout)) {
      throw new ConfigurationError("The timeout must be a positive number of seconds.");
    }
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    if (!Number.isInteger(maxRetries) || maxRetries < 0) {
      throw new ConfigurationError("maxRetries must be a whole number, 0 or more.");
    }
    const sleep = options.sleep ?? defaultSleep;
    const now = options.now ?? defaultNow;
    const log = new Log(resolveLogLevel(options.logLevel), options.logger ?? console);
    const defaultHeaders = { ...options.defaultHeaders };

    this.#options = { ...options, token: token.trim(), defaultHeaders };

    const transport = new Transport(
      {
        baseUrl: normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL),
        timeout,
        maxRetries,
        userAgent: buildUserAgent(options.userAgentSuffix),
        fetch: options.fetch ?? ((input, init) => globalThis.fetch(input, init)),
        sleep,
        now,
        random: Math.random,
        onDeprecation: options.onDeprecation ?? ((info) => log.warn(deprecationMessage(info))),
        defaultHeaders,
        log,
      },
      token.trim(),
    );

    this.transport = transport;
    this.decisions = new Decisions(transport);
    this.norms = new Norms(transport);
    this.datapackages = new Datapackages(transport);
    this.citationChecks = new CitationChecks(transport);
    this.citationCheckDocuments = new CitationCheckDocuments(transport, sleep, now);
    this.corpus = new Corpus(transport);
  }

  /**
   * A new client with these options changed. The original client is not touched, and the two share
   * no mutable state. `defaultHeaders` are merged: a header in `options` wins, the rest stay.
   *
   * ```ts
   * const patient = client.withOptions({ timeout: 120, maxRetries: 4 });
   * ```
   */
  withOptions(options: Partial<KlaracaseOptions>): Klaracase {
    const defined = Object.fromEntries(
      Object.entries(options).filter(([, value]) => value !== undefined),
    ) as Partial<KlaracaseOptions>;
    return new Klaracase({
      ...this.#options,
      ...defined,
      defaultHeaders: { ...this.#options.defaultHeaders, ...options.defaultHeaders },
    });
  }

  /** Search statutes and decisions together. Costs 1 credit. */
  search(
    query: string,
    filters: CrossTypeSearchFilters = {},
    request?: RequestOptions,
  ): Promise<WithMeta<CrossTypeSearchResponse>> {
    return crossTypeSearch(this.transport, query, filters, request);
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new ConfigurationError(`The base URL is not a valid URL: ${baseUrl}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ConfigurationError("The base URL must start with http:// or https://.");
  }
  return baseUrl.replace(/\/+$/, "");
}

function buildUserAgent(suffix: string | undefined): string {
  const base = `klaracase-node/${VERSION} ${detectRuntime()}`;
  return suffix === undefined || suffix === "" ? base : `${base} ${suffix}`;
}

function defaultSleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

function defaultNow(): number {
  return performance.now() / 1000;
}
