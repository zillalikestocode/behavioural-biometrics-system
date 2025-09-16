/**
 * Behavioral Biometrics Authentication Server
 * Built with Bun runtime for high performance
 */

import { serve } from "bun";
import { authRouter } from "./routes/auth.js";
import { middleware } from "./middleware/index.js";
import { Logger } from "./utils/logger.js";

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";

/**
 * Main server instance with middleware chain
 */
const server = serve({
  port: PORT,
  hostname: HOST,

  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method;

    // Apply middleware chain
    const middlewareResult = await middleware.apply(request);
    if (middlewareResult instanceof Response) {
      return middlewareResult;
    }

    // Enhanced request object with middleware context
    const enhancedRequest = middlewareResult;

    try {
      // Route handling
      if (
        url.pathname.startsWith("/api/auth") ||
        url.pathname.startsWith("/api/login") ||
        url.pathname.startsWith("/api/step-up")
      ) {
        return await authRouter.handle(enhancedRequest);
      }

      // Health check endpoint
      if (url.pathname === "/health" && method === "GET") {
        return new Response(
          JSON.stringify({
            status: "healthy",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: "1.0.0",
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // CORS preflight
      if (method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin":
              process.env.FRONTEND_URL || "http://localhost:5173",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers":
              "Content-Type, Authorization, X-Requested-With",
            "Access-Control-Max-Age": "86400",
          },
        });
      }

      // 404 handler
      return new Response(
        JSON.stringify({
          error: "Not Found",
          message: "The requested endpoint does not exist",
          path: url.pathname,
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      Logger.error("Server error:", error);

      return new Response(
        JSON.stringify({
          error: "Internal Server Error",
          message: "An unexpected error occurred",
          requestId: enhancedRequest.id || "unknown",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },

  error(error) {
    Logger.error("Server startup error:", error);
    return new Response("Internal Server Error", { status: 500 });
  },
});

// Server startup logging
Logger.info(`🚀 Behavioral Biometrics Server starting...`);
Logger.info(`📡 Server running at http://${HOST}:${PORT}`);
Logger.info(`🔒 Security middleware enabled`);
Logger.info(`🧠 ML risk assessment ready`);
Logger.info(`⚡ Bun runtime: ${Bun.version}`);

// Graceful shutdown handling
process.on("SIGINT", () => {
  Logger.info("🛑 Server shutting down gracefully...");
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  Logger.info("🛑 Server received SIGTERM, shutting down...");
  server.stop();
  process.exit(0);
});

export { server };
