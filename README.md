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
import { assertComplete, excerpt, groupByVerdict } from "@klaracase/sdk";

const run = await client.citationChecks.create({
  text: draftText, // 50 to 20,000 characters
  reference_date: "2026-10-01", // optional
});

// Check the status first. A run can end as "rejected" or "failed".
assertComplete(run);

const groups = groupByVerdict(run);
console.log(groups.verified_corpus.length, "found,", groups.not_found.length, "to check by hand");

for (const finding of groups.not_found) {
  // Not found in the corpus. This does not mean the citation is invented.
  console.log("check by hand:", excerpt(draftText, finding));
}
```

### Guard on the status

Always check `run.status` before you read `run.findings`. The status is `complete` only when the
check finished. A run can also be `rejected` or `failed`, or still be working when you read it with
`citationChecks.get`. Then the findings are not a full result, and a citation that is missing from
them has not been verified. `assertComplete(run)` throws `CitationCheckIncompleteError` for any
other status. The error has `run_status` and the `run`. Its `status` is `null`, because no HTTP
request failed. A complete run can still have `partial: true`. Read `partial` and
`findings_unavailable_reason` as well.

The helpers are plain functions and make no request:

| Helper                   | What it does                                                         |
| ------------------------ | -------------------------------------------------------------------- |
| `groupByVerdict(run)`    | Findings grouped by verdict. Each of the seven verdicts has a list.  |
| `assertComplete(run)`    | Throws `CitationCheckIncompleteError` unless `status` is `complete`. |
| `excerpt(text, finding)` | The cited text. Offsets count code points, so emoji do not shift it. |

The offsets of a finding are Unicode code point offsets into the text you sent. `text.slice` counts
UTF-16 units and cuts in the wrong place after an emoji. Use `excerpt`.

To check a file, upload it. The upload is free. PDF, DOCX, Markdown and plain text work, up to
25 MB. `upload` takes a `File`, a `Blob`, a `Uint8Array` or an `ArrayBuffer`. A `File` brings its own
name and media type. For bytes, pass `filename`.

```ts
import { readFile } from "node:fs/promises";

const receipt = await client.citationCheckDocuments.upload(await readFile("schriftsatz.pdf"), {
  filename: "schriftsatz.pdf",
});
const ready = await client.citationCheckDocuments.waitUntilReady(receipt.id, {
  pollInterval: 2, // seconds
  timeout: 120, // seconds
});
console.log("a check will cost", ready.quoted_credits, "credits");

const run = await client.citationChecks.create({ document_id: ready.id });
```

`createFromFile` does the three steps in one call:

```ts
import { assertComplete } from "@klaracase/sdk";

const run = await client.citationChecks.createFromFile(file, {
  wait: { timeout: 180, interval: 3 }, // seconds
  reference_date: "2026-10-01",
});
assertComplete(run);
```

`waitUntilReady` and `createFromFile` throw `DocumentFailedError` when the upload fails, for example
with `encrypted_pdf`. They throw `DocumentTimeoutError` when the time runs out.

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
| `client.citationCheckDocuments.upload(file, options)` | `POST /citation-check-documents`      |
| `client.citationCheckDocuments.get(id)`               | `GET /citation-check-documents/{id}`  |
| `client.citationCheckDocuments.waitUntilReady(id)`    | polls `get` until the upload is ready |
| `client.citationChecks.createFromFile(file)`          | upload, wait and check in one call    |
| `client.decisions.searchAll(query, filters, paging)`  | pages of `GET /decisions/search`      |
| `client.decisions.citationsAll(id, options, paging)`  | pages of the citations endpoint       |
| `client.corpus.coverage(options)`                     | `GET /corpus/coverage`                |
| `client.corpus.facets(field, options)`                | `GET /corpus/facets/{field}`          |

An `id` can be a UUID, an Aktenzeichen or an ECLI. The client encodes every path parameter as one
segment, so `VIII ZR 271/17` is sent as `VIII%20ZR%20271%2F17`. Arrays go out as
`cited_statutes[]=StGB&cited_statutes[]=StPO`. Options that you leave out or set to `undefined` are
not sent.

Full parameter lists are in the [API reference](https://klaracase.de/docs/api).

## Pagination

`decisions.searchAll` and `decisions.citationsAll` are async iterators over pages.

Paging the same query within a credit period costs no extra credits. A changed query, filter or mode is a new charge. Check `credits` on each response.
A search costs 1 credit per distinct query, filter set and mode, and the graph costs 2 credits per
decision, direction and depth. Each page is still a call. It counts against the rate limit and the
daily volume cap of your plan, and it takes time. So `maxPages` is required and has no default. It
is a guard against a runaway loop.

```ts
for await (const page of client.decisions.searchAll("Untreue", { court: "BGH" }, { maxPages: 3 })) {
  for (const hit of page.results) console.log(hit.aktenzeichen, hit.date);
  console.log("this page cost", page.credits.cost, "credits");
}

for await (const page of client.decisions.citationsAll("VIII ZR 271/17", {}, { maxPages: 2 })) {
  console.log(page.references.length, "references,", page.referenced_by.length, "cited by");
}
```

- The iterator yields whole pages, so you can read `credits` and `meta` of each one.
- It stops when a page has no results, or when the citations pages have no more, or after
  `maxPages` pages. An empty page is not yielded.
- `maxPages` is capped at the last page the endpoint serves: 10 for search, 20 for citations. A
  `page` in the filters is the first page.
- Breaking out of the loop stops the calls. Paging of citations works at depth 1 only.
- The third argument also takes `signal`, `timeout`, `maxRetries` and `headers` for every call.

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
  } else if (KlaracaseError.is(error)) {
    console.log(error.status, error.code, error.detail, error.retryable);
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
| `ServerError`                                 | 5xx except 503. It extends `ApiError`.              |
| `ApiError`                                    | any other status                                    |
| `TransportError`, `TimeoutError`              | no answer from the server                           |
| `DocumentFailedError`, `DocumentTimeoutError` | `waitUntilReady` ended without a ready upload       |
| `ConfigurationError`                          | bad client setup. Not a `KlaracaseError`.           |

An error has `type`, `title`, `status`, `detail`, `code`, `api_release`, `headers` and `extra`.
`extra` holds every other member of the problem body. A few members are also typed fields:

| Field                      | When                                                                 |
| -------------------------- | -------------------------------------------------------------------- |
| `candidates`               | `ambiguous_aktenzeichen`: the decisions that share the Aktenzeichen  |
| `successor`                | `statute_superseded`: the statute that replaced the cited one        |
| `unit`, `cap`, `resets_at` | `volume_cap`: what the daily cap counts, its size and when it resets |
| `retryable`                | `true` when the same request may succeed later (429, 5xx, transport) |
| `retryAfterSeconds`        | seconds the server asked you to wait, or `null`                      |

Use `KlaracaseError.is(error)` instead of `instanceof` when your app may load both the ESM and the
CommonJS build of the package, or two versions of it. Each copy has its own classes, so
`instanceof` can be false for an error from the other copy. `is` checks a shared brand. If the server answers with something that is not a problem
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
  not retried. The same check repeated in the same credit period costs nothing more, so you can repeat it
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
  timeout: 30, // seconds for each attempt, default 30
  maxRetries: 2, // default 2
  userAgentSuffix: "my-app/1.0", // appended to the User-Agent header
  defaultHeaders: { "X-Trace-Id": "abc" }, // sent with every request
  logLevel: "warn", // off, error, warn, info or debug
  logger: console, // anything with error, warn, info and debug
  fetch: globalThis.fetch, // your own fetch
  onDeprecation: (info) => console.warn(info), // see below
  dangerouslyAllowBrowser: false, // see "Browser and proxy pattern"
});
```

Timeouts are in seconds, in every Klaracase SDK, so the option means the same in each language. The
option for the API address is `baseUrl`.

The `User-Agent` is `klaracase-node/0.1.0 node/<version>`.

When the API announces a deprecation with `Deprecation` or `Sunset` headers, the client calls
`onDeprecation` once per process with the raw header values. The default writes one line at the
`warn` level. In tests, call `resetDeprecationWarnings()` to reset the guard.

## Logging

The client logs through the `logger` option. The default is `console`. Set the level with
`logLevel`, or with the `KLARACASE_LOG` environment variable. The option wins over the variable.
The default level is `warn`.

| Level   | What the client logs                                                      |
| ------- | ------------------------------------------------------------------------- |
| `warn`  | a deprecation notice from the API                                         |
| `info`  | one line per answer: method, path, status                                 |
| `debug` | every retry: method, path, status, attempt number and the wait in seconds |
| `off`   | nothing                                                                   |

The client never logs the token, a header, a request body or a query string. The query string is
left out because it holds your search text. `console.log(client)` does not show the token either.

```ts
import { Klaracase } from "@klaracase/sdk";

const client = new Klaracase({ logLevel: "debug", logger: console });
```

## Advanced

Per-request headers, and a client with changed options:

```ts
const found = await client.decisions.search("Untreue", {}, { headers: { "X-Trace-Id": "abc" } });

// A new client. The original is not changed, and the two share no state.
const patient = client.withOptions({ timeout: 120, maxRetries: 4 });
```

A header you pass to one call wins over `defaultHeaders`. `Authorization` and `Content-Type` cannot
be replaced. `withOptions` merges `defaultHeaders`: the new headers win, the rest stay.

A custom `fetch` lets you add a proxy, a dispatcher or a test double. It receives the URL and the
`RequestInit` that the client built.

```ts
import { Klaracase } from "@klaracase/sdk";

const proxied = new Klaracase({
  token: "klc_your_token_here",
  fetch: (input, init) => globalThis.fetch(input, { ...init, keepalive: true }),
});
```

## Credits

Most calls cost credits. The organization of the token pays.

- `decisions.search` and `search` cost 1 credit per distinct query and filter set per credit period; a repeat costs 0.
- `decisions.get` and `norms.get` cost 1 credit per decision or norm per credit period; a repeat costs 0.
- `decisions.citations` costs 2 credits. `datapackages.create` costs 5.
- `citationChecks.create` costs `max(2, ceil(characters / 5000))` credits.
- `corpus.coverage`, `corpus.facets`, uploads and reading a run or an upload are free.

One charge applies per operation, organization, subject and credit period. The same text
checked again in the same credit period costs 0. The response `credits` field shows the cost of each call.
Credits renew per credit period: the UTC calendar month for free organizations, the paid billing period for subscribers. Unused credits do not roll over.

## Schemas and validation

`@klaracase/sdk/schemas` holds a [zod](https://zod.dev) schema for every request input and every
response body. Use it to check arguments before you send them, or to check a body you got from a
cache or a queue.

```ts
import * as z from "zod/mini";
import { decisionSearchResponseSchema, searchDecisionsInputSchema } from "@klaracase/sdk/schemas";

const input = z.parse(searchDecisionsInputSchema, { query: "Untreue", limit: 5 });
const found = await client.decisions.search(input.query, { limit: input.limit });

const checked = z.parse(decisionSearchResponseSchema, JSON.parse(JSON.stringify(found)));
```

- The schemas use `zod/mini`. Install `zod` 4.1 or newer. It is an optional peer dependency: the
  main entry `@klaracase/sdk` does not import zod.
- Every object schema is loose. A key that the schema does not list survives the parse, so a newer
  API release does not break your validation.
- Enums in a response are open, like the types. Enums you send are closed lists.
- The inferred types are the types of the main entry. A test keeps them equal.
- The folder `schemas/` of the package holds the same schemas as JSON Schema files, one per schema,
  for tools that do not run JavaScript. Import one with
  `@klaracase/sdk/schemas/searchDecisionsInput.json`. They are generated by the build and committed.
  Input schemas refuse keys they do not list.

## Tools for agents

`@klaracase/sdk/tools` has four tool definitions and a dispatcher. It has no runtime dependency, so
it works with any agent loop that takes JSON Schema tools: Anthropic, OpenAI, an MCP host, your own.

```ts
import { callTool, tools } from "@klaracase/sdk/tools";

// The definitions: name, description and a JSON Schema for the arguments.
const definitions = tools.map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.inputSchema,
}));

// When the model calls a tool, run it. Pass the arguments as the model produced them.
const result = await callTool(client, "getDecision", { id: "VIII ZR 271/17" });
```

| Tool              | Calls                   | What `callTool` returns                                                                                                                |
| ----------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `searchDecisions` | `decisions.search`      | the body                                                                                                                               |
| `getDecision`     | `decisions.get`         | the body, with `max_chars` 4000 unless you set `maxChars`                                                                              |
| `getNorm`         | `norms.get`             | the body, with the norm text cut to `maxChars`                                                                                         |
| `checkCitations`  | `citationChecks.create` | a slim run: `id`, `status`, `verdict_counts`, `unique_citations`, and per finding `id`, `canonical`, `verdict`, `raw_text` and offsets |

`callTool(client, name, args, options)` takes `maxChars` (default 4000), `budget` and the request
options `signal`, `timeout`, `maxRetries` and `headers`.

- An error from the API comes back as `{ error: { code, detail, retry_after_seconds } }`, so the
  model can read it. Bad arguments and an unknown tool name come back the same way. Other errors,
  such as an abort, are thrown.
- A `budget` stops an agent from spending more than you allow. `{ credits: 10 }` is a shared
  counter: `callTool` takes the cost of each answer off it, and it does not send a call whose price
  does not fit. A repeat in the same credit period costs nothing.

```ts
import { callTool } from "@klaracase/sdk/tools";

const budget = { credits: 10 };
const answer = await callTool(client, "searchDecisions", { query: "Untreue" }, { budget });
console.log(budget.credits, "credits left");
```

Read the `status` of a `checkCitations` result before you rely on its verdicts.

### Vercel AI SDK

`@klaracase/ai-sdk` is a thin wrapper over these tools. It gives you the four tools in the shape that
`generateText` and `streamText` take. The AI SDK abort signal cancels the request.

```ts
import { generateText } from "ai";
import { Klaracase } from "@klaracase/sdk";
import { klaracaseTools } from "@klaracase/ai-sdk";

const aiClient = new Klaracase();
const { text } = await generateText({
  model: yourModel,
  tools: klaracaseTools(aiClient, { maxChars: 3000, budget: { credits: 20 } }),
  prompt: "Which BGH decisions deal with § 266 StGB and the Vermögensbetreuungspflicht?",
});
```

Pass `{ tools: ["searchDecisions", "getNorm"] }` to expose only some tools. See
[`packages/ai-sdk`](packages/ai-sdk).

### Other agent frameworks

For an agent with an MCP client, connect the Klaracase MCP server at <https://klaracase.de/mcp> with
the same token. The client itself does not speak MCP.

## Semantic versioning

This SDK follows [semantic versioning](https://semver.org), with the usual 0.x rule.

- Before 1.0, a minor version (0.1 to 0.2) may change the public surface. A patch version (0.1.0 to
  0.1.1) only fixes bugs. Pin the minor version: `"@klaracase/sdk": "~0.1.0"`.
- After 1.0, a breaking change needs a major version.
- The public surface is what the package exports from `@klaracase/sdk`, `@klaracase/sdk/schemas`
  and `@klaracase/sdk/tools`, and what [`api.md`](api.md) lists. Anything marked `@internal` is not
  part of it.
- An unknown field in a response, or a new value in a response enum, is not a breaking change. The
  response types are open for this reason. Write code that handles a value it does not know.
- Every change is listed in [CHANGELOG.md](CHANGELOG.md). All Klaracase SDKs bump together when the
  API contract changes.

## Stability and privacy

This SDK is 0.x and tracks API release 0.95.0.

The SDK sends no telemetry. The only thing it adds to a request is the User-Agent header
`klaracase-node/<version> <runtime>/<version>`, for example `klaracase-node/0.1.0 node/22.12.0`.

Klaracase is not affiliated with any court or with the federal government.

## Examples

Three programs in [`packages/sdk/examples`](packages/sdk/examples) show the common paths:
`quickstart.mjs`, `citation-check.mjs` (upload, poll, read the verdicts) and `agent-tools.mjs`.
They run offline against a small mock of the API, so they cost nothing.

```sh
pnpm build
node packages/sdk/examples/quickstart.mjs
node packages/sdk/examples/citation-check.mjs
node packages/sdk/examples/agent-tools.mjs
```

Add `--live` to call the real API with `KLARACASE_API_TOKEN`. That spends credits.

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
pnpm check-package   # publint and Are the Types Wrong? on both packages
pnpm docs:api        # regenerate api.md; fails when an export has no JSDoc
pnpm docs:check      # fail when api.md is out of date
pnpm examples        # run the three examples against the mock
```

`pnpm --filter @klaracase/sdk run test:bun` runs the tests on Bun, and `test:edge` runs them in the
Vercel Edge runtime.

## More

- API reference: <https://klaracase.de/docs/api>
- SDK reference, generated from the JSDoc: [api.md](api.md)
- MCP tools: <https://klaracase.de/docs/mcp>
- Support: support@klaracase.de
- Changes: [CHANGELOG.md](CHANGELOG.md)
- License: MIT, Copyright (c) 2026 SPARQ VENTURES UG
