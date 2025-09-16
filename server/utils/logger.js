/**
 * Advanced logging utility with structured logging
 */

export class Logger {
  static levels = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  static currentLevel =
    process.env.LOG_LEVEL === "debug"
      ? 3
      : process.env.LOG_LEVEL === "warn"
      ? 1
      : 2;

  static formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(Object.keys(meta).length > 0 && { meta }),
      pid: process.pid,
    };

    return JSON.stringify(logEntry);
  }

  static log(level, message, meta = {}) {
    if (this.levels[level] <= this.currentLevel) {
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

  static error(message, meta = {}) {
    this.log("ERROR", message, meta);
  }

  static warn(message, meta = {}) {
    this.log("WARN", message, meta);
  }

  static info(message, meta = {}) {
    this.log("INFO", message, meta);
  }

  static debug(message, meta = {}) {
    this.log("DEBUG", message, meta);
  }

  /**
   * Performance timing logger
   */
  static performance(operation, startTime, meta = {}) {
    const duration = Date.now() - startTime;
    this.info(`⚡ ${operation} completed in ${duration}ms`, {
      duration,
      operation,
      ...meta,
    });
  }
}
