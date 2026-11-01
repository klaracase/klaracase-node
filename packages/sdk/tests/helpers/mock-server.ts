import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

/** One scripted answer. */
export interface MockResponse {
  status?: number | undefined;
  headers?: Record<string, string> | undefined;
  /** Serialised body text. The runner resolves `body`, `body_file` and `body_text` before this. */
  bodyText?: string | undefined;
  delaySeconds?: number | undefined;
  dropConnection?: boolean | undefined;
}

export interface RecordedRequest {
  method: string;
  /** The raw request target: path and query, not decoded. */
  target: string;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

export interface MockServerOptions {
  /** Repeat the last answer when the script runs out. */
  repeatLast?: boolean;
}

/**
 * A tiny in-process HTTP server. It answers with a scripted sequence of responses and records
 * every request, including the raw target, so path encoding can be compared byte for byte.
 */
export class MockServer {
  readonly requests: RecordedRequest[] = [];
  private readonly server: Server;
  private readonly timers = new Set<NodeJS.Timeout>();
  private port = 0;

  constructor(
    private readonly script: MockResponse[],
    private readonly options: MockServerOptions = {},
  ) {
    this.server = createServer((req, res) => void this.handle(req, res));
  }

  get baseUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve) => this.server.listen(0, "127.0.0.1", resolve));
    this.port = (this.server.address() as AddressInfo).port;
  }

  async stop(): Promise<void> {
    for (const timer of this.timers) clearTimeout(timer);
    this.server.closeAllConnections();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    this.requests.push({
      method: req.method ?? "",
      target: req.url ?? "",
      headers: { ...req.headers },
      body: Buffer.concat(chunks),
    });

    const index = this.requests.length - 1;
    const scripted =
      this.script[index] ?? (this.options.repeatLast ? this.script.at(-1) : undefined);
    if (scripted === undefined) {
      res.writeHead(599, { "content-type": "text/plain" });
      res.end("The mock has no response left for this request.");
      return;
    }
    if (scripted.dropConnection) {
      req.socket.destroy();
      return;
    }

    const send = () => {
      if (res.destroyed || res.writableEnded) return;
      const headers = { ...(scripted.headers ?? {}) };
      const text = scripted.bodyText ?? "";
      const hasContentType = Object.keys(headers).some(
        (name) => name.toLowerCase() === "content-type",
      );
      if (!hasContentType && text !== "" && looksLikeJson(text)) {
        headers["content-type"] = "application/json";
      }
      res.on("error", () => undefined);
      res.writeHead(scripted.status ?? 200, headers);
      res.end(text);
    };

    if (scripted.delaySeconds === undefined) {
      send();
      return;
    }
    const timer = setTimeout(send, scripted.delaySeconds * 1000);
    this.timers.add(timer);
  }
}

function looksLikeJson(text: string): boolean {
  const first = text.trimStart()[0];
  return first === "{" || first === "[";
}

/** One part of a multipart body. File bytes are not compared by the tests. */
export interface MultipartPart {
  name: string;
  filename: string | null;
  content_type: string | null;
}

/** Parse the part headers of a multipart/form-data body. */
export function parseMultipart(contentType: string, body: Buffer): MultipartPart[] {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = match?.[1] ?? match?.[2];
  if (boundary === undefined) return [];
  const parts: MultipartPart[] = [];
  const text = body.toString("latin1");
  for (const chunk of text.split(`--${boundary}`)) {
    const headerEnd = chunk.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const headerBlock = chunk.slice(0, headerEnd);
    const disposition = /content-disposition:[^\r\n]*/i.exec(headerBlock)?.[0] ?? "";
    const name = /\bname="([^"]*)"/i.exec(disposition)?.[1];
    if (name === undefined) continue;
    parts.push({
      name,
      filename: /\bfilename="([^"]*)"/i.exec(disposition)?.[1] ?? null,
      content_type: /content-type:\s*([^\r\n]+)/i.exec(headerBlock)?.[1]?.trim() ?? null,
    });
  }
  return parts;
}
