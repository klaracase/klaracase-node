// A small mock of the Klaracase API for the examples. It answers with the example bodies of the
// API contract in tests/fixtures/examples, so every example runs offline and spends no credits.
// It is not part of the package. Run an example with `--live` to use the real API instead.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixtures = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "tests",
  "fixtures",
  "examples",
);
const fixture = (name) => JSON.parse(readFileSync(join(fixtures, `${name}.json`), "utf8"));

/**
 * Start the mock on a free local port.
 * @returns {Promise<{ baseUrl: string, requests: string[], stop: () => Promise<void> }>}
 */
export async function startMockApi() {
  const requests = [];
  let documentPolls = 0;

  const route = (method, path) => {
    if (method === "GET" && path === "/decisions/search") return [200, fixture("decisions.search")];
    if (method === "GET" && path.startsWith("/decisions/")) return [200, fixture("decisions.show")];
    if (method === "GET" && path.startsWith("/norms/")) return [200, fixture("norms.show")];
    if (method === "POST" && path === "/citation-checks")
      return [200, fixture("citation-checks.store")];
    if (method === "POST" && path === "/citation-check-documents") {
      return [202, fixture("citation-check-documents.store")];
    }
    if (method === "GET" && path.startsWith("/citation-check-documents/")) {
      documentPolls += 1;
      const receipt = fixture("citation-check-documents.show");
      return [200, documentPolls < 3 ? { ...receipt, status: "processing" } : receipt];
    }
    return [
      404,
      { status: 404, code: "not_found", title: "Not found", detail: `No route for ${path}.` },
    ];
  };

  const server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname.replace(
        /^\/api\/v1/,
        "",
      );
      requests.push(`${request.method} ${path}`);
      const [status, body] = route(request.method ?? "GET", path);
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}/api/v1`,
    requests,
    stop: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/**
 * Build the client for an example. Without `--live` it talks to the mock with a placeholder
 * token. With `--live` it reads KLARACASE_API_TOKEN and calls https://klaracase.de, and the
 * calls cost credits.
 */
export async function connect(Klaracase) {
  if (process.argv.includes("--live")) {
    return { client: new Klaracase(), stop: async () => {}, requests: [] };
  }
  const mock = await startMockApi();
  const client = new Klaracase({ token: "klc_your_token_here", baseUrl: mock.baseUrl });
  return { client, stop: mock.stop, requests: mock.requests };
}
