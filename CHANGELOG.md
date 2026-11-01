# Changelog

All notable changes to this project are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `@klaracase/sdk` 0.1.0: REST client for the Klaracase API v1 with all twelve operations.
- `@klaracase/ai-sdk` 0.1.0: Vercel AI SDK tools over the core client.
- Runtime detector that never throws: Deno, Bun, Vercel Edge, Cloudflare Workers, Node, browser,
  else `unknown`. The client now builds on hosts without `process`.
- Option `dangerouslyAllowBrowser`. Without it, the constructor throws `ConfigurationError` (code
  `client_validation`) when `window` and `document` exist.
- CI lanes for Bun and for the Vercel Edge runtime (vitest `edge-runtime` environment).
- `ConfigurationError.code`.
- Complete typed response model for all twelve operations, derived from the example bodies. No
  response type has an index signature any more. `getExtra(body, key)` reads an undeclared key.
- `ResponseMeta.headers` (the response `Headers`).
- `CITATION_VERDICTS` and `isKnownVerdict()`.
- Request enums are strict unions (`mode`, `branch`, `document_type`, `cited_statutes`,
  `direction`, `depth`, facet `type`). Response enums stay open.
- Every input type accepts `undefined` for optional keys (`exactOptionalPropertyTypes` safe).
  A second tsconfig compiles the sources, the tests and the README examples with that flag.
- Type tests that assign every example and conformance body to its response type, and a key
  manifest test that fails when a body carries a key the type does not declare.

- `KlaracaseError.is(error)` and `ConfigurationError.is(error)`, based on `Symbol.for` brands, for
  apps that load both the ESM and the CJS build.
- `ServerError` (5xx except 503, extends `ApiError`).
- `headers` on every error that came with an answer.
- Typed problem extras on every error: `candidates`, `successor`, `unit`, `cap`, `resets_at`, plus
  `retryable` and `retryAfterSeconds`.

### Changed

- Every error class sets `name` with an explicit string, so a minifier cannot rename it.

- `corpus.coverage` `branches[].count` and `courts[].count` are `Count` objects, not numbers.
- `corpus.facets` has the optional key `norm`. `decisions.get` has the optional `returned_range`.
- `SearchMode`, `Branch`, `DocumentType` and `CitedStatute` are strict unions. Use `Open<...>` for a
  response value.

### Not done yet

- TODO: a Deno lane. No Deno binary was available when the lanes were added.
- TODO: a Cloudflare Workers (workerd) lane through `@cloudflare/vitest-pool-workers`.
