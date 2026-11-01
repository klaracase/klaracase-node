import { encodePathSegment } from "../encoding.js";
import type { Transport } from "../http.js";
import type { ApiEnvelope, Open, RequestOptions, WithMeta } from "../types.js";

/** Arguments of `GET /norms/{reference}`. */
export interface NormGetOptions {
  /** `DE` or `EU`. Read only when the abbreviation is ambiguous. */
  jurisdiction?: Open<"DE" | "EU"> | undefined;
}

/** Body of `GET /norms/{reference}`. */
export interface NormResponse extends ApiEnvelope {
  reference: string;
  requested_reference: string;
  law: {
    id: string;
    abbreviation: string;
    source_abbreviation: string | null;
    official_name: string | null;
    law_level: Open<"BUND" | "EU"> | null;
    jurisdiction: Open<"DE" | "EU"> | null;
    source_url: string | null;
    upstream_status: Open<"confirmed"> | null;
    upstream_last_seen_at: string | null;
    upstream_missing_since: string | null;
  };
  norm: {
    number: string;
    title: string | null;
    lifecycle: Open<"current"> | null;
    text: string;
    absatz_identifiers: string[];
    chars: number;
  };
  requested_qualifiers: { type: string; value: string; checked: boolean; present: boolean }[];
  version: {
    id: string;
    last_amendment_date: string | null;
    last_amendment_date_basis: Open<"source_stand"> | null;
    source_fetched_at: string | null;
    source_last_seen_at: string | null;
  };
  neighbours: { previous: string | null; next: string | null };
  links: {
    decisions_citing: { tool: string; arguments: { cited_norm: string } };
    decisions_citing_url: string;
    self_url: string;
  };
}

export class Norms {
  constructor(private readonly transport: Transport) {}

  /** Read the current text of one norm, for example `§ 535 BGB` or `Art. 6 DSGVO`. Costs 1 credit. */
  get(
    reference: string,
    options: NormGetOptions = {},
    request?: RequestOptions,
  ): Promise<WithMeta<NormResponse>> {
    return this.transport.request(
      { method: "GET", path: `/norms/${encodePathSegment(reference)}`, query: options },
      request,
    );
  }
}
