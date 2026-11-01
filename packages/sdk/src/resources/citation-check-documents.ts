import { encodePathSegment } from "../encoding.js";
import { DocumentFailedError, DocumentTimeoutError } from "../errors.js";
import type { Transport } from "../http.js";
import type {
  ApiEnvelope,
  DocumentErrorCode,
  DocumentStatus,
  Open,
  RequestOptions,
  WithMeta,
} from "../types.js";

/** Bytes for an upload. */
export type UploadFile = Blob | Uint8Array | ArrayBuffer;

export interface UploadParams {
  file: UploadFile;
  /** File name sent in the multipart part, for example `schriftsatz.pdf`. */
  filename: string;
  /** Media type of the part, for example `application/pdf`. */
  contentType: string;
}

/** Body of `POST /citation-check-documents` and `GET /citation-check-documents/{document}`. */
export interface DocumentReceipt extends ApiEnvelope {
  id: string;
  filename: string;
  format: Open<"pdf" | "docx" | "md" | "txt">;
  status: DocumentStatus;
  char_count: number | null;
  page_count: number | null;
  pages_without_text_layer: number | null;
  check_max_chars: number;
  /** Credits a check would cost. `null` above 20000 characters or before extraction ends. */
  quoted_credits: number | null;
  error_code: DocumentErrorCode | null;
  expires_at: string;
  created_at: string;
}

export interface WaitUntilReadyOptions {
  /** Seconds between polls. Default 2. */
  pollInterval?: number | undefined;
  /** Seconds to wait in total. Default 120. */
  timeout?: number | undefined;
}

export class CitationCheckDocuments {
  /** @internal */
  constructor(
    private readonly transport: Transport,
    private readonly sleep: (seconds: number) => Promise<void>,
    private readonly now: () => number,
  ) {}

  /** Upload a PDF, DOCX, Markdown or text file (up to 25 MB). Answers 202. Free. */
  upload(params: UploadParams, request?: RequestOptions): Promise<WithMeta<DocumentReceipt>> {
    const form = new FormData();
    form.append("file", toBlob(params.file, params.contentType), params.filename);
    return this.transport.request(
      { method: "POST", path: "/citation-check-documents", form },
      request,
    );
  }

  /** Read the receipt of one upload. Free. */
  get(documentId: string, request?: RequestOptions): Promise<WithMeta<DocumentReceipt>> {
    return this.transport.request(
      { method: "GET", path: `/citation-check-documents/${encodePathSegment(documentId)}` },
      request,
    );
  }

  /**
   * Poll until the upload is `ready` and return its receipt. `uploaded`, `extracting` and
   * `ocr_pending` count as not ready yet.
   *
   * @throws {DocumentFailedError} The upload ended in `failed`.
   * @throws {DocumentTimeoutError} The timeout passed first.
   */
  async waitUntilReady(
    documentId: string,
    options: WaitUntilReadyOptions = {},
    request?: RequestOptions,
  ): Promise<WithMeta<DocumentReceipt>> {
    const pollInterval = options.pollInterval ?? 2;
    const timeout = options.timeout ?? 120;
    const deadline = this.now() + timeout;
    for (;;) {
      const receipt = await this.get(documentId, request);
      if (receipt.status === "failed") throw new DocumentFailedError(receipt);
      if (receipt.status === "ready") return receipt;
      if (this.now() + pollInterval > deadline) throw new DocumentTimeoutError(receipt, timeout);
      await this.sleep(pollInterval);
    }
  }
}

function toBlob(file: UploadFile, contentType: string): Blob {
  if (file instanceof Blob) {
    return file.type === contentType ? file : new Blob([file], { type: contentType });
  }
  return new Blob([file as Uint8Array<ArrayBuffer>], { type: contentType });
}
