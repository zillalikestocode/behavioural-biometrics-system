import { useEffect, useState } from "react";
import { LoginForm } from "./components/auth/LoginForm";
import { Dashboard } from "./components/auth/Dashboard";
import { StepUpChallenge } from "./components/auth/StepUpChallenge";
import { useAuthStore } from "./store/auth-store";
import { AuthClient } from "./lib/auth-client";
import "./App.css";

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [showToast, setShowToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const { isAuthenticated, setAuthenticated, setUser, setLoading } =
    useAuthStore();

  const authClient = new AuthClient();

  // Initialize and validate session on app load
  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);

      try {
        if (authClient.isAuthenticated()) {
          // Validate existing session
          const validation = await authClient.validateSession();

          if (validation.valid && validation.user) {
            setAuthenticated({
              success: true,
              action: "GRANT",
              message: "Session restored",
              sessionToken: authClient.getSessionToken() || undefined,
              riskScore: validation.user.riskScore,
              timestamp: Date.now(),
            });
            setUser(validation.user);
          } else {
            // Invalid session, clear it
            await authClient.logout();
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        // Clear any invalid session data
        await authClient.logout();
      } finally {
        setLoading(false);
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, [setAuthenticated, setUser, setLoading]);

  const handleLoginSuccess = () => {
    setShowToast({
      message: "Authentication successful!",
      type: "success",
    });
  };

  const handleLoginError = (error: string) => {
    setShowToast({
      message: error,
      type: "error",
    });
  };

  const handleStepUpSuccess = () => {
    setShowToast({
      message: "Additional verification completed successfully!",
      type: "success",
    });
  };

  const handleStepUpFailure = (error: string) => {
    setShowToast({
      message: error,
      type: "error",
    });
  };

  const handleLogout = () => {
    setShowToast({
      message: "You have been signed out successfully.",
      type: "info",
    });
  };

  // Auto-hide toast after 5 seconds
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen w-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-6"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-purple-500 rounded-full animate-spin mx-auto animation-delay-150"></div>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Initializing Security
          </h3>
          <p className="text-gray-400">Loading behavioral analysis engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-gray-950 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-950 to-black">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-2xl"></div>
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-full">
          <div
            className={`
            max-w-sm p-4 rounded-xl shadow-2xl border backdrop-blur-sm
            ${
              showToast.type === "success"
                ? "bg-green-950/90 border-green-500/30 text-green-100"
                : ""
            }
            ${
              showToast.type === "error"
                ? "bg-red-950/90 border-red-500/30 text-red-100"
                : ""
            }
            ${
              showToast.type === "info"
                ? "bg-blue-950/90 border-blue-500/30 text-blue-100"
                : ""
            }
          `}
          >
            <div className="flex items-center gap-3">
              {showToast.type === "success" && (
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              )}
              {showToast.type === "error" && (
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
              )}
              {showToast.type === "info" && (
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              )}
              <span className="text-sm font-medium flex-1">
                {showToast.message}
              </span>
              <button
                onClick={() => setShowToast(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {isAuthenticated ? (
        <Dashboard onLogout={handleLogout} />
      ) : (
        <div className="min-h-screen flex w-screenitems-center justify-center p-6 bg-gray-950">
          <div className="w-full max-w-lg">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-6 shadow-xl">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
                Secure Authentication
              </h1>
              <p className="text-gray-400 text-lg leading-relaxed max-w-md mx-auto">
                Advanced behavioral biometrics powered by machine learning
              </p>
            </div>

            <LoginForm
              onLoginSuccess={handleLoginSuccess}
              onLoginError={handleLoginError}
            />

            {/* Footer */}
            <div className="mt-10 text-center">
              <div className="flex items-center justify-center space-x-4 text-gray-500 text-sm mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Real-time Analysis</span>
                </div>
                <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>TensorFlow.js</span>
                </div>
              </div>
              <p className="text-gray-600 text-xs">
                Your typing patterns create a unique biometric signature
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step-up Challenge Modal */}
      <StepUpChallenge
        onSuccess={handleStepUpSuccess}
        onFailure={handleStepUpFailure}
      />
    </div>
  );
}

export default App;
