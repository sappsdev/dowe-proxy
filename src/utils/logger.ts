type LogLevel = "debug" | "info" | "warn" | "error";

const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[currentLevel];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(
  level: LogLevel,
  context: string,
  message: string,
): string {
  return `[${formatTimestamp()}] [${level.toUpperCase()}] [${context}] ${message}`;
}

export function createLogger(context: string) {
  return {
    debug(message: string, data?: unknown) {
      if (shouldLog("debug")) {
        console.debug(formatMessage("debug", context, message), data ?? "");
      }
    },

    info(message: string, data?: unknown) {
      if (shouldLog("info")) {
        console.info(formatMessage("info", context, message), data ?? "");
      }
    },

    warn(message: string, data?: unknown) {
      if (shouldLog("warn")) {
        console.warn(formatMessage("warn", context, message), data ?? "");
      }
    },

    error(message: string, error?: unknown) {
      if (shouldLog("error")) {
        console.error(formatMessage("error", context, message), error ?? "");
      }
    },
  };
}

export const logger = createLogger("main");
