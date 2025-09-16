# Chapter Four – Results and Discussion (Sections 4.4–4.8)

This chapter documents the implementation details, operational steps, feature extraction pipeline, and the empirical observations derived from building and evaluating the behavioral biometrics (keystroke dynamics) authentication system implemented in this repository. All observations reference concrete modules and code paths to ensure reproducibility.

---

## 4.4 Implementation of Modules

The system comprises a client-side behavioral capture and risk inference layer and a server-side authentication and orchestration layer.

### 4.4.1 Client-side modules

- Biometric capture (`client/src/lib/biometrics.ts`)

  - Purpose: Non-intrusive keystroke dynamics collection from input fields with high-resolution timing using `performance.now()`.
  - Captured primitives per session:
    - Hold (dwell) time for each key: time between keydown and keyup.
    - Flight time: inter-key latency between consecutive key releases and the next key press.
    - Corrections and backspace count to estimate error rate.
  - Derived session metrics (TypingSession):
    - `typingSpeed` (WPM), `errorRate` (%), `consistencyScore` (0–100), `totalKeystrokes`, plus arrays of `holdTimes` and `flightTimes`.
  - Event wiring: `attachToElement()` and `destroy()` manage listeners on targeted inputs (e.g., username/password fields).
  - Feature vector export: `getTypingFeatures()` returns an 8-dimensional feature vector: [avgHold, avgFlight, stdHold, stdFlight, speed, errorRate, consistencyScore, totalKeystrokes].

  Example: capture and feature computation

  ```ts
  // client/src/lib/biometrics.ts (excerpt)
  public attachToElement(element: HTMLInputElement): void {
    const keydownHandler = (event: KeyboardEvent) => this.captureKeyDown(event);
    const keyupHandler = (event: KeyboardEvent) => this.captureKeyUp(event);
    element.addEventListener("keydown", keydownHandler);
    element.addEventListener("keyup", keyupHandler);
    this.eventListeners.set(element, { keydown: keydownHandler, keyup: keyupHandler });
  }

  private captureKeyDown(event: KeyboardEvent): void {
    const timestamp = performance.now();
    const key = event.key;
    if (this.isModifierKey(key)) return;
    if (key === "Backspace") {
      this.sessionData.corrections++;
      this.updateSession();
      return;
    }
    this.metrics.set(key, { downTime: timestamp, upTime: 0, holdTimes: [], flightTimes: [], lastKeyUp: 0, character: key });
    this.sessionData.totalKeystrokes++;
  }

  private captureKeyUp(event: KeyboardEvent): void {
    const timestamp = performance.now();
    const key = event.key;
    if (this.isModifierKey(key)) return;
    const metric = this.metrics.get(key);
    if (!metric) return;
    const holdTime = timestamp - metric.downTime;     // dwell time
    metric.upTime = timestamp;
    metric.holdTimes.push(holdTime);
    this.sessionData.holdTimes.push(holdTime);
    if (metric.lastKeyUp > 0) {
      const flightTime = metric.downTime - metric.lastKeyUp; // inter-key latency
      metric.flightTimes.push(flightTime);
      this.sessionData.flightTimes.push(flightTime);
    }
    metric.lastKeyUp = timestamp;
    this.updateSession();
  }

  public getTypingFeatures(): number[] {
    const session = this.sessionData;
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const variance = (xs: number[]) => {
      if (!xs.length) return 0; const m = avg(xs); return xs.reduce((s, v) => s + Math.pow(v - m, 2), 0) / xs.length;
    };
    const avgHoldTime = avg(session.holdTimes);
    const avgFlightTime = avg(session.flightTimes);
    const holdTimeStdDev = Math.sqrt(variance(session.holdTimes));
    const flightTimeStdDev = Math.sqrt(variance(session.flightTimes));
    return [avgHoldTime, avgFlightTime, holdTimeStdDev, flightTimeStdDev, session.typingSpeed, session.errorRate, session.consistencyScore, session.totalKeystrokes];
  }
  ```

- Risk calculator (`client/src/lib/risk-calculator.ts`)

  - Purpose: Local ML-based risk estimation with TensorFlow.js (WASM backend preferred, WebGL fallback).
  - Model: Small feed-forward neural net (input=8, hidden layers with ReLU + dropout, output sigmoid for risk probability).
  - Data: For demo, synthetic data simulates distributions akin to keystroke datasets (e.g., Clarkson-style). Normalization statistics (mean/std) are computed and cached.
  - Training & persistence: `trainModel()` supports local training; model JSON is persisted to `localStorage`. `isReady()` indicates inference readiness.
  - Inference: `calculateRisk(features)` normalizes the 8-D features and outputs `riskScore ∈ [0,1]`, a coarse confidence heuristic, and an action recommendation: GRANT, STEP_UP, or DENY.
  - Metrics: `getModelMetrics()` evaluates loss/accuracy against the synthetic dataset to report dev-time performance.

  Example: model definition and inference

  ```ts
  // client/src/lib/risk-calculator.ts (excerpt)
  private createModel(): tf.Sequential {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ units: 16, inputShape: [8], activation: "relu", kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }) }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 12, activation: "relu", kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }) }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 8, activation: "relu" }),
        tf.layers.dense({ units: 1, activation: "sigmoid" }),
      ],
    });
    model.compile({ optimizer: tf.train.adam(0.001), loss: "binaryCrossentropy", metrics: ["accuracy"] });
    return model;
  }

  public async calculateRisk(features: number[]): Promise<RiskPrediction> {
    if (!this.isModelReady || !this.model || !this.normalizeParams) {
      return { riskScore: 0.5, confidence: 0.1, recommendation: "STEP_UP", features };
    }
    const featureTensor = tf.tensor2d([features]);
    const normalized = featureTensor.sub(this.normalizeParams.mean).div(this.normalizeParams.std);
    const prediction = this.model.predict(normalized) as tf.Tensor;
    const [risk] = await prediction.data();
    featureTensor.dispose(); normalized.dispose(); prediction.dispose();
    const confidence = this.calculateConfidence(features);
    return { riskScore: risk, confidence, recommendation: this.getRecommendation(risk, confidence), features };
  }
  ```

  Example: using the calculator from the login form

  ```ts
  // client/src/components/auth/LoginForm.tsx (excerpt)
  const features = biometricCaptureRef.current.getTypingFeatures();
  const risk = await riskCalculatorRef.current.calculateRisk(features);
  setCurrentRisk(risk);
  updateRiskAssessment(risk);
  ```

- Auth client and state (`client/src/lib/auth-client.ts`, `client/src/store/auth-store.ts`)

  - API wrapper: Handles `/api/auth/login`, `/api/auth/step-up`, session validation, and health checks. Session token is persisted in `localStorage`.
  - Zustand store: Tracks `currentRisk`, `biometricSession`, step-up challenge state, and UI metrics (avg risk, attempts).

  Example: login request shape and submit

  ```ts
  // client/src/lib/auth-client.ts (excerpt)
  export interface LoginRequest {
    username: string;
    password: string;
    riskScore: number;
    features?: {
      holdTimes: number[];
      flightTimes: number[];
      typingSpeed: number;
      errorRate: number;
      consistencyScore: number;
      timestamp: number;
    };
  }

  // client/src/components/auth/LoginForm.tsx (excerpt)
  const session = biometricCaptureRef.current.getSessionData();
  const response = await authClientRef.current.login({
    username: formData.username,
    password: formData.password,
    riskScore: currentRisk?.riskScore ?? 0.5,
    features: {
      holdTimes: session.holdTimes,
      flightTimes: session.flightTimes,
      typingSpeed: session.typingSpeed,
      errorRate: session.errorRate,
      consistencyScore: session.consistencyScore,
      timestamp: Date.now(),
    },
  });
  ```

- UI components (`client/src/components/auth/*`)
  - `LoginForm.tsx`: Binds inputs to `BiometricCapture`, streams features into `RiskCalculator`, visualizes risk/confidence, and submits credentials plus summarized biometrics to the backend.
  - `StepUpChallenge.tsx`: Modal that renders math/SMS/email/CAPTCHA-style challenges and submits user solutions to complete step-up.
  - `Dashboard.tsx`: Post-login area (not central to this chapter) for session display.

### 4.4.2 Server-side modules

- HTTP server and routing (`server/server.ts`, `server/routes/*`)

  - Express with `helmet`, CORS, JSON parsing, request context, and rate limiting.
  - Endpoints (mounted at `/api/auth`): `POST /login`, `POST /step-up`, `GET /validate`, `GET /profile`, `POST /logout`.
  - Health endpoints: `/health` and `/api/health` for liveness and client-side checks.

  Example: server bootstrap and health

  ```ts
  // server/server.ts (excerpt)
  import express from "express";
  import cors from "cors";
  import helmet from "helmet";
  import routes from "./routes/index";
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", routes);
  app.get("/api/health", (_req, res) =>
    res.json({
      status: "healthy",
      services: { auth: true, risk: true },
      message: "OK",
    })
  );
  app.listen(3000, () => console.log("Server on :3000"));
  ```

- Auth controller (`server/controllers/authController.ts`)

  - Validates request body with Zod schemas, including a `features` object containing: `holdTimes[]`, `flightTimes[]`, `errorRate (0–1)`, `typingSpeed`, and `timestamp`.
  - Orchestrates login flow:
    1. `UserManager.validateUser()` verifies credentials and loads the user’s biometric profile.
    2. `RiskCalculator.calculateRisk()` fuses client risk with server-side analytics to compute a robust `finalScore`.
    3. Decision: GRANT (<0.3), STEP_UP (0.3–0.7), or DENY (>0.7). For step-up, `ChallengeManager.createChallenge()` is invoked and details returned to the client.
    4. On non-denied flows, `UserManager.updateBiometricProfile()` appends summarized samples to the user’s profile for continuous learning.

  Example: Zod schemas and decision thresholds

  ```ts
  // server/controllers/authController.ts (excerpt)
  const biometricSchema = z.object({
    holdTimes: z.array(z.number()),
    flightTimes: z.array(z.number()),
    errorRate: z.number().min(0).max(1),
    typingSpeed: z.number().min(0),
    timestamp: z.number(),
  });

  if (riskAnalysis.finalScore < 0.3) {
    // GRANT
  } else if (riskAnalysis.finalScore < 0.7) {
    // STEP_UP
  } else {
    // DENY
  }
  ```

- Server risk engine (`server/services/riskCalculator.ts`)

  - Multi-factor scoring with weights: temporal (dwell/flight), behavioral (speed/error), consistency (variance deltas), deviation (z-scores from history), velocity (intra-session smoothness), and client-provided risk.
  - Outputs: `finalScore ∈ [0,1]`, factor breakdown, and a confidence based on profile maturity (sample count and time span).

  Example: factor fusion and deviation risk

  ```ts
  // server/services/riskCalculator.ts (excerpt)
  static calculateWeightedScore(factors: Record<string, number>) {
    const weights = { temporal: 0.25, behavioral: 0.2, consistency: 0.2, deviation: 0.15, velocity: 0.1, client: 0.1 };
    let weighted = 0, total = 0;
    for (const [k, v] of Object.entries(factors)) {
      if (typeof v === "number" && weights[k as keyof typeof weights]) {
        weighted += v * (weights as any)[k]; total += (weights as any)[k];
      }
    }
    return total ? weighted / total : 0.5;
  }

  static calculateDeviationRisk(current: BiometricFeatures, profile: BiometricProfile) {
    const s = profile.samples;
    const z = (x: number, arr: number[]) => { const m = this.calculateAverage(arr); const sd = this.calculateStandardDeviation(arr); return sd > 0 ? (x - m) / sd : 0; };
    const holdZ = z(this.calculateAverage(current.holdTimes), s.map(x => x.avgHoldTime));
    const flightZ = z(this.calculateAverage(current.flightTimes), s.map(x => x.avgFlightTime));
    const speedZ = z(current.typingSpeed, s.map(x => x.typingSpeed));
    const toRisk = (zv: number) => Math.min(Math.abs(zv) / 3, 1);
    return (toRisk(holdZ) + toRisk(flightZ) + toRisk(speedZ)) / 3;
  }
  ```

- User and biometric profiles (`server/services/userManager.ts`, `server/types.ts`)

  - In-memory demo users (lowrisk, normal, highrisk, admin) with synthetic biometric histories shaped as consistent/normal/robotic profiles.
  - On each successful/step-up login, a new `BiometricSampleSummary` is computed from submitted features and appended (max 50 samples retained).

- Step-up challenges (`server/services/challengeManager.ts`)

  - Generates time-bound challenges (math/pattern/memory/captcha/security-questions). Verifies solutions with attempt limits, tracks completion, and cleans expired entries.

  Example: creating and verifying a challenge

  ```ts
  // server/services/challengeManager.ts (excerpt)
  static async createChallenge(userId: string) {
    const challengeId = uuidv4();
    const { question, answer, hints } = this.createMathChallenge();
    const data: ChallengeData = { id: challengeId, userId, type: "math", question, answer, hints: hints || [], createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 5*60*1000).toISOString(), attempts: 0, maxAttempts: 3, completed: false };
    this.challenges.set(challengeId, data);
    return { id: challengeId, type: "math", question, hints, expiresIn: 300 };
  }

  static async verifyChallenge(challengeId: string, solution: string) {
    const ch = this.challenges.get(challengeId);
    if (!ch) return { valid: false, error: "Challenge not found or expired" } as const;
    if (new Date() > new Date(ch.expiresAt)) return { valid: false, error: "Challenge expired" } as const;
    ch.attempts++;
    const ok = this.verifySolution(ch, solution);
    return ok ? { valid: true as const, userId: ch.userId, challengeType: ch.type, attempts: ch.attempts } : { valid: false as const, error: "Incorrect solution", attemptsRemaining: ch.maxAttempts - ch.attempts };
  }
  ```

- Utilities (`server/utils/logger.ts`, `server/utils/errors.ts`)

  - Structured logging with performance timers; rich error typing and formatted responses.

  Example: performance log entry and error formatting

  ```ts
  // server/utils/logger.ts (excerpt)
  Logger.performance("Risk calculation", startTime, {
    finalScore,
    sampleCount: userProfile.samples.length,
  });

  // server/utils/errors.ts (excerpt)
  export const formatErrorResponse = (
    error: any,
    requestId: string | null = null
  ) => ({
    error: error.code || "INTERNAL_ERROR",
    message: error.message || "Unknown error",
    timestamp: error.timestamp || new Date().toISOString(),
    ...(requestId ? { requestId } : {}),
    ...(error.field ? { field: error.field } : {}),
    ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
    ...(error.riskScore !== undefined ? { riskScore: error.riskScore } : {}),
  });
  ```

---

## 4.5 Steps to Opening/Running the Program

Prerequisites

- macOS with Bun (>=1.0) and Node.js installed
- Ports: server uses 3000, client dev server defaults to 5173

Run the backend (Express + Bun)

1. Open a terminal at `server/` and run: start dev server with hot reload.
2. The server will log health status at `http://localhost:3000` and expose `/api/*` routes.

```sh
# Backend (Bun)
cd server
bun install
bun --hot server.ts
```

Run the frontend (Vite + React)

1. Open a second terminal at `client/` and run the dev server.
2. Navigate to `http://localhost:5173` in your browser. The client performs health checks against the backend (`/api/health`).

```sh
# Frontend (Bun or npm)
cd client
bun install
bun run dev
# or
npm install
npm run dev
```

Notes

- Environment variables (optional): `PORT` for server port; `FRONTEND_URL` for CORS origin; `JWT_SECRET` for token signing.
- Integration probe: `server/test-auth-flow.ts` provides a quick script to exercise login and step-up endpoints.

```sh
# Example (zsh)
export PORT=3000
export FRONTEND_URL=http://localhost:5173
export JWT_SECRET="replace-this-in-production"
```

---

## 4.6 Feature Extraction from the Dataset (Keystroke Dynamics)

Data source and capture

- The “dataset” in this demo is user-generated typing during login, captured via DOM keyboard events. For development realism, both the client risk model and server profiles synthesize distributions representative of keystroke datasets.
- Client capture (`BiometricCapture`): For each key event, we track press/release times and compute dwell/flight arrays, along with correction counts to estimate an error rate.

Computed features (client-side 8D vector)

1. Average hold (dwell) time (ms)
2. Average flight time (ms)
3. Hold time standard deviation (ms)
4. Flight time standard deviation (ms)
5. Typing speed (WPM) – 5 chars/word approximation
6. Error rate (%) – derived from backspace corrections and keystrokes
7. Consistency score (0–100) – inverse of timing variance
8. Total keystrokes in session

Normalization and inference

- The client model normalizes features with dataset mean/std, then infers a probability-like risk via a sigmoid output. A heuristic confidence penalizes extreme or out-of-range statistics.

Server-side feature aggregation

- On login, the server computes additional aggregates from submitted features to update the user’s `BiometricProfile` with a `BiometricSampleSummary` (averages and variances). This supports longitudinal comparisons (z-scores, deviation tracking) in subsequent sessions.

```ts
// server/services/userManager.ts (excerpt)
const avgHoldTime =
  features.holdTimes.reduce((s, v) => s + v, 0) / features.holdTimes.length;
const avgFlightTime =
  features.flightTimes.reduce((s, v) => s + v, 0) / features.flightTimes.length;
const holdTimeVariance =
  features.holdTimes.reduce((s, v) => s + Math.pow(v - avgHoldTime, 2), 0) /
  features.holdTimes.length;
const flightTimeVariance =
  features.flightTimes.reduce((s, v) => s + Math.pow(v - avgFlightTime, 2), 0) /
  features.flightTimes.length;
profile.samples.push({
  avgHoldTime,
  avgFlightTime,
  holdTimeVariance,
  flightTimeVariance,
  errorRate: features.errorRate,
  typingSpeed: features.typingSpeed,
  timestamp: new Date().toISOString(),
});
```

---

## 4.7 Discussion of Findings

System behavior by profile

- Consistent users (e.g., `lowrisk`): Stable dwell/flight, low error rates, and matured profiles yield low final risk (<0.3). Auth is granted without friction.
- Normal users (`normal`): Moderate deviations can trigger STEP_UP challenges when `finalScore` falls between 0.3–0.7. Successful challenge completion issues a token and reinforces the profile with the new sample.
- High-risk patterns (`highrisk` or robotic typing): Extreme uniformity or erratic variance increases deviation/consistency/velocity factors, pushing final risk >0.7 and causing DENY.

Defense-in-depth

- Client-side ML acts as an early indicator and UX element (risk bar, warnings). The server independently assesses risk using historical baselines and statistical tests. Combining both reduces single-point failures and tampering.

Data sufficiency and confidence

- The server’s confidence improves with sample count and time span, reflecting the reality that behavioral biometrics stabilize over time. Cold-start users receive moderate risk and low confidence, nudging the flow toward STEP_UP instead of blind grant/deny decisions.

Privacy and performance

- Raw keystroke sequences are not stored indefinitely; the server keeps summarized statistics (means/variances) capped at 50 samples per user. On-device inference via WASM is fast and keeps sensitive timing data local to the browser session.

Limitations

- Synthetic training data and demo profiles approximate but don’t replace real-world datasets. The client confidence heuristic is simplistic, and adversarial behaviors (replay/automation) are only partially captured by the current velocity/variance checks.

---

## 4.8 Results and Analysis of Results

Functional outcomes

- End-to-end authentication with adaptive responses: GRANT, STEP_UP with challenge modal, or DENY based on computed risk.
- Session issuance via JWT on GRANT/step-up success; `GET /api/auth/validate` confirms session validity for UI state.

Sample qualitative outcomes (from included demo tooling)

- `server/test-auth-flow.ts` demonstrates:
  - `lowrisk` user typically receives GRANT with a low risk score.
  - `normal` user often receives STEP_UP; solving the challenge completes authentication.
  - Incorrect step-up solutions return `RETRY` until attempts are exhausted, then `DENY`.

Runtime metrics and observability

- The server logs performance timings (e.g., “Risk calculation completed in Xms”), aiding latency analysis for ML/risk code paths.
- The client visualizes `riskScore` and `confidence` during typing, and the Zustand store maintains running averages for UI feedback.

Example: sample structured logs

```json
{"timestamp":"2025-09-16T10:12:34.567Z","level":"INFO","message":"⚡ Risk calculation completed in 12ms","meta":{"duration":12,"operation":"Risk calculation","finalScore":0.28,"confidence":0.62,"sampleCount":18}}
{"timestamp":"2025-09-16T10:12:34.890Z","level":"INFO","message":"🔐 Login attempt","meta":{"username":"normal","riskScore":0.41,"requestId":"req-123"}}
```

Accuracy and decision thresholds

- Client model metrics (`getModelMetrics()`) can be inspected after training on the synthetic set; thresholds at 0.3/0.7 balance usability and security in this demo. In production, ROC analysis on a labeled dataset would inform optimal cutoffs and weighting in the server fusion engine.

Security posture

- Rate limiting middleware, input validation (Zod), JWT-based sessions, and challenge attempts/expiry collectively reduce brute-force and automated abuse.

Recommended extensions

- Replace synthetic data with a real keystroke dataset for training/evaluation; introduce k-fold validation and drift monitoring.
- Expand server analytics with sequence-based models (e.g., RNN/Transformer) or one-class anomaly detection per user.
- Persist profiles to a database with encryption-at-rest; add audit trails and privacy controls (data minimization, retention policies).

---

End of Chapter 4 (Sections 4.4–4.8).
