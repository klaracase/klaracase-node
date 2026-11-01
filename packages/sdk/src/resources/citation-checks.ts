import { encodePathSegment } from "../encoding.js";
import { ValidationError } from "../errors.js";
import type { Transport } from "../http.js";
import type {
  ApiEnvelope,
  CitationCheckStatus,
  CitationVerdict,
  Open,
  RequestOptions,
  WithMeta,
} from "../types.js";

/** Body of `POST /citation-checks`: exactly one of `text` and `document_id`. */
export type CitationCheckCreateParams = (
  { text: string; document_id?: undefined } | { document_id: string; text?: undefined }
) & {
  /** Document date, `YYYY-MM-DD`. Applied to statute citations that name no date themselves. */
  reference_date?: string;
};

export interface MatchedDecision {
  artifact_id: string;
  ecli: string | null;
  court: string | null;
  date: string | null;
  [key: string]: unknown;
}

export interface CitationFinding {
  id: string;
  raw_text: string;
  canonical: string | null;
  type: Open<"case" | "statute">;
  role: string | null;
  verdict: CitationVerdict;
  external_status: string;
  /** Unicode codepoint offsets into the submitted text. */
  start_offset: number;
  end_offset: number;
  occurrence_index: number;
  confidence: number | string | null;
  matched_decision: MatchedDecision | null;
  subdivision_check: string;
  subdivision_advisory: string | null;
  check_scope: Record<string, unknown>;
  ambiguity_advisory: string | null;
  coverage: unknown;
  coverage_boundary: unknown;
  coverage_advisory: string | null;
  evidence: Record<string, unknown>;
  disputed_at: string | null;
  [key: string]: unknown;
}

export interface UniqueCitation {
  key_basis: string;
  target_artifact_id: string | null;
  canonical: string | null;
  spellings: string[];
  occurrences: number;
  verdict: CitationVerdict;
  reference_type: Open<"case" | "statute">;
  [key: string]: unknown;
}

/** Body of `POST /citation-checks` and `GET /citation-checks/{run}`. */
export interface CitationCheckRun extends ApiEnvelope {
  id: string;
  status: CitationCheckStatus;
  source: string;
  progress: {
    citations_total: number;
    citations_checked: number;
    unique_citations_total: number;
    [key: string]: unknown;
  };
  /** Count per verdict. Keys are verdict names. */
  verdict_counts: Record<string, number>;
  partial: boolean;
  unverified_count: number;
  reason_counts: Array<{ category: string; count: number; [key: string]: unknown }>;
  unique_citations: UniqueCitation[];
  extraction: Record<string, unknown>;
  notes: unknown[];
  findings_unavailable_reason: string | null;
  findings_purged_at: string | null;
  findings: CitationFinding[];
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  payload_truncated: boolean;
}

export class CitationChecks {
  constructor(private readonly transport: Transport) {}

  /**
   * Check the citations in a German legal text, or in a ready upload. Synchronous: the answer is
   * the finished run. Costs 2 to 4 credits by length. The same text again in the same month is free.
   */
  create(
    params: CitationCheckCreateParams,
    request?: RequestOptions,
  ): Promise<WithMeta<CitationCheckRun>> {
    const hasText = params.text !== undefined && params.text !== null;
    const hasDocument = params.document_id !== undefined && params.document_id !== null;
    if (hasText === hasDocument) {
      return Promise.reject(
        new ValidationError({
          title: "Invalid arguments",
          detail: "Pass exactly one of `text` and `document_id`.",
          code: "client_validation",
        }),
      );
    }
    return this.transport.request(
      { method: "POST", path: "/citation-checks", json: params },
      request,
    );
  }

  /** Read back a run made through the API by your organization. Free. */
  get(runId: string, request?: RequestOptions): Promise<WithMeta<CitationCheckRun>> {
    return this.transport.request(
      { method: "GET", path: `/citation-checks/${encodePathSegment(runId)}` },
      request,
    );
  }
}
