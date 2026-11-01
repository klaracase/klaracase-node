import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  CitationCheckRun,
  CorpusCoverageResponse,
  CorpusFacetsResponse,
  CrossTypeSearchResponse,
  DatapackageResponse,
  DecisionCitationsResponse,
  DecisionResponse,
  DecisionSearchResponse,
  DocumentReceipt,
  NormResponse,
} from "../src/index.js";
import {
  citationCheckRunKeys,
  corpusCoverageKeys,
  corpusFacetsKeys,
  crossTypeSearchKeys,
  datapackageKeys,
  decisionCitationsKeys,
  decisionKeys,
  decisionSearchKeys,
  documentReceiptKeys,
  normKeys,
  undeclaredKeys,
} from "./helpers/key-manifest.js";

import citationChecksShow from "./fixtures/examples/citation-checks.show.json";
import citationChecksStore from "./fixtures/examples/citation-checks.store.json";
import corpusCoverage from "./fixtures/examples/corpus.coverage.json";
import corpusFacets from "./fixtures/examples/corpus.facets.json";
import datapackagesStore from "./fixtures/examples/datapackages.store.json";
import decisionsCitations from "./fixtures/examples/decisions.citations.json";
import decisionsSearch from "./fixtures/examples/decisions.search.json";
import decisionsShow from "./fixtures/examples/decisions.show.json";
import documentsShow from "./fixtures/examples/citation-check-documents.show.json";
import documentsStore from "./fixtures/examples/citation-check-documents.store.json";
import normsShow from "./fixtures/examples/norms.show.json";
import crossTypeSearch from "./fixtures/examples/search.json";

import bodyCoverageNotMetered from "./fixtures/conformance/bodies/corpus.coverage.not_metered.json";
import bodyFacetsCitedNorms from "./fixtures/conformance/bodies/corpus.facets.cited_norms.json";
import bodySearchApiBudget from "./fixtures/conformance/bodies/decisions.search.api_budget.json";
import bodySearchFutureKey from "./fixtures/conformance/bodies/decisions.search.future_key.json";
import bodyDocExtracting from "./fixtures/conformance/bodies/documents.extracting.json";
import bodyDocFailed from "./fixtures/conformance/bodies/documents.failed.encrypted_pdf.json";
import bodyDocOcrPending from "./fixtures/conformance/bodies/documents.ocr_pending.json";
import bodyDocReady from "./fixtures/conformance/bodies/documents.ready.json";
import bodyDocUploaded from "./fixtures/conformance/bodies/documents.uploaded.json";
import bodyNormDsgvo from "./fixtures/conformance/bodies/norms.show.dsgvo.json";

/**
 * The JSON import widens every literal (`"LAW"` becomes `string`, `1` becomes `number`). The
 * response types are widened the same way before the comparison, so the check still covers
 * structure: required keys, `null` against a value, arrays against objects.
 */
type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends readonly (infer U)[]
        ? Widen<U>[]
        : T extends object
          ? { [K in keyof T]: Widen<T[K]> }
          : T;

describe("example bodies fit the response types", () => {
  it("assigns every example to its type", () => {
    expectTypeOf(documentsShow).toExtend<Widen<DocumentReceipt>>();
    expectTypeOf(documentsStore).toExtend<Widen<DocumentReceipt>>();
    expectTypeOf(citationChecksShow).toExtend<Widen<CitationCheckRun>>();
    expectTypeOf(citationChecksStore).toExtend<Widen<CitationCheckRun>>();
    expectTypeOf(corpusCoverage).toExtend<Widen<CorpusCoverageResponse>>();
    expectTypeOf(corpusFacets).toExtend<Widen<CorpusFacetsResponse>>();
    expectTypeOf(datapackagesStore).toExtend<Widen<DatapackageResponse>>();
    expectTypeOf(decisionsCitations).toExtend<Widen<DecisionCitationsResponse>>();
    expectTypeOf(decisionsSearch).toExtend<Widen<DecisionSearchResponse>>();
    expectTypeOf(decisionsShow).toExtend<Widen<DecisionResponse>>();
    expectTypeOf(normsShow).toExtend<Widen<NormResponse>>();
    expectTypeOf(crossTypeSearch).toExtend<Widen<CrossTypeSearchResponse>>();
  });

  it("assigns every conformance body to its type", () => {
    expectTypeOf(bodyCoverageNotMetered).toExtend<Widen<CorpusCoverageResponse>>();
    expectTypeOf(bodyFacetsCitedNorms).toExtend<Widen<CorpusFacetsResponse>>();
    expectTypeOf(bodySearchApiBudget).toExtend<Widen<DecisionSearchResponse>>();
    expectTypeOf(bodySearchFutureKey).toExtend<Widen<DecisionSearchResponse>>();
    expectTypeOf(bodyDocExtracting).toExtend<Widen<DocumentReceipt>>();
    expectTypeOf(bodyDocFailed).toExtend<Widen<DocumentReceipt>>();
    expectTypeOf(bodyDocOcrPending).toExtend<Widen<DocumentReceipt>>();
    expectTypeOf(bodyDocReady).toExtend<Widen<DocumentReceipt>>();
    expectTypeOf(bodyDocUploaded).toExtend<Widen<DocumentReceipt>>();
    expectTypeOf(bodyNormDsgvo).toExtend<Widen<NormResponse>>();
  });
});

interface Sample {
  file: string;
  body: unknown;
  keys: unknown;
  /** Keys the body carries on purpose and the type must not declare (a future-key test body). */
  knownUndeclared?: string[];
}

const samples: Sample[] = [
  {
    file: "examples/citation-check-documents.show",
    body: documentsShow,
    keys: documentReceiptKeys,
  },
  {
    file: "examples/citation-check-documents.store",
    body: documentsStore,
    keys: documentReceiptKeys,
  },
  { file: "examples/citation-checks.show", body: citationChecksShow, keys: citationCheckRunKeys },
  { file: "examples/citation-checks.store", body: citationChecksStore, keys: citationCheckRunKeys },
  { file: "examples/corpus.coverage", body: corpusCoverage, keys: corpusCoverageKeys },
  { file: "examples/corpus.facets", body: corpusFacets, keys: corpusFacetsKeys },
  { file: "examples/datapackages.store", body: datapackagesStore, keys: datapackageKeys },
  { file: "examples/decisions.citations", body: decisionsCitations, keys: decisionCitationsKeys },
  { file: "examples/decisions.search", body: decisionsSearch, keys: decisionSearchKeys },
  { file: "examples/decisions.show", body: decisionsShow, keys: decisionKeys },
  { file: "examples/norms.show", body: normsShow, keys: normKeys },
  { file: "examples/search", body: crossTypeSearch, keys: crossTypeSearchKeys },
  {
    file: "conformance/bodies/corpus.coverage.not_metered",
    body: bodyCoverageNotMetered,
    keys: corpusCoverageKeys,
  },
  {
    file: "conformance/bodies/corpus.facets.cited_norms",
    body: bodyFacetsCitedNorms,
    keys: corpusFacetsKeys,
  },
  {
    file: "conformance/bodies/decisions.search.api_budget",
    body: bodySearchApiBudget,
    keys: decisionSearchKeys,
  },
  {
    file: "conformance/bodies/decisions.search.future_key",
    body: bodySearchFutureKey,
    keys: decisionSearchKeys,
    knownUndeclared: ["$.future_key", "$.another_future_key", "$.results[0].future_result_key"],
  },
  {
    file: "conformance/bodies/documents.extracting",
    body: bodyDocExtracting,
    keys: documentReceiptKeys,
  },
  {
    file: "conformance/bodies/documents.failed.encrypted_pdf",
    body: bodyDocFailed,
    keys: documentReceiptKeys,
  },
  {
    file: "conformance/bodies/documents.ocr_pending",
    body: bodyDocOcrPending,
    keys: documentReceiptKeys,
  },
  { file: "conformance/bodies/documents.ready", body: bodyDocReady, keys: documentReceiptKeys },
  {
    file: "conformance/bodies/documents.uploaded",
    body: bodyDocUploaded,
    keys: documentReceiptKeys,
  },
  { file: "conformance/bodies/norms.show.dsgvo", body: bodyNormDsgvo, keys: normKeys },
];

describe("key manifests", () => {
  for (const sample of samples) {
    it(`${sample.file} carries no key the type does not declare`, () => {
      expect(undeclaredKeys(sample.body, sample.keys).sort()).toEqual(
        [...(sample.knownUndeclared ?? [])].sort(),
      );
    });
  }

  it("fails on a key the type does not declare", () => {
    const extra = { ...documentsShow, surprise: 1, credits: { ...documentsShow.credits, odd: 2 } };
    expect(undeclaredKeys(extra, documentReceiptKeys).sort()).toEqual([
      "$.credits.odd",
      "$.surprise",
    ]);
  });

  it("covers every example and every conformance body file", () => {
    const here = join(import.meta.dirname, "fixtures");
    const onDisk = (dir: string) =>
      readdirSync(join(here, dir))
        .filter((name) => name.endsWith(".json"))
        .map((name) => `${dir}/${name.replace(/\.json$/, "")}`);
    const covered = new Set(samples.map((sample) => sample.file));
    for (const file of [...onDisk("examples"), ...onDisk("conformance/bodies")]) {
      expect(covered.has(file), `${file} has no manifest check`).toBe(true);
    }
    expect(readFileSync(join(here, "examples/search.json"), "utf8")).toContain("sections");
  });
});
