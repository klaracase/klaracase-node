import { ConfigurationError } from "./errors.js";
import { readEnv } from "./runtime.js";

/** How much the client logs. `off` logs nothing. Each level includes the ones before it. */
export type LogLevel = "off" | "error" | "warn" | "info" | "debug";

/** The log levels in order, from quiet to loud. */
export const LOG_LEVELS = ["off", "error", "warn", "info", "debug"] as const;

/** A console-like sink. `console` fits. */
export interface Logger {
  /** Log a failure. */
  error(...args: unknown[]): void;
  /** Log something the caller should look at, such as a deprecation. */
  warn(...args: unknown[]): void;
  /** Log one line per answer. */
  info(...args: unknown[]): void;
  /** Log each retry. */
  debug(...args: unknown[]): void;
}

/** The environment variable that sets the log level when `logLevel` is not passed. */
export const LOG_ENV_VAR = "KLARACASE_LOG";

const DEFAULT_LEVEL: LogLevel = "warn";

function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === "string" && (LOG_LEVELS as readonly string[]).includes(value);
}

/**
 * The level the client uses: the `logLevel` option, else `KLARACASE_LOG`, else `warn`. An invalid
 * option throws. An invalid environment value is ignored, because a typo in the environment should
 * not stop an app from starting.
 */
export function resolveLogLevel(option: LogLevel | undefined): LogLevel {
  if (option !== undefined) {
    if (!isLogLevel(option)) {
      throw new ConfigurationError(
        `logLevel must be one of ${LOG_LEVELS.join(", ")}. Got: ${String(option)}`,
      );
    }
    return option;
  }
  const fromEnv = readEnv(LOG_ENV_VAR)?.trim().toLowerCase();
  return isLogLevel(fromEnv) ? fromEnv : DEFAULT_LEVEL;
}

/** Structured fields of one log line. Never put a token, a header or a body in here. */
export type LogFields = Record<string, string | number | boolean | null>;

/** The client's log: level checks around a {@link Logger}. */
export class Log {
  constructor(
    readonly level: LogLevel,
    private readonly logger: Logger,
  ) {}

  error(message: string, fields?: LogFields): void {
    this.emit("error", message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.emit("warn", message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.emit("info", message, fields);
  }

  debug(message: string, fields?: LogFields): void {
    this.emit("debug", message, fields);
  }

  private emit(level: Exclude<LogLevel, "off">, message: string, fields?: LogFields): void {
    if (LOG_LEVELS.indexOf(level) > LOG_LEVELS.indexOf(this.level)) return;
    try {
      const line = `[klaracase] ${message}`;
      if (fields === undefined) this.logger[level](line);
      else this.logger[level](line, fields);
    } catch {
      // A failing logger must never break a request.
    }
  }
}
