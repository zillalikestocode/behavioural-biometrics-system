/**
 * Custom error classes for better error handling
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400, "VALIDATION_ERROR");
    this.field = field;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication failed") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Rate limit exceeded", retryAfter = 60) {
    super(message, 429, "RATE_LIMIT_ERROR");
    this.retryAfter = retryAfter;
  }
}

export class BiometricError extends AppError {
  constructor(message, riskScore = null) {
    super(message, 403, "BIOMETRIC_ERROR");
    this.riskScore = riskScore;
  }
}

/**
 * Error response formatter
 */
export const formatErrorResponse = (error, requestId = null) => {
  const response = {
    error: error.code || "INTERNAL_ERROR",
    message: error.message,
    timestamp: error.timestamp || new Date().toISOString(),
    ...(requestId && { requestId }),
  };

  // Add specific error fields
  if (error.field) response.field = error.field;
  if (error.retryAfter) response.retryAfter = error.retryAfter;
  if (error.riskScore !== null && error.riskScore !== undefined) {
    response.riskScore = error.riskScore;
  }

  return response;
};
