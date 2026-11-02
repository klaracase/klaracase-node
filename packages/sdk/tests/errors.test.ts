import { describe, expect, it } from "vitest";
import {
  ApiError,
  AuthenticationError,
  ConfigurationError,
  ConflictError,
  DocumentFailedError,
  DocumentTimeoutError,
  InsufficientCreditsError,
  Klaracase,
  KlaracaseError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  ServerError,
  ServiceUnavailableError,
  TimeoutError,
  TokenLimitReachedError,
  TransportError,
  ValidationError,
  type AmbiguousCandidate,
} from "../src/index.js";
import type * as ErrorsModule from "../src/errors.js";
import ambiguous from "./fixtures/conformance/problems/ambiguous_aktenzeichen.json";
import superseded from "./fixtures/conformance/problems/statute_superseded.json";
import volumeCap from "./fixtures/conformance/problems/volume_cap.json";
import rateLimited from "./fixtures/conformance/problems/rate_limited.json";
import internalError from "./fixtures/conformance/problems/internal_error.json";
import budgetEmpty from "./fixtures/conformance/problems/insufficient_credits.api_budget_empty.json";
import budgetNotAvailable from "./fixtures/conformance/problems/insufficient_credits.api_budget_not_available.json";
import insufficientCredits from "./fixtures/conformance/problems/insufficient_credits.json";
import tokenLimitReached from "./fixtures/conformance/problems/token_limit_reached.json";
import unauthenticated from "./fixtures/conformance/problems/unauthenticated.json";

/** A client whose fetch answers once with the given problem body. */
function clientAnswering(body: unknown, headers: Record<string, string> = {}, status?: number) {
  const code = status ?? (body as { status: number }).status;
  const fetchMock = (async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status: code,
      headers: { "content-type": "application/problem+json", ...headers },
    })) as typeof fetch;
  return new Klaracase({
    token: "t",
    fetch: fetchMock,
    maxRetries: 0,
    sleep: async () => undefined,
  });
}

async function failureOf(promise: Promise<unknown>): Promise<KlaracaseError> {
  const failure = await promise.catch((error: unknown) => error);
  expect(KlaracaseError.is(failure)).toBe(true);
  return failure as KlaracaseError;
}

describe("error names", () => {
  it("sets an explicit name on every class, so a minifier cannot rename it", () => {
    const document = { id: "d", status: "failed", error_code: "encrypted_pdf" };
    const names = new Map<string, Error>([
      ["KlaracaseError", new KlaracaseError()],
      ["AuthenticationError", new AuthenticationError()],
      ["InsufficientCreditsError", new InsufficientCreditsError()],
      ["TokenLimitReachedError", new TokenLimitReachedError()],
      ["PermissionError", new PermissionError()],
      ["NotFoundError", new NotFoundError()],
      ["ConflictError", new ConflictError()],
      ["ValidationError", new ValidationError()],
      ["RateLimitError", new RateLimitError()],
      ["ServiceUnavailableError", new ServiceUnavailableError()],
      ["ApiError", new ApiError()],
      ["ServerError", new ServerError()],
      ["TransportError", new TransportError()],
      ["TimeoutError", new TimeoutError()],
      ["DocumentFailedError", new DocumentFailedError(document)],
      ["DocumentTimeoutError", new DocumentTimeoutError(document, 1)],
      ["ConfigurationError", new ConfigurationError("x")],
    ]);
    for (const [name, error] of names) expect(error.name).toBe(name);
  });
});

describe("KlaracaseError.is", () => {
  it("recognizes errors from another copy of the module (dual package hazard)", async () => {
    // A query string gives the bundler a second module instance, like a second installed copy.
    const specifier = "../src/errors.js?copy=1";
    const copy = (await import(/* @vite-ignore */ specifier)) as typeof ErrorsModule;
    const foreign = new copy.NotFoundError({ status: 404 });
    expect(foreign).not.toBeInstanceOf(NotFoundError);
    expect(KlaracaseError.is(foreign)).toBe(true);
    expect(copy.KlaracaseError.is(new NotFoundError())).toBe(true);
    expect(ConfigurationError.is(new copy.ConfigurationError("x"))).toBe(true);
  });

  it("rejects things that are not Klaracase errors", () => {
    expect(KlaracaseError.is(new Error("x"))).toBe(false);
    expect(KlaracaseError.is(null)).toBe(false);
    expect(KlaracaseError.is("KlaracaseError")).toBe(false);
    expect(KlaracaseError.is({ name: "KlaracaseError" })).toBe(false);
    expect(KlaracaseError.is(new ConfigurationError("x"))).toBe(false);
  });
});

describe("HTTP errors", () => {
  it("carry status and headers", async () => {
    const error = await failureOf(
      clientAnswering(unauthenticated, { "x-request-id": "abc" }).corpus.coverage(),
    );
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.status).toBe(401);
    expect(error.headers?.get("x-request-id")).toBe("abc");
    expect(error.retryable).toBe(false);
  });

  it("maps a 500 to ServerError, which is an ApiError", async () => {
    const error = await failureOf(clientAnswering(internalError).corpus.coverage());
    expect(error).toBeInstanceOf(ServerError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
    expect(error.retryable).toBe(true);
  });

  it("maps a 502 HTML page to ServerError with code unknown", async () => {
    const error = await failureOf(
      clientAnswering(
        "<html>bad gateway</html>",
        { "content-type": "text/html" },
        502,
      ).corpus.coverage(),
    );
    expect(error).toBeInstanceOf(ServerError);
    expect(error.code).toBe("unknown");
  });

  it("types the candidates of an ambiguous Aktenzeichen", async () => {
    const error = await failureOf(clientAnswering(ambiguous).decisions.get("5 U 123/19"));
    expect(error).toBeInstanceOf(ValidationError);
    const candidates = error.candidates as AmbiguousCandidate[];
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toEqual({
      id: "0193b0c7-1a2b-7c3d-8e4f-5a6b7c8d9e01",
      court: "OLG Hamm",
      date: "2019-06-12",
      aktenzeichen: "5 U 123/19",
    });
    expect(error.retryable).toBe(false);
  });

  it("types the successor of a superseded statute", async () => {
    const error = await failureOf(clientAnswering(superseded).norms.get("§ 1 BBauG"));
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.successor).toBe("BauGB");
    expect(error.candidates).toBeUndefined();
  });

  it("types unit, cap and resets_at of the volume cap and exposes the wait", async () => {
    const error = await failureOf(clientAnswering(volumeCap).corpus.coverage());
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.unit).toBe("rows");
    expect(error.cap).toBe(1000);
    expect(error.resets_at).toBe("2026-11-02T00:00:00+01:00");
    expect(error.retryAfterSeconds).toBe(41230);
    expect((error as RateLimitError).retry_after_seconds).toBe(41230);
    expect(error.retryable).toBe(true);
  });

  it("takes retryAfterSeconds from the Retry-After header when the body names none", async () => {
    const { retry_after_seconds: _removed, ...withoutWait } = rateLimited;
    const error = await failureOf(
      clientAnswering(withoutWait, { "retry-after": "7" }).corpus.coverage(),
    );
    expect(error.retryAfterSeconds).toBe(7);
    expect((error as RateLimitError).retry_after_seconds).toBe(7);
  });

  it("marks 402 and 422 as not retryable and transport errors as retryable", () => {
    expect(new InsufficientCreditsError({ status: 402 }).retryable).toBe(false);
    expect(new ValidationError({ status: 422 }).retryable).toBe(false);
    expect(new TransportError().retryable).toBe(true);
    expect(new TimeoutError().retryable).toBe(true);
    expect(new ServiceUnavailableError({ status: 503 }).retryable).toBe(true);
    expect(new ValidationError({ code: "client_validation" }).retryable).toBe(false);
  });
});

describe("402 insufficient_credits with a reason (API release 0.96.0)", () => {
  it("reads reason and topUpUrl, and keeps them in extra", async () => {
    const error = await failureOf(clientAnswering(budgetEmpty).corpus.coverage());
    expect(error).toBeInstanceOf(InsufficientCreditsError);
    expect(error).not.toBeInstanceOf(TokenLimitReachedError);
    const credits = error as InsufficientCreditsError;
    expect(credits.reason).toBe("api_budget_empty");
    expect(credits.topUpUrl).toBe("https://klaracase.de/org/billing/api-budget");
    expect(credits.cost).toBe(1);
    expect(credits.balance).toBe(0);
    expect(credits.extra["reason"]).toBe("api_budget_empty");
    expect(credits.extra["top_up_url"]).toBe("https://klaracase.de/org/billing/api-budget");
    expect(credits.retryable).toBe(false);
  });

  it("does not require top_up_url", async () => {
    const error = (await failureOf(
      clientAnswering(budgetNotAvailable).corpus.coverage(),
    )) as InsufficientCreditsError;
    expect(error.reason).toBe("api_budget_not_available");
    expect(error.topUpUrl).toBeUndefined();
  });

  it("keeps a reason that a later release adds, and the reserved one", async () => {
    const later = { ...budgetEmpty, reason: "something_new" };
    const error = (await failureOf(
      clientAnswering(later).corpus.coverage(),
    )) as InsufficientCreditsError;
    expect(error.reason).toBe("something_new");
    const reserved = (await failureOf(
      clientAnswering({ ...budgetEmpty, reason: "plan_credits_exhausted" }).corpus.coverage(),
    )) as InsufficientCreditsError;
    expect(reserved.reason).toBe("plan_credits_exhausted");
  });

  it("leaves reason and topUpUrl undefined for the older body", async () => {
    const error = (await failureOf(
      clientAnswering(insufficientCredits).corpus.coverage(),
    )) as InsufficientCreditsError;
    expect(error.reason).toBeUndefined();
    expect(error.topUpUrl).toBeUndefined();
    expect(error.cost).not.toBeNull();
  });

  it("reads apiBudget from the optional api_budget member", async () => {
    const budget = { cents: 0, rate_cents_per_credit: 25, credits_at_rate: 0 };
    const error = (await failureOf(
      clientAnswering({ ...budgetEmpty, api_budget: budget }).corpus.coverage(),
    )) as InsufficientCreditsError;
    expect(error.apiBudget).toEqual(budget);
    expect(error.extra["api_budget"]).toEqual(budget);
    const without = (await failureOf(
      clientAnswering(budgetEmpty).corpus.coverage(),
    )) as InsufficientCreditsError;
    expect(without.apiBudget).toBeUndefined();
  });

  it("ignores members of the wrong type", () => {
    const error = new InsufficientCreditsError({
      status: 402,
      extra: { reason: 3, top_up_url: false, api_budget: "free" },
    });
    expect(error.reason).toBeUndefined();
    expect(error.topUpUrl).toBeUndefined();
    expect(error.apiBudget).toBeUndefined();
  });
});

describe("402 token_limit_reached (API release 0.96.0)", () => {
  it("is a TokenLimitReachedError and an InsufficientCreditsError, with no cost and no balance", async () => {
    const error = await failureOf(clientAnswering(tokenLimitReached).corpus.coverage());
    expect(error).toBeInstanceOf(TokenLimitReachedError);
    expect(error).toBeInstanceOf(InsufficientCreditsError);
    const limit = error as TokenLimitReachedError;
    expect(limit.name).toBe("TokenLimitReachedError");
    expect(limit.status).toBe(402);
    expect(limit.code).toBe("token_limit_reached");
    expect(limit.cost).toBeNull();
    expect(limit.balance).toBeNull();
    expect(limit.reason).toBeUndefined();
    expect(limit.topUpUrl).toBeUndefined();
    expect(limit.retryable).toBe(false);
  });

  it("reads unit, cap, spent, resetsAt and settingsUrl", async () => {
    const limit = (await failureOf(
      clientAnswering(tokenLimitReached).corpus.coverage(),
    )) as TokenLimitReachedError;
    expect(limit.unit).toBe("credits");
    expect(limit.cap).toBe(500);
    expect(limit.spent).toBe(500);
    expect(limit.resets_at).toBe("2026-12-01T00:00:00+00:00");
    expect(limit.resetsAt).toEqual(new Date("2026-12-01T00:00:00Z"));
    expect(limit.settingsUrl).toBe("https://klaracase.de/org/api-keys");
    expect(limit.extra["settings_url"]).toBe("https://klaracase.de/org/api-keys");
    expect(limit.extra["spent"]).toBe(500);
  });

  it("tolerates a body without the optional members, and a date it cannot parse", () => {
    const bare = new TokenLimitReachedError({ status: 402, code: "token_limit_reached" });
    expect(bare.spent).toBeUndefined();
    expect(bare.resetsAt).toBeUndefined();
    expect(bare.resets_at).toBeUndefined();
    expect(bare.settingsUrl).toBeUndefined();
    const odd = new TokenLimitReachedError({ status: 402, extra: { resets_at: "soon" } });
    expect(odd.resets_at).toBe("soon");
    expect(odd.resetsAt).toBeUndefined();
  });

  it("is not retried, whatever max_retries says", async () => {
    let calls = 0;
    const client = new Klaracase({
      token: "t",
      maxRetries: 2,
      sleep: async () => undefined,
      fetch: (async () => {
        calls += 1;
        return new Response(JSON.stringify(tokenLimitReached), {
          status: 402,
          headers: { "content-type": "application/problem+json" },
        });
      }) as typeof fetch,
    });
    await expect(client.corpus.coverage()).rejects.toBeInstanceOf(TokenLimitReachedError);
    expect(calls).toBe(1);
  });

  it("keeps a 402 with another code a plain InsufficientCreditsError", async () => {
    const error = await failureOf(
      clientAnswering({ ...insufficientCredits, code: "something_else" }).corpus.coverage(),
    );
    expect(error).toBeInstanceOf(InsufficientCreditsError);
    expect(error).not.toBeInstanceOf(TokenLimitReachedError);
  });
});
