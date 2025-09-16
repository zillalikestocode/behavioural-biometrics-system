# Behavioral Biometrics Authentication Server

A high-performance backend server built with Bun for behavioral biometrics authentication using keystroke dynamics analysis.

## Features

- 🔐 **Advanced Risk Assessment**: Multi-factor risk calculation using keystroke dynamics
- 🧠 **Machine Learning Integration**: Backend risk analysis with statistical modeling
- 🚀 **High Performance**: Built with Bun runtime for optimal speed
- 🛡️ **Security First**: Rate limiting, input validation, CORS, and security headers
- 🔄 **Step-up Authentication**: Dynamic challenge system for high-risk scenarios
- 📊 **Comprehensive Logging**: Structured logging with performance metrics
- 🎯 **Biometric Profiling**: Adaptive user profiles with historical analysis

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) runtime (v1.0+)

### Installation

1. **Install dependencies**:

   ```bash
   bun install
   ```

2. **Configure environment**:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the server**:

   ```bash
   # Development mode with hot reload
   bun run dev

   # Production mode
   bun start
   ```

The server will start at `http://localhost:3001`

## API Endpoints

### Authentication

#### POST `/api/login`

Authenticate user with biometric analysis.

**Request Body**:

```json
{
  "username": "string",
  "password": "string",
  "riskScore": 0.0-1.0,
  "features": {
    "holdTimes": [number],
    "flightTimes": [number],
    "errorRate": 0.0-1.0,
    "typingSpeed": number,
    "timestamp": number
  }
}
```

**Response**:

```json
{
  "status": "GRANT|STEP_UP|DENY",
  "token": "jwt_token",
  "user": { "id": "uuid", "username": "string" },
  "riskScore": 0.0-1.0,
  "factors": { "temporal": 0.0-1.0, "behavioral": 0.0-1.0 }
}
```

#### POST `/api/step-up`

Complete step-up authentication challenge.

**Request Body**:

```json
{
  "challengeId": "uuid",
  "solution": "string",
  "features": {
    /* optional biometric features */
  }
}
```

### Health Check

#### GET `/health`

Server health and status information.

## Demo Users

The server initializes with demo users for testing:

| Username   | Password   | Profile Type | Expected Behavior                 |
| ---------- | ---------- | ------------ | --------------------------------- |
| `lowrisk`  | `pass123`  | Consistent   | Low risk scores, immediate access |
| `highrisk` | `pass123`  | Robotic      | High risk scores, likely denial   |
| `normal`   | `pass123`  | Normal       | Medium risk, possible step-up     |
| `admin`    | `admin123` | Consistent   | Administrative access             |

## Risk Assessment Algorithm

The server implements a sophisticated multi-factor risk assessment:

### Risk Factors (0.0 - 1.0)

1. **Temporal Risk (25%)**: Hold time and flight time deviations
2. **Behavioral Risk (20%)**: Error rate and typing speed changes
3. **Consistency Risk (20%)**: Variance pattern analysis
4. **Deviation Risk (15%)**: Statistical z-score analysis
5. **Velocity Risk (10%)**: Typing rhythm acceleration changes
6. **Client Risk (10%)**: Frontend-calculated risk score

### Risk Thresholds

- **< 0.3**: Low risk → Grant access
- **0.3 - 0.7**: Medium risk → Step-up challenge
- **> 0.7**: High risk → Deny access

## Challenge Types

For step-up authentication:

- **Math**: Simple arithmetic problems
- **Pattern**: Number sequence completion
- **Memory**: Word sequence recall
- **CAPTCHA**: Character recognition
- **Security Questions**: Personal information (demo)

## Security Features

### Rate Limiting

- Login attempts: 10 per 15 minutes per IP
- Step-up attempts: 5 per 5 minutes per IP
- General API: 100 per 15 minutes per IP

### Security Headers

- CORS configuration
- XSS protection
- Content type validation
- CSP headers
- HSTS enforcement

### Input Validation

- Zod schema validation
- XSS sanitization
- SQL injection prevention
- Request size limits

## Performance Metrics

Target performance benchmarks:

- **Initial Load**: < 3 seconds
- **Risk Calculation**: < 20ms
- **API Response**: < 100ms
- **Memory Usage**: < 100MB RAM

## Architecture

```
server/
├── server.js              # Main server entry point
├── middleware/             # Request middleware
│   └── index.js           # Security, logging, rate limiting
├── routes/                 # API route handlers
│   └── auth.js            # Authentication endpoints
├── services/               # Business logic
│   ├── riskCalculator.js  # ML risk assessment
│   ├── userManager.js     # User data management
│   └── challengeManager.js # Step-up challenges
└── utils/                  # Utilities
    ├── logger.js          # Structured logging
    ├── rateLimiter.js     # Rate limiting
    └── errors.js          # Error handling
```

## Environment Variables

| Variable       | Description     | Default                |
| -------------- | --------------- | ---------------------- |
| `PORT`         | Server port     | 3001                   |
| `HOST`         | Server host     | 0.0.0.0                |
| `FRONTEND_URL` | CORS origin     | http://localhost:5173  |
| `JWT_SECRET`   | JWT signing key | (change in production) |
| `LOG_LEVEL`    | Logging level   | info                   |
| `NODE_ENV`     | Environment     | development            |

## Development

### Code Style

- ESModules with async/await
- Comprehensive error handling
- JSDoc documentation
- Structured logging

### Testing

```bash
bun test
```

### Debugging

Set `LOG_LEVEL=debug` for detailed logging including:

- Request/response details
- Risk calculation breakdowns
- Performance timings
- Biometric analysis

## Production Deployment

### Security Checklist

- [ ] Change `JWT_SECRET` to a strong random key
- [ ] Set `NODE_ENV=production`
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS/TLS
- [ ] Set up proper database (replace in-memory storage)
- [ ] Configure log aggregation
- [ ] Set up monitoring and alerting

### Database Migration

The current implementation uses in-memory storage. For production:

1. Replace `UserManager` with database integration
2. Replace `RateLimiter` with Redis
3. Add session management
4. Implement token blacklisting

## Monitoring

### Health Check

```bash
curl http://localhost:3001/health
```

### Metrics

- Login success/failure rates
- Risk score distributions
- Challenge completion rates
- API response times

## License

MIT License - see LICENSE file for details.

## Support

For questions or issues:

1. Check the logs for detailed error information
2. Verify environment configuration
3. Test with demo users first
4. Review API documentation

---

**⚡ Powered by Bun Runtime**
