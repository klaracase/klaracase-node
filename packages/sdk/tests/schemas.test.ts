import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as z from "zod/mini";
import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  AssembleDatapackageInput,
  CheckCitationsInput,
  CitationCheckCreateParams,
  CitationCheckRun,
  Count,
  CorpusCoverageInput,
  CorpusCoverageResponse,
  CorpusFacetsResponse,
  CrossTypeSearchFilters,
  CrossTypeSearchInput,
  CrossTypeSearchResponse,
  Credits,
  DatapackageCreateParams,
  DatapackageResponse,
  DecisionCitationsOptions,
  DecisionCitationsResponse,
  DecisionGetOptions,
  DecisionResponse,
  DecisionSearchFilters,
  DecisionSearchResponse,
  DocumentReceipt,
  CorpusCoverageOptions,
  CorpusFacetsOptions,
  GetCitationCheckInput,
  GetCitationGraphInput,
  GetDecisionInput,
  GetDocumentInput,
  GetNormInput,
  ListFacetsInput,
  NormGetOptions,
  NormResponse,
  SearchDecisionsInput,
} from "../src/index.js";
import * as schemas from "../src/schemas/index.js";

/**
 * A loose object schema infers an index signature (`[x: string]: unknown`) next to its known keys.
 * The response types have none. `Known` removes the index signature at every depth, so the known
 * keys can be compared with `toEqualTypeOf`. A map without known keys (`Record<string, T>`) stays
 * a map.
 */
type Known<T> = T extends readonly (infer U)[]
  ? Known<U>[]
  : T extends object
    ? keyof { [K in keyof T as string extends K ? never : K]: 0 } extends never
      ? string extends keyof T
        ? { [key: string]: Known<T[string]> }
        : T
      : { [K in keyof T as string extends K ? never : K]: Known<T[K]> }
    : T;

type Infer<S extends z.ZodMiniType> = Known<z.infer<S>>;

describe("schema types equal the SDK types", () => {
  it("inputs", () => {
    expectTypeOf<Infer<typeof schemas.decisionSearchFiltersSchema>>().toEqualTypeOf<
      Known<DecisionSearchFilters>
    >();
    expectTypeOf<Infer<typeof schemas.searchDecisionsInputSchema>>().toEqualTypeOf<
      Known<SearchDecisionsInput>
    >();
    expectTypeOf<Infer<typeof schemas.crossTypeSearchFiltersSchema>>().toEqualTypeOf<
      Known<CrossTypeSearchFilters>
    >();
    expectTypeOf<Infer<typeof schemas.crossTypeSearchInputSchema>>().toEqualTypeOf<
      Known<CrossTypeSearchInput>
    >();
    expectTypeOf<Infer<typeof schemas.decisionGetOptionsSchema>>().toEqualTypeOf<
      Known<DecisionGetOptions>
    >();
    expectTypeOf<Infer<typeof schemas.getDecisionInputSchema>>().toEqualTypeOf<
      Known<GetDecisionInput>
    >();
    expectTypeOf<Infer<typeof schemas.decisionCitationsOptionsSchema>>().toEqualTypeOf<
      Known<DecisionCitationsOptions>
    >();
    expectTypeOf<Infer<typeof schemas.getCitationGraphInputSchema>>().toEqualTypeOf<
      Known<GetCitationGraphInput>
    >();
    expectTypeOf<Infer<typeof schemas.normGetOptionsSchema>>().toEqualTypeOf<
      Known<NormGetOptions>
    >();
    expectTypeOf<Infer<typeof schemas.getNormInputSchema>>().toEqualTypeOf<Known<GetNormInput>>();
    expectTypeOf<Infer<typeof schemas.datapackageCreateParamsSchema>>().toEqualTypeOf<
      Known<DatapackageCreateParams>
    >();
    expectTypeOf<Infer<typeof schemas.datapackageCreateParamsSchema>>().toEqualTypeOf<
      Known<AssembleDatapackageInput>
    >();
    expectTypeOf<Infer<typeof schemas.checkCitationsInputSchema>>().toEqualTypeOf<
      Known<CheckCitationsInput>
    >();
    expectTypeOf<Infer<typeof schemas.getCitationCheckInputSchema>>().toEqualTypeOf<
      Known<GetCitationCheckInput>
    >();
    expectTypeOf<Infer<typeof schemas.getDocumentInputSchema>>().toEqualTypeOf<
      Known<GetDocumentInput>
    >();
    expectTypeOf<Infer<typeof schemas.corpusCoverageOptionsSchema>>().toEqualTypeOf<
      Known<CorpusCoverageOptions>
    >();
    expectTypeOf<Infer<typeof schemas.corpusCoverageOptionsSchema>>().toEqualTypeOf<
      Known<CorpusCoverageInput>
    >();
    expectTypeOf<Infer<typeof schemas.corpusFacetsOptionsSchema>>().toEqualTypeOf<
      Known<CorpusFacetsOptions>
    >();
    expectTypeOf<Infer<typeof schemas.listFacetsInputSchema>>().toEqualTypeOf<
      Known<ListFacetsInput>
    >();
    expectTypeOf<Infer<typeof schemas.citationCheckCreateParamsSchema>>().toEqualTypeOf<
      Known<CitationCheckCreateParams>
    >();
  });

  it("shared pieces and response bodies", () => {
    expectTypeOf<Infer<typeof schemas.countSchema>>().toEqualTypeOf<Known<Count>>();
    expectTypeOf<Infer<typeof schemas.creditsSchema>>().toEqualTypeOf<Known<Credits>>();
    expectTypeOf<Infer<typeof schemas.documentReceiptSchema>>().toEqualTypeOf<
      Known<DocumentReceipt>
    >();
    expectTypeOf<Infer<typeof schemas.citationCheckRunSchema>>().toEqualTypeOf<
      Known<CitationCheckRun>
    >();
    expectTypeOf<Infer<typeof schemas.corpusCoverageResponseSchema>>().toEqualTypeOf<
      Known<CorpusCoverageResponse>
    >();
    expectTypeOf<Infer<typeof schemas.corpusFacetsResponseSchema>>().toEqualTypeOf<
      Known<CorpusFacetsResponse>
    >();
    expectTypeOf<Infer<typeof schemas.datapackageResponseSchema>>().toEqualTypeOf<
      Known<DatapackageResponse>
    >();
    expectTypeOf<Infer<typeof schemas.decisionCitationsResponseSchema>>().toEqualTypeOf<
      Known<DecisionCitationsResponse>
    >();
    expectTypeOf<Infer<typeof schemas.decisionSearchResponseSchema>>().toEqualTypeOf<
      Known<DecisionSearchResponse>
    >();
    expectTypeOf<Infer<typeof schemas.decisionResponseSchema>>().toEqualTypeOf<
      Known<DecisionResponse>
    >();
    expectTypeOf<Infer<typeof schemas.normResponseSchema>>().toEqualTypeOf<Known<NormResponse>>();
    expectTypeOf<Infer<typeof schemas.crossTypeSearchResponseSchema>>().toEqualTypeOf<
      Known<CrossTypeSearchResponse>
    >();
  });
});

const fixtures = (name: string): unknown => {
  const path = join(import.meta.dirname, "fixtures", `${name}.json`);
  return JSON.parse(readFileSync(path, "utf8"));
};

const responseSamples: Array<[string, z.ZodMiniType]> = [
  ["examples/citation-check-documents.show", schemas.documentReceiptSchema],
  ["examples/citation-check-documents.store", schemas.documentReceiptSchema],
  ["examples/citation-checks.show", schemas.citationCheckRunSchema],
  ["examples/citation-checks.store", schemas.citationCheckRunSchema],
  ["examples/corpus.coverage", schemas.corpusCoverageResponseSchema],
  ["examples/corpus.facets", schemas.corpusFacetsResponseSchema],
  ["examples/datapackages.store", schemas.datapackageResponseSchema],
  ["examples/decisions.citations", schemas.decisionCitationsResponseSchema],
  ["examples/decisions.search", schemas.decisionSearchResponseSchema],
  ["examples/decisions.show", schemas.decisionResponseSchema],
  ["examples/norms.show", schemas.normResponseSchema],
  ["examples/search", schemas.crossTypeSearchResponseSchema],
  ["conformance/bodies/corpus.coverage.not_metered", schemas.corpusCoverageResponseSchema],
  ["conformance/bodies/corpus.facets.cited_norms", schemas.corpusFacetsResponseSchema],
  ["conformance/bodies/decisions.search.future_key", schemas.decisionSearchResponseSchema],
  ["conformance/bodies/documents.extracting", schemas.documentReceiptSchema],
  ["conformance/bodies/documents.failed.encrypted_pdf", schemas.documentReceiptSchema],
  ["conformance/bodies/documents.ocr_pending", schemas.documentReceiptSchema],
  ["conformance/bodies/documents.ready", schemas.documentReceiptSchema],
  ["conformance/bodies/documents.uploaded", schemas.documentReceiptSchema],
  ["conformance/bodies/norms.show.dsgvo", schemas.normResponseSchema],
];

describe("response schemas parse every example body", () => {
  for (const [name, schema] of responseSamples) {
    it(`${name}`, () => {
      const body = fixtures(name);
      const parsed = z.safeParse(schema, body);
      expect(parsed.success, parsed.success ? "" : z.prettifyError(parsed.error)).toBe(true);
      // A loose parse returns every key the body had, also the ones the schema does not list.
      expect(parsed.data).toEqual(body);
    });
  }

  it("keeps a key the schema does not list", () => {
    const parsed = z.parse(
      schemas.decisionSearchResponseSchema,
      fixtures("conformance/bodies/decisions.search.future_key"),
    ) as Record<string, unknown>;
    expect(parsed["future_key"]).toBeDefined();
    expect(parsed["another_future_key"]).toBe("x");
  });

  it("rejects a wrong type, such as a plain number where a Count object is", () => {
    const body = structuredClone(fixtures("examples/corpus.coverage")) as {
      branches: Array<{ count: unknown }>;
    };
    (body.branches[0] as { count: unknown }).count = 5;
    expect(z.safeParse(schemas.corpusCoverageResponseSchema, body).success).toBe(false);
  });

  it("accepts an enum value that a later release adds", () => {
    const body = structuredClone(fixtures("examples/citation-checks.show")) as {
      findings: Array<{ verdict: string }>;
    };
    (body.findings[0] as { verdict: string }).verdict = "a_verdict_from_a_later_release";
    expect(z.safeParse(schemas.citationCheckRunSchema, body).success).toBe(true);
  });

  it("rejects a non-string where an open enum is", () => {
    const body = structuredClone(fixtures("examples/citation-checks.show")) as {
      status: unknown;
    };
    body.status = 3;
    expect(z.safeParse(schemas.citationCheckRunSchema, body).success).toBe(false);
  });
});

describe("request schemas", () => {
  it("accept valid input and keep an unknown key", () => {
    const input = {
      query: "Vermögensbetreuungspflicht",
      court: "BGH",
      branch: "ordentlich",
      cited_statutes: ["StGB", "StPO"],
      date_from: "2015-01-01",
      limit: 5,
      bridge: false,
      future_filter: 1,
    };
    const parsed = z.parse(schemas.searchDecisionsInputSchema, input) as Record<string, unknown>;
    expect(parsed["future_filter"]).toBe(1);
    expect(parsed["cited_statutes"]).toEqual(["StGB", "StPO"]);
  });

  it("refuse bad values", () => {
    const bad = (schema: z.ZodMiniType, value: unknown) => z.safeParse(schema, value).success;
    const search = schemas.searchDecisionsInputSchema;
    expect(bad(search, { query: "x" })).toBe(false);
    expect(bad(search, { query: "Untreue", mode: "fuzzy" })).toBe(false);
    expect(bad(search, { query: "Untreue", branch: "civil" })).toBe(false);
    expect(bad(search, { query: "Untreue", date_from: "01.01.2015" })).toBe(false);
    expect(bad(search, { query: "Untreue", limit: 50 })).toBe(false);
    expect(bad(search, { query: "Untreue", page: 11 })).toBe(false);
    expect(bad(search, { query: "Untreue", cited_statutes: ["BGB"] })).toBe(false);
    expect(
      bad(search, {
        query: "Untreue",
        cited_statutes: ["StGB", "StPO", "InsO", "DSGVO", "GDPR", "BDSG"],
      }),
    ).toBe(false);
    expect(bad(schemas.getDecisionInputSchema, { id: "1 StR 185/01", max_chars: 100 })).toBe(false);
    expect(bad(schemas.getDecisionInputSchema, { id: "" })).toBe(false);
    expect(bad(schemas.getCitationGraphInputSchema, { id: "x", depth: 3 })).toBe(false);
    expect(bad(schemas.checkCitationsInputSchema, { text: "too short" })).toBe(false);
    expect(bad(schemas.checkCitationsInputSchema, { text: "x".repeat(20001) })).toBe(false);
    expect(bad(schemas.datapackageCreateParamsSchema, { ids: [] })).toBe(false);
    expect(bad(schemas.corpusFacetsOptionsSchema, { type: "case" })).toBe(false);
  });

  it("accept open enums where the contract names no closed list", () => {
    const ok = (schema: z.ZodMiniType, value: unknown) => z.safeParse(schema, value).success;
    expect(ok(schemas.crossTypeSearchInputSchema, { query: "Miete", jurisdiction: "XI" })).toBe(
      true,
    );
    expect(ok(schemas.getDecisionInputSchema, { id: "x", section: "gründe" })).toBe(true);
    expect(ok(schemas.listFacetsInputSchema, { field: "a_new_field" })).toBe(true);
  });

  it("citation check params take exactly one of text and document_id", () => {
    const ok = (value: unknown) =>
      z.safeParse(schemas.citationCheckCreateParamsSchema, value).success;
    expect(ok({ text: "Der Text" })).toBe(true);
    expect(ok({ document_id: "d1", reference_date: "2026-01-01" })).toBe(true);
    expect(ok({})).toBe(false);
    expect(ok({ text: "a", document_id: "b" })).toBe(false);
  });
});
