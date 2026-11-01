import { describe, expect, it, vi } from "vitest";
import {
  AuthenticationError,
  Klaracase,
  KlaracaseError,
  RateLimitError,
  type CitationCheckRun,
} from "../src/index.js";
import { callTool, tools, type ToolBudget, type ToolClient } from "../src/tools/index.js";
import budgetEmpty from "./fixtures/conformance/problems/insufficient_credits.api_budget_empty.json";
import tokenLimitReached from "./fixtures/conformance/problems/token_limit_reached.json";
import runExample from "./fixtures/examples/citation-checks.show.json";
import decisionExample from "./fixtures/examples/decisions.show.json";
import normExample from "./fixtures/examples/norms.show.json";
import searchExample from "./fixtures/examples/decisions.search.json";

function mockClient() {
  const search = vi.fn(async (..._args: unknown[]) => searchExample);
  const get = vi.fn(async (..._args: unknown[]) => decisionExample);
  const norm = vi.fn(async (..._args: unknown[]) => normExample);
  const create = vi.fn(async (..._args: unknown[]) => runExample);
  const client = {
    decisions: { search, get },
    norms: { get: norm },
    citationChecks: { create },
  } as unknown as ToolClient;
  return { client, search, get, norm, create };
}

describe("tools", () => {
  it("has four tools with names, descriptions and JSON Schema inputs", () => {
    expect(tools.map((tool) => tool.name)).toEqual([
      "searchDecisions",
      "getDecision",
      "getNorm",
      "checkCitations",
    ]);
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema["type"]).toBe("object");
      expect(Array.isArray(tool.inputSchema["required"])).toBe(true);
    }
  });

  it("states what not_found means, in plain words", () => {
    const check = tools.find((tool) => tool.name === "checkCitations");
    expect(check?.description).toContain("not invented");
  });

  it("JSON.stringify of the definitions needs no zod and is plain JSON", () => {
    expect(JSON.parse(JSON.stringify(tools))).toEqual(tools);
  });
});

describe("callTool dispatch", () => {
  it("searchDecisions passes the query first and the filters second", async () => {
    const { client, search } = mockClient();
    const result = await callTool(client, "searchDecisions", {
      query: "Untreue",
      court: "BGH",
      limit: 3,
    });
    expect(search).toHaveBeenCalledWith("Untreue", { court: "BGH", limit: 3 }, {});
    expect(result).toBe(searchExample);
  });

  it("getDecision defaults max_chars to 4000 and splits the id", async () => {
    const { client, get } = mockClient();
    await callTool(client, "getDecision", { id: "VIII ZR 271/17", section: "Gründe" });
    expect(get).toHaveBeenCalledWith("VIII ZR 271/17", { section: "Gründe", max_chars: 4000 }, {});
  });

  it("getDecision caps max_chars at maxChars and never goes below the API minimum", async () => {
    const { client, get } = mockClient();
    await callTool(client, "getDecision", { id: "a", max_chars: 40000 });
    expect(get).toHaveBeenLastCalledWith("a", { max_chars: 4000 }, {});
    await callTool(client, "getDecision", { id: "a", max_chars: 1000 }, { maxChars: 2500 });
    expect(get).toHaveBeenLastCalledWith("a", { max_chars: 1000 }, {});
    await callTool(client, "getDecision", { id: "a" }, { maxChars: 100 });
    expect(get).toHaveBeenLastCalledWith("a", { max_chars: 500 }, {});
  });

  it("getNorm cuts a long norm text to maxChars and says so", async () => {
    const { client, norm } = mockClient();
    const result = (await callTool(
      client,
      "getNorm",
      { reference: "§ 535 BGB" },
      { maxChars: 500 },
    )) as {
      norm: { text: string; text_truncated?: boolean };
    };
    expect(norm).toHaveBeenCalledWith("§ 535 BGB", {}, {});
    const original = normExample.norm.text;
    if (Array.from(original).length > 500) {
      expect(Array.from(result.norm.text)).toHaveLength(500);
      expect(result.norm.text_truncated).toBe(true);
    } else {
      expect(result.norm.text).toBe(original);
    }
  });

  it("getNorm leaves a short text alone", async () => {
    const { client } = mockClient();
    const result = (await callTool(client, "getNorm", { reference: "§ 535 BGB" })) as {
      norm: { text: string; text_truncated?: boolean };
    };
    expect(result.norm.text_truncated).toBeUndefined();
  });

  it("checkCitations sends text and the reference date only when given", async () => {
    const { client, create } = mockClient();
    const text = "x".repeat(60);
    await callTool(client, "checkCitations", { text });
    await callTool(client, "checkCitations", { text, reference_date: "2026-10-01" });
    expect(create).toHaveBeenNthCalledWith(1, { text }, {});
    expect(create).toHaveBeenNthCalledWith(2, { text, reference_date: "2026-10-01" }, {});
  });

  it("checkCitations returns a slim object", async () => {
    const { client } = mockClient();
    const result = (await callTool(client, "checkCitations", { text: "x".repeat(60) })) as Record<
      string,
      unknown
    >;
    const run = runExample as unknown as CitationCheckRun;
    expect(Object.keys(result).sort()).toEqual([
      "findings",
      "id",
      "status",
      "unique_citations",
      "verdict_counts",
    ]);
    expect(result["status"]).toBe(run.status);
    expect(result["verdict_counts"]).toEqual(run.verdict_counts);
    const findings = result["findings"] as Array<Record<string, unknown>>;
    expect(findings).toHaveLength(run.findings.length);
    expect(Object.keys(findings[0] as object).sort()).toEqual([
      "canonical",
      "end_offset",
      "id",
      "raw_text",
      "start_offset",
      "verdict",
    ]);
  });

  it("passes signal, timeout and headers to the client", async () => {
    const { client, search } = mockClient();
    const controller = new AbortController();
    await callTool(
      client,
      "searchDecisions",
      { query: "Untreue" },
      { signal: controller.signal, timeout: 5, headers: { "X-A": "1" } },
    );
    expect(search).toHaveBeenCalledWith(
      "Untreue",
      {},
      { signal: controller.signal, timeout: 5, headers: { "X-A": "1" } },
    );
  });
});

describe("callTool errors", () => {
  it("returns an unknown tool and bad arguments as errors the model can read", async () => {
    const { client, search } = mockClient();
    expect(await callTool(client, "dropTables", {})).toEqual({
      error: { code: "unknown_tool", detail: expect.any(String), retry_after_seconds: null },
    });
    expect(await callTool(client, "searchDecisions", {})).toMatchObject({
      error: { code: "invalid_arguments" },
    });
    expect(await callTool(client, "searchDecisions", "Untreue")).toMatchObject({
      error: { code: "invalid_arguments" },
    });
    expect(await callTool(client, "searchDecisions", { query: 5 })).toMatchObject({
      error: { code: "invalid_arguments" },
    });
    expect(search).not.toHaveBeenCalled();
  });

  it("converts an API error into { error: { code, detail, retry_after_seconds } }", async () => {
    const { client, search } = mockClient();
    search.mockRejectedValueOnce(
      new RateLimitError({
        status: 429,
        code: "rate_limited",
        detail: "Too many requests.",
        extra: { retry_after_seconds: 42 },
      }),
    );
    expect(await callTool(client, "searchDecisions", { query: "Untreue" })).toEqual({
      error: { code: "rate_limited", detail: "Too many requests.", retry_after_seconds: 42 },
    });
    search.mockRejectedValueOnce(
      new AuthenticationError({ status: 401, code: "unauthenticated", detail: "No." }),
    );
    expect(await callTool(client, "searchDecisions", { query: "Untreue" })).toEqual({
      error: { code: "unauthenticated", detail: "No.", retry_after_seconds: null },
    });
  });

  it("converts a real client error end to end", async () => {
    const real = new Klaracase({
      token: "t",
      maxRetries: 0,
      fetch: (async () =>
        new Response(
          JSON.stringify({
            type: "t",
            title: "x",
            status: 402,
            detail: "No credits left.",
            code: "insufficient_credits",
            cost: 1,
            balance: 0,
          }),
          { status: 402, headers: { "content-type": "application/problem+json" } },
        )) as typeof fetch,
    });
    expect(await callTool(real, "getNorm", { reference: "§ 1 BGB" })).toEqual({
      error: {
        code: "insufficient_credits",
        detail: "No credits left.",
        retry_after_seconds: null,
      },
    });
  });

  it.each([
    ["token_limit_reached", tokenLimitReached],
    ["insufficient_credits", budgetEmpty],
  ])("returns %s once, without a retry, for the model to report", async (code, problem) => {
    let calls = 0;
    const real = new Klaracase({
      token: "t",
      maxRetries: 2,
      sleep: async () => undefined,
      fetch: (async () => {
        calls += 1;
        return new Response(JSON.stringify(problem), {
          status: 402,
          headers: { "content-type": "application/problem+json" },
        });
      }) as typeof fetch,
    });
    expect(await callTool(real, "searchDecisions", { query: "Untreue" })).toEqual({
      error: { code, detail: problem.detail, retry_after_seconds: null },
    });
    expect(calls).toBe(1);
  });

  it("throws what is not an API error, such as an abort", async () => {
    const { client, search } = mockClient();
    search.mockRejectedValueOnce(new DOMException("stop", "AbortError"));
    await expect(callTool(client, "searchDecisions", { query: "Untreue" })).rejects.toThrow("stop");
    search.mockRejectedValueOnce(new TypeError("bug"));
    await expect(callTool(client, "searchDecisions", { query: "Untreue" })).rejects.toThrow("bug");
    expect(KlaracaseError.is(new TypeError("x"))).toBe(false);
  });
});

describe("callTool budget", () => {
  it("takes the cost of each answer off the budget", async () => {
    const { client } = mockClient();
    const budget: ToolBudget = { credits: 3 };
    await callTool(client, "searchDecisions", { query: "Untreue" }, { budget });
    expect(budget.credits).toBe(3 - searchExample.credits.cost);
  });

  it("refuses a call that does not fit and sends nothing", async () => {
    const { client, search, create } = mockClient();
    const budget: ToolBudget = { credits: 1 };
    const result = await callTool(client, "checkCitations", { text: "x".repeat(60) }, { budget });
    expect(result).toMatchObject({ error: { code: "budget_exceeded" } });
    expect(create).not.toHaveBeenCalled();
    expect(budget.credits).toBe(1);

    budget.credits = 0;
    expect(
      await callTool(client, "searchDecisions", { query: "Untreue" }, { budget }),
    ).toMatchObject({
      error: { code: "budget_exceeded" },
    });
    expect(search).not.toHaveBeenCalled();
  });

  it("prices a long check by length", async () => {
    const { client, create } = mockClient();
    const budget: ToolBudget = { credits: 3 };
    const result = await callTool(
      client,
      "checkCitations",
      { text: "x".repeat(20000) },
      { budget },
    );
    expect(result).toMatchObject({ error: { code: "budget_exceeded" } });
    expect(create).not.toHaveBeenCalled();
  });
});
