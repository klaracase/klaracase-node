import { asSchema } from "ai";
import { describe, expect, it, vi } from "vitest";
import {
  checkCitationsInput,
  getDecisionInput,
  getNormInput,
  klaracaseTools,
  searchDecisionsInput,
  type KlaracaseToolClient,
} from "../src/index.js";
import decisionExample from "../../sdk/tests/fixtures/examples/decisions.show.json";
import normExample from "../../sdk/tests/fixtures/examples/norms.show.json";
import runExample from "../../sdk/tests/fixtures/examples/citation-checks.show.json";
import searchExample from "../../sdk/tests/fixtures/examples/decisions.search.json";

function mockClient() {
  const search = vi.fn(async (..._args: unknown[]) => searchExample);
  const getDecision = vi.fn(async (..._args: unknown[]) => decisionExample);
  const getNorm = vi.fn(async (..._args: unknown[]) => normExample);
  const create = vi.fn(async (..._args: unknown[]) => runExample);
  const client = {
    decisions: { search, get: getDecision },
    norms: { get: getNorm },
    citationChecks: { create },
  } as unknown as KlaracaseToolClient;
  return { client, search, getDecision, getNorm, create };
}

const callOptions = { toolCallId: "call-1", messages: [] };

describe("input schemas", () => {
  it("accepts the documented search parameters", () => {
    const parsed = searchDecisionsInput.parse({
      query: "Vermögensbetreuungspflicht",
      branch: "ordentlich",
      cited_statutes: ["StGB", "StPO"],
      date_from: "2015-01-01",
      limit: 5,
      bridge: false,
    });
    expect(parsed.cited_statutes).toEqual(["StGB", "StPO"]);
  });

  it("refuses bad values", () => {
    expect(searchDecisionsInput.safeParse({ query: "x" }).success).toBe(false);
    expect(searchDecisionsInput.safeParse({ query: "Untreue", mode: "fuzzy" }).success).toBe(false);
    expect(
      searchDecisionsInput.safeParse({ query: "Untreue", date_from: "01.01.2015" }).success,
    ).toBe(false);
    expect(searchDecisionsInput.safeParse({ query: "Untreue", limit: 50 }).success).toBe(false);
    expect(getDecisionInput.safeParse({ id: "1 StR 185/01", max_chars: 100 }).success).toBe(false);
    expect(getNormInput.safeParse({ jurisdiction: "DE" }).success).toBe(false);
    expect(checkCitationsInput.safeParse({ text: "too short" }).success).toBe(false);
    expect(checkCitationsInput.safeParse({ text: "x".repeat(20001) }).success).toBe(false);
  });

  it("caps cited_statutes at 5 items, like the server", () => {
    const six = ["StGB", "StPO", "InsO", "DSGVO", "GDPR", "BDSG"];
    expect(
      searchDecisionsInput.safeParse({ query: "Untreue", cited_statutes: six.slice(0, 5) }).success,
    ).toBe(true);
    expect(searchDecisionsInput.safeParse({ query: "Untreue", cited_statutes: six }).success).toBe(
      false,
    );
  });
});

describe("klaracaseTools", () => {
  it("returns all four tools with descriptions and JSON Schema the AI SDK can read", async () => {
    const tools = klaracaseTools(mockClient().client);
    expect(Object.keys(tools).sort()).toEqual([
      "checkCitations",
      "getDecision",
      "getNorm",
      "searchDecisions",
    ]);
    for (const tool of Object.values(tools)) {
      expect(tool.description?.length).toBeGreaterThan(20);
      const json = await asSchema(tool.inputSchema as never).jsonSchema;
      expect(json).toMatchObject({ type: "object" });
    }
  });

  it("returns only the tools asked for and refuses an unknown name", () => {
    const { client } = mockClient();
    expect(Object.keys(klaracaseTools(client, { tools: ["getNorm"] }))).toEqual(["getNorm"]);
    expect(() => klaracaseTools(client, { tools: ["nope" as never] })).toThrow(
      "Unknown Klaracase tool",
    );
  });

  it("searchDecisions passes the query first and the filters second", async () => {
    const { client, search } = mockClient();
    const { searchDecisions } = klaracaseTools(client, { tools: ["searchDecisions"] });
    const result = await searchDecisions.execute?.(
      { query: "Untreue", court: "BGH", limit: 3 },
      callOptions,
    );
    expect(result).toBe(searchExample);
    expect(search).toHaveBeenCalledWith("Untreue", { court: "BGH", limit: 3 }, expect.anything());
  });

  it("getDecision splits the id from the slice options and caps the text at 4000", async () => {
    const { client, getDecision } = mockClient();
    const { getDecision: tool } = klaracaseTools(client, { tools: ["getDecision"] });
    await tool.execute?.(
      { id: "VIII ZR 271/17", section: "Gründe", rn_from: 10, rn_to: 20 },
      callOptions,
    );
    expect(getDecision).toHaveBeenCalledWith(
      "VIII ZR 271/17",
      { section: "Gründe", rn_from: 10, rn_to: 20, max_chars: 4000 },
      expect.anything(),
    );
  });

  it("getNorm passes the reference and the jurisdiction", async () => {
    const { client, getNorm } = mockClient();
    const { getNorm: tool } = klaracaseTools(client, { tools: ["getNorm"] });
    await tool.execute?.({ reference: "Art. 6 DSGVO", jurisdiction: "EU" }, callOptions);
    expect(getNorm).toHaveBeenCalledWith("Art. 6 DSGVO", { jurisdiction: "EU" }, expect.anything());
  });

  it("checkCitations sends text, and the reference date only when given, and returns a slim run", async () => {
    const { client, create } = mockClient();
    const { checkCitations } = klaracaseTools(client, { tools: ["checkCitations"] });
    const text =
      "Der Bundesgerichtshof hat im Urteil vom 15.11.2001 zum Az. 1 StR 185/01 entschieden.";
    const slim = (await checkCitations.execute?.({ text }, callOptions)) as Record<string, unknown>;
    await checkCitations.execute?.({ text, reference_date: "2026-10-01" }, callOptions);
    expect(create).toHaveBeenNthCalledWith(1, { text }, expect.anything());
    expect(create).toHaveBeenNthCalledWith(
      2,
      { text, reference_date: "2026-10-01" },
      expect.anything(),
    );
    expect(Object.keys(slim).sort()).toEqual([
      "findings",
      "id",
      "status",
      "unique_citations",
      "verdict_counts",
    ]);
  });

  it("passes the AI SDK abortSignal to the client as signal", async () => {
    const { client, search } = mockClient();
    const { searchDecisions } = klaracaseTools(client, { tools: ["searchDecisions"] });
    const controller = new AbortController();
    await searchDecisions.execute?.(
      { query: "Untreue" },
      { ...callOptions, abortSignal: controller.signal },
    );
    expect(search.mock.calls[0]?.[2]).toMatchObject({ signal: controller.signal });
  });

  it("returns an API error as { error } and forwards maxChars and the budget", async () => {
    const { client, search } = mockClient();
    const budget = { credits: 0 };
    const { searchDecisions } = klaracaseTools(client, { tools: ["searchDecisions"], budget });
    expect(await searchDecisions.execute?.({ query: "Untreue" }, callOptions)).toMatchObject({
      error: { code: "budget_exceeded" },
    });
    expect(search).not.toHaveBeenCalled();

    const { getNorm } = klaracaseTools(client, { tools: ["getNorm"], maxChars: 500 });
    const result = (await getNorm.execute?.({ reference: "§ 535 BGB" }, callOptions)) as {
      norm: { text: string };
    };
    expect(Array.from(result.norm.text).length).toBeLessThanOrEqual(500);
  });
});
