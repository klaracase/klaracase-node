import type { Transport } from "../http.js";
import type { ApiEnvelope, RequestOptions, WithMeta } from "../types.js";

/** Body of `POST /datapackages`. */
export interface DatapackageCreateParams {
  /** 1 to 10 decision ids (UUID or Aktenzeichen). Order matters: the budget drops from the end. */
  ids: readonly string[];
  /** Include each decision's outgoing citation edges. Default true. */
  include_citations?: boolean;
  /** Serve whole judgments instead of excerpts. Default false. */
  full_text?: boolean;
  /** Per-decision text cap when `full_text` is true. 500 to 200000, default 60000. */
  max_chars?: number;
}

/** Body of `POST /datapackages`. */
export interface DatapackageResponse extends ApiEnvelope {
  decisions: Array<{
    id: string;
    aktenzeichen: string | null;
    court: string | null;
    date: string | null;
    document_type: string | null;
    ecli: string | null;
    jurisdiction: string | null;
    excerpt: string | null;
    excerpt_span: unknown;
    text_length: number;
    truncated: boolean;
    fortgeltung_checked: boolean;
    fortgeltung_note: string;
    [key: string]: unknown;
  }>;
  citation_edges: Array<Record<string, unknown>>;
  edge_accounting: Array<Record<string, unknown>>;
  per_source_resolved_target_cap: number;
  per_source_unresolved_edge_row_cap: number;
  requested: number;
  included: number;
  deduped: number;
  text_mode: string;
  max_chars: number;
  truncated: boolean;
  payload_truncated: boolean;
  assembled_at: string;
}

export class Datapackages {
  constructor(private readonly transport: Transport) {}

  /** Bundle up to 10 decisions with their citations. Costs 5 credits. */
  create(
    params: DatapackageCreateParams,
    request?: RequestOptions,
  ): Promise<WithMeta<DatapackageResponse>> {
    return this.transport.request({ method: "POST", path: "/datapackages", json: params }, request);
  }
}
