/**
 * Auth Controller (Express): request handlers for auth endpoints
 */

import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import type { BiometricFeatures } from "../types";
import { Logger } from "../utils/logger";
import {
  ValidationError,
  AuthenticationError,
  BiometricError,
} from "../utils/errors";
import { UserManager } from "../services/userManager";
import { RiskCalculator } from "../services/riskCalculator";
import { ChallengeManager } from "../services/challengeManager";

// Validation schemas
const biometricSchema = z.object({
  holdTimes: z.array(z.number()),
  flightTimes: z.array(z.number()),
  errorRate: z.number().min(0).max(1),
  typingSpeed: z.number().min(0),
  timestamp: z.number(),
});

const loginSchema = z.object({
  username: z.string().min(3).max(50).trim(),
  password: z.string().min(6).max(100),
  riskScore: z.number().min(0).max(1),
  features: biometricSchema,
});

const stepUpSchema = z.object({
  challengeId: z.string().uuid(),
  solution: z.string().min(1),
  features: biometricSchema.optional(),
});

// Helpers
const jwtSecret =
  process.env.JWT_SECRET || "your-super-secret-key-change-in-production";

function generateToken(
  user: { id: string; username: string },
  riskScore: number
) {
  const payload = {
    userId: user.id,
    username: user.username,
    riskScore,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
  } as const;
  return jwt.sign(payload, jwtSecret);
}

function extractToken(req: Request) {
  const authHeader = req.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AuthenticationError("Missing or invalid authorization header");
  }
  return authHeader.substring(7);
}

function verifyToken(token: string) {
  return jwt.verify(token, jwtSecret);
}
export async function login(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  try {
    const validatedData = loginSchema.parse(req.body);

    Logger.info("🔐 Login attempt", {
      username: validatedData.username,
      riskScore: validatedData.riskScore,
      requestId: req.id,
    });

    const user = await UserManager.validateUser(
      validatedData.username,
      validatedData.password
    );
    if (!user) throw new AuthenticationError("Invalid credentials");

    const riskAnalysis = await RiskCalculator.calculateRisk(
      validatedData.features as BiometricFeatures,
      user.biometricProfile!,
      validatedData.riskScore
    );

    Logger.info("🧠 Risk analysis completed", {
      username: validatedData.username,
      riskScore: riskAnalysis.finalScore,
      factors: riskAnalysis.factors,
      requestId: req.id,
    });

    await UserManager.updateBiometricProfile(
      user.id,
      validatedData.features as BiometricFeatures
    );

    if (riskAnalysis.finalScore < 0.3) {
      const token = generateToken(user, riskAnalysis.finalScore);
      Logger.performance("Login (GRANT)", startTime, {
        username: validatedData.username,
        riskScore: riskAnalysis.finalScore,
      });
      res.status(200).json({
        success: true,
        action: "GRANT",
        message: "Authentication successful",
        sessionToken: token,
        riskScore: riskAnalysis.finalScore,
        timestamp: Date.now(),
      });
    } else if (riskAnalysis.finalScore < 0.7) {
      const challenge = await ChallengeManager.createChallenge(user.id);
      Logger.performance("Login (STEP_UP)", startTime, {
        username: validatedData.username,
        riskScore: riskAnalysis.finalScore,
        challengeId: challenge.id,
      });
      // Map server challenge types to client-friendly categories
      const mapType = (t: string) => (t === "captcha" ? "CAPTCHA" : "MATH"); // pattern/memory/security_questions => MATH fallback

      res.status(200).json({
        success: true,
        action: "STEP_UP",
        message: "Additional verification required",
        challengeId: challenge.id,
        challengeType: mapType((challenge as any).type || "math"),
        challengeData:
          mapType((challenge as any).type || "math") === "MATH"
            ? { problem: challenge.question, hints: challenge.hints }
            : { prompt: challenge.question, hints: challenge.hints },
        riskScore: riskAnalysis.finalScore,
        timestamp: Date.now(),
      });
    } else {
      Logger.warn("🚫 High-risk login denied", {
        username: validatedData.username,
        riskScore: riskAnalysis.finalScore,
        factors: riskAnalysis.factors,
        requestId: req.id,
      });
      res.status(200).json({
        success: false,
        action: "DENY",
        message: "Authentication denied due to high risk score",
        riskScore: riskAnalysis.finalScore,
        timestamp: Date.now(),
      });
      return;
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        action: "DENY",
        message:
          "Invalid request data: " + (error.errors[0]?.message || "Unknown"),
        riskScore: 1.0,
        timestamp: Date.now(),
      });
    }
    return res.status(500).json({
      success: false,
      action: "DENY",
      message: (error as Error).message || "Internal server error",
      riskScore: 1.0,
      timestamp: Date.now(),
    });
  }
}

export async function stepUp(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  try {
    const validatedData = stepUpSchema.parse(req.body);

    Logger.info("🔒 Step-up challenge attempt", {
      challengeId: validatedData.challengeId,
      requestId: req.id,
    });

    const challengeResult = await ChallengeManager.verifyChallenge(
      validatedData.challengeId,
      validatedData.solution
    );
    if (!challengeResult.valid) {
      const attemptsRemaining = (challengeResult as any).attemptsRemaining;
      if (typeof attemptsRemaining === "number" && attemptsRemaining > 0) {
        return res.status(200).json({
          success: false,
          action: "RETRY",
          message: "Incorrect solution. Please try again.",
          attemptsRemaining,
        });
      }
      return res.status(200).json({
        success: false,
        action: "DENY",
        message: (challengeResult as any).error || "Invalid challenge",
      });
    }

    const user = await UserManager.getUserById(challengeResult.userId);
    if (!user) throw new AuthenticationError("User not found");

    const token = generateToken(user, 0.2);

    Logger.performance("Step-up (SUCCESS)", startTime, {
      userId: user.id,
      challengeId: validatedData.challengeId,
    });

    res.status(200).json({
      success: true,
      action: "GRANT",
      message: "Authentication successful",
      sessionToken: token,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        action: "DENY",
        message:
          "Invalid request data: " + (error.errors[0]?.message || "Unknown"),
      });
    }
    return res.status(500).json({
      success: false,
      action: "DENY",
      message: (error as Error).message || "Internal server error",
    });
  }
}

export async function profile(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    const decoded = verifyToken(token) as any;

    const user = await UserManager.getUserById(decoded.userId);
    if (!user) throw new AuthenticationError("User not found");

    res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        lastLogin: user.lastLogin,
        biometricProfileCount: user.biometricProfile?.samples?.length || 0,
      },
    });
  } catch (error) {
    return next(new AuthenticationError("Invalid or expired token"));
  }
}

export async function logout(req: Request, res: Response) {
  try {
    // If needed, validate token and blacklist it
    extractToken(req);
    res.status(200).json({ message: "Logged out successfully" });
  } catch {
    // Even if token is invalid, consider logout successful
    res.status(200).json({ message: "Logged out successfully" });
  }
}

export async function validate(req: Request, res: Response) {
  try {
    const token = extractToken(req);
    const decoded = verifyToken(token) as any;
    const user = await UserManager.getUserById(decoded.userId);
    if (!user) {
      return res.status(200).json({ valid: false, message: "User not found" });
    }
    return res.status(200).json({
      valid: true,
      user: {
        username: user.username,
        loginTime: (decoded.iat || Math.floor(Date.now() / 1000)) * 1000,
        riskScore: decoded.riskScore ?? 0.5,
      },
      message: "Session valid",
    });
  } catch {
    return res.status(200).json({ valid: false, message: "Invalid session" });
  }
}

export const authController = { login, stepUp, profile, logout, validate };

export type AuthController = typeof authController;
