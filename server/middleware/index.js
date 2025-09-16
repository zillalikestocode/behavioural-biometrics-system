/**
 * Middleware system for request processing
 */

import { v4 as uuidv4 } from "uuid";
import { Logger } from "../utils/logger.js";
import { RateLimiter } from "../utils/rateLimiter.js";
import { ValidationError } from "../utils/errors.js";

/**
 * Security headers middleware
 */
export const securityHeaders = (request) => {
  const headers = new Headers();

  // CORS headers
  headers.set(
    "Access-Control-Allow-Origin",
    process.env.FRONTEND_URL || "http://localhost:5173"
  );
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );

  // Security headers
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-XSS-Protection", "1; mode=block");
  headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  );

  return headers;
};

/**
 * Request logging middleware
 */
export const requestLogger = (request) => {
  const startTime = Date.now();
  const url = new URL(request.url);
  const method = request.method;
  const userAgent = request.headers.get("User-Agent") || "Unknown";
  const ip =
    request.headers.get("X-Forwarded-For") ||
    request.headers.get("X-Real-IP") ||
    "unknown";

  Logger.info(`📥 ${method} ${url.pathname}`, {
    ip,
    userAgent: userAgent.substring(0, 100),
    timestamp: new Date().toISOString(),
  });

  return { startTime, ip, userAgent };
};

/**
 * Rate limiting middleware
 */
export const rateLimitMiddleware = async (request, context) => {
  const url = new URL(request.url);
  const ip = context.ip;

  // Different limits for different endpoints
  let windowMs = 15 * 60 * 1000; // 15 minutes
  let maxRequests = 100;

  if (url.pathname.includes("/api/login")) {
    windowMs = 15 * 60 * 1000; // 15 minutes
    maxRequests = 10; // Max 10 login attempts per 15 minutes
  } else if (url.pathname.includes("/api/step-up")) {
    windowMs = 5 * 60 * 1000; // 5 minutes
    maxRequests = 5; // Max 5 step-up attempts per 5 minutes
  }

  const isAllowed = await RateLimiter.checkLimit(
    ip,
    url.pathname,
    windowMs,
    maxRequests
  );

  if (!isAllowed) {
    Logger.warn(`🚫 Rate limit exceeded for IP: ${ip} on ${url.pathname}`);

    return new Response(
      JSON.stringify({
        error: "Rate Limit Exceeded",
        message: "Too many requests. Please try again later.",
        retryAfter: Math.ceil(windowMs / 1000),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": Math.ceil(windowMs / 1000).toString(),
          ...Object.fromEntries(securityHeaders(request)),
        },
      }
    );
  }

  return null; // Continue processing
};

/**
 * Input sanitization middleware
 */
export const sanitizeInput = async (request) => {
  if (request.method !== "POST" && request.method !== "PUT") {
    return request;
  }

  try {
    const contentType = request.headers.get("Content-Type");

    if (contentType?.includes("application/json")) {
      const body = await request.text();

      // Basic XSS prevention
      const sanitizedBody = body
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/javascript:/gi, "")
        .replace(/on\w+\s*=/gi, "");

      // Create new request with sanitized body
      return new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: sanitizedBody,
      });
    }
  } catch (error) {
    Logger.warn("Input sanitization failed:", error);
  }

  return request;
};

/**
 * Main middleware orchestrator
 */
export const middleware = {
  async apply(request) {
    // Add unique request ID
    const requestId = uuidv4();

    // Request logging
    const logContext = requestLogger(request);

    // Rate limiting check
    const rateLimitResult = await rateLimitMiddleware(request, logContext);
    if (rateLimitResult instanceof Response) {
      return rateLimitResult;
    }

    // Input sanitization
    const sanitizedRequest = await sanitizeInput(request);

    // Enhance request with context
    const enhancedRequest = new Proxy(sanitizedRequest, {
      get(target, prop) {
        if (prop === "id") return requestId;
        if (prop === "context") return logContext;
        if (prop === "securityHeaders") return securityHeaders(request);
        return target[prop];
      },
    });

    return enhancedRequest;
  },
};
