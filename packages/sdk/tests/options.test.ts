import { inspect } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigurationError, Klaracase, resetDeprecationWarnings } from "../src/index.js";
import type { Logger } from "../src/index.js";

const TOKEN = "klc_secret_token_value";
const body = JSON.stringify({
  results: [],
  credits: { metered: true, cost: 1, credits_remaining: 9 },
});
const problem503 = JSON.stringify({
  type: "t",
  title: "x",
  status: 503,
  detail: "d",
  code: "backend_unavailable",
});

function scripted(
  ...answers: Array<{ status: number; body: string; headers?: Record<string, string> }>
) {
  let index = 0;
  return vi.fn(async (_input: unknown, _init?: unknown) => {
    const answer = answers[Math.min(index++, answers.length - 1)] as (typeof answers)[number];
    return new Response(answer.body, {
      status: answer.status,
      headers: { "content-type": "application/json", ...answer.headers },
    });
  });
}

function recordingLogger() {
  const lines: Array<{ level: string; args: unknown[] }> = [];
  const logger: Logger = {
    error: (...args) => lines.push({ level: "error", args }),
    warn: (...args) => lines.push({ level: "warn", args }),
    info: (...args) => lines.push({ level: "info", args }),
    debug: (...args) => lines.push({ level: "debug", args }),
  };
  return { logger, lines };
}

function sentHeaders(fetchMock: ReturnType<typeof scripted>, call = 0): Record<string, string> {
  return (fetchMock.mock.calls[call]?.[1] as { headers: Record<string, string> }).headers;
}

afterEach(() => {
  vi.unstubAllEnvs();
  resetDeprecationWarnings();
});

describe("headers", () => {
  it("sends defaultHeaders, lets a per-request header win and protects Authorization", async () => {
    const fetchMock = scripted({ status: 200, body });
    const client = new Klaracase({
      token: TOKEN,
      fetch: fetchMock as unknown as typeof fetch,
      defaultHeaders: { "X-Trace": "default", "x-keep": "kept" },
    });
    await client.decisions.search(
      "x",
      {},
      {
        headers: {
          "x-trace": "request",
          Authorization: "Bearer other",
          "Content-Type": "text/plain",
        },
      },
    );
    const headers = sentHeaders(fetchMock);
    expect(headers["x-trace"]).toBe("request");
    expect(headers["X-Trace"]).toBeUndefined();
    expect(headers["x-keep"]).toBe("kept");
    expect(headers["Authorization"]).toBe(`Bearer ${TOKEN}`);
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("copies defaultHeaders, so a later change of the caller's object has no effect", async () => {
    const fetchMock = scripted({ status: 200, body });
    const defaults = { "X-A": "1" };
    const client = new Klaracase({
      token: TOKEN,
      fetch: fetchMock as unknown as typeof fetch,
      defaultHeaders: defaults,
    });
    defaults["X-A"] = "changed";
    await client.corpus.coverage();
    expect(sentHeaders(fetchMock)["X-A"]).toBe("1");
  });
});

describe("withOptions", () => {
  it("returns a new client, merges defaultHeaders and leaves the original alone", async () => {
    const fetchMock = scripted({ status: 200, body }, { status: 200, body });
    const base = new Klaracase({
      token: TOKEN,
      fetch: fetchMock as unknown as typeof fetch,
      defaultHeaders: { "X-A": "base", "X-B": "base" },
      timeout: 5,
    });
    const derived = base.withOptions({
      defaultHeaders: { "X-B": "derived" },
      userAgentSuffix: "app/1",
    });
    expect(derived).not.toBe(base);
    expect(derived.decisions).not.toBe(base.decisions);

    await derived.corpus.coverage();
    await base.corpus.coverage();
    const first = sentHeaders(fetchMock, 0);
    const second = sentHeaders(fetchMock, 1);
    expect(first["X-A"]).toBe("base");
    expect(first["X-B"]).toBe("derived");
    expect(first["User-Agent"]).toMatch(/ app\/1$/);
    expect(first["Authorization"]).toBe(`Bearer ${TOKEN}`);
    expect(second["X-B"]).toBe("base");
    expect(second["User-Agent"]).not.toMatch(/app\/1/);
  });

  it("validates the new options and ignores undefined values", () => {
    const base = new Klaracase({ token: TOKEN, timeout: 5 });
    expect(() => base.withOptions({ timeout: 0 })).toThrow(ConfigurationError);
    expect(() => base.withOptions({ timeout: undefined, baseUrl: undefined })).not.toThrow();
  });
});

describe("logging", () => {
  it("logs every retry at debug with method, path, status, attempt and wait", async () => {
    const { logger, lines } = recordingLogger();
    const fetchMock = scripted(
      { status: 503, body: problem503 },
      { status: 503, body: problem503 },
      { status: 200, body },
    );
    const client = new Klaracase({
      token: TOKEN,
      fetch: fetchMock as unknown as typeof fetch,
      logLevel: "debug",
      logger,
      sleep: async () => undefined,
    });
    await client.decisions.search("geheime suche", { court: "BGH" });
    const retries = lines.filter((line) => line.args[0] === "[klaracase] retry");
    expect(retries).toHaveLength(2);
    expect(retries[0]?.level).toBe("debug");
    expect(retries[0]?.args[1]).toMatchObject({
      method: "GET",
      path: "/decisions/search",
      status: 503,
      attempt: 1,
    });
    expect(retries[1]?.args[1]).toMatchObject({ attempt: 2 });
    expect(typeof (retries[0]?.args[1] as { wait_seconds: unknown }).wait_seconds).toBe("number");
  });

  it("never logs the token, a header, or the query string", async () => {
    const { logger, lines } = recordingLogger();
    const fetchMock = scripted({ status: 503, body: problem503 }, { status: 200, body });
    const client = new Klaracase({
      token: TOKEN,
      fetch: fetchMock as unknown as typeof fetch,
      logLevel: "debug",
      logger,
      defaultHeaders: { "X-Secret-Header": "header-value" },
      sleep: async () => undefined,
    });
    await client.decisions.search("geheime suche");
    const everything = JSON.stringify(lines);
    expect(lines.length).toBeGreaterThan(0);
    expect(everything).not.toContain(TOKEN);
    expect(everything).not.toContain("header-value");
    expect(everything).not.toContain("geheime");
    expect(everything).not.toContain("query=");
  });

  it("logs nothing at debug by default, and one warning for a deprecation", async () => {
    const { logger, lines } = recordingLogger();
    const deprecated = { deprecation: "@1767225600", sunset: "Sat, 01 Aug 2026 00:00:00 GMT" };
    const fetchMock = scripted(
      { status: 503, body: problem503 },
      { status: 200, body, headers: deprecated },
    );
    const client = new Klaracase({
      token: TOKEN,
      fetch: fetchMock as unknown as typeof fetch,
      logger,
      sleep: async () => undefined,
    });
    await client.decisions.search("x");
    expect(lines.map((line) => line.level)).toEqual(["warn"]);
    expect(String(lines[0]?.args[0])).toContain("Sunset: Sat, 01 Aug 2026 00:00:00 GMT");
  });

  it("is silent at level off, even for a deprecation", async () => {
    const { logger, lines } = recordingLogger();
    const fetchMock = scripted({ status: 200, body, headers: { deprecation: "true" } });
    const client = new Klaracase({
      token: TOKEN,
      fetch: fetchMock as unknown as typeof fetch,
      logger,
      logLevel: "off",
    });
    await client.decisions.search("x");
    expect(lines).toEqual([]);
  });

  it("logs one info line per answer at level info", async () => {
    const { logger, lines } = recordingLogger();
    const fetchMock = scripted({ status: 200, body });
    const client = new Klaracase({
      token: TOKEN,
      fetch: fetchMock as unknown as typeof fetch,
      logger,
      logLevel: "info",
    });
    await client.corpus.coverage();
    expect(lines).toHaveLength(1);
    expect(lines[0]?.level).toBe("info");
    expect(String(lines[0]?.args[0])).toBe("[klaracase] GET /corpus/coverage 200");
  });

  it("reads the level from KLARACASE_LOG, lets the option win and ignores a bad value", async () => {
    const { logger, lines } = recordingLogger();
    const make = (logLevel?: "off") =>
      new Klaracase({
        token: TOKEN,
        fetch: scripted({ status: 200, body }) as unknown as typeof fetch,
        logger,
        logLevel,
      });
    vi.stubEnv("KLARACASE_LOG", "info");
    await make().corpus.coverage();
    expect(lines).toHaveLength(1);
    await make("off").corpus.coverage();
    expect(lines).toHaveLength(1);
    vi.stubEnv("KLARACASE_LOG", "loud");
    await make().corpus.coverage();
    expect(lines).toHaveLength(1);
  });

  it("rejects an invalid logLevel option", () => {
    expect(() => new Klaracase({ token: TOKEN, logLevel: "loud" as never })).toThrow(
      ConfigurationError,
    );
  });

  it("survives a logger that throws", async () => {
    const logger: Logger = {
      error: () => undefined,
      warn: () => undefined,
      info: () => {
        throw new Error("logger broke");
      },
      debug: () => undefined,
    };
    const client = new Klaracase({
      token: TOKEN,
      fetch: scripted({ status: 200, body }) as unknown as typeof fetch,
      logger,
      logLevel: "info",
    });
    await expect(client.corpus.coverage()).resolves.toBeDefined();
  });
});

describe("secrecy", () => {
  it("does not show the token when the client is inspected", () => {
    const client = new Klaracase({ token: TOKEN });
    expect(inspect(client, { depth: 6, showHidden: true })).not.toContain(TOKEN);
    expect(JSON.stringify(client)).not.toContain(TOKEN);
  });
});
