// Shared types for the server

export interface LogContext {
  startTime: number;
  ip: string;
  userAgent: string;
}

export interface BiometricFeatures {
  holdTimes: number[];
  flightTimes: number[];
  errorRate: number; // 0..1
  typingSpeed: number; // wpm/keystrokes per min
  timestamp: number; // epoch ms from client
}

export interface BiometricSampleSummary {
  avgHoldTime: number;
  avgFlightTime: number;
  holdTimeVariance: number;
  flightTimeVariance: number;
  errorRate: number;
  typingSpeed: number;
  holdVelocityVariance?: number;
  timestamp?: string;
}

export interface BiometricProfile {
  userId: string;
  createdAt: string;
  lastUpdated: string;
  samples: BiometricSampleSummary[];
}

export interface UserRecord {
  id: string;
  username: string;
  password: string; // hashed
  createdAt: string;
  lastLogin: string | null;
  loginCount: number;
  isActive: boolean;
  biometricProfile?: BiometricProfile;
}

// Request augmented by middleware
export interface ExtendedRequest extends Request {
  id: string;
  context: LogContext;
  securityHeaders: Headers;
}
