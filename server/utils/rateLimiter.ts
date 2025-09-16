/**
 * Rate limiting utility using in-memory storage (TypeScript)
 * In production, use Redis or similar
 */

interface Bucket {
  count: number;
  resetTime: number;
  firstRequest: number;
}

export class RateLimiter {
  static store: Map<string, Bucket> = new Map();

  /**
   * Clean up expired entries
   */
  static cleanup() {
    const now = Date.now();
    for (const [key, data] of this.store.entries()) {
      if (now > data.resetTime) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Check if request is within rate limit
   */
  static async checkLimit(
    identifier: string,
    endpoint: string,
    windowMs: number,
    maxRequests: number
  ): Promise<boolean> {
    const key = `${identifier}:${endpoint}`;
    const now = Date.now();

    // Cleanup expired entries periodically
    if (Math.random() < 0.01) {
      // 1% chance
      this.cleanup();
    }

    let bucket = this.store.get(key);

    // Initialize new bucket
    if (!bucket || now > bucket.resetTime) {
      bucket = {
        count: 0,
        resetTime: now + windowMs,
        firstRequest: now,
      };
      this.store.set(key, bucket);
    }

    // Check if limit exceeded
    if (bucket.count >= maxRequests) {
      return false;
    }

    // Increment counter
    bucket.count++;
    this.store.set(key, bucket);

    return true;
  }

  /**
   * Get current limit status for identifier
   */
  static getStatus(identifier: string, endpoint: string) {
    const key = `${identifier}:${endpoint}`;
    const bucket = this.store.get(key);

    if (!bucket) {
      return {
        count: 0,
        resetTime: null as number | null,
        remaining: null as number | null,
      };
    }

    return {
      count: bucket.count,
      resetTime: bucket.resetTime,
      remaining: Math.max(0, bucket.resetTime - Date.now()),
    };
  }

  /**
   * Reset limits for identifier (admin function)
   */
  static reset(identifier: string, endpoint: string | null = null) {
    if (endpoint) {
      const key = `${identifier}:${endpoint}`;
      this.store.delete(key);
    } else {
      // Reset all endpoints for identifier
      for (const key of this.store.keys()) {
        if (key.startsWith(`${identifier}:`)) {
          this.store.delete(key);
        }
      }
    }
  }
}
