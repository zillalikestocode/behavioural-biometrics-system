import type { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { Logger } from "../utils/logger";

export function requestContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = Date.now();
  const userAgent = req.get("User-Agent") || "Unknown";
  // Express ip requires trust proxy when behind proxies
  const ip = req.ip || (req.headers["x-forwarded-for"] as string) || "unknown";

  req.id = uuidv4();
  req.context = { startTime, ip, userAgent };

  Logger.info(`📥 ${req.method} ${req.originalUrl}`, {
    ip,
    userAgent: userAgent.substring(0, 120),
    requestId: req.id,
  });

  next();
}
