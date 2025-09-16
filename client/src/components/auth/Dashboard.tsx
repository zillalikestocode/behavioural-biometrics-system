/**
 * Dashboard Component - Post-authentication interface with dark theme
 */

import { useEffect, useState } from "react";
import {
  LogOut,
  Shield,
  Activity,
  Clock,
  TrendingUp,
  User,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Progress } from "../ui/progress";
import { useAuthStore } from "../../store/auth-store";
import { AuthClient } from "../../lib/auth-client";

interface DashboardProps {
  onLogout?: () => void;
}

export function Dashboard({ onLogout }: DashboardProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user, currentRisk, biometricSession, metrics, logout } =
    useAuthStore();
  const authClient = new AuthClient();

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    await authClient.logout();
    logout();
    onLogout?.();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getSessionDuration = () => {
    if (!user?.loginTime) return "Unknown";
    const duration = Date.now() - user.loginTime;
    const minutes = Math.floor(duration / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Security Dashboard
            </h1>
            <p className="text-gray-400">
              Real-time behavioral authentication monitoring
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm text-gray-400">Current Time</div>
              <div className="text-lg font-mono text-white">
                {formatTime(currentTime)}
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* User Status */}
          <Card className="bg-gray-900/60 border-gray-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                User Session
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-400">Username</div>
                  <div className="text-lg font-semibold text-white">
                    {user?.username || "Unknown"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Session Duration</div>
                  <div className="text-lg font-semibold text-green-400">
                    {getSessionDuration()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Status */}
          <Card className="bg-gray-900/60 border-gray-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-400" />
                Security Level
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-400">Risk Score</div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`text-lg font-semibold ${
                        (user?.riskScore || 0) < 0.3
                          ? "text-green-400"
                          : (user?.riskScore || 0) < 0.7
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}
                    >
                      {((user?.riskScore || 0) * 100).toFixed(0)}%
                    </div>
                    <div
                      className={`px-2 py-1 rounded-full text-xs ${
                        (user?.riskScore || 0) < 0.3
                          ? "bg-green-500/20 text-green-400"
                          : (user?.riskScore || 0) < 0.7
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {(user?.riskScore || 0) < 0.3
                        ? "Low"
                        : (user?.riskScore || 0) < 0.7
                        ? "Medium"
                        : "High"}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Status</div>
                  <div className="text-lg font-semibold text-green-400">
                    Authenticated
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Status */}
          <Card className="bg-gray-900/60 border-gray-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-400">Login Attempts</div>
                  <div className="text-lg font-semibold text-white">
                    {metrics.loginAttempts}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Last Update</div>
                  <div className="text-lg font-semibold text-gray-300">
                    {new Date(metrics.lastUpdateTime).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Current Session Analysis */}
        {currentRisk && biometricSession && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Real-time Risk Analysis */}
            <Card className="bg-gray-900/60 border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  Real-time Analysis
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Current behavioral biometric assessment
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Risk Level</span>
                    <span className="text-white">
                      {(currentRisk.riskScore * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress
                    value={currentRisk.riskScore * 100}
                    className="h-2 bg-gray-700"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Confidence</span>
                    <span className="text-white">
                      {(currentRisk.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress
                    value={currentRisk.confidence * 100}
                    className="h-2 bg-gray-700"
                  />
                </div>
                <div
                  className={`p-3 rounded-lg text-center ${
                    currentRisk.recommendation === "GRANT"
                      ? "bg-green-950/50 text-green-300"
                      : currentRisk.recommendation === "STEP_UP"
                      ? "bg-yellow-950/50 text-yellow-300"
                      : "bg-red-950/50 text-red-300"
                  }`}
                >
                  Recommendation: {currentRisk.recommendation}
                </div>
              </CardContent>
            </Card>

            {/* Typing Metrics */}
            <Card className="bg-gray-900/60 border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-400" />
                  Typing Metrics
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Keystroke dynamics analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-gray-800/30 rounded-lg">
                    <div className="text-2xl font-bold text-blue-400">
                      {biometricSession.typingSpeed.toFixed(0)}
                    </div>
                    <div className="text-sm text-gray-400">WPM</div>
                  </div>
                  <div className="text-center p-3 bg-gray-800/30 rounded-lg">
                    <div className="text-2xl font-bold text-green-400">
                      {biometricSession.errorRate.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-400">Error Rate</div>
                  </div>
                  <div className="text-center p-3 bg-gray-800/30 rounded-lg">
                    <div className="text-2xl font-bold text-purple-400">
                      {biometricSession.consistencyScore.toFixed(0)}%
                    </div>
                    <div className="text-sm text-gray-400">Consistency</div>
                  </div>
                  <div className="text-center p-3 bg-gray-800/30 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-400">
                      {biometricSession.totalKeystrokes}
                    </div>
                    <div className="text-sm text-gray-400">Keystrokes</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* System Information */}
        <Card className="bg-gray-900/60 border-gray-700/50">
          <CardHeader>
            <CardTitle className="text-white">System Information</CardTitle>
            <CardDescription className="text-gray-400">
              Behavioral biometrics authentication system status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Authentication Method</div>
                <div className="text-white font-medium">Keystroke Dynamics</div>
              </div>
              <div>
                <div className="text-gray-400">ML Framework</div>
                <div className="text-white font-medium">TensorFlow.js</div>
              </div>
              <div>
                <div className="text-gray-400">Security Level</div>
                <div className="text-green-400 font-medium">Enhanced</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
