/**
 * Read a top-level key of a response body that the SDK types do not declare.
 *
 * The API only adds keys within a major version, so a newer API release can send a key that this
 * SDK version does not list. The body keeps it at run time. This helper reads it without a cast
 * and without a typo-hiding index signature on the types.
 *
 * ```ts
 * const added = getExtra(result, "a_key_from_a_later_release");
 * ```
 *
 * @param body A response body, or any object.
 * @param key The wire name of the key.
 * @returns The value, or `undefined` when the body has no such own key.
 */
export function getExtra(body: object, key: string): unknown {
  if (!Object.hasOwn(body, key)) return undefined;
  return (body as Record<string, unknown>)[key];
}
