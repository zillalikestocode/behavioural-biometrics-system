/**
 * Step-up Challenge Modal Component
 */

import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  Calculator,
  Mail,
  MessageSquare,
  Image,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Alert } from "../ui/alert";
import { AuthClient, type StepUpRequest } from "../../lib/auth-client";
import { useAuthStore } from "../../store/auth-store";

interface StepUpChallengeProps {
  onSuccess?: () => void;
  onFailure?: (error: string) => void;
}

export function StepUpChallenge({
  onSuccess,
  onFailure,
}: StepUpChallengeProps) {
  const [solution, setSolution] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes

  const {
    showStepUp,
    stepUpChallenge,
    hideStepUpChallenge,
    setAuthenticated,
    setLoading,
  } = useAuthStore();

  const authClient = new AuthClient();

  // Timer for challenge expiration
  useEffect(() => {
    if (!showStepUp || !stepUpChallenge) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          hideStepUpChallenge();
          onFailure?.("Challenge expired. Please try logging in again.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showStepUp, stepUpChallenge, hideStepUpChallenge, onFailure]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const getChallengeIcon = (type: string) => {
    switch (type) {
      case "MATH":
        return <Calculator className="h-5 w-5 text-blue-600" />;
      case "EMAIL":
        return <Mail className="h-5 w-5 text-green-600" />;
      case "SMS":
        return <MessageSquare className="h-5 w-5 text-purple-600" />;
      case "CAPTCHA":
        return <Image className="h-5 w-5 text-orange-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getChallengeTitle = (type: string): string => {
    switch (type) {
      case "MATH":
        return "Mathematical Challenge";
      case "EMAIL":
        return "Email Verification";
      case "SMS":
        return "SMS Verification";
      case "CAPTCHA":
        return "Visual Verification";
      default:
        return "Additional Verification";
    }
  };

  const getChallengeDescription = (type: string): string => {
    switch (type) {
      case "MATH":
        return "Solve the mathematical problem below to continue.";
      case "EMAIL":
        return "Enter the verification code sent to your email.";
      case "SMS":
        return "Enter the verification code sent to your phone.";
      case "CAPTCHA":
        return "Complete the visual challenge to proceed.";
      default:
        return "Complete the additional verification step.";
    }
  };

  const renderChallengeContent = () => {
    if (!stepUpChallenge) return null;

    switch (stepUpChallenge.type) {
      case "MATH":
        return (
          <div className="space-y-4">
            <div className="p-6 bg-blue-950/30 rounded-xl border border-blue-500/20">
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-blue-300">
                  {stepUpChallenge.data?.problem || "12 + 8 = ?"}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="solution" className="text-gray-300">
                Your Answer
              </Label>
              <Input
                id="solution"
                type="number"
                placeholder="Enter your answer"
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                className="text-center text-lg bg-gray-800/50 border-gray-600/50 text-white placeholder:text-gray-500 
                          focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                autoFocus
              />
            </div>
          </div>
        );

      case "EMAIL":
      case "SMS":
        return (
          <div className="space-y-4">
            <div className="p-4 bg-gray-800/30 rounded-xl border border-gray-700/30">
              <div className="text-sm text-gray-400 text-center">
                Code sent to:{" "}
                <span className="text-gray-300">
                  {stepUpChallenge.data?.destination || "***@example.com"}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="solution" className="text-gray-300">
                Verification Code
              </Label>
              <Input
                id="solution"
                type="text"
                placeholder="Enter 6-digit code"
                value={solution}
                onChange={(e) =>
                  setSolution(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="text-center text-lg tracking-widest bg-gray-800/50 border-gray-600/50 text-white placeholder:text-gray-500 
                          focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                autoFocus
              />
            </div>
          </div>
        );

      case "CAPTCHA":
        return (
          <div className="space-y-4">
            <div className="p-4 bg-gray-800/30 rounded-xl border border-gray-700/30">
              <div className="text-center">
                <div className="w-full h-20 bg-gray-700/50 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400 text-sm">
                    CAPTCHA Challenge
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="solution" className="text-gray-300">
                Enter the text you see
              </Label>
              <Input
                id="solution"
                type="text"
                placeholder="Enter CAPTCHA text"
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                className="text-center bg-gray-800/50 border-gray-600/50 text-white placeholder:text-gray-500 
                          focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                autoFocus
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-950/30 rounded-xl border border-yellow-500/20">
              <div className="text-sm text-yellow-200 text-center">
                Additional verification required
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="solution" className="text-gray-300">
                Verification Response
              </Label>
              <Input
                id="solution"
                type="text"
                placeholder="Enter response"
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                className="bg-gray-800/50 border-gray-600/50 text-white placeholder:text-gray-500 
                          focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                autoFocus
              />
            </div>
          </div>
        );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!solution.trim() || !stepUpChallenge) {
      setError("Please provide a solution");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const request: StepUpRequest = {
        challengeId: stepUpChallenge.id,
        solution: solution.trim(),
      };

      const response = await authClient.completeStepUp(request);

      if (response.success && response.action === "GRANT") {
        // Update auth store with successful authentication
        setAuthenticated({
          success: true,
          action: "GRANT",
          message: "Authentication successful",
          sessionToken: response.sessionToken,
          riskScore: 0.2, // Lower risk after successful step-up
          timestamp: Date.now(),
        });
        hideStepUpChallenge();
        onSuccess?.();
      } else if (response.action === "RETRY") {
        setError(response.message || "Incorrect solution. Please try again.");
        setSolution("");
      } else {
        hideStepUpChallenge();
        onFailure?.(response.message || "Authentication failed");
      }
    } catch (error) {
      console.error("Step-up challenge error:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    hideStepUpChallenge();
    onFailure?.("Authentication cancelled");
  };

  if (!showStepUp || !stepUpChallenge) {
    return null;
  }

  return (
    <Dialog open={showStepUp} onOpenChange={() => handleCancel()}>
      <DialogContent className="sm:max-w-md bg-gray-900/95 backdrop-blur-xl border-gray-700/50 text-white">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {getChallengeIcon(stepUpChallenge.type)}
            <DialogTitle className="text-white">
              {getChallengeTitle(stepUpChallenge.type)}
            </DialogTitle>
          </div>
          <DialogDescription className="text-gray-400">
            {getChallengeDescription(stepUpChallenge.type)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Timer */}
          <div className="flex justify-between items-center text-sm bg-gray-800/50 p-3 rounded-lg">
            <span className="text-gray-400">Time remaining:</span>
            <span
              className={`font-mono font-bold ${
                timeRemaining < 60 ? "text-red-400" : "text-green-400"
              }`}
            >
              {formatTime(timeRemaining)}
            </span>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert className="border-red-500/20 bg-red-950/30 text-red-200">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <div>{error}</div>
            </Alert>
          )}

          {/* Challenge Content */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {renderChallengeContent()}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="flex-1 bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:text-white"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                disabled={isSubmitting || !solution.trim()}
              >
                {isSubmitting ? "Verifying..." : "Verify"}
              </Button>
            </div>
          </form>

          <div className="text-xs text-gray-500 text-center pt-2">
            This additional step helps protect your account from unauthorized
            access.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
