import type { Transport } from "../http.js";
import type { ApiEnvelope, DocumentType, Open, RequestOptions, WithMeta } from "../types.js";
import type { CitationEdge } from "./decisions.js";

/** Body of `POST /datapackages`. */
export interface DatapackageCreateParams {
  /** 1 to 10 decision ids (UUID or Aktenzeichen). Order matters: the budget drops from the end. */
  ids: readonly string[];
  /** Include each decision's outgoing citation edges. Default true. */
  include_citations?: boolean | undefined;
  /** Serve whole judgments instead of excerpts. Default false. */
  full_text?: boolean | undefined;
  /** Per-decision text cap when `full_text` is true. 500 to 200000, default 60000. */
  max_chars?: number | undefined;
}

/** One decision of a data package. */
export interface DatapackageDecision {
  id: string;
  aktenzeichen: string | null;
  court: string | null;
  date: string | null;
  document_type: Open<DocumentType> | null;
  ecli: string | null;
  jurisdiction: string | null;
  excerpt: string | null;
  excerpt_span: Open<"document_start"> | null;
  text_length: number;
  truncated: boolean;
  fortgeltung_checked: boolean;
  fortgeltung_note: string;
}

/** Edge counts for one source decision of a data package. */
export interface EdgeAccounting {
  from_artifact_id: string;
  unit: Open<"edge_rows">;
  edges_total: number;
  edges_included: number;
  edges_resolved_included: number;
  edges_unresolved_included: number;
  edges_resolved_total: number;
  edges_unresolved_total: number;
  targets_resolved_included: number;
  targets_resolved_total: number;
}

/** Body of `POST /datapackages`. */
export interface DatapackageResponse extends ApiEnvelope {
  decisions: DatapackageDecision[];
  citation_edges: CitationEdge[];
  edge_accounting: EdgeAccounting[];
  per_source_resolved_target_cap: number;
  per_source_unresolved_edge_row_cap: number;
  requested: number;
  included: number;
  deduped: number;
  text_mode: Open<"excerpt" | "full_text">;
  max_chars: number;
  truncated: boolean;
  payload_truncated: boolean;
  assembled_at: string;
}

export class Datapackages {
  /** @internal */
  constructor(private readonly transport: Transport) {}

  /** Bundle up to 10 decisions with their citations. Costs 5 credits. */
  create(
    params: DatapackageCreateParams,
    request?: RequestOptions,
  ): Promise<WithMeta<DatapackageResponse>> {
    return this.transport.request({ method: "POST", path: "/datapackages", json: params }, request);
  }
}
