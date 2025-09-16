/**
 * Authentication router handling login and step-up challenges
 */

import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserManager } from "../services/userManager.js";
import { RiskCalculator } from "../services/riskCalculator.js";
import { ChallengeManager } from "../services/challengeManager.js";
import { Logger } from "../utils/logger.js";
import {
  ValidationError,
  AuthenticationError,
  BiometricError,
  formatErrorResponse,
} from "../utils/errors.js";

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(3).max(50).trim(),
  password: z.string().min(6).max(100),
  riskScore: z.number().min(0).max(1),
  features: z.object({
    holdTimes: z.array(z.number()).min(1),
    flightTimes: z.array(z.number()).min(1),
    errorRate: z.number().min(0).max(1),
    typingSpeed: z.number().min(0),
    timestamp: z.number(),
  }),
});

const stepUpSchema = z.object({
  challengeId: z.string().uuid(),
  solution: z.string().min(1),
  features: z
    .object({
      holdTimes: z.array(z.number()).min(1),
      flightTimes: z.array(z.number()).min(1),
      errorRate: z.number().min(0).max(1),
      typingSpeed: z.number().min(0),
      timestamp: z.number(),
    })
    .optional(),
});

export const authRouter = {
  async handle(request) {
    const url = new URL(request.url);
    const method = request.method;

    try {
      // Route matching
      if (url.pathname === "/api/login" && method === "POST") {
        return await this.handleLogin(request);
      }

      if (url.pathname === "/api/step-up" && method === "POST") {
        return await this.handleStepUp(request);
      }

      if (url.pathname === "/api/auth/profile" && method === "GET") {
        return await this.handleProfile(request);
      }

      if (url.pathname === "/api/auth/logout" && method === "POST") {
        return await this.handleLogout(request);
      }

      return new Response(
        JSON.stringify({
          error: "Not Found",
          message: "Auth endpoint not found",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            ...Object.fromEntries(request.securityHeaders),
          },
        }
      );
    } catch (error) {
      Logger.error("Auth router error:", {
        error: error.message,
        stack: error.stack,
        path: url.pathname,
        requestId: request.id,
      });

      const statusCode = error.statusCode || 500;
      const errorResponse = formatErrorResponse(error, request.id);

      return new Response(JSON.stringify(errorResponse), {
        status: statusCode,
        headers: {
          "Content-Type": "application/json",
          ...Object.fromEntries(request.securityHeaders),
        },
      });
    }
  },

  /**
   * Handle user login with biometric analysis
   */
  async handleLogin(request) {
    const startTime = Date.now();

    try {
      const body = await request.json();
      const validatedData = loginSchema.parse(body);

      Logger.info("🔐 Login attempt", {
        username: validatedData.username,
        riskScore: validatedData.riskScore,
        requestId: request.id,
      });

      // Validate user credentials
      const user = await UserManager.validateUser(
        validatedData.username,
        validatedData.password
      );

      if (!user) {
        throw new AuthenticationError("Invalid credentials");
      }

      // Calculate comprehensive risk score
      const riskAnalysis = await RiskCalculator.calculateRisk(
        validatedData.features,
        user.biometricProfile,
        validatedData.riskScore
      );

      Logger.info("🧠 Risk analysis completed", {
        username: validatedData.username,
        riskScore: riskAnalysis.finalScore,
        factors: riskAnalysis.factors,
        requestId: request.id,
      });

      // Update user's biometric profile
      await UserManager.updateBiometricProfile(user.id, validatedData.features);

      // Risk-based decision
      if (riskAnalysis.finalScore < 0.3) {
        // Low risk - grant access
        const token = this.generateToken(user, riskAnalysis.finalScore);

        Logger.performance("Login (GRANT)", startTime, {
          username: validatedData.username,
          riskScore: riskAnalysis.finalScore,
        });

        return new Response(
          JSON.stringify({
            status: "GRANT",
            token,
            user: {
              id: user.id,
              username: user.username,
              lastLogin: new Date().toISOString(),
            },
            riskScore: riskAnalysis.finalScore,
            factors: riskAnalysis.factors,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...Object.fromEntries(request.securityHeaders),
            },
          }
        );
      } else if (riskAnalysis.finalScore < 0.7) {
        // Medium risk - require step-up authentication
        const challenge = await ChallengeManager.createChallenge(user.id);

        Logger.performance("Login (STEP_UP)", startTime, {
          username: validatedData.username,
          riskScore: riskAnalysis.finalScore,
          challengeId: challenge.id,
        });

        return new Response(
          JSON.stringify({
            status: "STEP_UP",
            challengeId: challenge.id,
            challenge: challenge.question,
            riskScore: riskAnalysis.finalScore,
            factors: riskAnalysis.factors,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...Object.fromEntries(request.securityHeaders),
            },
          }
        );
      } else {
        // High risk - deny access
        Logger.warn("🚫 High-risk login denied", {
          username: validatedData.username,
          riskScore: riskAnalysis.finalScore,
          factors: riskAnalysis.factors,
          requestId: request.id,
        });

        throw new BiometricError(
          "Authentication denied due to high risk score",
          riskAnalysis.finalScore
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          "Invalid request data: " + error.errors[0].message
        );
      }
      throw error;
    }
  },

  /**
   * Handle step-up authentication
   */
  async handleStepUp(request) {
    const startTime = Date.now();

    try {
      const body = await request.json();
      const validatedData = stepUpSchema.parse(body);

      Logger.info("🔒 Step-up challenge attempt", {
        challengeId: validatedData.challengeId,
        requestId: request.id,
      });

      // Verify challenge
      const challengeResult = await ChallengeManager.verifyChallenge(
        validatedData.challengeId,
        validatedData.solution
      );

      if (!challengeResult.valid) {
        throw new AuthenticationError("Invalid challenge solution");
      }

      // Get user and generate token
      const user = await UserManager.getUserById(challengeResult.userId);
      if (!user) {
        throw new AuthenticationError("User not found");
      }

      const token = this.generateToken(user, 0.5); // Medium risk for step-up

      Logger.performance("Step-up (SUCCESS)", startTime, {
        userId: user.id,
        challengeId: validatedData.challengeId,
      });

      return new Response(
        JSON.stringify({
          status: "GRANT",
          token,
          user: {
            id: user.id,
            username: user.username,
            lastLogin: new Date().toISOString(),
          },
          stepUpCompleted: true,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...Object.fromEntries(request.securityHeaders),
          },
        }
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          "Invalid request data: " + error.errors[0].message
        );
      }
      throw error;
    }
  },

  /**
   * Get user profile (requires valid token)
   */
  async handleProfile(request) {
    try {
      const token = this.extractToken(request);
      const decoded = this.verifyToken(token);

      const user = await UserManager.getUserById(decoded.userId);
      if (!user) {
        throw new AuthenticationError("User not found");
      }

      return new Response(
        JSON.stringify({
          user: {
            id: user.id,
            username: user.username,
            lastLogin: user.lastLogin,
            biometricProfileCount: user.biometricProfile?.samples?.length || 0,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...Object.fromEntries(request.securityHeaders),
          },
        }
      );
    } catch (error) {
      throw new AuthenticationError("Invalid or expired token");
    }
  },

  /**
   * Handle user logout
   */
  async handleLogout(request) {
    try {
      const token = this.extractToken(request);
      // In a full implementation, add token to blacklist

      return new Response(
        JSON.stringify({
          message: "Logged out successfully",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...Object.fromEntries(request.securityHeaders),
          },
        }
      );
    } catch (error) {
      // Even if token is invalid, consider logout successful
      return new Response(
        JSON.stringify({
          message: "Logged out successfully",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...Object.fromEntries(request.securityHeaders),
          },
        }
      );
    }
  },

  /**
   * Generate JWT token
   */
  generateToken(user, riskScore) {
    const payload = {
      userId: user.id,
      username: user.username,
      riskScore,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
    };

    const secret =
      process.env.JWT_SECRET || "your-super-secret-key-change-in-production";
    return jwt.sign(payload, secret);
  },

  /**
   * Extract token from request headers
   */
  extractToken(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AuthenticationError("Missing or invalid authorization header");
    }

    return authHeader.substring(7);
  },

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    const secret =
      process.env.JWT_SECRET || "your-super-secret-key-change-in-production";
    return jwt.verify(token, secret);
  },
};
