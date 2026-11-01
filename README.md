# Klaracase for TypeScript and Node.js

The official client for the [Klaracase](https://klaracase.de) REST API. Klaracase holds German
court decisions and German statutes, linked by a citation graph.

Klaracase covers German law only. It is a research tool. It gives no legal advice and does not
replace a lawyer's review. A `not_found` verdict means the citation was not found in the corpus; it
is not a claim that the citation is fabricated.

This repository has two packages:

| Package                                | What it is                                                 |
| -------------------------------------- | ---------------------------------------------------------- |
| [`@klaracase/sdk`](packages/sdk)       | The API client. No runtime dependencies. Node 22 or newer. |
| [`@klaracase/ai-sdk`](packages/ai-sdk) | Tools for the Vercel AI SDK, built on the client.          |

The client calls the REST API. It does not speak MCP. If your agent has an MCP client, connect it
to `https://klaracase.de/mcp` with the same token.

## Install

```sh
npm install @klaracase/sdk
```

The package ships ESM and CommonJS builds with type files.

```ts
// ESM
import { Klaracase } from "@klaracase/sdk";
```

```js
// CommonJS
const { Klaracase } = require("@klaracase/sdk");
```

## Requirements and runtimes

The client needs a global `fetch`, `FormData`, `Blob` and `AbortSignal.any`. It has no runtime
dependencies and imports no Node module.

| Runtime            | Version | Tested in CI                           |
| ------------------ | ------- | -------------------------------------- |
| Node.js            | 22+     | 22, 24 and 26                          |
| Bun                | 1.x     | the whole suite                        |
| Vercel Edge        | current | the whole suite, in the Edge sandbox   |
| Deno               | 2+      | not in CI yet, see the changelog       |
| Cloudflare Workers | current | not in CI yet, see the changelog       |
| Browsers           | current | not supported without your own backend |

The `User-Agent` names the runtime it detects: `node/22.12.0`, `bun/1.4.4`, `deno/2.1.0`,
`vercel-edge/unknown`, `cloudflare-workers/unknown`, `browser/unknown` or `unknown/unknown`. The
detector never throws, so the client builds on a host that has no `process` object.

## Browser and proxy pattern

The token is an organization secret. Do not ship it to a browser. The constructor throws a
`ConfigurationError` with the code `client_validation` when it finds `window` and `document` and
you did not pass `dangerouslyAllowBrowser: true`.

Keep the token on your server. Give the browser your own route, and point the `fetch` option at it.
The client then sends its requests to your route, and your route adds the token.

```ts
// In the browser. No token is needed here, but the constructor wants a placeholder.
import { Klaracase } from "@klaracase/sdk";

const client = new Klaracase({
  token: "proxied",
  baseUrl: "https://app.example.com/klaracase",
  dangerouslyAllowBrowser: true,
  fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
});
```

```ts
// On your server (a route handler). It adds the real token and forwards the call.
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/klaracase/, "");
  return fetch(`https://klaracase.de/api/v1${path}${url.search}`, {
    headers: {
      Authorization: `Bearer ${process.env.KLARACASE_API_TOKEN}`,
      Accept: "application/json",
    },
  });
}
```

Check the signed-in user and rate-limit the route yourself. Every call it forwards costs credits.

## Get a token

Create a token at <https://klaracase.de/settings/api-tokens>. You need to be signed in with a
verified email.

- A token belongs to the organization that is open when you create it. That organization pays for
  every call.
- A token carries abilities. There are five: `search`, `read`, `graph`, `datapackage` and
  `citation-check`. All five are ticked by default.
- A token expires after 30, 90, 180 or 365 days. The default is 365.

Pass the token to the client, or set `KLARACASE_API_TOKEN` and pass nothing. A missing token raises
`ConfigurationError` when you build the client, not a 401 later. Never commit a token.

## Quick start

```ts
import { Klaracase } from "@klaracase/sdk";

const client = new Klaracase({ token: "klc_your_token_here" });

const found = await client.decisions.search("Vermögensbetreuungspflicht", {
  court: "BGH",
  date_from: "2015-01-01",
  limit: 5,
});

for (const hit of found.results) {
  console.log(hit.aktenzeichen, hit.court, hit.date, hit.title);
}
console.log(found.credits.cost, "credit used,", found.credits.credits_remaining, "left");
```

Request parameters use the names of the API, such as `date_from` and `cited_statutes`. They are
typed strictly. Client options and method names use camel case.

## Check the citations in a text

`citationChecks.create` checks every court-decision and statute citation in a German legal text. It
answers when the check is finished.

```ts
const run = await client.citationChecks.create({
  text: draftText, // 50 to 20,000 characters
  reference_date: "2026-10-01", // optional
});

for (const finding of run.findings) {
  const where = draftText.slice(finding.start_offset, finding.end_offset);
  switch (finding.verdict) {
    case "verified_corpus":
    case "verified_external":
      console.log("found:", where);
      break;
    case "not_found":
      // Not found in the corpus. This does not mean the citation is invented.
      console.log("check by hand:", where);
      break;
    case "out_of_coverage":
    case "ambiguous":
    case "unverifiable":
    case "discrepancy":
      console.log(finding.verdict + ":", where);
      break;
    default:
      console.log("new verdict:", finding.verdict, where);
  }
}
```

The offsets are Unicode code point offsets into the text you sent. For text that has characters
outside the basic plane, slice with `Array.from(draftText)`.

To check a file, upload it first. The upload is free. PDF, DOCX, Markdown and plain text work, up to
25 MB.

```ts
import { readFile } from "node:fs/promises";

const receipt = await client.citationCheckDocuments.upload({
  file: await readFile("schriftsatz.pdf"),
  filename: "schriftsatz.pdf",
  contentType: "application/pdf",
});
const ready = await client.citationCheckDocuments.waitUntilReady(receipt.id, {
  pollInterval: 2, // seconds
  timeout: 120, // seconds
});
console.log("a check will cost", ready.quoted_credits, "credits");

const run = await client.citationChecks.create({ document_id: ready.id });
```

`waitUntilReady` throws `DocumentFailedError` when the upload fails, for example with
`encrypted_pdf`. It throws `DocumentTimeoutError` when the time runs out.

## All operations

| Method                                                | Endpoint                              |
| ----------------------------------------------------- | ------------------------------------- |
| `client.decisions.search(query, filters)`             | `GET /decisions/search`               |
| `client.search(query, filters)`                       | `GET /search` (laws and decisions)    |
| `client.decisions.get(id, options)`                   | `GET /decisions/{id}`                 |
| `client.decisions.citations(id, options)`             | `GET /decisions/{id}/citations`       |
| `client.norms.get(reference, options)`                | `GET /norms/{reference}`              |
| `client.datapackages.create({ ids, ... })`            | `POST /datapackages`                  |
| `client.citationChecks.create({ text })`              | `POST /citation-checks`               |
| `client.citationChecks.get(runId)`                    | `GET /citation-checks/{run}`          |
| `client.citationCheckDocuments.upload({ file, ... })` | `POST /citation-check-documents`      |
| `client.citationCheckDocuments.get(id)`               | `GET /citation-check-documents/{id}`  |
| `client.citationCheckDocuments.waitUntilReady(id)`    | polls `get` until the upload is ready |
| `client.corpus.coverage(options)`                     | `GET /corpus/coverage`                |
| `client.corpus.facets(field, options)`                | `GET /corpus/facets/{field}`          |

An `id` can be a UUID, an Aktenzeichen or an ECLI. The client encodes every path parameter as one
segment, so `VIII ZR 271/17` is sent as `VIII%20ZR%20271%2F17`. Arrays go out as
`cited_statutes[]=StGB&cited_statutes[]=StPO`. Options that you leave out or set to `undefined` are
not sent.

Full parameter lists are in the [API reference](https://klaracase.de/docs/api).

## Responses

Each method returns the answer body, parsed. Nothing in it is renamed, reordered or cleaned.

The response types list the documented keys and nothing else. They have no index signature, so a
misspelled key is a compile error. A key that a later API release adds still exists at run time.
Read it with `getExtra`:

```ts
import { getExtra } from "@klaracase/sdk";

const found = await client.decisions.search("Untreue");
const added = getExtra(found, "a_key_from_a_later_release"); // unknown
```

Enum values in a response are open: `verdict` is a known name or any other string. Enum values you
send are strict unions, such as `mode: "keyword" | "semantic" | "hybrid"`. `CITATION_VERDICTS` lists
the seven verdicts, and `isKnownVerdict(value)` tells you whether a value is one of them.

Each body also has a `meta` property with `status`, `api_release` (from `X-Klaracase-Api-Release`),
`request_duration` in seconds and `headers` (the response `Headers`). `meta` is not enumerable. It
does not show in `JSON.stringify(result)`, `Object.keys(result)` or a spread copy. Read
`result.meta` directly. `result.credits` has `metered`, `cost` and `credits_remaining`. The body
itself is a plain mutable object.

All input types accept `undefined` for an optional key, also under `exactOptionalPropertyTypes`.

## Errors

Every error from the API or the network extends `KlaracaseError`. The class follows the HTTP status.

```ts
import {
  Klaracase,
  KlaracaseError,
  InsufficientCreditsError,
  RateLimitError,
  TransportError,
  ValidationError,
} from "@klaracase/sdk";

try {
  await client.decisions.get("VIII ZR 999/99");
} catch (error) {
  if (error instanceof InsufficientCreditsError) {
    console.log("out of credits:", error.cost, error.balance);
  } else if (error instanceof RateLimitError) {
    console.log("wait", error.retry_after_seconds, "seconds");
  } else if (error instanceof ValidationError) {
    console.log(error.errors); // field name to a list of messages
  } else if (error instanceof TransportError) {
    console.log("no answer:", error.message); // also covers TimeoutError
  } else if (error instanceof KlaracaseError) {
    console.log(error.status, error.code, error.detail);
  } else {
    throw error;
  }
}
```

| Class                                         | When                                                |
| --------------------------------------------- | --------------------------------------------------- |
| `AuthenticationError`                         | 401                                                 |
| `InsufficientCreditsError`                    | 402, with `cost` and `balance`                      |
| `PermissionError`                             | 403, with `required_ability`                        |
| `NotFoundError`                               | 404                                                 |
| `ConflictError`                               | 409                                                 |
| `ValidationError`                             | 422, with `errors`. Also raised before any request. |
| `RateLimitError`                              | 429, with `retry_after_seconds`                     |
| `ServiceUnavailableError`                     | 503                                                 |
| `ApiError`                                    | any other status                                    |
| `TransportError`, `TimeoutError`              | no answer from the server                           |
| `DocumentFailedError`, `DocumentTimeoutError` | `waitUntilReady` ended without a ready upload       |
| `ConfigurationError`                          | bad client setup. Not a `KlaracaseError`.           |

An error has `type`, `title`, `status`, `detail`, `code`, `api_release` and `extra`. `extra` holds
every other member of the problem body. If the server answers with something that is not a problem
body, such as an HTML page from a proxy, `code` is `unknown` and `detail` holds the first 1,000
characters of the body.

Passing both `text` and `document_id`, or neither, to `citationChecks.create` raises a
`ValidationError` with the code `client_validation`. No request is sent.

## Retries and timeouts

The client retries at most `maxRetries` times (default 2).

- It retries on 429 and 503. Both statuses mean nothing ran and nothing was charged, so a retry is
  safe on every operation, including POST.
- It waits for `retry_after_seconds` from the body, or the `Retry-After` header. Without one it
  backs off for up to 0.5 s, then 1 s, then 2 s, with random jitter, never more than 8 s.
- If the server asks for more than 30 seconds, the client does not sleep. It throws
  `RateLimitError` and you decide. The daily `volume_cap` is handled this way.
- It never retries 402 or any other 4xx, and it does not retry 500 or 502.
- It retries a transport error on GET only. A POST whose connection dropped after it was sent is
  not retried. The same check repeated in the same month costs nothing more, so you can repeat it
  by hand.

`timeout` is in seconds for each attempt (default 30). You can set `timeout`, `maxRetries` and an
`AbortSignal` for a single call:

```ts
await client.norms.get("§ 535 BGB", {}, { timeout: 10, maxRetries: 0, signal: controller.signal });
```

## Client options

```ts
import { Klaracase } from "@klaracase/sdk";

new Klaracase({
  token: "klc_your_token_here", // or KLARACASE_API_TOKEN
  baseUrl: "https://klaracase.de/api/v1", // default
  timeout: 30, // seconds, default 30
  maxRetries: 2, // default 2
  userAgentSuffix: "my-app/1.0", // appended to the User-Agent header
  fetch: globalThis.fetch, // your own fetch
  onDeprecation: (info) => console.warn(info), // see below
  sleep: async (seconds) => void seconds, // for tests
  now: () => performance.now() / 1000, // for tests
});
```

The `User-Agent` is `klaracase-node/0.1.0 node/<version>`.

When the API announces a deprecation with `Deprecation` or `Sunset` headers, the client calls
`onDeprecation` once per process with the raw header values. The default logs one `console.warn`
line. In tests, call `resetDeprecationWarnings()` to reset the guard.

## Credits

Most calls cost credits. The organization of the token pays.

- `decisions.search` and `search` cost 1 credit per distinct query and filter set per calendar month; a repeat costs 0.
- `decisions.get` and `norms.get` cost 1 credit per decision or norm per calendar month; a repeat costs 0.
- `decisions.citations` costs 2 credits. `datapackages.create` costs 5.
- `citationChecks.create` costs `max(2, ceil(characters / 5000))` credits.
- `corpus.coverage`, `corpus.facets`, uploads and reading a run or an upload are free.

One charge applies per operation, organization, subject and calendar month (UTC). The same text
checked again in the same month costs 0. The response `credits` field shows the cost of each call.

## Use with the Vercel AI SDK

`@klaracase/ai-sdk` turns the client into tools for `generateText` and `streamText`.

```ts
import { generateText } from "ai";
import { Klaracase } from "@klaracase/sdk";
import { klaracaseTools } from "@klaracase/ai-sdk";

const client = new Klaracase();
const { text } = await generateText({
  model: yourModel,
  tools: klaracaseTools(client),
  prompt: "Which BGH decisions deal with § 266 StGB and the Vermögensbetreuungspflicht?",
});
```

Pass `{ tools: ["searchDecisions", "getNorm"] }` to expose only some tools. See
[`packages/ai-sdk`](packages/ai-sdk).

### Agents

For frameworks other than the Vercel AI SDK, connect the Klaracase MCP server at
<https://klaracase.de/mcp> with the same token. The client itself does not speak MCP.

## Stability and privacy

This SDK is 0.x and tracks API release 0.95.0. Minor versions may change the public surface until
1.0. Every change is listed in [CHANGELOG.md](CHANGELOG.md). All Klaracase SDKs bump together when
the API contract changes.

The SDK sends no telemetry. The only thing it adds to a request is the User-Agent header
`klaracase-node/<version> <runtime>/<version>`, for example `klaracase-node/0.1.0 node/22.12.0`.

Klaracase is not affiliated with any court or with the federal government.

## Smoke test

`pnpm smoke` calls the two free endpoints with a real token. It needs a build first.

```sh
pnpm build
KLARACASE_API_TOKEN=<token> pnpm smoke
```

## Development

```sh
pnpm install
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## More

- API reference: <https://klaracase.de/docs/api>
- MCP tools: <https://klaracase.de/docs/mcp>
- Support: support@klaracase.de
- Changes: [CHANGELOG.md](CHANGELOG.md)
- License: MIT, Copyright (c) 2026 SPARQ VENTURES UG
