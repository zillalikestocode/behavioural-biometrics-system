/**
 * API client for communicating with the Bun backend server
 * Handles authentication, step-up challenges, and risk assessment
 */

export interface LoginRequest {
  username: string;
  password: string;
  riskScore: number;
  features?: {
    holdTimes: number[];
    flightTimes: number[];
    typingSpeed: number;
    errorRate: number;
    consistencyScore: number;
    timestamp: number;
  };
}

export interface LoginResponse {
  success: boolean;
  action: "GRANT" | "DENY" | "STEP_UP";
  message: string;
  sessionToken?: string;
  challengeId?: string;
  challengeType?: "MATH" | "CAPTCHA" | "SMS" | "EMAIL";
  challengeData?: any;
  riskScore: number;
  timestamp: number;
}

export interface StepUpRequest {
  challengeId: string;
  solution: string;
  sessionToken?: string;
}

export interface StepUpResponse {
  success: boolean;
  action: "GRANT" | "DENY" | "RETRY";
  message: string;
  sessionToken?: string;
  attemptsRemaining?: number;
}

export interface SessionValidationResponse {
  valid: boolean;
  user?: {
    username: string;
    loginTime: number;
    riskScore: number;
  };
  message: string;
}

export class AuthClient {
  private baseUrl: string;
  private sessionToken: string | null = null;

  constructor(baseUrl: string = "http://localhost:3000") {
    this.baseUrl = baseUrl;
    this.sessionToken = localStorage.getItem("sessionToken");
  }

  /**
   * Authenticate user with credentials and biometric data
   */
  public async login(request: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          ...request,
          // userAgent: navigator.userAgent,
          // timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: LoginResponse = await response.json();

      // Store session token if login successful
      if (data.success && data.sessionToken) {
        this.sessionToken = data.sessionToken;
        localStorage.setItem("sessionToken", data.sessionToken);
      }

      return data;
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        action: "DENY",
        message: "Network error occurred. Please try again.",
        riskScore: 1.0,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Complete step-up authentication challenge
   */
  public async completeStepUp(request: StepUpRequest): Promise<StepUpResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/step-up`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          ...(this.sessionToken && {
            Authorization: `Bearer ${this.sessionToken}`,
          }),
        },
        body: JSON.stringify({
          ...request,
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: StepUpResponse = await response.json();

      // Update session token if provided
      if (data.sessionToken) {
        this.sessionToken = data.sessionToken;
        localStorage.setItem("sessionToken", data.sessionToken);
      }

      return data;
    } catch (error) {
      console.error("Step-up error:", error);
      return {
        success: false,
        action: "DENY",
        message: "Network error occurred. Please try again.",
      };
    }
  }

  /**
   * Validate current session
   */
  public async validateSession(): Promise<SessionValidationResponse> {
    if (!this.sessionToken) {
      return {
        valid: false,
        message: "No active session",
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/validate`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.sessionToken}`,
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: SessionValidationResponse = await response.json();

      if (!data.valid) {
        this.clearSession();
      }

      return data;
    } catch (error) {
      console.error("Session validation error:", error);
      this.clearSession();
      return {
        valid: false,
        message: "Session validation failed",
      };
    }
  }

  /**
   * Logout and clear session
   */
  public async logout(): Promise<{ success: boolean; message: string }> {
    try {
      if (this.sessionToken) {
        await fetch(`${this.baseUrl}/api/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.sessionToken}`,
            "X-Requested-With": "XMLHttpRequest",
          },
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      this.clearSession();
    }

    return {
      success: true,
      message: "Logged out successfully",
    };
  }

  /**
   * Get current session token
   */
  public getSessionToken(): string | null {
    return this.sessionToken;
  }

  /**
   * Check if user is currently authenticated
   */
  public isAuthenticated(): boolean {
    return this.sessionToken !== null;
  }

  /**
   * Clear session data
   */
  private clearSession(): void {
    this.sessionToken = null;
    localStorage.removeItem("sessionToken");
  }

  /**
   * Submit feedback about authentication experience
   */
  public async submitFeedback(feedback: {
    rating: number;
    comment?: string;
    experienceType: "smooth" | "difficult" | "blocked";
  }): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          ...(this.sessionToken && {
            Authorization: `Bearer ${this.sessionToken}`,
          }),
        },
        body: JSON.stringify({
          ...feedback,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Feedback submission error:", error);
      return {
        success: false,
        message: "Failed to submit feedback",
      };
    }
  }

  /**
   * Get system health status
   */
  public async getSystemHealth(): Promise<{
    status: "healthy" | "degraded" | "down";
    services: Record<string, boolean>;
    message: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: "GET",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Health check error:", error);
      return {
        status: "down",
        services: {},
        message: "Unable to connect to authentication service",
      };
    }
  }
}
