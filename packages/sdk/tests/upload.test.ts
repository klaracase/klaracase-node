import { describe, expect, it } from "vitest";
import {
  DocumentFailedError,
  DocumentTimeoutError,
  Klaracase,
  ValidationError,
} from "../src/index.js";
import documentReady from "./fixtures/conformance/bodies/documents.ready.json";
import documentUploaded from "./fixtures/conformance/bodies/documents.uploaded.json";
import documentExtracting from "./fixtures/conformance/bodies/documents.extracting.json";
import documentFailed from "./fixtures/conformance/bodies/documents.failed.encrypted_pdf.json";
import runExample from "./fixtures/examples/citation-checks.store.json";
import { MockServer, parseMultipart, type MockResponse } from "./helpers/mock-server.js";

const json = { "content-type": "application/json", "x-klaracase-api-release": "0.95.0" };
const answer = (status: number, body: unknown): MockResponse => ({
  status,
  headers: json,
  bodyText: JSON.stringify(body),
});

async function withClient<T>(
  script: MockResponse[],
  run: (client: Klaracase, mock: MockServer, slept: number[]) => Promise<T>,
): Promise<T> {
  const mock = new MockServer(script);
  await mock.start();
  try {
    const slept: number[] = [];
    const client = new Klaracase({
      token: "t",
      baseUrl: `${mock.baseUrl}/api/v1`,
      sleep: async (seconds) => {
        slept.push(seconds);
      },
    });
    return await run(client, mock, slept);
  } finally {
    await mock.stop();
  }
}

/** The media type without parameters: Bun adds ";charset=utf-8" to text parts. */
function partOf(mock: MockServer, index = 0) {
  const request = mock.requests[index];
  const part = parseMultipart(String(request?.headers["content-type"]), request?.body as Buffer)[0];
  return { ...part, content_type: part?.content_type?.split(";")[0]?.trim() };
}

describe("upload", () => {
  it("takes name and media type from a File", async () => {
    await withClient([answer(202, documentUploaded)], async (client, mock) => {
      const receipt = await client.citationCheckDocuments.upload(
        new File(["%PDF-1.7"], "brief.pdf", { type: "application/pdf" }),
      );
      expect(receipt.meta.status).toBe(202);
      expect(partOf(mock)).toEqual({
        name: "file",
        filename: "brief.pdf",
        content_type: "application/pdf",
      });
    });
  });

  it("accepts a Uint8Array and an ArrayBuffer with a filename and guesses the media type", async () => {
    await withClient(
      [answer(202, documentUploaded), answer(202, documentUploaded), answer(202, documentUploaded)],
      async (client, mock) => {
        const bytes = new TextEncoder().encode("# Titel");
        await client.citationCheckDocuments.upload(bytes, { filename: "notiz.md" });
        await client.citationCheckDocuments.upload(bytes.buffer as ArrayBuffer, {
          filename: "scan.pdf",
        });
        await client.citationCheckDocuments.upload(bytes, {
          filename: "x.bin",
          contentType: "text/plain",
        });
        expect(partOf(mock, 0)).toMatchObject({
          filename: "notiz.md",
          content_type: "text/markdown",
        });
        expect(partOf(mock, 1)).toMatchObject({
          filename: "scan.pdf",
          content_type: "application/pdf",
        });
        expect(partOf(mock, 2)).toMatchObject({ filename: "x.bin", content_type: "text/plain" });
      },
    );
  });

  it("lets the options override what the File says", async () => {
    await withClient([answer(202, documentUploaded)], async (client, mock) => {
      await client.citationCheckDocuments.upload(new File(["x"], "a.txt", { type: "text/plain" }), {
        filename: "b.md",
        contentType: "text/markdown",
      });
      expect(partOf(mock)).toMatchObject({ filename: "b.md", content_type: "text/markdown" });
    });
  });

  it("needs a filename for bytes and for a Blob, and sends no request without one", async () => {
    await withClient([], async (client, mock) => {
      await expect(
        client.citationCheckDocuments.upload(new Uint8Array([1, 2])),
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(
        client.citationCheckDocuments.upload(new Blob(["x"], { type: "text/plain" })),
      ).rejects.toMatchObject({ code: "client_validation" });
      expect(mock.requests).toHaveLength(0);
    });
  });

  it("still accepts the older object form", async () => {
    await withClient([answer(202, documentUploaded)], async (client, mock) => {
      await client.citationCheckDocuments.upload({
        file: new Uint8Array([1]),
        filename: "a.pdf",
        contentType: "application/pdf",
      });
      expect(partOf(mock)).toMatchObject({ filename: "a.pdf", content_type: "application/pdf" });
    });
  });
});

describe("citationChecks.createFromFile", () => {
  it("uploads, waits until ready, then creates the check with the document id", async () => {
    const script = [
      answer(202, documentUploaded),
      answer(200, documentExtracting),
      answer(200, documentReady),
      answer(200, runExample),
    ];
    await withClient(script, async (client, mock, slept) => {
      const run = await client.citationChecks.createFromFile(
        new File(["%PDF"], "brief.pdf", { type: "application/pdf" }),
        { wait: { timeout: 60, interval: 3 }, reference_date: "2026-10-01" },
      );
      expect(run.id).toBe(runExample.id);
      expect(mock.requests.map((r) => `${r.method} ${r.target.split("?")[0]}`)).toEqual([
        "POST /api/v1/citation-check-documents",
        `GET /api/v1/citation-check-documents/${documentUploaded.id}`,
        `GET /api/v1/citation-check-documents/${documentUploaded.id}`,
        "POST /api/v1/citation-checks",
      ]);
      expect(slept).toEqual([3]);
      expect(JSON.parse((mock.requests[3] as { body: Buffer }).body.toString())).toEqual({
        document_id: documentReady.id,
        reference_date: "2026-10-01",
      });
    });
  });

  it("sends only document_id when no reference_date is given", async () => {
    await withClient(
      [answer(202, documentReady), answer(200, documentReady), answer(200, runExample)],
      async (client, mock) => {
        await client.citationChecks.createFromFile(new File(["x"], "a.txt"));
        const body = JSON.parse((mock.requests[2] as { body: Buffer }).body.toString());
        expect(body).toEqual({ document_id: documentReady.id });
      },
    );
  });

  it("throws DocumentFailedError and never creates the check", async () => {
    await withClient(
      [answer(202, documentUploaded), answer(200, documentFailed)],
      async (client, mock) => {
        const failure = await client.citationChecks
          .createFromFile(new File(["x"], "a.pdf"))
          .catch((e: unknown) => e);
        expect(failure).toBeInstanceOf(DocumentFailedError);
        expect((failure as DocumentFailedError).error_code).toBe("encrypted_pdf");
        expect(mock.requests).toHaveLength(2);
      },
    );
  });

  it("throws DocumentTimeoutError when the upload is not ready in time", async () => {
    await withClient(
      [answer(202, documentUploaded), answer(200, documentExtracting)],
      async (client) => {
        const failure = await client.citationChecks
          .createFromFile(new File(["x"], "a.pdf"), { wait: { timeout: 1, interval: 2 } })
          .catch((e: unknown) => e);
        expect(failure).toBeInstanceOf(DocumentTimeoutError);
      },
    );
  });
});
