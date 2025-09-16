/**
 * TensorFlow.js ML model for behavioral biometrics risk assessment
 * Implements neural network for keystroke dynamics analysis
 */

import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-wasm";

export interface RiskPrediction {
  riskScore: number;
  confidence: number;
  recommendation: "GRANT" | "DENY" | "STEP_UP";
  features: number[];
}

export interface TrainingData {
  features: number[][];
  labels: number[];
}

export class RiskCalculator {
  private model: tf.LayersModel | null = null;
  private isModelReady = false;
  private trainingData: TrainingData | null = null;
  private normalizeParams: { mean: tf.Tensor; std: tf.Tensor } | null = null;

  constructor() {
    this.initializeTensorFlow();
  }

  /**
   * Initialize TensorFlow.js with WASM backend for better performance
   */
  private async initializeTensorFlow(): Promise<void> {
    try {
      // Set backend to WASM for better performance
      await tf.setBackend("wasm");
      console.log("TensorFlow.js initialized with WASM backend");
      await this.loadOrCreateModel();
    } catch (error) {
      console.warn("WASM backend failed, falling back to WebGL:", error);
      await tf.setBackend("webgl");
      await this.loadOrCreateModel();
    }
  }

  /**
   * Create a neural network model for behavioral analysis
   */
  private createModel(): tf.Sequential {
    const model = tf.sequential({
      layers: [
        // Input layer: 8 features (hold times, flight times, speed, error rate, etc.)
        tf.layers.dense({
          units: 16,
          inputShape: [8],
          activation: "relu",
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
        }),

        // Hidden layer with dropout for regularization
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 12,
          activation: "relu",
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
        }),

        // Second hidden layer
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 8,
          activation: "relu",
        }),

        // Output layer: sigmoid for risk probability (0-1)
        tf.layers.dense({
          units: 1,
          activation: "sigmoid",
        }),
      ],
    });

    // Compile with Adam optimizer and binary crossentropy loss
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "binaryCrossentropy",
      metrics: ["accuracy"],
    });

    return model;
  }

  /**
   * Load existing model or create new one
   */
  private async loadOrCreateModel(): Promise<void> {
    try {
      // Try to load from localStorage
      const modelJson = localStorage.getItem("behavioralModel");
      const weightsData = localStorage.getItem("behavioralModelWeights");

      if (modelJson && weightsData) {
        const modelConfig = JSON.parse(modelJson);
        this.model = (await tf.models.modelFromJSON(
          modelConfig
        )) as tf.LayersModel;
        console.log("Loaded existing model from localStorage");
      } else {
        this.model = this.createModel();
        console.log("Created new neural network model");
      }

      this.isModelReady = true;
      await this.loadTrainingData();
    } catch (error) {
      console.error("Error loading/creating model:", error);
      this.model = this.createModel();
      this.isModelReady = true;
    }
  }

  /**
   * Load training data (Clarkson dataset simulation)
   */
  private async loadTrainingData(): Promise<void> {
    // Simulate Clarkson dataset with synthetic data for demo
    // In production, this would load real keystroke data
    const features: number[][] = [];
    const labels: number[] = [];

    // Generate synthetic legitimate user patterns
    for (let i = 0; i < 100; i++) {
      features.push([
        80 + Math.random() * 40, // avg hold time (80-120ms)
        50 + Math.random() * 30, // avg flight time (50-80ms)
        15 + Math.random() * 10, // hold time std dev
        20 + Math.random() * 15, // flight time std dev
        40 + Math.random() * 20, // typing speed (40-60 WPM)
        1 + Math.random() * 3, // error rate (1-4%)
        70 + Math.random() * 25, // consistency (70-95%)
        50 + Math.random() * 50, // total keystrokes
      ]);
      labels.push(0); // 0 = legitimate
    }

    // Generate synthetic anomalous patterns
    for (let i = 0; i < 100; i++) {
      features.push([
        30 + Math.random() * 200, // erratic hold times
        10 + Math.random() * 100, // erratic flight times
        50 + Math.random() * 100, // high std deviation
        40 + Math.random() * 80, // high std deviation
        100 + Math.random() * 50, // abnormal speed
        10 + Math.random() * 20, // high error rate
        10 + Math.random() * 40, // low consistency
        20 + Math.random() * 30, // fewer keystrokes
      ]);
      labels.push(1); // 1 = anomalous
    }

    this.trainingData = { features, labels };

    // Calculate normalization parameters
    const featureTensor = tf.tensor2d(features);
    this.normalizeParams = {
      mean: featureTensor.mean(0),
      std: tf.moments(featureTensor, 0).variance.sqrt().add(tf.scalar(1e-7)), // Add small epsilon to avoid division by zero
    };

    featureTensor.dispose();
  }

  /**
   * Train the model with current training data
   */
  public async trainModel(epochs: number = 50): Promise<void> {
    if (!this.model || !this.trainingData || !this.normalizeParams) {
      throw new Error("Model or training data not ready");
    }

    const { features, labels } = this.trainingData;

    // Convert to tensors and normalize
    const xs = tf.tensor2d(features);
    const normalizedXs = xs
      .sub(this.normalizeParams.mean)
      .div(this.normalizeParams.std);
    const ys = tf.tensor2d(labels, [labels.length, 1]);

    try {
      // Train the model
      await this.model.fit(normalizedXs, ys, {
        epochs,
        batchSize: 32,
        validationSplit: 0.2,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              console.log(
                `Epoch ${epoch}: loss = ${logs?.loss?.toFixed(
                  4
                )}, accuracy = ${logs?.acc?.toFixed(4)}`
              );
            }
          },
        },
      });

      console.log("Model training completed");

      // Save model to localStorage
      await this.saveModel();
    } finally {
      // Clean up tensors
      xs.dispose();
      normalizedXs.dispose();
      ys.dispose();
    }
  }

  /**
   * Calculate risk score for given keystroke features
   */
  public async calculateRisk(features: number[]): Promise<RiskPrediction> {
    if (!this.isModelReady || !this.model || !this.normalizeParams) {
      // Return moderate risk if model not ready
      return {
        riskScore: 0.5,
        confidence: 0.1,
        recommendation: "STEP_UP",
        features,
      };
    }

    try {
      // Normalize features
      const featureTensor = tf.tensor2d([features]);
      const normalizedFeatures = featureTensor
        .sub(this.normalizeParams.mean)
        .div(this.normalizeParams.std);

      // Get prediction
      const prediction = this.model.predict(normalizedFeatures) as tf.Tensor;
      const riskScore = await prediction.data();

      // Clean up tensors
      featureTensor.dispose();
      normalizedFeatures.dispose();
      prediction.dispose();

      const risk = riskScore[0];
      const confidence = this.calculateConfidence(features);

      return {
        riskScore: risk,
        confidence,
        recommendation: this.getRecommendation(risk, confidence),
        features,
      };
    } catch (error) {
      console.error("Error calculating risk:", error);
      return {
        riskScore: 0.5,
        confidence: 0.1,
        recommendation: "STEP_UP",
        features,
      };
    }
  }

  /**
   * Calculate confidence based on feature consistency
   */
  private calculateConfidence(features: number[]): number {
    // Simple confidence calculation based on feature ranges
    // In production, this would be more sophisticated
    const [holdTime, flightTime, , , speed, errorRate, consistency] = features;

    let confidence = 1.0;

    // Reduce confidence for extreme values
    if (holdTime < 20 || holdTime > 300) confidence *= 0.8;
    if (flightTime < 10 || flightTime > 500) confidence *= 0.8;
    if (speed < 10 || speed > 200) confidence *= 0.7;
    if (errorRate > 20) confidence *= 0.6;
    if (consistency < 30) confidence *= 0.7;

    return Math.max(0.1, confidence);
  }

  /**
   * Get recommendation based on risk score and confidence
   */
  private getRecommendation(
    riskScore: number,
    confidence: number
  ): "GRANT" | "DENY" | "STEP_UP" {
    if (confidence < 0.5) return "STEP_UP";

    if (riskScore < 0.3) return "GRANT";
    if (riskScore > 0.7) return "DENY";
    return "STEP_UP";
  }

  /**
   * Save model to localStorage
   */
  private async saveModel(): Promise<void> {
    if (!this.model) return;

    try {
      const modelJson = await this.model.toJSON();
      localStorage.setItem("behavioralModel", JSON.stringify(modelJson));
      console.log("Model saved to localStorage");
    } catch (error) {
      console.error("Error saving model:", error);
    }
  }

  /**
   * Get model performance metrics
   */
  public async getModelMetrics(): Promise<{
    accuracy: number;
    loss: number;
  } | null> {
    if (!this.model || !this.trainingData || !this.normalizeParams) return null;

    const { features, labels } = this.trainingData;
    const xs = tf.tensor2d(features);
    const normalizedXs = xs
      .sub(this.normalizeParams.mean)
      .div(this.normalizeParams.std);
    const ys = tf.tensor2d(labels, [labels.length, 1]);

    try {
      const evaluation = this.model.evaluate(normalizedXs, ys) as tf.Tensor[];
      const loss = await evaluation[0].data();
      const accuracy = await evaluation[1].data();

      return {
        loss: loss[0],
        accuracy: accuracy[0],
      };
    } finally {
      xs.dispose();
      normalizedXs.dispose();
      ys.dispose();
    }
  }

  /**
   * Check if model is ready for predictions
   */
  public isReady(): boolean {
    return this.isModelReady && this.model !== null;
  }

  /**
   * Dispose of model and free memory
   */
  public dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }

    if (this.normalizeParams) {
      this.normalizeParams.mean.dispose();
      this.normalizeParams.std.dispose();
      this.normalizeParams = null;
    }

    this.isModelReady = false;
  }
}
