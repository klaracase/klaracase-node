import { afterEach, describe, expect, it, vi } from "vitest";
import { buildQuery, encodePathSegment } from "../src/encoding.js";
import {
  ConfigurationError,
  Klaracase,
  RateLimitError,
  TimeoutError,
  TransportError,
  VERSION,
  resetDeprecationWarnings,
} from "../src/index.js";
import { MockServer, parseMultipart } from "./helpers/mock-server.js";

const searchBody = JSON.stringify({
  results: [],
  credits: { metered: true, cost: 1, credits_remaining: 9 },
});
const jsonHeaders = { "content-type": "application/json", "x-klaracase-api-release": "0.95.0" };

async function withMock<T>(
  script: ConstructorParameters<typeof MockServer>[0],
  run: (mock: MockServer) => Promise<T>,
): Promise<T> {
  const mock = new MockServer(script);
  await mock.start();
  try {
    return await run(mock);
  } finally {
    await mock.stop();
  }
}

afterEach(() => {
  resetDeprecationWarnings();
  vi.restoreAllMocks();
});

describe("encoding", () => {
  it("encodes every byte outside the unreserved set", () => {
    expect(encodePathSegment("VIII ZR 271/17")).toBe("VIII%20ZR%20271%2F17");
    expect(encodePathSegment("§ 535 BGB")).toBe("%C2%A7%20535%20BGB");
    expect(encodePathSegment("a!b*c'd(e)f~g")).toBe("a%21b%2Ac%27d%28e%29f~g");
  });

  it("sends arrays as name[]=, drops null and keeps false and zero", () => {
    expect(
      buildQuery({
        q: "a b",
        list: ["x", "y"],
        none: null,
        unset: undefined,
        flag: false,
        n: 0,
        empty: [],
      }),
    ).toBe("q=a%20b&list[]=x&list[]=y&flag=false&n=0");
  });
});

describe("construction", () => {
  it("rejects an invalid base URL and a bad timeout", () => {
    expect(() => new Klaracase({ token: "t", baseUrl: "not a url" })).toThrow(ConfigurationError);
    expect(() => new Klaracase({ token: "t", baseUrl: "ftp://example.org" })).toThrow(
      ConfigurationError,
    );
    expect(() => new Klaracase({ token: "t", timeout: 0 })).toThrow(ConfigurationError);
  });

  it("sends the version in the user agent", async () => {
    await withMock([{ status: 200, headers: jsonHeaders, bodyText: searchBody }], async (mock) => {
      const client = new Klaracase({ token: "t", baseUrl: `${mock.baseUrl}/api/v1` });
      await client.decisions.search("x");
      const agent = String(mock.requests[0]?.headers["user-agent"]);
      expect(agent).toMatch(new RegExp(`^klaracase-node/${VERSION} (node|bun|deno)/`));
    });
  });
});

describe("injectable fetch", () => {
  it("uses the fetch option and puts meta on the body without making it enumerable", async () => {
    const fetchMock = vi.fn(
      async () => new Response(searchBody, { status: 200, headers: jsonHeaders }),
    );
    const client = new Klaracase({ token: "t", fetch: fetchMock as unknown as typeof fetch });
    const result = await client.decisions.search("Untreue");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.meta.status).toBe(200);
    expect(result.meta.api_release).toBe("0.95.0");
    expect(Object.keys(result)).not.toContain("meta");
    expect(JSON.stringify(result)).toBe(searchBody);
  });
});

describe("request options", () => {
  it("passes an abort signal through and does not retry it", async () => {
    await withMock(
      [{ status: 200, headers: jsonHeaders, bodyText: searchBody, delaySeconds: 5 }],
      async (mock) => {
        const client = new Klaracase({
          token: "t",
          baseUrl: `${mock.baseUrl}/api/v1`,
          sleep: async () => undefined,
        });
        const controller = new AbortController();
        const pending = client.decisions.search("x", {}, { signal: controller.signal });
        setTimeout(() => controller.abort(new Error("stop")), 50);
        await expect(pending).rejects.toThrow("stop");
        expect(mock.requests).toHaveLength(1);
      },
    );
  });

  it("lets a request override maxRetries and timeout", async () => {
    const problem = JSON.stringify({
      type: "t",
      title: "x",
      status: 503,
      detail: "d",
      code: "backend_unavailable",
    });
    await withMock([{ status: 503, headers: jsonHeaders, bodyText: problem }], async (mock) => {
      const client = new Klaracase({
        token: "t",
        baseUrl: `${mock.baseUrl}/api/v1`,
        sleep: async () => undefined,
      });
      await expect(client.decisions.search("x", {}, { maxRetries: 0 })).rejects.toMatchObject({
        status: 503,
      });
      expect(mock.requests).toHaveLength(1);
    });
    await withMock([{ status: 200, bodyText: searchBody, delaySeconds: 3 }], async (mock) => {
      const client = new Klaracase({
        token: "t",
        baseUrl: `${mock.baseUrl}/api/v1`,
        maxRetries: 0,
      });
      const failure = await client.decisions
        .search("x", {}, { timeout: 0.1 })
        .catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(TimeoutError);
      expect(failure).toBeInstanceOf(TransportError);
    });
  });
});

describe("upload", () => {
  it("accepts a Blob and a File and keeps the file name and type", async () => {
    const receipt = JSON.stringify({
      id: "d",
      status: "uploaded",
      credits: { metered: true, cost: 0, credits_remaining: 1 },
    });
    await withMock(
      [
        { status: 202, headers: jsonHeaders, bodyText: receipt },
        { status: 202, headers: jsonHeaders, bodyText: receipt },
      ],
      async (mock) => {
        const client = new Klaracase({ token: "t", baseUrl: `${mock.baseUrl}/api/v1` });
        const blob = new Blob(["hello"], { type: "text/plain" });
        const first = await client.citationCheckDocuments.upload({
          file: blob,
          filename: "a.txt",
          contentType: "text/plain",
        });
        expect(first.meta.status).toBe(202);
        await client.citationCheckDocuments.upload({
          file: new File(["# hi"], "ignored.md"),
          filename: "b.md",
          contentType: "text/markdown",
        });
        const parts = mock.requests.map((r) =>
          parseMultipart(String(r.headers["content-type"]), r.body),
        );
        expect(parts[0]).toEqual([{ name: "file", filename: "a.txt", content_type: "text/plain" }]);
        expect(parts[1]).toEqual([
          { name: "file", filename: "b.md", content_type: "text/markdown" },
        ]);
      },
    );
  });
});

describe("deprecation hook", () => {
  const deprecated = {
    ...jsonHeaders,
    deprecation: "@1767225600",
    sunset: "Sat, 01 Aug 2026 00:00:00 GMT",
  };

  it("logs one console.warn line per process by default", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await withMock(
      [
        { status: 200, headers: deprecated, bodyText: searchBody },
        { status: 200, headers: deprecated, bodyText: searchBody },
      ],
      async (mock) => {
        const client = new Klaracase({ token: "t", baseUrl: `${mock.baseUrl}/api/v1` });
        await client.decisions.search("x");
        await client.decisions.search("x");
        expect(warn).toHaveBeenCalledTimes(1);
      },
    );
  });

  it("warns again after resetDeprecationWarnings", async () => {
    const calls: unknown[] = [];
    await withMock(
      [
        { status: 200, headers: deprecated, bodyText: searchBody },
        { status: 200, headers: deprecated, bodyText: searchBody },
      ],
      async (mock) => {
        const client = new Klaracase({
          token: "t",
          baseUrl: `${mock.baseUrl}/api/v1`,
          onDeprecation: (info) => calls.push(info),
        });
        await client.decisions.search("x");
        resetDeprecationWarnings();
        await client.decisions.search("x");
        expect(calls).toHaveLength(2);
      },
    );
  });

  it("does not break a served request when the hook throws", async () => {
    await withMock([{ status: 200, headers: deprecated, bodyText: searchBody }], async (mock) => {
      const client = new Klaracase({
        token: "t",
        baseUrl: `${mock.baseUrl}/api/v1`,
        onDeprecation: () => {
          throw new Error("boom");
        },
      });
      await expect(client.decisions.search("x")).resolves.toBeDefined();
    });
  });
});

describe("rate limit error", () => {
  it("falls back to the Retry-After header for its typed field", async () => {
    await withMock(
      [{ status: 429, headers: { "retry-after": "120" }, bodyText: "slow down" }],
      async (mock) => {
        const client = new Klaracase({ token: "t", baseUrl: `${mock.baseUrl}/api/v1` });
        const failure = await client.decisions.search("x").catch((e: unknown) => e);
        expect(failure).toBeInstanceOf(RateLimitError);
        expect((failure as RateLimitError).retry_after_seconds).toBe(120);
        expect(mock.requests).toHaveLength(1);
      },
    );
  });
});
