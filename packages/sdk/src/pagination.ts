import { ValidationError } from "./errors.js";
import type { RequestOptions } from "./types.js";

/** The last page the search endpoint serves. */
export const SEARCH_MAX_PAGES = 10;
/** The last page the citations endpoint serves. */
export const CITATIONS_MAX_PAGES = 20;

/** Options of the paging iterators. */
export interface PageOptions extends RequestOptions {
  /**
   * The most pages to fetch. Required. Paging the same query within a credit period costs no extra credits (a changed query, filter or
   * mode is a new charge; check `credits` on each response),
   * but every page is a call: it counts against the rate limit and the daily volume cap, and it
   * takes time. A value above the endpoint's last page (10 for search, 20 for citations) counts
   * as that page.
   */
  maxPages: number;
}

/**
 * Check `maxPages` and the first page number. Returns the last page to fetch.
 *
 * @throws {ValidationError} `maxPages` is missing, not a whole number, or below 1.
 */
export function lastPageToFetch(
  maxPages: unknown,
  firstPage: number,
  endpointLastPage: number,
): number {
  if (typeof maxPages !== "number" || !Number.isInteger(maxPages) || maxPages < 1) {
    throw new ValidationError({
      title: "Invalid arguments",
      detail:
        "Pass { maxPages } as a whole number, 1 or more. Every page is a call against your rate limit and daily volume cap, so there is no default.",
      code: "client_validation",
    });
  }
  if (!Number.isInteger(firstPage) || firstPage < 1) {
    throw new ValidationError({
      title: "Invalid arguments",
      detail: "The page must be a whole number, 1 or more.",
      code: "client_validation",
    });
  }
  return Math.min(firstPage + maxPages - 1, endpointLastPage);
}
