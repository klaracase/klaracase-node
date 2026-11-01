import { encodePathSegment } from "../encoding.js";
import { ValidationError } from "../errors.js";
import type { Transport } from "../http.js";
import type {
  CitationCheckDocuments,
  UploadFile,
  UploadOptions,
} from "./citation-check-documents.js";
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
  reference_date?: string | undefined;
};

/** Progress counters of a run. */
export interface CitationProgress {
  citations_total: number;
  citations_checked: number;
  unique_citations_total: number;
}

/** How many citations ended without a verdict of "found", by reason. */
export interface ReasonCount {
  category: Open<"statute_unknown">;
  count: number;
}

/** What the extractor saw and dropped before it checked anything. */
export interface CitationExtraction {
  detected: number;
  dropped: number;
  dropped_unreadable: number;
  dropped_truncation: number;
  dropped_trailing_noun: number;
  dropped_stacked_subdivision: number;
  dropped_refused_collision: number;
  dropped_by_token: unknown[];
  dropped_unreadable_texts: unknown[];
  refused_contract_collision: unknown[];
  not_verifiable: number;
  not_verifiable_by_type: unknown[];
  possible_citations_unparsed: number;
  possible_citations_unparsed_texts: string[];
}

/** The decision a case citation resolved to. */
export interface MatchedDecision {
  artifact_id: string;
  ecli: string | null;
  court: string | null;
  date: string | null;
}

/** What the check read to reach a verdict. */
export interface CheckScope {
  subdivision: Open<"not_applicable">;
  article_text_available: boolean | null;
  article_text_read: boolean;
  court: Open<"checked">;
}

/** Why a finding got its verdict. */
export interface FindingEvidence {
  reason: Open<"exact_match">;
  match_strength: Open<"exact">;
}

/** One citation found in the text, with its verdict. */
export interface CitationFinding {
  id: string;
  raw_text: string;
  canonical: string | null;
  type: Open<"case" | "statute">;
  role: string | null;
  verdict: CitationVerdict;
  external_status: Open<"skipped">;
  /** Unicode code point offsets into the submitted text. */
  start_offset: number;
  end_offset: number;
  occurrence_index: number;
  confidence: number | null;
  matched_decision: MatchedDecision | null;
  subdivision_check: Open<"not_checked">;
  subdivision_advisory: string | null;
  check_scope: CheckScope;
  ambiguity_advisory: string | null;
  coverage: Record<string, unknown> | null;
  coverage_boundary: Record<string, unknown> | null;
  coverage_advisory: string | null;
  evidence: FindingEvidence;
  disputed_at: string | null;
}

/** One distinct citation with all its spellings and occurrences. */
export interface UniqueCitation {
  key_basis: Open<"matched_decision" | "canonical">;
  target_artifact_id: string | null;
  canonical: string | null;
  spellings: string[];
  occurrences: number;
  verdict: CitationVerdict;
  reference_type: Open<"case" | "statute">;
}

/**
 * Body of `POST /citation-checks` and `GET /citation-checks/{run}`.
 *
 * Check `status` before you trust the findings. See `assertComplete`.
 */
export interface CitationCheckRun extends ApiEnvelope {
  id: string;
  status: CitationCheckStatus;
  source: Open<"api_v1">;
  progress: CitationProgress;
  /** Count per verdict. Keys are verdict names. */
  verdict_counts: Record<string, number>;
  partial: boolean;
  unverified_count: number;
  reason_counts: ReasonCount[];
  unique_citations: UniqueCitation[];
  extraction: CitationExtraction;
  notes: unknown[];
  findings_unavailable_reason: string | null;
  findings_purged_at: string | null;
  findings: CitationFinding[];
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  payload_truncated: boolean;
}

/** Options of {@link CitationChecks.createFromFile}. */
export interface CreateFromFileOptions extends UploadOptions {
  /** How long to wait for the upload to be read. Both values are in seconds. */
  wait?:
    | {
        /** Seconds to wait in total. Default 120. */
        timeout?: number | undefined;
        /** Seconds between polls. Default 2. */
        interval?: number | undefined;
      }
    | undefined;
  /** Document date, `YYYY-MM-DD`. Applied to statute citations that name no date themselves. */
  reference_date?: string | undefined;
}

/**
 * Citation checks: send a text or an uploaded document, read the verdict for each citation.
 * Reach it as `client.citationChecks`.
 */
export class CitationChecks {
  /** @internal */
  constructor(
    private readonly transport: Transport,
    private readonly documents: CitationCheckDocuments,
  ) {}

  /**
   * Check the citations in a German legal text, or in a ready upload. Synchronous: the answer is
   * the finished run. Costs 2 to 4 credits by length. The same text again in the same credit period is free.
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

  /**
   * Upload a file, wait until it is read, then check its citations. This is `upload`,
   * `waitUntilReady` and `create` in one call. The upload is free. The check costs 2 to 4 credits.
   *
   * ```ts
   * const run = await client.citationChecks.createFromFile(file, {
   *   wait: { timeout: 180, interval: 3 },
   *   reference_date: "2026-10-01",
   * });
   * assertComplete(run);
   * ```
   *
   * @throws {DocumentFailedError} The upload ended in `failed`, for example `encrypted_pdf`.
   * @throws {DocumentTimeoutError} The upload was not ready within `wait.timeout`.
   * @throws {ValidationError} The file has no name and `filename` is missing.
   */
  async createFromFile(
    file: UploadFile,
    options: CreateFromFileOptions = {},
  ): Promise<WithMeta<CitationCheckRun>> {
    const { wait, reference_date, ...upload } = options;
    const { signal, timeout, maxRetries, headers } = upload;
    const request: RequestOptions = { signal, timeout, maxRetries, headers };
    const receipt = await this.documents.upload(file, upload);
    const ready = await this.documents.waitUntilReady(
      receipt.id,
      { pollInterval: wait?.interval, timeout: wait?.timeout },
      request,
    );
    return this.create(
      reference_date === undefined
        ? { document_id: ready.id }
        : { document_id: ready.id, reference_date },
      request,
    );
  }
}
