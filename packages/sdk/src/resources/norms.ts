import { encodePathSegment } from "../encoding.js";
import type { Transport } from "../http.js";
import type { ApiEnvelope, Open, RequestOptions, WithMeta } from "../types.js";

/** Arguments of `GET /norms/{reference}`. */
export interface NormGetOptions {
  /** `DE` or `EU`. Read only when the abbreviation is ambiguous. */
  jurisdiction?: Open<"DE" | "EU">;
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
    law_level: string | null;
    jurisdiction: string | null;
    source_url: string | null;
    upstream_status: string | null;
    upstream_last_seen_at: string | null;
    upstream_missing_since: string | null;
    [key: string]: unknown;
  };
  norm: {
    number: string;
    title: string | null;
    lifecycle: string | null;
    text: string;
    absatz_identifiers: string[];
    chars: number;
    [key: string]: unknown;
  };
  requested_qualifiers: Array<{
    type: string;
    value: string;
    checked: boolean;
    present: boolean;
    [key: string]: unknown;
  }>;
  version: Record<string, unknown>;
  neighbours: { previous: string | null; next: string | null; [key: string]: unknown };
  links: Record<string, unknown>;
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
