/**
 * Login Form Component with Biometric Capture
 */

import React, { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Lock, User, Shield, AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent } from "../ui/card";
import { Alert } from "../ui/alert";
import { Progress } from "../ui/progress";
import { BiometricCapture, type TypingSession } from "../../lib/biometrics";
import { RiskCalculator, type RiskPrediction } from "../../lib/risk-calculator";
import { AuthClient, type LoginRequest } from "../../lib/auth-client";
import { useAuthStore } from "../../store/auth-store";

interface LoginFormProps {
  onLoginSuccess?: () => void;
  onLoginError?: (error: string) => void;
}

export function LoginForm({ onLoginSuccess, onLoginError }: LoginFormProps) {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [currentRisk, setCurrentRisk] = useState<RiskPrediction | null>(null);
  const [biometricSession, setBiometricSession] =
    useState<TypingSession | null>(null);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const biometricCaptureRef = useRef<BiometricCapture | null>(null);
  const riskCalculatorRef = useRef<RiskCalculator | null>(null);
  const authClientRef = useRef<AuthClient | null>(null);

  const {
    isLoading,
    setLoading,
    setAuthenticated,
    updateRiskAssessment,
    updateBiometricSession,
    incrementLoginAttempts,
  } = useAuthStore();

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      // Initialize biometric capture
      biometricCaptureRef.current = new BiometricCapture((session) => {
        setBiometricSession(session);
        updateBiometricSession(session);
        calculateRisk(session);
      });

      // Initialize risk calculator
      riskCalculatorRef.current = new RiskCalculator();

      // Initialize auth client
      authClientRef.current = new AuthClient();

      // Attach biometric capture to form inputs
      if (usernameRef.current) {
        biometricCaptureRef.current.attachToElement(usernameRef.current);
      }
      if (passwordRef.current) {
        biometricCaptureRef.current.attachToElement(passwordRef.current);
      }
    };

    initializeServices();

    return () => {
      // Cleanup
      if (biometricCaptureRef.current) {
        biometricCaptureRef.current.destroy();
      }
      if (riskCalculatorRef.current) {
        riskCalculatorRef.current.dispose();
      }
    };
  }, [updateBiometricSession]);

  const calculateRisk = async (session: TypingSession) => {
    if (!riskCalculatorRef.current || session.totalKeystrokes < 5) return;

    try {
      const features = [
        session.holdTimes.length > 0
          ? session.holdTimes.reduce((sum, val) => sum + val, 0) /
            session.holdTimes.length
          : 0,
        session.flightTimes.length > 0
          ? session.flightTimes.reduce((sum, val) => sum + val, 0) /
            session.flightTimes.length
          : 0,
        Math.sqrt(calculateVariance(session.holdTimes)),
        Math.sqrt(calculateVariance(session.flightTimes)),
        session.typingSpeed,
        session.errorRate,
        session.consistencyScore,
        session.totalKeystrokes,
      ];

      const risk = await riskCalculatorRef.current.calculateRisk(features);
      setCurrentRisk(risk);
      updateRiskAssessment(risk);
    } catch (error) {
      console.error("Error calculating risk:", error);
    }
  };

  const calculateVariance = (values: number[]): number => {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username || !formData.password) {
      onLoginError?.("Please enter both username and password");
      return;
    }

    if (!authClientRef.current || !biometricCaptureRef.current) {
      onLoginError?.("Authentication service not ready");
      return;
    }

    setLoading(true);
    incrementLoginAttempts();

    try {
      const session = biometricCaptureRef.current.getSessionData();
      const features = biometricCaptureRef.current.getTypingFeatures();

      const loginRequest: LoginRequest = {
        username: formData.username,
        password: formData.password,
        riskScore: currentRisk?.riskScore || 0.5,
        features: {
          holdTimes: session.holdTimes,
          flightTimes: session.flightTimes,
          typingSpeed: session.typingSpeed,
          errorRate: session.errorRate,
          consistencyScore: session.consistencyScore,
          timestamp: Date.now(),
        },
      };

      const response = await authClientRef.current.login(loginRequest);
      setAuthenticated(response);

      if (response.success) {
        onLoginSuccess?.();
      } else {
        onLoginError?.(response.message);
      }
    } catch (error) {
      console.error("Login error:", error);
      onLoginError?.("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number): string => {
    if (score < 0.3) return "bg-green-500";
    if (score < 0.7) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getRiskLabel = (score: number): string => {
    if (score < 0.3) return "Low Risk";
    if (score < 0.7) return "Medium Risk";
    return "High Risk";
  };

  return (
    <div className="w-full">
      <Card className="border-0 bg-gray-900/60 backdrop-blur-xl shadow-2xl">
        <CardContent className="p-8">
          {/* Risk Visualization */}
          {currentRisk &&
            biometricSession &&
            biometricSession.totalKeystrokes > 5 && (
              <div className="mb-6 p-4 rounded-xl bg-gray-800/50 border border-gray-700/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300">
                    Security Assessment
                  </span>
                  <span
                    className={`text-sm font-semibold px-2 py-1 rounded-full ${
                      currentRisk.riskScore < 0.3
                        ? "bg-green-500/20 text-green-400"
                        : currentRisk.riskScore < 0.7
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {getRiskLabel(currentRisk.riskScore)}
                  </span>
                </div>
                <div className="relative">
                  <Progress
                    value={currentRisk.riskScore * 100}
                    className="h-2 bg-gray-700"
                  />
                  <div
                    className={`absolute top-0 left-0 h-2 rounded-full transition-all duration-500 ${
                      currentRisk.riskScore < 0.3
                        ? "bg-gradient-to-r from-green-500 to-green-400"
                        : currentRisk.riskScore < 0.7
                        ? "bg-gradient-to-r from-yellow-500 to-yellow-400"
                        : "bg-gradient-to-r from-red-500 to-red-400"
                    }`}
                    style={{ width: `${currentRisk.riskScore * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                  <span>
                    Confidence: {(currentRisk.confidence * 100).toFixed(0)}%
                  </span>
                  <span>Keystrokes: {biometricSession.totalKeystrokes}</span>
                </div>
              </div>
            )}

          {/* Warning for high risk */}
          {currentRisk && currentRisk.riskScore > 0.7 && (
            <Alert className="mb-6 border-amber-500/20 bg-amber-950/30 text-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <div>
                <div className="font-medium">
                  Unusual typing pattern detected
                </div>
                <div className="text-sm opacity-90">
                  Additional verification may be required.
                </div>
              </div>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-gray-300 font-medium">
                Username
              </Label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 h-5 w-5 transition-colors group-focus-within:text-blue-400" />
                <Input
                  ref={usernameRef}
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Enter your username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="pl-12 h-12 bg-gray-800/50 border-gray-600/50 text-white placeholder:text-gray-500 
                            focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200
                            hover:border-gray-500/50"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300 font-medium">
                Password
              </Label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 h-5 w-5 transition-colors group-focus-within:text-blue-400" />
                <Input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="pl-12 pr-12 h-12 bg-gray-800/50 border-gray-600/50 text-white placeholder:text-gray-500 
                            focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200
                            hover:border-gray-500/50"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Biometric Stats */}
            {biometricSession && biometricSession.totalKeystrokes > 0 && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-800/30 rounded-xl border border-gray-700/30">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-400">
                    {biometricSession.typingSpeed.toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">
                    WPM
                  </div>
                </div>
                <div className="text-center border-l border-r border-gray-700/50">
                  <div className="text-lg font-bold text-green-400">
                    {biometricSession.errorRate.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">
                    Errors
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-400">
                    {biometricSession.consistencyScore.toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">
                    Consistency
                  </div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                        text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-[1.02] 
                        shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              disabled={isLoading || !formData.username || !formData.password}
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Authenticating...</span>
                </div>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <div className="flex items-center justify-center space-x-2 text-xs text-gray-500 mb-2">
              <Shield className="w-3 h-3" />
              <span>End-to-end encrypted</span>
              <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
              <span>Biometric analysis</span>
            </div>
            <p className="text-xs text-gray-600">
              Your keystroke patterns are analyzed locally for enhanced security
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
