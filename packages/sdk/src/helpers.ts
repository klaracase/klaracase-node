import { CitationCheckIncompleteError, ValidationError } from "./errors.js";
import type { CitationCheckRun, CitationFinding } from "./resources/citation-checks.js";
import type { KnownCitationVerdict } from "./verdicts.js";
import { CITATION_VERDICTS } from "./verdicts.js";

/** Findings by verdict. Every known verdict has a list, empty when nothing got that verdict. */
export type FindingsByVerdict = { [K in KnownCitationVerdict]: CitationFinding[] } & Record<
  string,
  CitationFinding[]
>;

/**
 * Group the findings of a run by verdict. The result has a list for each of the seven known
 * verdicts, so `groups.not_found.length` needs no check for `undefined`. A verdict that a later
 * API release adds gets its own list. The order of findings inside a list is the order in the run.
 *
 * ```ts
 * const groups = groupByVerdict(run);
 * console.log(groups.not_found.length, "citations to check by hand");
 * ```
 */
export function groupByVerdict(run: Pick<CitationCheckRun, "findings">): FindingsByVerdict {
  const groups: Record<string, CitationFinding[]> = {};
  for (const verdict of CITATION_VERDICTS) groups[verdict] = [];
  for (const finding of run.findings) {
    // defineProperty, because a plain assignment of the key "__proto__" would set the prototype.
    if (!Object.hasOwn(groups, finding.verdict)) {
      Object.defineProperty(groups, finding.verdict, {
        value: [],
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    (groups[finding.verdict] as CitationFinding[]).push(finding);
  }
  return groups as FindingsByVerdict;
}

/** A run whose `status` is `complete`. */
export type CompleteCitationCheckRun = CitationCheckRun & { status: "complete" };

/**
 * Throw unless the run finished. A run can come back as `rejected`, `failed` or still working, and
 * then `findings` is not a full result. Call this before you read the findings.
 *
 * ```ts
 * const run = await client.citationChecks.get(id);
 * assertComplete(run);
 * ```
 *
 * `status: "complete"` can still come with `partial: true`. Read `partial` and
 * `findings_unavailable_reason` too.
 *
 * @throws {CitationCheckIncompleteError} The status is not `complete`.
 */
export function assertComplete(
  run: Pick<CitationCheckRun, "id" | "status" | "partial">,
): asserts run is typeof run & { status: "complete" } {
  if (run.status !== "complete") throw new CitationCheckIncompleteError(run);
}

/**
 * The part of `text` that a finding points at. The offsets of a finding count Unicode code points,
 * not UTF-16 units, so `text.slice(start, end)` cuts emoji and other characters outside the basic
 * plane in the wrong place. This function does not.
 *
 * ```ts
 * for (const finding of run.findings) console.log(excerpt(draftText, finding));
 * ```
 *
 * @param text The exact text you submitted.
 * @param finding A finding of the run for that text.
 * @throws {ValidationError} The offsets do not fit the text, so it is not the text that was checked.
 */
export function excerpt(
  text: string,
  finding: Pick<CitationFinding, "start_offset" | "end_offset">,
): string {
  const { start_offset: start, end_offset: end } = finding;
  const characters = Array.from(text);
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    end > characters.length
  ) {
    throw new ValidationError({
      title: "Invalid arguments",
      detail:
        `The finding points at code points ${start} to ${end}, but the text has ${characters.length}. ` +
        "Pass the exact text that was submitted.",
      code: "client_validation",
    });
  }
  return characters.slice(start, end).join("");
}
