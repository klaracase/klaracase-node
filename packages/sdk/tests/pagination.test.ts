import { describe, expect, it, vi } from "vitest";
import { Klaracase, ValidationError } from "../src/index.js";
import searchExample from "./fixtures/examples/decisions.search.json";
import citationsExample from "./fixtures/examples/decisions.citations.json";

type Answer = { status: number; body: unknown };

/** A fetch that answers in order and records the URLs it saw. */
function fetchAnswering(...answers: Answer[]) {
  let index = 0;
  const urls: string[] = [];
  const fetchMock = vi.fn(async (input: unknown) => {
    urls.push(String(input));
    const answer = answers[Math.min(index++, answers.length - 1)] as Answer;
    return new Response(JSON.stringify(answer.body), {
      status: answer.status,
      headers: { "content-type": "application/json" },
    });
  });
  return { fetchMock: fetchMock as unknown as typeof fetch, urls };
}

const pageWithResults = { status: 200, body: searchExample };
const emptyPage = { status: 200, body: { ...searchExample, results: [] } };

function clientFor(fetchMock: typeof fetch) {
  return new Klaracase({ token: "t", fetch: fetchMock, sleep: async () => undefined });
}

async function collect<T>(iterator: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterator) items.push(item);
  return items;
}

describe("decisions.searchAll", () => {
  it("fetches pages 1 to maxPages and sends the page number", async () => {
    const { fetchMock, urls } = fetchAnswering(pageWithResults);
    const pages = await collect(
      clientFor(fetchMock).decisions.searchAll("Untreue", { court: "BGH" }, { maxPages: 3 }),
    );
    expect(pages).toHaveLength(3);
    expect(urls.map((url) => new URL(url).searchParams.get("page"))).toEqual(["1", "2", "3"]);
    expect(urls[0]).toContain("court=BGH");
    expect(pages[0]?.results[0]?.aktenzeichen).toBe("1 StR 185/01");
    expect(pages[0]?.meta.status).toBe(200);
  });

  it("stops at the first empty page and does not yield it", async () => {
    const { fetchMock, urls } = fetchAnswering(pageWithResults, emptyPage, pageWithResults);
    const pages = await collect(
      clientFor(fetchMock).decisions.searchAll("Untreue", {}, { maxPages: 10 }),
    );
    expect(pages).toHaveLength(1);
    expect(urls).toHaveLength(2);
  });

  it("caps maxPages at page 10", async () => {
    const { fetchMock, urls } = fetchAnswering(pageWithResults);
    const pages = await collect(
      clientFor(fetchMock).decisions.searchAll("Untreue", {}, { maxPages: 50 }),
    );
    expect(pages).toHaveLength(10);
    expect(urls).toHaveLength(10);
  });

  it("starts at the page in the filters and still stops at page 10", async () => {
    const { fetchMock, urls } = fetchAnswering(pageWithResults);
    await collect(clientFor(fetchMock).decisions.searchAll("x", { page: 9 }, { maxPages: 5 }));
    expect(urls.map((url) => new URL(url).searchParams.get("page"))).toEqual(["9", "10"]);
  });

  it("fetches lazily: breaking out of the loop stops the calls", async () => {
    const { fetchMock, urls } = fetchAnswering(pageWithResults);
    const iterator = clientFor(fetchMock).decisions.searchAll("x", {}, { maxPages: 5 });
    await iterator.next();
    await iterator.return();
    expect(urls).toHaveLength(1);
  });

  it("refuses a missing, zero or fractional maxPages before any call", () => {
    const { fetchMock, urls } = fetchAnswering(pageWithResults);
    const client = clientFor(fetchMock);
    for (const options of [undefined, {}, { maxPages: 0 }, { maxPages: 1.5 }, { maxPages: -1 }]) {
      expect(() => client.decisions.searchAll("x", {}, options as never)).toThrow(ValidationError);
    }
    expect(urls).toHaveLength(0);
  });

  it("passes the per-request options to every call and propagates an error", async () => {
    const problem = {
      status: 402,
      body: { type: "t", title: "x", status: 402, detail: "d", code: "insufficient_credits" },
    };
    const { fetchMock } = fetchAnswering(pageWithResults, problem);
    const seen: Array<unknown> = [];
    const client = clientFor(fetchMock);
    const iterator = client.decisions.searchAll(
      "x",
      {},
      { maxPages: 3, headers: { "X-Trace": "t1" } },
    );
    seen.push((await iterator.next()).value);
    await expect(iterator.next()).rejects.toMatchObject({ status: 402 });
    expect(seen).toHaveLength(1);
    const init = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      headers: Record<string, string>;
    };
    expect(init.headers["X-Trace"]).toBe("t1");
  });
});

describe("decisions.citationsAll", () => {
  const morePages = {
    status: 200,
    body: {
      ...citationsExample,
      pagination: { ...citationsExample.pagination, has_more_references: true },
    },
  };
  const lastPage = { status: 200, body: citationsExample };

  it("follows pages while a direction has more, then stops", async () => {
    const { fetchMock, urls } = fetchAnswering(morePages, morePages, lastPage, morePages);
    const pages = await collect(
      clientFor(fetchMock).decisions.citationsAll(
        "VIII ZR 271/17",
        { direction: "both" },
        { maxPages: 20 },
      ),
    );
    expect(pages).toHaveLength(3);
    expect(urls.map((url) => new URL(url).searchParams.get("page"))).toEqual(["1", "2", "3"]);
    expect(urls[0]).toContain("/decisions/VIII%20ZR%20271%2F17/citations");
  });

  it("stops at an empty page without yielding it", async () => {
    const empty = {
      status: 200,
      body: { ...citationsExample, references: [], referenced_by: [] },
    };
    const { fetchMock, urls } = fetchAnswering(morePages, empty);
    const pages = await collect(
      clientFor(fetchMock).decisions.citationsAll("id", {}, { maxPages: 5 }),
    );
    expect(pages).toHaveLength(1);
    expect(urls).toHaveLength(2);
  });

  it("caps maxPages at page 20", async () => {
    const { fetchMock, urls } = fetchAnswering(morePages);
    const pages = await collect(
      clientFor(fetchMock).decisions.citationsAll("id", {}, { maxPages: 99 }),
    );
    expect(pages).toHaveLength(20);
    expect(urls).toHaveLength(20);
  });

  it("refuses depth 2 and a missing maxPages before any call", () => {
    const { fetchMock, urls } = fetchAnswering(lastPage);
    const client = clientFor(fetchMock);
    expect(() => client.decisions.citationsAll("id", { depth: 2 }, { maxPages: 2 })).toThrow(
      ValidationError,
    );
    expect(() => client.decisions.citationsAll("id", {}, {} as never)).toThrow(ValidationError);
    expect(urls).toHaveLength(0);
  });
});
