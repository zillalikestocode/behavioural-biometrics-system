/**
 * Behavioral Biometrics Authentication Server (Express + TypeScript)
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { Logger } from "./utils/logger";
import routes from "./routes/index";
import { requestContext } from "./middleware/requestContext";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import { formatErrorResponse, AppError } from "./utils/errors";

const PORT = Number(process.env.PORT || 3000);

const app = express();

// Core middlewares
app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(requestContext);
app.use(rateLimitMiddleware);

// Health check
app.get("/health", (_req: express.Request, res: express.Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "1.0.0",
  });
});

// API routes
app.use("/api", routes);

// Health alias under /api for client health checks
app.get("/api/health", (_req: express.Request, res: express.Response) => {
  res.json({
    status: "healthy",
    services: { auth: true, risk: true },
    message: "OK",
  });
});

// 404 handler
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested endpoint does not exist",
    path: req.originalUrl,
  });
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const status = (err as AppError).statusCode || 500;
    const body = formatErrorResponse(err, req.id || null);
    Logger.error("Request error", {
      error: err?.message,
      path: req.originalUrl,
      requestId: req.id,
    });
    res.status(status).json(body);
  }
);

app.listen(PORT, () => {
  Logger.info(`🚀 Behavioral Biometrics Server (Express) starting...`);
  Logger.info(`📡 Server running at http://localhost:${PORT}`);
  Logger.info(`🔐 Security middleware enabled`);
  Logger.info(`🧠 ML risk assessment ready`);
});

export default app;
