/**
 * Rate limiting utility using in-memory storage
 * In production, this should use Redis or similar
 */

export class RateLimiter {
  static store = new Map();

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
  static async checkLimit(identifier, endpoint, windowMs, maxRequests) {
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
  static getStatus(identifier, endpoint) {
    const key = `${identifier}:${endpoint}`;
    const bucket = this.store.get(key);

    if (!bucket) {
      return {
        count: 0,
        resetTime: null,
        remaining: null,
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
  static reset(identifier, endpoint = null) {
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
