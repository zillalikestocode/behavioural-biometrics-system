/**
 * Authentication state management using Zustand
 */

import { create } from "zustand";
import type {
  LoginResponse,
  SessionValidationResponse,
} from "../lib/auth-client";
import type { RiskPrediction } from "../lib/risk-calculator";
import type { TypingSession } from "../lib/biometrics";

export interface AuthState {
  // Authentication state
  isAuthenticated: boolean;
  user: {
    username: string;
    loginTime: number;
    riskScore: number;
  } | null;
  sessionToken: string | null;

  // Risk assessment state
  currentRisk: RiskPrediction | null;
  biometricSession: TypingSession | null;

  // UI state
  isLoading: boolean;
  showStepUp: boolean;
  stepUpChallenge: {
    id: string;
    type: "MATH" | "CAPTCHA" | "SMS" | "EMAIL";
    data: any;
  } | null;

  // Performance metrics
  metrics: {
    loginAttempts: number;
    modelAccuracy: number;
    averageRiskScore: number;
    lastUpdateTime: number;
  };
}

interface AuthActions {
  // Authentication actions
  setAuthenticated: (response: LoginResponse) => void;
  setUser: (user: AuthState["user"]) => void;
  setSessionToken: (token: string | null) => void;
  logout: () => void;

  // Risk assessment actions
  updateRiskAssessment: (risk: RiskPrediction) => void;
  updateBiometricSession: (session: TypingSession) => void;

  // UI actions
  setLoading: (loading: boolean) => void;
  showStepUpChallenge: (challenge: AuthState["stepUpChallenge"]) => void;
  hideStepUpChallenge: () => void;

  // Metrics actions
  updateMetrics: (metrics: Partial<AuthState["metrics"]>) => void;
  incrementLoginAttempts: () => void;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  sessionToken: localStorage.getItem("sessionToken"),
  currentRisk: null,
  biometricSession: null,
  isLoading: false,
  showStepUp: false,
  stepUpChallenge: null,
  metrics: {
    loginAttempts: 0,
    modelAccuracy: 0,
    averageRiskScore: 0,
    lastUpdateTime: Date.now(),
  },
};

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  ...initialState,

  setAuthenticated: (response: LoginResponse) => {
    set({
      isAuthenticated: response.success && response.action === "GRANT",
      user:
        response.success && response.action === "GRANT"
          ? {
              username: "", // Will be updated from session validation
              loginTime: response.timestamp,
              riskScore: response.riskScore,
            }
          : null,
      sessionToken: response.sessionToken || null,
      showStepUp: response.action === "STEP_UP",
      stepUpChallenge: response.challengeId
        ? {
            id: response.challengeId,
            type: response.challengeType || "MATH",
            data: response.challengeData,
          }
        : null,
      isLoading: false,
    });
  },

  setUser: (user) => set({ user }),

  setSessionToken: (token) => {
    set({ sessionToken: token });
    if (token) {
      localStorage.setItem("sessionToken", token);
    } else {
      localStorage.removeItem("sessionToken");
    }
  },

  logout: () => {
    localStorage.removeItem("sessionToken");
    set({
      isAuthenticated: false,
      user: null,
      sessionToken: null,
      currentRisk: null,
      biometricSession: null,
      showStepUp: false,
      stepUpChallenge: null,
    });
  },

  updateRiskAssessment: (risk) => {
    const currentMetrics = get().metrics;
    set({
      currentRisk: risk,
      metrics: {
        ...currentMetrics,
        averageRiskScore:
          (currentMetrics.averageRiskScore + risk.riskScore) / 2,
        lastUpdateTime: Date.now(),
      },
    });
  },

  updateBiometricSession: (session) => set({ biometricSession: session }),

  setLoading: (loading) => set({ isLoading: loading }),

  showStepUpChallenge: (challenge) =>
    set({
      showStepUp: true,
      stepUpChallenge: challenge,
    }),

  hideStepUpChallenge: () =>
    set({
      showStepUp: false,
      stepUpChallenge: null,
    }),

  updateMetrics: (metrics) =>
    set((state) => ({
      metrics: { ...state.metrics, ...metrics },
    })),

  incrementLoginAttempts: () =>
    set((state) => ({
      metrics: {
        ...state.metrics,
        loginAttempts: state.metrics.loginAttempts + 1,
      },
    })),
}));
