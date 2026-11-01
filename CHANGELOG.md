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

### Not done yet

- TODO: a Deno lane. No Deno binary was available when the lanes were added.
- TODO: a Cloudflare Workers (workerd) lane through `@cloudflare/vitest-pool-workers`.
