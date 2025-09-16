# Behavioral Biometrics Authentication Frontend

A sophisticated React-based frontend application that implements behavioral biometrics authentication using keystroke dynamics analysis with TensorFlow.js.

## 🔐 Features

### Core Authentication

- **Keystroke Dynamics Analysis**: Captures precise timing data using `performance.now()` for hold times and flight times
- **Real-time Risk Assessment**: Uses TensorFlow.js neural network for behavioral pattern analysis
- **Step-up Authentication**: Intelligent challenge system based on risk scores
- **Session Management**: Secure token-based authentication with validation

### User Experience

- **Clean, Elegant UI**: Built with shadcn/ui components and Tailwind CSS
- **Real-time Visualization**: Live risk score and typing pattern feedback
- **Responsive Design**: Mobile-first design that works on all devices
- **Accessibility**: WCAG compliant with keyboard navigation and screen reader support

### Security Features

- **Biometric Privacy**: No permanent storage of biometric data
- **CSP Protection**: Content Security Policy implementation
- **Error Boundaries**: Graceful error handling and recovery
- **Performance Monitoring**: Real-time metrics and system health checks

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Bun runtime
- A running Bun backend server (from the `/server` directory)

### Installation

```bash
# Install dependencies
bun install

# Start development server
bun dev

# Build for production
bun build

# Preview production build
bun preview
```

### Environment Setup

The application connects to a backend server at `http://localhost:3000` by default. You can modify this in `src/lib/auth-client.ts`.

## 🏗️ Architecture

### Technology Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 4 with shadcn/ui components
- **ML Library**: TensorFlow.js 4.21.0 with WASM backend
- **State Management**: Zustand for lightweight state management
- **Icons**: Lucide React for consistent iconography

### Project Structure

```
src/
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx          # Main login interface
│   │   ├── Dashboard.tsx          # Post-auth dashboard
│   │   └── StepUpChallenge.tsx   # Multi-factor auth modal
│   ├── ui/                       # shadcn/ui components
│   └── ErrorBoundary.tsx         # Error handling
├── lib/
│   ├── biometrics.ts             # Keystroke capture engine
│   ├── risk-calculator.ts        # TensorFlow.js ML model
│   ├── auth-client.ts            # API communication
│   └── utils.ts                  # Utility functions
├── store/
│   └── auth-store.ts             # Zustand state management
├── hooks/
│   └── use-toast.ts              # Toast notification system
├── App.tsx                       # Main application component
└── main.tsx                      # Application entry point
```

## 🧠 Behavioral Analysis

### Keystroke Metrics Captured

- **Hold Times (Dwell Time)**: Time between key press and release
- **Flight Times**: Time between consecutive keystrokes
- **Typing Speed**: Words per minute calculation
- **Error Rate**: Percentage of corrections/backspaces
- **Consistency Score**: Statistical variance in timing patterns

### Machine Learning Model

- **Architecture**: 3-layer neural network with dropout regularization
- **Input Features**: 8 statistical features derived from keystroke patterns
- **Training**: Real-time learning with synthetic data simulation
- **Output**: Risk score (0-1) with confidence level and recommendation

### Risk Assessment Thresholds

- **Low Risk (0-0.3)**: Grant access immediately
- **Medium Risk (0.3-0.7)**: Require step-up authentication
- **High Risk (0.7-1.0)**: Deny access or require strong verification

## 🔧 Configuration

### Model Training Parameters

```typescript
const trainingConfig = {
  epochs: 50,
  batchSize: 32,
  validationSplit: 0.2,
  learningRate: 0.001,
};
```

### Risk Thresholds

```typescript
const riskThresholds = {
  grant: 0.3, // Below this: immediate access
  stepUp: 0.7, // Above this: additional verification
  deny: 0.8, // Above this: access denied
};
```

### Performance Targets

- **Initial Load**: < 3 seconds
- **Risk Calculation**: < 20ms
- **Model Training**: < 5 seconds
- **Memory Usage**: < 100MB RAM

## 🎨 UI Components

### Authentication Flow

1. **Login Form**: Captures credentials and biometric data
2. **Risk Visualization**: Real-time feedback on typing patterns
3. **Step-up Challenges**: Math, CAPTCHA, SMS, or email verification
4. **Dashboard**: Post-authentication monitoring and metrics

### Design System

- **Colors**: Blue/gray palette with semantic risk colors
- **Typography**: Inter font family for readability
- **Spacing**: 4px base unit for consistent spacing
- **Animations**: Subtle transitions for better UX

## 🧪 Testing Scenarios

### Demo Accounts (for testing with backend)

```typescript
const testUsers = [
  {
    username: "lowrisk",
    password: "pass123",
    expected: "GRANT",
  },
  {
    username: "highrisk",
    password: "pass123",
    expected: "STEP_UP",
  },
];
```

### Typing Pattern Simulation

- **Consistent Typing**: Regular intervals, low variance
- **Robotic Typing**: Identical timings, high suspicion
- **Hunt-and-Peck**: Irregular patterns, high variance

## 📊 Performance Metrics

### Model Accuracy

- **Target Accuracy**: 98%+ match with behavioral patterns
- **False Acceptance Rate**: < 0.5%
- **False Rejection Rate**: < 1.2%

### System Performance

- **Real-time Processing**: All operations under 100ms
- **Browser Compatibility**: Chrome, Firefox, Safari latest versions
- **Mobile Performance**: Optimized for touch devices

## 🔒 Security Considerations

### Privacy Protection

- **No Persistent Storage**: Biometric data cleared after session
- **Local Processing**: ML inference happens client-side
- **Encrypted Transport**: HTTPS for all API communications

### Attack Mitigation

- **Replay Attack Prevention**: Timestamp validation
- **Rate Limiting**: Built-in request throttling
- **Input Validation**: Comprehensive data sanitization

## 🚀 Deployment

### Production Build

```bash
# Create optimized build
bun build

# Serve static files
bun preview
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 4173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📄 License

This project is part of a behavioral biometrics research and demonstration system. Please ensure compliance with biometric data protection regulations in your jurisdiction.

## 🆘 Support

For issues and questions:

- Check the browser console for detailed error messages
- Ensure the backend server is running on port 3000
- Verify TensorFlow.js WASM backend compatibility
- Review network requests in developer tools

---

**⚠️ Important**: This is a demonstration system. For production use, implement additional security measures, thorough testing, and compliance with biometric data protection laws.
