/**
 * Advanced logging utility with structured logging (TypeScript)
 */

export class Logger {
  static levels = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  } as const;

  static currentLevel: number =
    process.env.LOG_LEVEL === "debug"
      ? 3
      : process.env.LOG_LEVEL === "warn"
      ? 1
      : 2;

  static formatMessage(
    level: keyof typeof Logger.levels,
    message: string,
    meta: Record<string, unknown> = {}
  ) {
    const timestamp = new Date().toISOString();
    const logEntry: Record<string, unknown> = {
      timestamp,
      level,
      message,
      ...(Object.keys(meta).length > 0 && { meta }),
      pid: typeof process !== "undefined" ? process.pid : undefined,
    };

    return JSON.stringify(logEntry);
  }

  static log(
    level: keyof typeof Logger.levels,
    message: string,
    meta: Record<string, unknown> = {}
  ) {
    if (Logger.levels[level] <= this.currentLevel) {
      const formatted = this.formatMessage(level, message, meta);

      if (level === "ERROR") {
        console.error(formatted);
      } else if (level === "WARN") {
        console.warn(formatted);
      } else {
        console.log(formatted);
      }
    }
  }

  static error(message: string, meta: Record<string, unknown> = {}) {
    this.log("ERROR", message, meta);
  }

  static warn(message: string, meta: Record<string, unknown> = {}) {
    this.log("WARN", message, meta);
  }

  static info(message: string, meta: Record<string, unknown> = {}) {
    this.log("INFO", message, meta);
  }

  static debug(message: string, meta: Record<string, unknown> = {}) {
    this.log("DEBUG", message, meta);
  }

  /**
   * Performance timing logger
   */
  static performance(
    operation: string,
    startTime: number,
    meta: Record<string, unknown> = {}
  ) {
    const duration = Date.now() - startTime;
    this.info(`⚡ ${operation} completed in ${duration}ms`, {
      duration,
      operation,
      ...meta,
    });
  }
}
