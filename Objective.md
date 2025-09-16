### AI Implementation Prompt: Frontend for Behavioral Biometrics Authentication System

**Objective:** Build a complete frontend for a risk-adaptive authentication system that uses keystroke dynamics analysis with TensorFlow.js, implements client-side machine learning, and communicates with a Bun backend server.

---

### **Technology Stack Requirements**

- **Core Framework**: ReactJS with Vite
- **ML Library**: TensorFlow.js 4.23.0 (WASM backend)
- **UI**: React + TailwindCSS with responsive design
- **Cryptography**: WebCrypto API
- **Build Tool**: None (direct browser execution)
- **Communication**: Fetch API for REST calls

---

### **Core Functional Requirements**

#### **1. User Interface Components**

- Clean login form with username/password fields
- Real-time risk visualization dashboard
- Step-up challenge modal
- Session status indicator
- Performance metrics display

#### **2. Keystroke Dynamics Capture**

```javascript
// Implement precise timing capture
const keyMetrics = {
  downTime: 0,
  upTime: 0,
  holdTimes: [],
  flightTimes: [],
  lastKeyUp: 0,
};

// Must capture with microsecond precision using performance.now()
```

#### **3. TensorFlow.js Implementation**

```javascript
// Model architecture for behavioral analysis
const model = tf.sequential({
  layers: [
    tf.layers.dense({ units: 8, inputShape: [4], activation: "relu" }),
    tf.layers.dense({ units: 4, activation: "relu" }),
    tf.layers.dense({ units: 1, activation: "sigmoid" }),
  ],
});

// Training configuration with Clarkson dataset
const trainingConfig = {
  epochs: 50,
  batchSize: 32,
  validationSplit: 0.2,
};
```

#### **4. Risk Calculation Engine**

```javascript
// Real-time risk assessment using multiple features
function calculateRiskScore(
  holdTimes,
  flightTimes,
  errorRate,
  consistencyScore
) {
  // Implement comprehensive risk algorithm
  return normalizeScore(0.7 * temporalScore + 0.3 * behavioralScore);
}
```

#### **5. Server Communication**

```javascript
// API communication protocol
const authAPI = {
  login: async (username, password, riskScore, features) => {
    return fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, riskScore, features }),
    });
  },

  stepUp: async (challengeId, solution) => {
    // Step-up verification implementation
  },
};
```

---

### **Implementation Steps**

#### **1. Project Structure**

```
frontend/
├── index.html          # Main interface
├── styles.css          # Responsive styling
├── app.js              # Core application logic
├── biometrics.js       # Keystroke analysis
├── ml-model.js         # TF.js implementation
└── api-client.js       # Server communication
```

#### **2. HTML Structure**

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Behavioral Auth Demo</title>
    <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.23.0"></script>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div id="auth-container">
      <form id="login-form">
        <!-- Form fields with event listeners -->
      </form>
      <div id="risk-visualization">
        <!-- Real-time risk display -->
      </div>
    </div>
    <script type="module" src="app.js"></script>
  </body>
</html>
```

#### **3. Key Implementation Files**

**app.js**

```javascript
import { BiometricCapture } from "./biometrics.js";
import { RiskCalculator } from "./ml-model.js";
import { AuthClient } from "./api-client.js";

class AuthenticationApp {
  constructor() {
    this.biometricCapture = new BiometricCapture();
    this.riskCalculator = new RiskCalculator();
    this.authClient = new AuthClient();
    this.initializeEventListeners();
  }

  async initializeEventListeners() {
    // Form submission handling
    // Real-time risk updates
    // UI state management
  }
}
```

**biometrics.js**

```javascript
export class BiometricCapture {
  constructor() {
    this.metrics = new Map();
    this.setupEventListeners();
  }

  setupEventListeners() {
    const inputs = document.querySelectorAll('input[type="password"]');
    inputs.forEach((input) => {
      input.addEventListener("keydown", this.captureKeyDown.bind(this));
      input.addEventListener("keyup", this.captureKeyUp.bind(this));
    });
  }

  captureKeyDown(event) {
    // Precision timing implementation
  }

  calculateTypingMetrics() {
    // Extract hold times, flight times, error rates
  }
}
```

**ml-model.js**

```javascript
export class RiskCalculator {
  constructor() {
    this.model = null;
    this.loadModel();
  }

  async loadModel() {
    // Load and train TF.js model with Clarkson dataset
  }

  async calculateRisk(metrics) {
    // Convert metrics to tensor
    // Run model prediction
    // Return normalized risk score
  }
}
```

#### **4. CSS Requirements**

```css
/* Responsive design for mobile/desktop */
#auth-container {
  max-width: 400px;
  margin: 2rem auto;
  padding: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.risk-indicator {
  height: 4px;
  background: linear-gradient(90deg, green 0%, yellow 50%, red 100%);
  margin: 1rem 0;
}

/* Visual feedback for different risk levels */
```

---

### **Performance Requirements**

- **Initial Load**: < 3 seconds
- **Risk Calculation**: < 20ms after typing
- **Model Training**: < 5 seconds (first load)
- **Memory Usage**: < 100MB RAM
- **Network Calls**: < 100ms roundtrip

---

### **Testing Specifications**

```javascript
// Test cases to implement
const testScenarios = [
  {
    username: "lowrisk",
    password: "pass123",
    typingPattern: "consistent",
    expected: "GRANT",
  },
  {
    username: "highrisk",
    password: "pass123",
    typingPattern: "robotic",
    expected: "DENY",
  },
];
```

---

### **Validation Metrics**

- **Accuracy**: 98%+ match with Clarkson dataset labels
- **Precision**: < 0.5% false acceptance rate
- **Recall**: < 1.2% false rejection rate
- **Latency**: All operations under 100ms
- **Compatibility**: Chrome, Firefox, Safari latest versions

---

### **Delivery Requirements**

1. **Complete working frontend** with all specified components
2. **Clean, documented code** with JSDoc comments
3. **Responsive design** working on mobile and desktop
4. **Performance metrics** displayed in console
5. **Error handling** for all possible failure scenarios
6. **Security considerations** (CSP, XSS protection)
