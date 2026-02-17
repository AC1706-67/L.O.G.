# LOG Peer Recovery System

An AI-powered peer recovery organization management system designed for peer specialists to manage participants in substance use disorder recovery programs. Built with React Native/Expo and powered by Amazon Nova AI via AWS Bedrock.

## Features

- **HIPAA & 42 CFR Part 2 Compliant**: Full compliance with healthcare privacy regulations
- **Conversational AI**: Natural language interactions powered by Amazon Nova
- **Multi-Session Intake**: Flexible participant data collection across multiple sessions
- **Assessments**: SUPRT-C and BARC-10 conversational assessments with automatic scoring
- **Recovery Plans**: Collaborative goal setting and progress tracking
- **Voice & Text Input**: Support for both voice and text input modalities
- **Offline Support**: Queue data locally and sync when connectivity is restored
- **Comprehensive Audit Logging**: All interactions logged for compliance

## Technology Stack

- **Frontend**: React Native with Expo (iOS/Android)
- **AI Engine**: Amazon Nova via AWS Bedrock
- **Database**: Supabase (PostgreSQL with HIPAA-compliant configuration)
- **Authentication**: Supabase Auth with MFA
- **Voice Processing**: AWS Transcribe
- **Testing**: Jest + fast-check (property-based testing)

## Project Structure

```
log-peer-recovery/
├── src/
│   ├── config/           # Configuration files (Supabase, AWS)
│   ├── modules/          # Feature modules
│   │   ├── consent/      # Consent management
│   │   ├── intake/       # Participant intake
│   │   ├── assessment/   # SUPRT-C & BARC-10 assessments
│   │   ├── logging/      # Interaction & audit logging
│   │   ├── recovery-plan/# Recovery goal tracking
│   │   ├── query/        # Natural language queries
│   │   ├── ai/           # Nova AI integration
│   │   └── security/     # Encryption & access control
│   ├── utils/            # Utility functions
│   └── __tests__/        # Test files
├── assets/               # Images and static assets
├── .env                  # Environment variables (not committed)
├── .env.example          # Environment variables template
└── README.md             # This file
```

## 🔗 Deep Linking Setup

This app supports Supabase invite deep links for mobile authentication. When users receive invite emails, they can tap the link to open the app and complete authentication automatically.

**Quick Setup:** See [`DEEP_LINK_QUICK_START.md`](./DEEP_LINK_QUICK_START.md) (10 minutes)

**Complete Guide:** See [`docs/SUPABASE_DEEP_LINKING_GUIDE.md`](./docs/SUPABASE_DEEP_LINKING_GUIDE.md)

**Key Features:**
- ✅ Invite links open the app directly
- ✅ Password recovery links supported
- ✅ PKCE security flow
- ✅ Session persistence across app restarts
- ✅ Auto token refresh
- ✅ Works on iOS and Android

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Expo CLI
- iOS Simulator (macOS) or Android Emulator
- Supabase account with HIPAA BAA
- AWS account with Bedrock access and HIPAA BAA

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and configure your credentials:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your actual credentials:
   - Supabase URL and anon key
   - AWS credentials and region
   - Bedrock model ID

### Running the App

```bash
# Start the development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web
npm run web
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## Environment Variables

Required environment variables (see `.env.example`):

- `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `EXPO_PUBLIC_AWS_REGION`: AWS region (e.g., us-east-1)
- `EXPO_PUBLIC_AWS_ACCESS_KEY_ID`: AWS access key
- `EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY`: AWS secret key
- `EXPO_PUBLIC_BEDROCK_MODEL_ID`: Bedrock model ID (default: amazon.nova-2-sonic-v1:0)

## Compliance & Security

### HIPAA Compliance

- All PHI encrypted at rest (AES-256) and in transit (TLS 1.2+)
- Role-based access control (RBAC)
- Comprehensive audit logging (7-year retention)
- Multi-factor authentication (MFA) required
- 15-minute session timeout
- Secure data deletion

### 42 CFR Part 2 Compliance

- Explicit written consent before disclosure
- Prohibition on re-disclosure notices
- Separate consent records per disclosure purpose
- Consent expiration tracking
- Breach notification procedures

## Development Guidelines

### Module Structure

Each module follows this structure:
- `types.ts`: TypeScript interfaces and types
- `index.ts`: Module exports
- Services will be implemented in subsequent tasks

### Testing

- Unit tests for specific functionality
- Property-based tests for universal correctness properties
- Integration tests for end-to-end workflows
- Minimum 100 iterations for property-based tests

### Code Style

- TypeScript strict mode enabled
- ESLint for code quality
- Prettier for code formatting

## License

Proprietary - All rights reserved

## Support

For questions or issues, please contact the development team.
