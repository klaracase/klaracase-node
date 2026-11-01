import { encodePathSegment } from "../encoding.js";
import { DocumentFailedError, DocumentTimeoutError, ValidationError } from "../errors.js";
import type { Transport } from "../http.js";
import type {
  ApiEnvelope,
  DocumentErrorCode,
  DocumentStatus,
  Open,
  RequestOptions,
  WithMeta,
} from "../types.js";

/** Bytes for an upload. A `File` also carries its name and media type. */
export type UploadFile = Blob | File | Uint8Array | ArrayBuffer;

/** The older form of the arguments of `upload`: one object with everything in it. */
export interface UploadParams {
  file: UploadFile;
  /** File name sent in the multipart part, for example `schriftsatz.pdf`. */
  filename: string;
  /** Media type of the part, for example `application/pdf`. */
  contentType: string;
}

/** Options of `upload`. Both names are read from a `File`, so a `File` needs neither. */
export interface UploadOptions extends RequestOptions {
  /** File name sent in the multipart part, for example `schriftsatz.pdf`. Required for bytes. */
  filename?: string | undefined;
  /** Media type of the part. Default: the type of the `File` or `Blob`, else from the extension. */
  contentType?: string | undefined;
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

/** Options of `citationCheckDocuments.waitUntilReady`. */
export interface WaitUntilReadyOptions {
  /** Seconds between polls. Default 2. */
  pollInterval?: number | undefined;
  /** Seconds to wait in total. Default 120. */
  timeout?: number | undefined;
}

/**
 * Uploads of documents (PDF, DOCX, text) for a citation check. Reach it as
 * `client.citationCheckDocuments`.
 */
export class CitationCheckDocuments {
  /** @internal */
  constructor(
    private readonly transport: Transport,
    private readonly sleep: (seconds: number) => Promise<void>,
    private readonly now: () => number,
  ) {}

  /**
   * Upload a PDF, DOCX, Markdown or text file (up to 25 MB). Answers 202. Free.
   *
   * Pass a `File` and the name and media type come from it. Pass a `Blob`, a `Uint8Array` or an
   * `ArrayBuffer` and give `filename`. The media type is guessed from the extension when you give
   * none.
   *
   * ```ts
   * const receipt = await client.citationCheckDocuments.upload(file); // a File
   * const fromDisk = await client.citationCheckDocuments.upload(bytes, { filename: "brief.pdf" });
   * ```
   *
   * @throws {ValidationError} The file has no name and `filename` is missing.
   */
  upload(file: UploadFile, options?: UploadOptions): Promise<WithMeta<DocumentReceipt>>;
  /** The older form: one object with `file`, `filename` and `contentType`. */
  upload(params: UploadParams, request?: RequestOptions): Promise<WithMeta<DocumentReceipt>>;
  upload(
    first: UploadFile | UploadParams,
    options: UploadOptions | RequestOptions = {},
  ): Promise<WithMeta<DocumentReceipt>> {
    let file: UploadFile;
    let upload: UploadOptions;
    if (isUploadParams(first)) {
      file = first.file;
      upload = { ...options, filename: first.filename, contentType: first.contentType };
    } else {
      file = first;
      upload = options;
    }
    const { filename, contentType, ...request } = upload;
    let part: { blob: Blob; name: string };
    try {
      part = toPart(file, filename, contentType);
    } catch (error) {
      return Promise.reject(error);
    }
    const form = new FormData();
    form.append("file", part.blob, part.name);
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

function isUploadParams(value: UploadFile | UploadParams): value is UploadParams {
  if (value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return false;
  }
  return typeof value === "object" && value !== null && "file" in value;
}

const MEDIA_TYPES: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  md: "text/markdown",
  markdown: "text/markdown",
  txt: "text/plain",
};

function mediaTypeFromName(name: string): string {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return MEDIA_TYPES[extension] ?? "application/octet-stream";
}

/** Work out the name, the media type and the bytes of the multipart part. */
function toPart(
  file: UploadFile,
  filename: string | undefined,
  contentType: string | undefined,
): { blob: Blob; name: string } {
  const named = typeof File !== "undefined" && file instanceof File ? file.name : undefined;
  const name = filename ?? (named === "" ? undefined : named);
  if (name === undefined) {
    throw new ValidationError({
      title: "Invalid arguments",
      detail: "Pass { filename } with bytes or a Blob. Only a File carries its own name.",
      code: "client_validation",
    });
  }
  const own = file instanceof Blob && file.type !== "" ? file.type : undefined;
  const type = contentType ?? own ?? mediaTypeFromName(name);
  if (file instanceof Blob) {
    return { blob: file.type === type ? file : new Blob([file], { type }), name };
  }
  return { blob: new Blob([file as Uint8Array<ArrayBuffer>], { type }), name };
}
