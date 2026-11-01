import { describe, expect, expectTypeOf, it } from "vitest";
import {
  CITATION_VERDICTS,
  Klaracase,
  getExtra,
  isKnownVerdict,
  type CitationCheckCreateParams,
  type CitationVerdict,
  type CorpusCoverageOptions,
  type CorpusFacetsOptions,
  type CrossTypeSearchFilters,
  type DatapackageCreateParams,
  type DecisionCitationsOptions,
  type DecisionGetOptions,
  type DecisionSearchFilters,
  type DecisionSearchResponse,
  type NormGetOptions,
  type RequestOptions,
  type ResponseMeta,
  type WithMeta,
} from "../src/index.js";
import searchBody from "./fixtures/conformance/bodies/decisions.search.future_key.json";

describe("request types", () => {
  it("accepts undefined for every optional input, also under exactOptionalPropertyTypes", () => {
    const filters: DecisionSearchFilters = {
      court: undefined,
      branch: undefined,
      document_type: undefined,
      cited_norm: undefined,
      cited_statutes: undefined,
      date_from: undefined,
      date_to: undefined,
      mode: undefined,
      limit: undefined,
      page: undefined,
      bridge: undefined,
    };
    const cross: CrossTypeSearchFilters = { jurisdiction: undefined, limit: undefined };
    const get: DecisionGetOptions = { max_chars: undefined, section: undefined };
    const citations: DecisionCitationsOptions = { direction: undefined, depth: undefined };
    const norm: NormGetOptions = { jurisdiction: undefined };
    const coverage: CorpusCoverageOptions = { branch: undefined, top: undefined };
    const facets: CorpusFacetsOptions = { type: undefined, norm: undefined, prefix: undefined };
    const pack: DatapackageCreateParams = { ids: ["a"], full_text: undefined };
    const check: CitationCheckCreateParams = { text: "x", reference_date: undefined };
    const request: RequestOptions = { signal: undefined, timeout: undefined, headers: undefined };
    expect([
      filters,
      cross,
      get,
      citations,
      norm,
      coverage,
      facets,
      pack,
      check,
      request,
    ]).toHaveLength(10);
  });

  it("types request enums as strict unions", () => {
    expectTypeOf<DecisionSearchFilters["mode"]>().toEqualTypeOf<
      "keyword" | "semantic" | "hybrid" | undefined
    >();
    expectTypeOf<DecisionCitationsOptions["direction"]>().toEqualTypeOf<
      "outgoing" | "incoming" | "both" | undefined
    >();
    expectTypeOf<DecisionCitationsOptions["depth"]>().toEqualTypeOf<1 | 2 | undefined>();
    // @ts-expect-error "fuzzy" is not a retrieval mode
    const bad: DecisionSearchFilters = { mode: "fuzzy" };
    // @ts-expect-error "civil" is not a branch
    const badBranch: CorpusCoverageOptions = { branch: "civil" };
    expect([bad, badBranch]).toHaveLength(2);
  });

  it("keeps response enums open", () => {
    const mode: DecisionSearchResponse["mode"] = "a_mode_from_a_later_release";
    const verdict: CitationVerdict = "a_verdict_from_a_later_release";
    expect([mode, verdict]).toHaveLength(2);
  });
});

describe("response model", () => {
  it("has no index signature, so a typo is a compile error", () => {
    const body = searchBody as unknown as DecisionSearchResponse;
    // @ts-expect-error `totl_available` is not a key
    const typo = body.totl_available;
    expect(typo).toBeUndefined();
  });

  it("reads an undeclared key with getExtra and only own keys", () => {
    const body = { known: 1, future_key: { nested: [1, 2] } };
    expect(getExtra(body, "future_key")).toEqual({ nested: [1, 2] });
    expect(getExtra(body, "missing")).toBeUndefined();
    expect(getExtra(body, "toString")).toBeUndefined();
    expect(getExtra(searchBody, "future_key")).toBeDefined();
  });

  it("keeps meta readonly and carries the headers", () => {
    expectTypeOf<WithMeta<{ a: 1 }>["meta"]>().toEqualTypeOf<ResponseMeta>();
    expectTypeOf<ResponseMeta["headers"]>().toEqualTypeOf<Headers>();
    expectTypeOf<ResponseMeta>().toHaveProperty("headers");
  });

  it("exposes the verdict list and a guard for it", () => {
    expect(CITATION_VERDICTS).toHaveLength(7);
    expect(CITATION_VERDICTS).toContain("not_found");
    expect(isKnownVerdict("verified_corpus")).toBe(true);
    expect(isKnownVerdict("something_new")).toBe(false);
  });

  it("puts the response headers on meta", async () => {
    const client = new Klaracase({
      token: "t",
      fetch: (async () =>
        new Response("{}", {
          status: 200,
          headers: { "X-Klaracase-Api-Release": "0.95.0", "X-Other": "yes" },
        })) as typeof fetch,
    });
    const result = await client.corpus.coverage();
    expect(result.meta.headers.get("x-other")).toBe("yes");
    expect(Object.keys(result)).not.toContain("meta");
    expect(Object.getOwnPropertyDescriptor(result, "meta")?.enumerable).toBe(false);
  });
});
