import { describe, expect, it, vi } from "vitest";
import {
  checkCitationsInput,
  getDecisionInput,
  getNormInput,
  klaracaseTools,
  searchDecisionsInput,
  type KlaracaseToolClient,
} from "../src/index.js";

function mockClient() {
  const answer = { ok: true };
  const search = vi.fn(async () => answer);
  const getDecision = vi.fn(async () => answer);
  const getNorm = vi.fn(async () => answer);
  const create = vi.fn(async () => answer);
  const client = {
    decisions: { search, get: getDecision },
    norms: { get: getNorm },
    citationChecks: { create },
  } as unknown as KlaracaseToolClient;
  return { client, search, getDecision, getNorm, create, answer };
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
    expect(getDecisionInput.safeParse({ id: "1 StR 185/01", section: "Rubrum" }).success).toBe(
      false,
    );
    expect(getDecisionInput.safeParse({ id: "1 StR 185/01", max_chars: 100 }).success).toBe(false);
    expect(getNormInput.safeParse({ reference: "§ 535 BGB", jurisdiction: "XI" }).success).toBe(
      false,
    );
    expect(checkCitationsInput.safeParse({ text: "too short" }).success).toBe(false);
    expect(checkCitationsInput.safeParse({ text: "x".repeat(20001) }).success).toBe(false);
  });
});

describe("klaracaseTools", () => {
  it("returns all four tools with descriptions and schemas", () => {
    const tools = klaracaseTools(mockClient().client);
    expect(Object.keys(tools).sort()).toEqual([
      "checkCitations",
      "getDecision",
      "getNorm",
      "searchDecisions",
    ]);
    for (const tool of Object.values(tools)) {
      expect(tool.description?.length).toBeGreaterThan(20);
      expect(tool.inputSchema).toBeDefined();
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
    const { client, search, answer } = mockClient();
    const { searchDecisions } = klaracaseTools(client, { tools: ["searchDecisions"] });
    const result = await searchDecisions.execute?.(
      { query: "Untreue", court: "BGH", limit: 3 },
      callOptions,
    );
    expect(result).toBe(answer);
    expect(search).toHaveBeenCalledWith("Untreue", { court: "BGH", limit: 3 });
  });

  it("getDecision splits the id from the slice options", async () => {
    const { client, getDecision } = mockClient();
    const { getDecision: tool } = klaracaseTools(client, { tools: ["getDecision"] });
    await tool.execute?.(
      { id: "VIII ZR 271/17", section: "Gründe", rn_from: 10, rn_to: 20 },
      callOptions,
    );
    expect(getDecision).toHaveBeenCalledWith("VIII ZR 271/17", {
      section: "Gründe",
      rn_from: 10,
      rn_to: 20,
    });
  });

  it("getNorm passes the reference and the jurisdiction", async () => {
    const { client, getNorm } = mockClient();
    const { getNorm: tool } = klaracaseTools(client, { tools: ["getNorm"] });
    await tool.execute?.({ reference: "Art. 6 DSGVO", jurisdiction: "EU" }, callOptions);
    expect(getNorm).toHaveBeenCalledWith("Art. 6 DSGVO", { jurisdiction: "EU" });
  });

  it("checkCitations sends text, and the reference date only when given", async () => {
    const { client, create } = mockClient();
    const { checkCitations } = klaracaseTools(client, { tools: ["checkCitations"] });
    const text =
      "Der Bundesgerichtshof hat im Urteil vom 15.11.2001 zum Az. 1 StR 185/01 entschieden.";
    await checkCitations.execute?.({ text }, callOptions);
    await checkCitations.execute?.({ text, reference_date: "2026-10-01" }, callOptions);
    expect(create).toHaveBeenNthCalledWith(1, { text });
    expect(create).toHaveBeenNthCalledWith(2, { text, reference_date: "2026-10-01" });
  });
});
