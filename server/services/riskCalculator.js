/**
 * Advanced risk calculation engine for keystroke dynamics analysis
 * Implements multiple algorithms for comprehensive biometric assessment
 */

import { Logger } from "../utils/logger.js";

export class RiskCalculator {
  /**
   * Calculate comprehensive risk score combining multiple factors
   */
  static async calculateRisk(currentFeatures, userProfile, clientRiskScore) {
    const startTime = Date.now();

    try {
      // Initialize risk factors
      const factors = {
        temporal: 0,
        behavioral: 0,
        consistency: 0,
        deviation: 0,
        velocity: 0,
        client: clientRiskScore || 0,
      };

      // If no profile exists, this is a new user - moderate risk
      if (
        !userProfile ||
        !userProfile.samples ||
        userProfile.samples.length === 0
      ) {
        factors.temporal = 0.4;
        factors.behavioral = 0.4;
        factors.consistency = 0.5;
        factors.deviation = 0.3;
        factors.velocity = 0.3;

        Logger.debug("New user risk assessment", { factors });

        return {
          finalScore: this.calculateWeightedScore(factors),
          factors,
          confidence: 0.3, // Low confidence for new users
          analysis: "New user - limited biometric data",
        };
      }

      // Calculate individual risk factors
      factors.temporal = this.calculateTemporalRisk(
        currentFeatures,
        userProfile
      );
      factors.behavioral = this.calculateBehavioralRisk(
        currentFeatures,
        userProfile
      );
      factors.consistency = this.calculateConsistencyRisk(
        currentFeatures,
        userProfile
      );
      factors.deviation = this.calculateDeviationRisk(
        currentFeatures,
        userProfile
      );
      factors.velocity = this.calculateVelocityRisk(
        currentFeatures,
        userProfile
      );

      // Calculate final weighted score
      const finalScore = this.calculateWeightedScore(factors);

      // Calculate confidence based on profile maturity
      const confidence = this.calculateConfidence(userProfile);

      // Generate analysis summary
      const analysis = this.generateAnalysis(factors, finalScore);

      Logger.performance("Risk calculation", startTime, {
        finalScore,
        confidence,
        sampleCount: userProfile.samples.length,
      });

      return {
        finalScore,
        factors,
        confidence,
        analysis,
      };
    } catch (error) {
      Logger.error("Risk calculation failed:", error);

      // Fallback to high risk on calculation failure
      return {
        finalScore: 0.8,
        factors: { error: true },
        confidence: 0,
        analysis: "Risk calculation failed - defaulting to high risk",
      };
    }
  }

  /**
   * Calculate temporal pattern risk (hold times and flight times)
   */
  static calculateTemporalRisk(current, profile) {
    const avgHoldTimes = this.calculateAverage(
      profile.samples.map((s) => s.avgHoldTime)
    );
    const avgFlightTimes = this.calculateAverage(
      profile.samples.map((s) => s.avgFlightTime)
    );

    const currentHoldAvg = this.calculateAverage(current.holdTimes);
    const currentFlightAvg = this.calculateAverage(current.flightTimes);

    // Calculate relative deviations
    const holdDeviation =
      Math.abs(currentHoldAvg - avgHoldTimes) / avgHoldTimes;
    const flightDeviation =
      Math.abs(currentFlightAvg - avgFlightTimes) / avgFlightTimes;

    // Normalize to 0-1 scale
    const holdRisk = Math.min(holdDeviation * 2, 1);
    const flightRisk = Math.min(flightDeviation * 2, 1);

    return (holdRisk + flightRisk) / 2;
  }

  /**
   * Calculate behavioral pattern risk
   */
  static calculateBehavioralRisk(current, profile) {
    const avgErrorRate = this.calculateAverage(
      profile.samples.map((s) => s.errorRate)
    );
    const avgTypingSpeed = this.calculateAverage(
      profile.samples.map((s) => s.typingSpeed)
    );

    // Error rate deviation
    const errorDeviation = Math.abs(current.errorRate - avgErrorRate);

    // Typing speed deviation (normalized)
    const speedDeviation =
      Math.abs(current.typingSpeed - avgTypingSpeed) / avgTypingSpeed;

    // Combine factors
    const errorRisk = Math.min(errorDeviation * 5, 1); // Error rates should be very stable
    const speedRisk = Math.min(speedDeviation * 3, 1);

    return (errorRisk + speedRisk) / 2;
  }

  /**
   * Calculate consistency risk based on variance patterns
   */
  static calculateConsistencyRisk(current, profile) {
    // Calculate variance of current session
    const currentHoldVariance = this.calculateVariance(current.holdTimes);
    const currentFlightVariance = this.calculateVariance(current.flightTimes);

    // Calculate historical variance pattern
    const historicalHoldVariances = profile.samples.map(
      (s) => s.holdTimeVariance || 0
    );
    const historicalFlightVariances = profile.samples.map(
      (s) => s.flightTimeVariance || 0
    );

    const avgHoldVariance = this.calculateAverage(historicalHoldVariances);
    const avgFlightVariance = this.calculateAverage(historicalFlightVariances);

    // Compare current vs historical consistency
    const holdConsistencyRisk =
      avgHoldVariance > 0
        ? Math.abs(currentHoldVariance - avgHoldVariance) / avgHoldVariance
        : 0;
    const flightConsistencyRisk =
      avgFlightVariance > 0
        ? Math.abs(currentFlightVariance - avgFlightVariance) /
          avgFlightVariance
        : 0;

    return Math.min((holdConsistencyRisk + flightConsistencyRisk) / 2, 1);
  }

  /**
   * Calculate statistical deviation risk using z-scores
   */
  static calculateDeviationRisk(current, profile) {
    const samples = profile.samples;

    // Calculate z-scores for key metrics
    const holdTimeZScore = this.calculateZScore(
      this.calculateAverage(current.holdTimes),
      samples.map((s) => s.avgHoldTime)
    );

    const flightTimeZScore = this.calculateZScore(
      this.calculateAverage(current.flightTimes),
      samples.map((s) => s.avgFlightTime)
    );

    const typingSpeedZScore = this.calculateZScore(
      current.typingSpeed,
      samples.map((s) => s.typingSpeed)
    );

    // Convert z-scores to risk (higher absolute z-score = higher risk)
    const holdRisk = Math.min(Math.abs(holdTimeZScore) / 3, 1);
    const flightRisk = Math.min(Math.abs(flightTimeZScore) / 3, 1);
    const speedRisk = Math.min(Math.abs(typingSpeedZScore) / 3, 1);

    return (holdRisk + flightRisk + speedRisk) / 3;
  }

  /**
   * Calculate velocity/acceleration risk
   */
  static calculateVelocityRisk(current, profile) {
    // Analyze typing rhythm changes within the session
    const holdTimes = current.holdTimes;
    const flightTimes = current.flightTimes;

    if (holdTimes.length < 3 || flightTimes.length < 3) {
      return 0.3; // Default moderate risk for insufficient data
    }

    // Calculate velocity changes (rate of change in timing)
    const holdVelocities = [];
    const flightVelocities = [];

    for (let i = 1; i < holdTimes.length; i++) {
      holdVelocities.push(holdTimes[i] - holdTimes[i - 1]);
    }

    for (let i = 1; i < flightTimes.length; i++) {
      flightVelocities.push(flightTimes[i] - flightTimes[i - 1]);
    }

    // Calculate velocity variance (smoothness of typing)
    const holdVelocityVariance = this.calculateVariance(holdVelocities);
    const flightVelocityVariance = this.calculateVariance(flightVelocities);

    // Compare with historical patterns
    const historicalHoldVelocityVariance = this.calculateAverage(
      profile.samples.map((s) => s.holdVelocityVariance || 0)
    );

    const velocityRisk =
      historicalHoldVelocityVariance > 0
        ? Math.abs(holdVelocityVariance - historicalHoldVelocityVariance) /
          historicalHoldVelocityVariance
        : 0.3;

    return Math.min(velocityRisk, 1);
  }

  /**
   * Calculate weighted final score
   */
  static calculateWeightedScore(factors) {
    const weights = {
      temporal: 0.25,
      behavioral: 0.2,
      consistency: 0.2,
      deviation: 0.15,
      velocity: 0.1,
      client: 0.1,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [factor, value] of Object.entries(factors)) {
      if (typeof value === "number" && !isNaN(value) && weights[factor]) {
        weightedSum += value * weights[factor];
        totalWeight += weights[factor];
      }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  }

  /**
   * Calculate confidence based on profile maturity
   */
  static calculateConfidence(profile) {
    const sampleCount = profile.samples.length;
    const daysSinceFirstSample =
      (Date.now() - new Date(profile.createdAt).getTime()) /
      (1000 * 60 * 60 * 24);

    // Confidence increases with sample count and time span
    const sampleConfidence = Math.min(sampleCount / 20, 1); // Max confidence at 20 samples
    const timeConfidence = Math.min(daysSinceFirstSample / 30, 1); // Max confidence after 30 days

    return (sampleConfidence + timeConfidence) / 2;
  }

  /**
   * Generate human-readable analysis
   */
  static generateAnalysis(factors, finalScore) {
    const riskLevel =
      finalScore < 0.3 ? "Low" : finalScore < 0.7 ? "Medium" : "High";
    const primaryRisk = Object.entries(factors)
      .filter(([key, value]) => key !== "client" && typeof value === "number")
      .sort(([, a], [, b]) => b - a)[0];

    return `${riskLevel} risk detected. Primary concern: ${primaryRisk[0]} (${(
      primaryRisk[1] * 100
    ).toFixed(1)}%)`;
  }

  // Helper mathematical functions

  static calculateAverage(array) {
    return array.length > 0
      ? array.reduce((sum, val) => sum + val, 0) / array.length
      : 0;
  }

  static calculateVariance(array) {
    if (array.length < 2) return 0;
    const avg = this.calculateAverage(array);
    const squaredDiffs = array.map((val) => Math.pow(val - avg, 2));
    return this.calculateAverage(squaredDiffs);
  }

  static calculateStandardDeviation(array) {
    return Math.sqrt(this.calculateVariance(array));
  }

  static calculateZScore(value, historicalValues) {
    if (historicalValues.length < 2) return 0;
    const mean = this.calculateAverage(historicalValues);
    const std = this.calculateStandardDeviation(historicalValues);
    return std > 0 ? (value - mean) / std : 0;
  }
}
