import type { Request, Response, NextFunction } from "express";
import { RateLimiter } from "../utils/rateLimiter";

export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const path = req.originalUrl;
  const ip = req.ip || (req.headers["x-real-ip"] as string) || "unknown";

  // Defaults
  let windowMs = 15 * 60 * 1000; // 15 minutes
  let maxRequests = 100;

  if (path.includes("/api/auth/login")) {
    windowMs = 15 * 60 * 1000;
    maxRequests = 10;
  } else if (path.includes("/api/auth/step-up")) {
    windowMs = 5 * 60 * 1000;
    maxRequests = 5;
  }

  const allowed = await RateLimiter.checkLimit(ip, path, windowMs, maxRequests);
  if (!allowed) {
    res
      .status(429)
      .setHeader("Retry-After", Math.ceil(windowMs / 1000).toString())
      .json({
        error: "Rate Limit Exceeded",
        message: "Too many requests. Please try again later.",
        retryAfter: Math.ceil(windowMs / 1000),
      });
    return;
  }

  next();
}
