/**
 * Runtime detection. Every function here is safe to call on any JavaScript host: none of them
 * throws, whatever globals are missing.
 */

interface RuntimeGlobals {
  Deno?: { version?: { deno?: string }; env?: { get?: (name: string) => string | undefined } };
  Bun?: { version?: string };
  EdgeRuntime?: unknown;
  navigator?: { userAgent?: string };
  process?: { versions?: { node?: string }; env?: Record<string, string | undefined> };
  window?: unknown;
  document?: unknown;
}

/** The object the detectors read. Tests pass a stand-in host. */
export type RuntimeHost = object;

function asHost(host: RuntimeHost): RuntimeGlobals {
  return host as RuntimeGlobals;
}

/**
 * Name and version of the host runtime, as `name/version`, for the `User-Agent` header.
 *
 * Checked in this order: Deno, Bun, Vercel Edge, Cloudflare Workers, Node, browser. Anything else
 * is `unknown/unknown`. Never throws.
 */
export function detectRuntime(global: RuntimeHost = globalThis): string {
  try {
    const host = asHost(global);
    const deno = host.Deno?.version?.deno;
    if (typeof deno === "string") return `deno/${deno}`;
    const bun = host.Bun?.version;
    if (typeof bun === "string") return `bun/${bun}`;
    if (typeof host.EdgeRuntime === "string") return "vercel-edge/unknown";
    if (host.navigator?.userAgent === "Cloudflare-Workers") return "cloudflare-workers/unknown";
    const node = host.process?.versions?.node;
    if (typeof node === "string") return `node/${node}`;
    if (isBrowser(global)) return "browser/unknown";
  } catch {
    // A hostile or partial global must not stop the client from being built.
  }
  return "unknown/unknown";
}

/** True when both `window` and `document` exist, which is a browser page or a DOM test host. */
export function isBrowser(global: RuntimeHost = globalThis): boolean {
  try {
    const host = asHost(global);
    return typeof host.window !== "undefined" && typeof host.document !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Read one environment variable. Returns `undefined` on a host without `process.env` or where the
 * read is denied (Deno without permission, a sandbox). Never throws.
 */
export function readEnv(name: string, global: RuntimeHost = globalThis): string | undefined {
  try {
    const host = asHost(global);
    const fromProcess = host.process?.env?.[name];
    if (typeof fromProcess === "string") return fromProcess;
    const fromDeno = host.Deno?.env?.get?.(name);
    if (typeof fromDeno === "string") return fromDeno;
  } catch {
    // Reading the environment is optional. A denied read means "not set".
  }
  return undefined;
}
