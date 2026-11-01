import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigurationError, Klaracase } from "../src/index.js";
import { detectRuntime, isBrowser, readEnv } from "../src/runtime.js";

/** `Bun` and `Deno` are not configurable on their own runtimes, so detector tests use a fake host. */
const host = (globals: object = {}): object => ({ ...globals });

function recordingFetch() {
  return vi.fn(
    async () =>
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
  );
}

async function userAgentOf(client: Klaracase, fetchMock: ReturnType<typeof vi.fn>) {
  await client.corpus.coverage();
  const init = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> };
  return init.headers["User-Agent"] as string;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runtime detection", () => {
  it("names Deno first, then Bun", () => {
    const bun = { Bun: { version: "1.4.0" } };
    expect(detectRuntime(host(bun))).toBe("bun/1.4.0");
    expect(detectRuntime(host({ ...bun, Deno: { version: { deno: "2.1.0" } } }))).toBe(
      "deno/2.1.0",
    );
  });

  it("names Vercel Edge and Cloudflare Workers", () => {
    expect(detectRuntime(host({ EdgeRuntime: "edge-runtime" }))).toBe("vercel-edge/unknown");
    expect(detectRuntime(host({ navigator: { userAgent: "Cloudflare-Workers" } }))).toBe(
      "cloudflare-workers/unknown",
    );
  });

  it("names Node from process.versions.node", () => {
    expect(detectRuntime(host({ process: { versions: { node: "22.1.0" } } }))).toBe("node/22.1.0");
  });

  it("falls back to unknown and never throws when process is missing", () => {
    expect(detectRuntime(host())).toBe("unknown/unknown");
  });

  it("does not throw when process has no versions", () => {
    expect(detectRuntime(host({ process: { env: {} } }))).toBe("unknown/unknown");
  });

  it("names a browser when window and document exist", () => {
    const page = host({ window: {}, document: {} });
    expect(isBrowser(page)).toBe(true);
    expect(detectRuntime(page)).toBe("browser/unknown");
    expect(isBrowser(host({ window: {} }))).toBe(false);
  });

  it("survives a global that throws on access", () => {
    const hostile = {
      get process(): never {
        throw new Error("denied");
      },
    };
    expect(detectRuntime(hostile)).toBe("unknown/unknown");
    expect(isBrowser(hostile)).toBe(false);
    expect(readEnv("X", hostile)).toBeUndefined();
  });

  it("reads the environment from process.env or Deno.env, and nothing when both are missing", () => {
    const name = "KLARACASE_API_TOKEN";
    expect(readEnv(name, host({ process: { env: { [name]: "a" } } }))).toBe("a");
    expect(readEnv(name, host({ Deno: { env: { get: () => "b" } } }))).toBe("b");
    expect(readEnv(name, host())).toBeUndefined();
  });
});

describe("client on hosts without process", () => {
  it("builds with a token and sends a User-Agent when process is missing", async () => {
    vi.stubGlobal("process", undefined);
    const fetchMock = recordingFetch();
    const client = new Klaracase({ token: "t", fetch: fetchMock as unknown as typeof fetch });
    vi.unstubAllGlobals();
    expect(await userAgentOf(client, fetchMock)).toMatch(/^klaracase-node\/0\.1\.0 \S+\/\S+/);
  });

  it("reports a missing token as ConfigurationError, not a TypeError, without process", () => {
    vi.stubGlobal("process", undefined);
    expect(() => new Klaracase()).toThrow(ConfigurationError);
  });

  it("builds when process has no versions", () => {
    vi.stubGlobal("process", { env: {} });
    expect(() => new Klaracase({ token: "t" })).not.toThrow();
  });
});

describe("browser guard", () => {
  function fakeBrowser(): void {
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {});
  }

  it("refuses to build in a browser and names the option", () => {
    fakeBrowser();
    let failure: unknown;
    try {
      new Klaracase({ token: "klc_your_token_here" });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(ConfigurationError);
    const error = failure as ConfigurationError;
    expect(error.code).toBe("client_validation");
    expect(error.message).toContain("organization secret");
    expect(error.message).toContain("must stay on the server");
    expect(error.message).toContain("dangerouslyAllowBrowser");
    expect(error.message).not.toContain("klc_your_token_here");
  });

  it("builds in a browser only with dangerouslyAllowBrowser", () => {
    fakeBrowser();
    expect(() => new Klaracase({ token: "t", dangerouslyAllowBrowser: true })).not.toThrow();
  });

  it("does not trip on a window without a document", () => {
    vi.stubGlobal("window", {});
    expect(() => new Klaracase({ token: "t" })).not.toThrow();
  });
});
