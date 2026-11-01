import { ValidationError } from "./errors.js";

/** A value a query parameter may hold. `null` and `undefined` are not sent. */
export type QueryValue = string | number | boolean | readonly string[] | null | undefined;

/** Parameters of a request, by wire name. */
export type QueryParams = object;

/**
 * Encode one path parameter as ONE segment. Every byte outside `A-Z a-z 0-9 - . _ ~` becomes `%XX`
 * with upper-case hex. `encodeURIComponent` leaves `! * ' ( )` alone, so those are done here.
 */
export function encodePathSegment(value: string): string {
  let encoded: string;
  try {
    encoded = encodeURIComponent(value);
  } catch (cause) {
    throw new ValidationError({
      title: "Invalid path parameter",
      detail: "The value is not valid Unicode text and cannot be put in a URL.",
      code: "client_validation",
      cause,
    });
  }
  return encoded.replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
  );
}

/** Encode a query value so that it decodes to the original string. */
function encodeQueryValue(value: string): string {
  return encodePathSegment(value);
}

/**
 * Build a query string. Rules:
 * - `null`, `undefined` and an empty array are not sent. `false` and `0` are sent.
 * - Numbers are decimal and booleans are `true` or `false`.
 * - An array is sent as `name[]=a&name[]=b` (the PHP form the API reads).
 *
 * Returns the string without a leading `?`. It is empty when nothing is sent.
 */
export function buildQuery(params: QueryParams | undefined): string {
  if (params === undefined) return "";
  const pairs: string[] = [];
  for (const [name, value] of Object.entries(params as Record<string, QueryValue>)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value as readonly string[]) {
        pairs.push(`${name}[]=${encodeQueryValue(String(item))}`);
      }
      continue;
    }
    pairs.push(`${name}=${encodeQueryValue(String(value))}`);
  }
  return pairs.join("&");
}
