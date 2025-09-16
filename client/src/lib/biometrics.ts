/**
 * Biometric capture module for keystroke dynamics analysis
 * Captures precise timing data with microsecond precision using performance.now()
 */

export interface KeyMetrics {
  downTime: number;
  upTime: number;
  holdTimes: number[];
  flightTimes: number[];
  lastKeyUp: number;
  character: string;
}

export interface TypingSession {
  holdTimes: number[];
  flightTimes: number[];
  errorRate: number;
  typingSpeed: number;
  consistencyScore: number;
  sessionStart: number;
  totalKeystrokes: number;
  corrections: number;
}

export class BiometricCapture {
  private metrics: Map<string, KeyMetrics>;
  private sessionData: TypingSession;
  private eventListeners: Map<
    HTMLElement,
    { keydown: (e: KeyboardEvent) => void; keyup: (e: KeyboardEvent) => void }
  >;
  private onMetricsUpdate?: (session: TypingSession) => void;

  constructor(onMetricsUpdate?: (session: TypingSession) => void) {
    this.metrics = new Map();
    this.eventListeners = new Map();
    this.onMetricsUpdate = onMetricsUpdate;
    this.sessionData = this.initializeSession();
  }

  private initializeSession(): TypingSession {
    return {
      holdTimes: [],
      flightTimes: [],
      errorRate: 0,
      typingSpeed: 0,
      consistencyScore: 0,
      sessionStart: performance.now(),
      totalKeystrokes: 0,
      corrections: 0,
    };
  }

  /**
   * Attach keystroke capture to input elements
   */
  public attachToElement(element: HTMLInputElement): void {
    const keydownHandler = (event: KeyboardEvent) => this.captureKeyDown(event);
    const keyupHandler = (event: KeyboardEvent) => this.captureKeyUp(event);

    element.addEventListener("keydown", keydownHandler);
    element.addEventListener("keyup", keyupHandler);

    this.eventListeners.set(element, {
      keydown: keydownHandler,
      keyup: keyupHandler,
    });
  }

  /**
   * Remove keystroke capture from input elements
   */
  public detachFromElement(element: HTMLInputElement): void {
    const listeners = this.eventListeners.get(element);
    if (listeners) {
      element.removeEventListener("keydown", listeners.keydown);
      element.removeEventListener("keyup", listeners.keyup);
      this.eventListeners.delete(element);
    }
  }

  /**
   * Capture keydown events with precise timing
   */
  private captureKeyDown(event: KeyboardEvent): void {
    const timestamp = performance.now();
    const key = event.key;

    // Skip modifier keys and function keys
    if (this.isModifierKey(key)) return;

    // Track backspace as correction
    if (key === "Backspace") {
      this.sessionData.corrections++;
      this.updateSession();
      return;
    }

    this.metrics.set(key, {
      downTime: timestamp,
      upTime: 0,
      holdTimes: [],
      flightTimes: [],
      lastKeyUp: 0,
      character: key,
    });

    this.sessionData.totalKeystrokes++;
  }

  /**
   * Capture keyup events and calculate timing metrics
   */
  private captureKeyUp(event: KeyboardEvent): void {
    const timestamp = performance.now();
    const key = event.key;

    // Skip modifier keys and function keys
    if (this.isModifierKey(key)) return;

    const metric = this.metrics.get(key);
    if (!metric) return;

    // Calculate hold time (dwell time)
    const holdTime = timestamp - metric.downTime;
    metric.upTime = timestamp;
    metric.holdTimes.push(holdTime);
    this.sessionData.holdTimes.push(holdTime);

    // Calculate flight time (time between consecutive keystrokes)
    if (metric.lastKeyUp > 0) {
      const flightTime = metric.downTime - metric.lastKeyUp;
      metric.flightTimes.push(flightTime);
      this.sessionData.flightTimes.push(flightTime);
    }

    metric.lastKeyUp = timestamp;
    this.updateSession();
  }

  /**
   * Check if key is a modifier key that should be ignored
   */
  private isModifierKey(key: string): boolean {
    const modifierKeys = [
      "Shift",
      "Control",
      "Alt",
      "Meta",
      "CapsLock",
      "Tab",
      "Escape",
      "Enter",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
      "Insert",
      "Delete",
    ];
    return modifierKeys.includes(key) || key.startsWith("F");
  }

  /**
   * Update session metrics and notify listeners
   */
  private updateSession(): void {
    this.calculateTypingSpeed();
    this.calculateErrorRate();
    this.calculateConsistencyScore();

    if (this.onMetricsUpdate) {
      this.onMetricsUpdate({ ...this.sessionData });
    }
  }

  /**
   * Calculate typing speed in WPM
   */
  private calculateTypingSpeed(): void {
    const timeElapsed =
      (performance.now() - this.sessionData.sessionStart) / 1000 / 60; // minutes
    const wordsTyped = this.sessionData.totalKeystrokes / 5; // Assuming 5 characters per word
    this.sessionData.typingSpeed = wordsTyped / timeElapsed;
  }

  /**
   * Calculate error rate as percentage
   */
  private calculateErrorRate(): void {
    if (this.sessionData.totalKeystrokes === 0) {
      this.sessionData.errorRate = 0;
      return;
    }
    this.sessionData.errorRate =
      (this.sessionData.corrections / this.sessionData.totalKeystrokes) * 100;
  }

  /**
   * Calculate consistency score based on timing variance
   */
  private calculateConsistencyScore(): void {
    if (this.sessionData.holdTimes.length < 2) {
      this.sessionData.consistencyScore = 0;
      return;
    }

    const holdTimeVariance = this.calculateVariance(this.sessionData.holdTimes);
    const flightTimeVariance =
      this.sessionData.flightTimes.length > 1
        ? this.calculateVariance(this.sessionData.flightTimes)
        : 0;

    // Normalize variance to 0-100 score (lower variance = higher consistency)
    const normalizedHoldVar = Math.max(0, 100 - holdTimeVariance / 10);
    const normalizedFlightVar = Math.max(0, 100 - flightTimeVariance / 10);

    this.sessionData.consistencyScore =
      (normalizedHoldVar + normalizedFlightVar) / 2;
  }

  /**
   * Calculate variance of an array of numbers
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Get current session data
   */
  public getSessionData(): TypingSession {
    return { ...this.sessionData };
  }

  /**
   * Reset session data
   */
  public resetSession(): void {
    this.sessionData = this.initializeSession();
    this.metrics.clear();
  }

  /**
   * Get typing features for ML model
   */
  public getTypingFeatures(): number[] {
    const session = this.sessionData;

    // Calculate statistical features
    const avgHoldTime =
      session.holdTimes.length > 0
        ? session.holdTimes.reduce((sum, val) => sum + val, 0) /
          session.holdTimes.length
        : 0;

    const avgFlightTime =
      session.flightTimes.length > 0
        ? session.flightTimes.reduce((sum, val) => sum + val, 0) /
          session.flightTimes.length
        : 0;

    const holdTimeStdDev = Math.sqrt(this.calculateVariance(session.holdTimes));
    const flightTimeStdDev = Math.sqrt(
      this.calculateVariance(session.flightTimes)
    );

    return [
      avgHoldTime,
      avgFlightTime,
      holdTimeStdDev,
      flightTimeStdDev,
      session.typingSpeed,
      session.errorRate,
      session.consistencyScore,
      session.totalKeystrokes,
    ];
  }

  /**
   * Clean up event listeners
   */
  public destroy(): void {
    this.eventListeners.forEach((listeners, element) => {
      element.removeEventListener("keydown", listeners.keydown);
      element.removeEventListener("keyup", listeners.keyup);
    });
    this.eventListeners.clear();
  }
}
