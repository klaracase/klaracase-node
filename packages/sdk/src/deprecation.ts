/** The raw `Deprecation`, `Sunset` and `Link` header values of an answer. `null` when absent. */
export interface DeprecationInfo {
  deprecation: string | null;
  sunset: string | null;
  link: string | null;
}

export type DeprecationHandler = (info: DeprecationInfo) => void;

let alreadyWarned = false;

/**
 * Tell the SDK to warn again. The guard is process-wide in production, so tests call this between
 * cases.
 */
export function resetDeprecationWarnings(): void {
  alreadyWarned = false;
}

/** The default hook: one `console.warn` line. */
export function defaultDeprecationHandler(info: DeprecationInfo): void {
  const parts = ["[klaracase] The API announced a deprecation."];
  if (info.deprecation) parts.push(`Deprecation: ${info.deprecation}.`);
  if (info.sunset) parts.push(`Sunset: ${info.sunset}.`);
  if (info.link) parts.push(`Link: ${info.link}.`);
  console.warn(parts.join(" "));
}

/** Call the hook once per process when the answer carries a deprecation header. */
export function surfaceDeprecation(headers: Headers, handler: DeprecationHandler): void {
  if (alreadyWarned) return;
  const info: DeprecationInfo = {
    deprecation: headers.get("deprecation"),
    sunset: headers.get("sunset"),
    link: headers.get("link"),
  };
  if (info.deprecation === null && info.sunset === null) return;
  alreadyWarned = true;
  try {
    handler(info);
  } catch {
    // A failing hook must never break a request that was already served and charged.
  }
}
