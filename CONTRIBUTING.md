# Contributing

This repository is a pnpm workspace. You need Node 22 or newer and pnpm 10.

```sh
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Rules:

- The core package `@klaracase/sdk` has no runtime dependencies. Do not add one.
- Request parameters are typed strictly. Response types keep unknown keys.
- Every change to behavior needs a test against the local mock server. No test may touch the
  network.
- The shared conformance cases live in `packages/sdk/tests/fixtures/conformance`. Do not edit them
  here. They are copied from the Klaracase SDK contract.
- Keep commits small and use semantic commit messages.
