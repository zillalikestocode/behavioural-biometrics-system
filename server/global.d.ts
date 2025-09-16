declare module "bcryptjs";
declare module "bun";

import "express-serve-static-core";
declare global {
  namespace Express {
    // Augment Request with custom fields
    interface Request {
      id?: string;
      context?: {
        startTime: number;
        ip: string;
        userAgent: string;
      };
    }
  }
}
