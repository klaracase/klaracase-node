/** The seven verdicts the API defines for one citation, in the order the API documents them. */
export const CITATION_VERDICTS = [
  "verified_corpus",
  "verified_external",
  "not_found",
  "out_of_coverage",
  "ambiguous",
  "unverifiable",
  "discrepancy",
] as const;

/** One of the verdicts the SDK knows by name. */
export type KnownCitationVerdict = (typeof CITATION_VERDICTS)[number];

/**
 * True when `verdict` is one of {@link CITATION_VERDICTS}. A `false` means the API added a verdict
 * that this SDK version does not know, so handle it as "unknown" and do not guess.
 */
export function isKnownVerdict(verdict: string): verdict is KnownCitationVerdict {
  return (CITATION_VERDICTS as readonly string[]).includes(verdict);
}
