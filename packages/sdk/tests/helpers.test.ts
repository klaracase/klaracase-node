import { describe, expect, it } from "vitest";
import {
  CitationCheckIncompleteError,
  KlaracaseError,
  ValidationError,
  assertComplete,
  excerpt,
  groupByVerdict,
  type CitationCheckRun,
  type CitationFinding,
} from "../src/index.js";
import runExample from "./fixtures/examples/citation-checks.show.json";

function finding(verdict: string, start = 0, end = 1): CitationFinding {
  return {
    ...(runExample.findings[0] as unknown as CitationFinding),
    verdict,
    start_offset: start,
    end_offset: end,
  };
}

describe("groupByVerdict", () => {
  it("has a list for each known verdict and keeps the finding order", () => {
    const run = {
      findings: [
        finding("not_found", 1, 2),
        finding("verified_corpus"),
        finding("not_found", 5, 6),
      ],
    };
    const groups = groupByVerdict(run);
    expect(Object.keys(groups).slice(0, 7)).toEqual([
      "verified_corpus",
      "verified_external",
      "not_found",
      "out_of_coverage",
      "ambiguous",
      "unverifiable",
      "discrepancy",
    ]);
    expect(groups.not_found.map((f) => f.start_offset)).toEqual([1, 5]);
    expect(groups.verified_corpus).toHaveLength(1);
    expect(groups.discrepancy).toEqual([]);
  });

  it("gives an unknown verdict its own list, also a hostile name", () => {
    const groups = groupByVerdict({ findings: [finding("brand_new"), finding("__proto__")] });
    expect(groups["brand_new"]).toHaveLength(1);
    expect(Object.hasOwn(groups, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(groups)).toBe(Object.prototype);
  });

  it("works on the example run", () => {
    const groups = groupByVerdict(runExample as unknown as CitationCheckRun);
    expect(groups.verified_corpus).toHaveLength(1);
  });
});

describe("assertComplete", () => {
  it("passes a complete run", () => {
    expect(() => assertComplete({ id: "r", status: "complete", partial: false })).not.toThrow();
  });

  it.each(["pending", "extracting", "rejected", "failed", "something_new"])(
    "throws CitationCheckIncompleteError for status %s",
    (status) => {
      const run = { id: "r1", status, partial: false };
      let failure: unknown;
      try {
        assertComplete(run);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(CitationCheckIncompleteError);
      expect(failure).toBeInstanceOf(KlaracaseError);
      const error = failure as CitationCheckIncompleteError;
      expect(error.run_status).toBe(status);
      expect(error.run).toBe(run);
      expect(error.code).toBe("citation_check_incomplete");
      expect(error.name).toBe("CitationCheckIncompleteError");
      expect(error.message).toContain(`"${status}"`);
    },
  );

  it("narrows the type", () => {
    const run: Pick<CitationCheckRun, "id" | "status" | "partial"> = {
      id: "r",
      status: "complete",
      partial: false,
    };
    assertComplete(run);
    const status: "complete" = run.status;
    expect(status).toBe("complete");
  });
});

describe("excerpt", () => {
  it("cuts by code points, so an emoji before the citation does not shift it", () => {
    const text = "😀😀 BGH, 1 StR 185/01 ende";
    const start = Array.from("😀😀 ").length;
    const end = start + Array.from("BGH, 1 StR 185/01").length;
    expect(excerpt(text, { start_offset: start, end_offset: end })).toBe("BGH, 1 StR 185/01");
    // The same offsets on UTF-16 slicing cut in the wrong place.
    expect(text.slice(start, end)).not.toBe("BGH, 1 StR 185/01");
  });

  it("does not split a surrogate pair at the end", () => {
    expect(excerpt("a😀b", { start_offset: 1, end_offset: 2 })).toBe("😀");
  });

  it("returns the cited text of a finding", () => {
    const first = runExample.findings[0] as unknown as CitationFinding;
    const text = `${"x".repeat(first.start_offset)}${first.raw_text}${"y".repeat(10)}`;
    const end_offset = first.start_offset + Array.from(first.raw_text).length;
    expect(excerpt(text, { start_offset: first.start_offset, end_offset })).toBe(first.raw_text);
  });

  it("throws when the offsets do not fit the text", () => {
    expect(() => excerpt("short", { start_offset: 2, end_offset: 99 })).toThrow(ValidationError);
    expect(() => excerpt("short", { start_offset: 3, end_offset: 2 })).toThrow(ValidationError);
    expect(() => excerpt("short", { start_offset: -1, end_offset: 2 })).toThrow(ValidationError);
  });
});
