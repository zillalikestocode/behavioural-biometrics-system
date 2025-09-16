/**
 * Challenge management system for step-up authentication (TypeScript)
 */

import { v4 as uuidv4 } from "uuid";
import { Logger } from "../utils/logger";

export interface ChallengeData {
  id: string;
  userId: string;
  type: string;
  question: string;
  answer: string | number;
  hints: string[];
  createdAt: string;
  expiresAt: string;
  attempts: number;
  maxAttempts: number;
  completed: boolean;
}

export class ChallengeManager {
  static challenges: Map<string, ChallengeData> = new Map();
  static challengeTypes = [
    "math",
    "pattern",
    "memory",
    "captcha",
    "security_questions",
  ] as const;

  /**
   * Create a new challenge for user
   */
  static async createChallenge(
    userId: string,
    type: (typeof ChallengeManager.challengeTypes)[number] | null = null
  ) {
    const challengeId = uuidv4();
    const challengeType = type ?? this.selectRandomChallengeType();

    let challenge: {
      question: string;
      answer: string | number;
      hints?: string[];
    };

    switch (challengeType) {
      case "math":
        challenge = this.createMathChallenge();
        break;
      case "pattern":
        challenge = this.createPatternChallenge();
        break;
      case "memory":
        challenge = this.createMemoryChallenge();
        break;
      case "captcha":
        challenge = this.createCaptchaChallenge();
        break;
      case "security_questions":
        challenge = this.createSecurityQuestionChallenge();
        break;
      default:
        challenge = this.createMathChallenge();
    }

    const challengeData: ChallengeData = {
      id: challengeId,
      userId,
      type: challengeType as string,
      question: challenge.question,
      answer: challenge.answer,
      hints: challenge.hints || [],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      attempts: 0,
      maxAttempts: 3,
      completed: false,
    };

    this.challenges.set(challengeId, challengeData);

    // Cleanup expired challenges
    this.cleanupExpiredChallenges();

    Logger.info(`🎯 Challenge created: ${challengeType} for user ${userId}`, {
      challengeId,
      type: challengeType,
    });

    return {
      id: challengeId,
      type: challengeType,
      question: challenge.question,
      hints: challenge.hints || [],
      expiresIn: 300, // 5 minutes in seconds
    };
  }

  /**
   * Verify challenge solution
   */
  static async verifyChallenge(challengeId: string, solution: string) {
    const challenge = this.challenges.get(challengeId);

    if (!challenge) {
      Logger.warn(`Challenge verification failed - not found: ${challengeId}`);
      return { valid: false, error: "Challenge not found or expired" } as const;
    }

    // Check if challenge is expired
    if (new Date() > new Date(challenge.expiresAt)) {
      this.challenges.delete(challengeId);
      Logger.warn(`Challenge verification failed - expired: ${challengeId}`);
      return { valid: false, error: "Challenge expired" } as const;
    }

    // Check if challenge is already completed
    if (challenge.completed) {
      Logger.warn(
        `Challenge verification failed - already completed: ${challengeId}`
      );
      return { valid: false, error: "Challenge already completed" } as const;
    }

    // Check attempt limit
    if (challenge.attempts >= challenge.maxAttempts) {
      this.challenges.delete(challengeId);
      Logger.warn(
        `Challenge verification failed - max attempts: ${challengeId}`
      );
      return { valid: false, error: "Maximum attempts exceeded" } as const;
    }

    // Increment attempt counter
    challenge.attempts++;

    // Verify solution
    const isCorrect = this.verifySolution(challenge, solution);

    if (isCorrect) {
      challenge.completed = true;

      Logger.info(`✅ Challenge completed successfully: ${challengeId}`, {
        userId: challenge.userId,
        type: challenge.type,
        attempts: challenge.attempts,
      });

      return {
        valid: true as const,
        userId: challenge.userId,
        challengeType: challenge.type,
        attempts: challenge.attempts,
      };
    } else {
      Logger.warn(
        `❌ Challenge verification failed - incorrect solution: ${challengeId}`,
        {
          attempts: challenge.attempts,
          maxAttempts: challenge.maxAttempts,
        }
      );

      return {
        valid: false as const,
        error: "Incorrect solution",
        attemptsRemaining: challenge.maxAttempts - challenge.attempts,
      };
    }
  }

  /**
   * Verify solution based on challenge type
   */
  static verifySolution(challenge: ChallengeData, solution: string) {
    const normalizedSolution = solution.toString().toLowerCase().trim();
    const normalizedAnswer = challenge.answer.toString().toLowerCase().trim();

    switch (challenge.type) {
      case "math":
        return parseFloat(normalizedSolution) === parseFloat(normalizedAnswer);
      case "pattern":
      case "memory":
      case "captcha":
        return normalizedSolution === normalizedAnswer;
      case "security_questions":
        // More flexible matching for security questions
        return this.fuzzyMatch(normalizedSolution, normalizedAnswer);
      default:
        return normalizedSolution === normalizedAnswer;
    }
  }

  /**
   * Fuzzy matching for security questions
   */
  static fuzzyMatch(solution: string, answer: string) {
    // Remove common words and normalize
    const normalize = (str: string) =>
      str
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by)\b/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const normalizedSolution = normalize(solution);
    const normalizedAnswer = normalize(answer);

    // Exact match
    if (normalizedSolution === normalizedAnswer) return true;

    // Substring match
    if (
      normalizedSolution.includes(normalizedAnswer) ||
      normalizedAnswer.includes(normalizedSolution)
    ) {
      return true;
    }

    // Levenshtein distance for typos
    const distance = this.levenshteinDistance(
      normalizedSolution,
      normalizedAnswer
    );
    const maxLength = Math.max(
      normalizedSolution.length,
      normalizedAnswer.length
    );
    const similarity = 1 - (distance ?? 0) / (maxLength || 1);

    return similarity >= 0.8; // 80% similarity threshold
  }

  /**
   * Calculate Levenshtein distance
   */
  static levenshteinDistance(a: string, b: string) {
    const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
      Array(b.length + 1).fill(0)
    );

    for (let i = 0; i <= a.length; i++) matrix[i]![0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0]![j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j]! + 1, // deletion
          matrix[i]![j - 1]! + 1, // insertion
          matrix[i - 1]![j - 1]! + cost // substitution
        );
      }
    }

    return matrix[a.length]![b.length]!;
  }

  /**
   * Select random challenge type
   */
  static selectRandomChallengeType() {
    return this.challengeTypes[
      Math.floor(Math.random() * this.challengeTypes.length)
    ];
  }

  /**
   * Create math challenge
   */
  static createMathChallenge() {
    const operations = ["+", "-", "*"] as const;
    const operation = operations[Math.floor(Math.random() * operations.length)];

    let a = 0,
      b = 0,
      answer: number = 0,
      question = "";

    switch (operation) {
      case "+":
        a = Math.floor(Math.random() * 50) + 10;
        b = Math.floor(Math.random() * 50) + 10;
        answer = a + b;
        question = `What is ${a} + ${b}?`;
        break;
      case "-":
        a = Math.floor(Math.random() * 50) + 50;
        b = Math.floor(Math.random() * 30) + 10;
        answer = a - b;
        question = `What is ${a} - ${b}?`;
        break;
      case "*":
        a = Math.floor(Math.random() * 12) + 2;
        b = Math.floor(Math.random() * 12) + 2;
        answer = a * b;
        question = `What is ${a} × ${b}?`;
        break;
    }

    return { question, answer };
  }

  /**
   * Create pattern challenge
   */
  static createPatternChallenge() {
    const patterns = [
      { sequence: [2, 4, 6, 8], next: 10, rule: "even numbers" },
      { sequence: [1, 3, 5, 7], next: 9, rule: "odd numbers" },
      { sequence: [1, 4, 7, 10], next: 13, rule: "add 3" },
      { sequence: [2, 6, 18, 54], next: 162, rule: "multiply by 3" },
      { sequence: [1, 1, 2, 3, 5], next: 8, rule: "Fibonacci" },
    ];

    const pattern = patterns[Math.floor(Math.random() * patterns.length)]!;
    const question = `What is the next number in this sequence: ${pattern.sequence.join(
      ", "
    )}, ?`;

    return { question, answer: pattern.next, hints: [`Hint: ${pattern.rule}`] };
  }

  /**
   * Create memory challenge
   */
  static createMemoryChallenge() {
    const words = [
      "apple",
      "bridge",
      "candle",
      "dragon",
      "eagle",
      "forest",
      "guitar",
      "house",
    ];
    const sequence: string[] = [];
    const length = Math.floor(Math.random() * 3) + 4; // 4-6 words

    for (let i = 0; i < length; i++) {
      const word = words[Math.floor(Math.random() * words.length)]!;
      if (!sequence.includes(word)) {
        sequence.push(word);
      } else {
        i--; // Try again
      }
    }

    const targetIndex = Math.floor(Math.random() * sequence.length);
    const question = `Remember this sequence: "${sequence.join(
      " - "
    )}". What was the ${this.ordinal(targetIndex + 1)} word?`;

    return { question, answer: sequence[targetIndex]! };
  }

  /**
   * Create CAPTCHA-style challenge
   */
  static createCaptchaChallenge() {
    const letters = "ABCDEFGHIJKLMNPQRSTUVWXYZ23456789"; // Excluding confusing characters
    const length = 5;
    let captcha = "";

    for (let i = 0; i < length; i++) {
      captcha += letters.charAt(Math.floor(Math.random() * letters.length));
    }

    const distortions = [
      "slightly rotated",
      "with wavy lines",
      "with dots in background",
      "in cursive style",
      "with strikethrough",
    ];

    const distortion =
      distortions[Math.floor(Math.random() * distortions.length)];

    return {
      question: `Type the following characters (${distortion}): ${captcha}`,
      answer: captcha,
    };
  }

  /**
   * Create security question challenge
   */
  static createSecurityQuestionChallenge() {
    const questions = [
      { q: "What was the name of your first pet?", a: "buddy" },
      { q: "What is your mother's maiden name?", a: "smith" },
      { q: "What was the make of your first car?", a: "toyota" },
      { q: "What city were you born in?", a: "denver" },
      { q: "What was your favorite subject in school?", a: "mathematics" },
    ];

    const qa = questions[Math.floor(Math.random() * questions.length)]!;

    return {
      question: qa.q + " (This is a demo - any reasonable answer will work)",
      answer: qa.a,
    };
  }

  /**
   * Get ordinal number string
   */
  static ordinal(n: number) {
    const ordinals = [
      "",
      "first",
      "second",
      "third",
      "fourth",
      "fifth",
      "sixth",
    ];
    return ordinals[n] || `${n}th`;
  }

  /**
   * Cleanup expired challenges
   */
  static cleanupExpiredChallenges() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [id, challenge] of this.challenges.entries()) {
      if (now > new Date(challenge.expiresAt)) {
        this.challenges.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      Logger.debug(`🧹 Cleaned up ${cleanedCount} expired challenges`);
    }
  }

  /**
   * Get challenge status (admin function)
   */
  static getChallengeStatus() {
    return {
      activeChallenges: this.challenges.size,
      challengeTypes: this.challengeTypes,
      averageAttempts: this.calculateAverageAttempts(),
    };
  }

  /**
   * Calculate average attempts across all challenges
   */
  static calculateAverageAttempts() {
    const challenges = Array.from(this.challenges.values());
    if (challenges.length === 0) return 0;

    const totalAttempts = challenges.reduce(
      (sum, challenge) => sum + challenge.attempts,
      0
    );
    return totalAttempts / challenges.length;
  }
}
