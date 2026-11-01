import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ApiError,
  AuthenticationError,
  ConfigurationError,
  ConflictError,
  DocumentFailedError,
  DocumentTimeoutError,
  InsufficientCreditsError,
  Klaracase,
  KlaracaseError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  ServiceUnavailableError,
  TransportError,
  ValidationError,
  resetDeprecationWarnings,
  type DeprecationInfo,
  type KlaracaseOptions,
} from "../src/index.js";
import { MockServer, parseMultipart, type MockResponse } from "./helpers/mock-server.js";
import { parsePath, walk } from "./helpers/paths.js";

const here = dirname(fileURLToPath(import.meta.url));
const conformanceDir = join(here, "fixtures", "conformance");
const casesDir = join(conformanceDir, "cases");
const DEFAULT_TOKEN = "test_token_123";

type Json = Record<string, unknown>;

interface CaseResponse {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
  body_file?: string;
  body_text?: string;
  delay_seconds?: number;
  drop_connection?: boolean;
}

interface ConformanceCase {
  name: string;
  sdk: {
    group: string | null;
    method: string;
    args?: Json;
    options?: Json;
    env?: Record<string, string>;
    repeat?: number;
  };
  expect: {
    request: {
      method: string;
      path: string;
      query: Record<string, string | string[]>;
      headers?: Record<string, string>;
      json?: unknown;
      multipart?: Array<{ name: string; filename: string; content_type: string }>;
      user_agent_suffix?: string;
    } | null;
    request_count: number | { min: number; max: number };
    sleeps?: Array<{ exact?: number; min?: number; max?: number }>;
  };
  responses: CaseResponse[];
  expect_result: {
    kind: "success" | "error";
    assert?: Json;
    class?: string;
    code?: string | null;
    status?: number | null;
    fields?: Json;
    deprecation_warning?: boolean;
    deprecation?: Json;
    deprecation_warning_count?: number;
    body_roundtrip?: boolean;
  };
  runner?: { real_clock?: boolean; repeat_last_response?: boolean };
}

const errorClasses: Record<string, new (...args: never[]) => Error> = {
  ApiError,
  AuthenticationError,
  ConflictError,
  DocumentFailedError,
  DocumentTimeoutError,
  InsufficientCreditsError,
  KlaracaseError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  ServiceUnavailableError,
  TransportError,
  ValidationError,
  ConfigurationError,
};

function loadCases(): ConformanceCase[] {
  return readdirSync(casesDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(casesDir, file), "utf8")) as ConformanceCase);
}

/** Serialise one scripted response the way the case README describes. */
function toMockResponse(response: CaseResponse): MockResponse {
  if (response.drop_connection) return { dropConnection: true };
  let bodyText: string | undefined;
  if (response.body_file !== undefined) {
    bodyText = readFileSync(resolve(casesDir, response.body_file), "utf8");
  } else if (response.body_text !== undefined) {
    bodyText = response.body_text;
  } else if (response.body !== undefined) {
    bodyText = JSON.stringify(response.body);
  }
  return {
    status: response.status,
    headers: response.headers,
    bodyText,
    delaySeconds: response.delay_seconds,
  };
}

/** Map an argument object (API names) to the SDK's argument names and drop null values. */
function cleanArgs(args: Json): Json {
  return Object.fromEntries(Object.entries(args).filter(([, value]) => value !== null));
}

function omit(args: Json, ...keys: string[]): Json {
  return Object.fromEntries(Object.entries(args).filter(([key]) => !keys.includes(key)));
}

function resolveFile(value: unknown): unknown {
  if (typeof value === "object" && value !== null && "$file" in value) {
    const path = join(conformanceDir, (value as { $file: string }).$file);
    return new Uint8Array(readFileSync(path));
  }
  return value;
}

/** Call the SDK method named by the case. */
async function invoke(client: Klaracase, sdk: ConformanceCase["sdk"]): Promise<unknown> {
  const args = cleanArgs(sdk.args ?? {});
  const key = `${sdk.group ?? ""}.${sdk.method}`;
  switch (key) {
    case ".search":
      return client.search(args["query"] as string, omit(args, "query"));
    case "decisions.search":
      return client.decisions.search(args["query"] as string, omit(args, "query"));
    case "decisions.get":
      return client.decisions.get(args["id"] as string, omit(args, "id"));
    case "decisions.citations":
      return client.decisions.citations(args["id"] as string, omit(args, "id"));
    case "norms.get":
      return client.norms.get(args["reference"] as string, omit(args, "reference"));
    case "datapackages.create":
      return client.datapackages.create(args as never);
    case "citation_checks.create":
      return client.citationChecks.create(args as never);
    case "citation_checks.get":
      return client.citationChecks.get(args["run_id"] as string);
    case "citation_check_documents.upload":
      return client.citationCheckDocuments.upload({
        file: resolveFile(args["file"]) as Uint8Array,
        filename: args["filename"] as string,
        contentType: args["content_type"] as string,
      });
    case "citation_check_documents.get":
      return client.citationCheckDocuments.get(args["document_id"] as string);
    case "citation_check_documents.wait_until_ready":
      return client.citationCheckDocuments.waitUntilReady(args["document_id"] as string, {
        pollInterval: args["poll_interval"] as number | undefined,
        timeout: args["timeout"] as number | undefined,
      });
    case "corpus.coverage":
      return client.corpus.coverage(args);
    case "corpus.facets":
      return client.corpus.facets(args["field"] as string, omit(args, "field"));
    default:
      throw new Error(`The runner has no mapping for ${key}.`);
  }
}

function matchesMatcher(actual: unknown, matcher: Json): void {
  for (const [name, expected] of Object.entries(matcher)) {
    switch (name) {
      case "$type": {
        const type = Array.isArray(actual) ? "array" : actual === null ? "null" : typeof actual;
        expect(type).toBe(expected);
        break;
      }
      case "$min":
        expect(actual as number).toBeGreaterThanOrEqual(expected as number);
        break;
      case "$length":
        expect((actual as string | unknown[]).length).toBe(expected);
        break;
      case "$contains":
        expect(actual as string).toContain(expected as string);
        break;
      case "$starts_with":
        expect((actual as string).startsWith(expected as string)).toBe(true);
        break;
      default:
        throw new Error(`Unknown matcher ${name}`);
    }
  }
}

function assertValue(path: string, actual: unknown, expected: unknown): void {
  const isMatcher =
    typeof expected === "object" &&
    expected !== null &&
    !Array.isArray(expected) &&
    Object.keys(expected).length > 0 &&
    Object.keys(expected).every((key) => key.startsWith("$"));
  if (isMatcher) {
    matchesMatcher(actual, expected as Json);
    return;
  }
  expect(actual, `at ${path}`).toEqual(expected);
}

/** `extra.x` on a success result is the unknown top-level key `x`. */
function resolveOnResult(result: unknown, path: string): unknown {
  const steps = parsePath(path);
  if (steps[0] === "extra") return walk(result, steps.slice(1));
  return walk(result, steps);
}

/** On an error, a bare name means the typed field, else the same name inside `extra`. */
function resolveOnError(error: KlaracaseError | Error, path: string): unknown {
  const steps = parsePath(path);
  const direct = walk(error, steps);
  if (direct !== undefined) return direct;
  const extra = (error as KlaracaseError).extra;
  if (extra === undefined) return undefined;
  return walk(extra, steps);
}

function checkSleeps(expected: NonNullable<ConformanceCase["expect"]["sleeps"]>, slept: number[]) {
  expect(slept).toHaveLength(expected.length);
  expected.forEach((want, index) => {
    const got = slept[index] as number;
    if (want.exact !== undefined) {
      expect(got).toBeCloseTo(want.exact, 6);
      return;
    }
    expect(got).toBeGreaterThanOrEqual(want.min as number);
    expect(got).toBeLessThanOrEqual(want.max as number);
  });
}

function checkRequest(
  want: NonNullable<ConformanceCase["expect"]["request"]>,
  got: {
    method: string;
    target: string;
    headers: Record<string, string | string[] | undefined>;
    body: Buffer;
  },
  suffix: string | undefined,
) {
  expect(got.method).toBe(want.method);

  const [rawPath = "", rawQuery = ""] = got.target.split("?");
  expect(rawPath).toBe(`/api/v1${want.path}`);

  const wire = new Map<string, string[]>();
  for (const [name, value] of new URLSearchParams(rawQuery)) {
    wire.set(name, [...(wire.get(name) ?? []), value]);
  }
  const wantedWire = new Map<string, string[]>();
  for (const [name, value] of Object.entries(want.query)) {
    wantedWire.set(name, Array.isArray(value) ? value : [value]);
  }
  expect([...wire.keys()].sort()).toEqual([...wantedWire.keys()].sort());
  for (const [name, values] of wantedWire) expect(wire.get(name)).toEqual(values);

  const headers = got.headers;
  const wantedHeaders = Object.fromEntries(
    Object.entries(want.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  );
  for (const [name, value] of Object.entries(wantedHeaders)) {
    const actual = headers[name];
    expect(actual, `header ${name}`).toBeDefined();
    if (name === "user-agent") {
      expect(String(actual).startsWith(value)).toBe(true);
      if (suffix !== undefined) expect(String(actual).endsWith(` ${suffix}`)).toBe(true);
      continue;
    }
    if (name === "content-type") {
      expect(String(actual).split(";")[0]?.trim().toLowerCase()).toBe(value);
      continue;
    }
    expect(actual).toBe(value);
  }
  if (!("content-type" in wantedHeaders)) expect(headers["content-type"]).toBeUndefined();

  if (want.json !== undefined) expect(JSON.parse(got.body.toString("utf8"))).toEqual(want.json);
  if (want.multipart !== undefined) {
    expect(parseMultipart(String(headers["content-type"]), got.body)).toEqual(want.multipart);
  }
}

describe("conformance pack", () => {
  const saved = process.env["KLARACASE_API_TOKEN"];
  beforeEach(() => {
    delete process.env["KLARACASE_API_TOKEN"];
    resetDeprecationWarnings();
  });
  afterEach(() => {
    if (saved === undefined) delete process.env["KLARACASE_API_TOKEN"];
    else process.env["KLARACASE_API_TOKEN"] = saved;
  });

  const cases = loadCases();

  it("loads every case of the pack", () => {
    expect(cases).toHaveLength(106);
  });

  for (const testCase of cases) {
    it(testCase.name, async () => {
      for (const [name, value] of Object.entries(testCase.sdk.env ?? {})) {
        process.env[name] = value;
      }

      const mock = new MockServer(testCase.responses.map(toMockResponse), {
        repeatLast: testCase.runner?.repeat_last_response === true,
      });
      await mock.start();
      try {
        const slept: number[] = [];
        const warnings: DeprecationInfo[] = [];
        const options = testCase.sdk.options ?? {};
        const token = "token" in options ? (options["token"] as string | null) : DEFAULT_TOKEN;
        const clientOptions: KlaracaseOptions = {
          baseUrl: `${mock.baseUrl}/api/v1${options["base_url_trailing_slash"] ? "/" : ""}`,
          onDeprecation: (info) => warnings.push(info),
        };
        if (token !== null) clientOptions.token = token;
        if (options["max_retries"] !== undefined)
          clientOptions.maxRetries = options["max_retries"] as number;
        if (options["timeout"] !== undefined) clientOptions.timeout = options["timeout"] as number;
        if (options["user_agent_suffix"] !== undefined) {
          clientOptions.userAgentSuffix = options["user_agent_suffix"] as string;
        }
        if (testCase.runner?.real_clock !== true) {
          clientOptions.sleep = async (seconds) => {
            slept.push(seconds);
          };
        }

        let result: unknown;
        let failure: unknown;
        try {
          const client = new Klaracase(clientOptions);
          for (let i = 0; i < (testCase.sdk.repeat ?? 1); i++) {
            result = await invoke(client, testCase.sdk);
          }
        } catch (error) {
          failure = error;
        }

        // Request side.
        const wantCount = testCase.expect.request_count;
        if (typeof wantCount === "number") expect(mock.requests).toHaveLength(wantCount);
        else {
          expect(mock.requests.length).toBeGreaterThanOrEqual(wantCount.min);
          expect(mock.requests.length).toBeLessThanOrEqual(wantCount.max);
        }
        if (testCase.expect.request === null) expect(mock.requests).toHaveLength(0);
        else {
          for (const request of mock.requests) {
            checkRequest(
              testCase.expect.request,
              request,
              testCase.expect.request.user_agent_suffix,
            );
          }
        }
        if (testCase.expect.sleeps !== undefined && testCase.runner?.real_clock !== true) {
          checkSleeps(testCase.expect.sleeps, slept);
        }

        // Result side.
        const want = testCase.expect_result;
        if (want.kind === "success") {
          if (failure !== undefined) throw failure;
          for (const [path, expected] of Object.entries(want.assert ?? {})) {
            assertValue(path, resolveOnResult(result, path), expected);
          }
          if (want.body_roundtrip) {
            const served =
              testCase.responses[Math.min(mock.requests.length, testCase.responses.length) - 1];
            const servedText = toMockResponse(served as CaseResponse).bodyText as string;
            expect(JSON.stringify(result)).toBe(JSON.stringify(JSON.parse(servedText)));
          }
        } else {
          expect(failure, "the call should have failed").toBeDefined();
          const error = failure as Error;
          const errorClass = errorClasses[want.class as string];
          expect(errorClass, `unknown class ${want.class}`).toBeDefined();
          expect(error).toBeInstanceOf(errorClass);
          if (want.class === "ConfigurationError") {
            expect(error).not.toBeInstanceOf(KlaracaseError);
          } else {
            expect(error).toBeInstanceOf(KlaracaseError);
            const klaracaseError = error as KlaracaseError;
            if (want.code !== undefined) expect(klaracaseError.code).toBe(want.code);
            if (want.status !== undefined) expect(klaracaseError.status).toBe(want.status);
            checkProblemMembers(testCase, mock.requests.length, klaracaseError);
          }
          for (const [path, expected] of Object.entries(want.fields ?? {})) {
            assertValue(path, resolveOnError(error, path), expected);
          }
        }

        // Deprecation hook.
        if (want.deprecation_warning !== undefined) {
          expect(warnings.length > 0).toBe(want.deprecation_warning);
        }
        if (want.deprecation_warning_count !== undefined) {
          expect(warnings).toHaveLength(want.deprecation_warning_count);
        }
        if (want.deprecation !== undefined) {
          expect(warnings[0]).toEqual(want.deprecation);
        }
      } finally {
        await mock.stop();
      }
    });
  }
});

/** The checks the README applies to every error that comes from a problem body. */
function checkProblemMembers(
  testCase: ConformanceCase,
  requestCount: number,
  error: KlaracaseError,
) {
  if (error.status === null || requestCount === 0) return;
  const served = testCase.responses[Math.min(requestCount, testCase.responses.length) - 1];
  if (served === undefined) return;
  const text = toMockResponse(served).bodyText;
  let body: unknown;
  try {
    body = JSON.parse(text ?? "");
  } catch {
    return;
  }
  if (typeof body !== "object" || body === null || typeof (body as Json)["code"] !== "string")
    return;

  const problem = body as Json;
  const { type, title, status, detail, code, ...rest } = problem;
  expect(error.type).toBe(type);
  expect(error.title).toBe(title);
  expect(error.detail).toBe(detail);
  expect(error.code).toBe(code);
  expect(error.status).toBe(served.status);
  expect(status).toBe(problem["status"]);
  expect(error.extra).toEqual(rest);
  const release = served.headers?.["x-klaracase-api-release"];
  expect(error.api_release).toBe(release ?? null);
}
