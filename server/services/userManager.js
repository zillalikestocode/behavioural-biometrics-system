/**
 * User management service with in-memory storage
 * In production, this should use a proper database
 */

import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { Logger } from "../utils/logger.js";
import { AuthenticationError } from "../utils/errors.js";

export class UserManager {
  static users = new Map();
  static biometricProfiles = new Map();

  // Initialize with demo users
  static async initialize() {
    await this.createDemoUsers();
    Logger.info("👥 User manager initialized with demo users");
  }

  /**
   * Create demo users for testing
   */
  static async createDemoUsers() {
    const demoUsers = [
      {
        username: "lowrisk",
        password: "pass123",
        profile: "consistent",
      },
      {
        username: "highrisk",
        password: "pass123",
        profile: "robotic",
      },
      {
        username: "normal",
        password: "pass123",
        profile: "normal",
      },
      {
        username: "admin",
        password: "admin123",
        profile: "consistent",
      },
    ];

    for (const demo of demoUsers) {
      await this.createUser(demo.username, demo.password, demo.profile);
    }
  }

  /**
   * Create a new user
   */
  static async createUser(username, password, profileType = "normal") {
    const existingUser = Array.from(this.users.values()).find(
      (user) => user.username === username
    );

    if (existingUser) {
      Logger.warn(`User creation failed - username exists: ${username}`);
      return null;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    const user = {
      id: userId,
      username,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      loginCount: 0,
      isActive: true,
    };

    // Create biometric profile
    const biometricProfile = this.createBiometricProfile(userId, profileType);

    this.users.set(userId, user);
    this.biometricProfiles.set(userId, biometricProfile);

    Logger.info(`👤 User created: ${username} (${profileType} profile)`);
    return user;
  }

  /**
   * Create biometric profile with synthetic data for demo
   */
  static createBiometricProfile(userId, profileType) {
    const profile = {
      userId,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      samples: [],
    };

    // Generate synthetic historical data based on profile type
    const sampleCount = Math.floor(Math.random() * 15) + 5; // 5-20 samples

    for (let i = 0; i < sampleCount; i++) {
      const sample = this.generateSyntheticSample(profileType);
      profile.samples.push({
        ...sample,
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    return profile;
  }

  /**
   * Generate synthetic keystroke sample
   */
  static generateSyntheticSample(profileType) {
    let baseHoldTime, baseFlightTime, baseErrorRate, baseTypingSpeed;
    let variance;

    switch (profileType) {
      case "consistent":
        baseHoldTime = 80;
        baseFlightTime = 120;
        baseErrorRate = 0.02;
        baseTypingSpeed = 250;
        variance = 0.1; // Low variance
        break;

      case "robotic":
        baseHoldTime = 100;
        baseFlightTime = 100;
        baseErrorRate = 0.0;
        baseTypingSpeed = 300;
        variance = 0.05; // Very low variance - suspicious
        break;

      default: // normal
        baseHoldTime = 90;
        baseFlightTime = 110;
        baseErrorRate = 0.05;
        baseTypingSpeed = 200;
        variance = 0.2; // Normal variance
    }

    // Generate sample data with variance
    const holdTimes = Array.from(
      { length: 8 },
      () => baseHoldTime * (1 + (Math.random() - 0.5) * variance)
    );

    const flightTimes = Array.from(
      { length: 7 },
      () => baseFlightTime * (1 + (Math.random() - 0.5) * variance)
    );

    const avgHoldTime =
      holdTimes.reduce((sum, val) => sum + val, 0) / holdTimes.length;
    const avgFlightTime =
      flightTimes.reduce((sum, val) => sum + val, 0) / flightTimes.length;

    // Calculate variance
    const holdTimeVariance =
      holdTimes.reduce((sum, val) => sum + Math.pow(val - avgHoldTime, 2), 0) /
      holdTimes.length;
    const flightTimeVariance =
      flightTimes.reduce(
        (sum, val) => sum + Math.pow(val - avgFlightTime, 2),
        0
      ) / flightTimes.length;

    return {
      avgHoldTime,
      avgFlightTime,
      holdTimeVariance,
      flightTimeVariance,
      errorRate: baseErrorRate * (1 + (Math.random() - 0.5) * variance),
      typingSpeed: baseTypingSpeed * (1 + (Math.random() - 0.5) * variance),
      holdVelocityVariance: Math.random() * 10,
    };
  }

  /**
   * Validate user credentials
   */
  static async validateUser(username, password) {
    const user = Array.from(this.users.values()).find(
      (user) => user.username === username && user.isActive
    );

    if (!user) {
      Logger.warn(`Login attempt with unknown username: ${username}`);
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      Logger.warn(`Invalid password for user: ${username}`);
      return null;
    }

    // Update login stats
    user.lastLogin = new Date().toISOString();
    user.loginCount++;

    // Attach biometric profile
    user.biometricProfile = this.biometricProfiles.get(user.id);

    Logger.info(`✅ User validated: ${username}`);
    return user;
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId) {
    const user = this.users.get(userId);
    if (user) {
      user.biometricProfile = this.biometricProfiles.get(userId);
    }
    return user;
  }

  /**
   * Update biometric profile with new sample
   */
  static async updateBiometricProfile(userId, features) {
    const profile = this.biometricProfiles.get(userId);

    if (!profile) {
      Logger.error(`Biometric profile not found for user: ${userId}`);
      return false;
    }

    // Calculate metrics for the new sample
    const avgHoldTime =
      features.holdTimes.reduce((sum, val) => sum + val, 0) /
      features.holdTimes.length;
    const avgFlightTime =
      features.flightTimes.reduce((sum, val) => sum + val, 0) /
      features.flightTimes.length;

    const holdTimeVariance =
      features.holdTimes.reduce(
        (sum, val) => sum + Math.pow(val - avgHoldTime, 2),
        0
      ) / features.holdTimes.length;
    const flightTimeVariance =
      features.flightTimes.reduce(
        (sum, val) => sum + Math.pow(val - avgFlightTime, 2),
        0
      ) / features.flightTimes.length;

    // Create new sample
    const newSample = {
      avgHoldTime,
      avgFlightTime,
      holdTimeVariance,
      flightTimeVariance,
      errorRate: features.errorRate,
      typingSpeed: features.typingSpeed,
      timestamp: new Date().toISOString(),
    };

    // Add to profile (keep last 50 samples)
    profile.samples.push(newSample);
    if (profile.samples.length > 50) {
      profile.samples.shift(); // Remove oldest
    }

    profile.lastUpdated = new Date().toISOString();

    Logger.debug(`🧬 Biometric profile updated for user: ${userId}`, {
      sampleCount: profile.samples.length,
      avgHoldTime,
      avgFlightTime,
    });

    return true;
  }

  /**
   * Get all users (admin function)
   */
  static async getAllUsers() {
    return Array.from(this.users.values()).map((user) => ({
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      loginCount: user.loginCount,
      isActive: user.isActive,
      biometricSampleCount:
        this.biometricProfiles.get(user.id)?.samples?.length || 0,
    }));
  }

  /**
   * Delete user (admin function)
   */
  static async deleteUser(userId) {
    const deleted = this.users.delete(userId);
    this.biometricProfiles.delete(userId);

    if (deleted) {
      Logger.info(`🗑️ User deleted: ${userId}`);
    }

    return deleted;
  }

  /**
   * Reset biometric profile (admin function)
   */
  static async resetBiometricProfile(userId) {
    const user = this.users.get(userId);
    if (!user) return false;

    const newProfile = {
      userId,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      samples: [],
    };

    this.biometricProfiles.set(userId, newProfile);

    Logger.info(`🔄 Biometric profile reset for user: ${userId}`);
    return true;
  }
}

// Initialize demo users on startup
UserManager.initialize();
