import * as z from "zod/mini";
import type { Open } from "../types.js";

/**
 * A string that is one of `known` or any other string. It is the schema twin of the type
 * `Open<...>`: a later API release may add a value, and parsing must not fail on it.
 */
export function open<const T extends readonly string[]>(
  known: T,
  description?: string,
): z.ZodMiniCustom<Open<T[number]>, Open<T[number]>> {
  const note = `Known values: ${known.join(", ")}. Other strings may appear in later releases.`;
  return z
    .custom<Open<T[number]>>((value) => typeof value === "string")
    .register(z.globalRegistry, {
      type: "string",
      description: description === undefined ? note : `${description} ${note}`,
    });
}

/** `YYYY-MM-DD`. */
export function isoDate(description: string): z.ZodMiniString<string> {
  return z
    .string()
    .check(z.regex(/^\d{4}-\d{2}-\d{2}$/))
    .register(z.globalRegistry, { description });
}

/** Add a description to a schema. */
export function described<T extends z.ZodMiniType>(schema: T, description: string): T {
  (schema as z.ZodMiniType).register(z.globalRegistry, { description });
  return schema;
}

/** A count that may be a lower bound. */
export const countSchema = z.looseObject({ value: z.number(), is_floor: z.boolean() });

/** Credit use of one call. */
export const creditsSchema = z.looseObject({
  metered: z.boolean(),
  cost: z.nullable(z.number()),
  credits_remaining: z.nullable(z.number()),
});

/** Keys that every operation body carries. */
export const envelopeShape = {
  api_version: z.string(),
  changelog_url: z.string(),
  credits: creditsSchema,
  ignored_parameters: z.optional(z.unknown()),
} as const;

export const nullableString = z.nullable(z.string());
export const nullableNumber = z.nullable(z.number());
export const stringList = z.array(z.string());
export const unknownList = z.array(z.unknown());
