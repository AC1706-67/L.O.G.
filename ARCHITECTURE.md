# LOG Peer Recovery System - Architecture

## Overview

The LOG Peer Recovery System follows a modular architecture with clear separation of concerns. Each module is self-contained with its own types, services, and tests.

## Module Architecture

### 1. Consent Module (`src/modules/consent/`)
**Purpose**: Manage participant consent for 42 CFR Part 2 and AI processing

**Key Components**:
- Consent form presentation and capture
- Digital signature handling
- Consent status tracking
- Expiration monitoring
- Revocation management

**Compliance**: 42 CFR Part 2, HIPAA

### 2. Intake Module (`src/modules/intake/`)
**Purpose**: Multi-session participant data collection

**Key Components**:
- Session management (start, resume, save)
- 11 intake sections (identifiers, contact, demographics, etc.)
- Progress tracking
- Auto-save functionality
- Flexible section ordering

**Data Sections**:
1. Identifiers
2. Contact Information
3. Demographics
4. Health Information
5. Substance Use History
6. Behavioral Health
7. Social Drivers
8. Family Information
9. Insurance
10. Engagement Preferences
11. Emergency Contact

### 3. Assessment Module (`src/modules/assessment/`)
**Purpose**: Conversational assessments with automatic scoring

**Key Components**:
- SUPRT-C baseline assessment
- BARC-10 assessment (10-60 score range)
- Conversational interface via Nova AI
- Automatic scoring and interpretation
- Baseline comparison and progress tracking

### 4. Logging Module (`src/modules/logging/`)
**Purpose**: Comprehensive audit logging for compliance

**Key Components**:
- Interaction logging (9 interaction types)
- PHI access logging
- Data change logging
- Session lifecycle tracking
- Audit query interface

**Retention**: 7 years minimum

### 5. Recovery Plan Module (`src/modules/recovery-plan/`)
**Purpose**: Collaborative goal setting and tracking

**Key Components**:
- Recovery plan creation
- Goal management (8 categories)
- Action step tracking
- Progress notes
- Review scheduling

**Goal Categories**: Housing, Employment, Health, Family, Recovery, Education, Legal, Other

### 6. Query Module (`src/modules/query/`)
**Purpose**: Natural language data queries via Nova AI

**Key Components**:
- Query intent interpretation
- Access control verification
- Natural language response generation
- Query history tracking

**Query Types**: Count, List, Detail, Comparison, Trend

### 7. AI Module (`src/modules/ai/`)
**Purpose**: Nova AI integration layer

**Key Components**:
- Conversation management
- Structured data extraction
- Voice transcription (AWS Transcribe)
- Crisis detection
- Report formatting

**Models**: Amazon Nova 2 Sonic (voice), Nova Pro (text)

### 8. Security Module (`src/modules/security/`)
**Purpose**: Encryption, access control, and security monitoring

**Key Components**:
- AES-256 encryption/decryption
- Role-based access control (RBAC)
- MFA verification
- Session timeout monitoring
- Security alert generation
- Secure deletion

## Configuration Layer (`src/config/`)

### Supabase Configuration
- HIPAA-compliant client setup
- AsyncStorage for session persistence
- Row Level Security (RLS) policies
- Encrypted field handling

### AWS Configuration
- Bedrock Runtime Client (Nova AI)
- Transcribe Client (voice processing)
- KMS integration (key management)
- CloudTrail audit logging

## Utility Layer (`src/utils/`)

### Encryption Utilities
- Field-level encryption
- AWS KMS integration
- Secure key management

### Validation Utilities
- Email validation
- Phone validation
- Password complexity (12+ chars, mixed case, numbers, special chars)
- Date of birth validation

## Data Flow

### Typical User Flow
1. **Authentication**: MFA login via Supabase Auth
2. **Consent Capture**: CFR Part 2 → AI consent → Digital signature
3. **Intake**: Multi-session data collection with auto-save
4. **Assessment**: Conversational SUPRT-C/BARC-10 via Nova AI
5. **Recovery Plan**: Collaborative goal setting
6. **Interaction Logging**: All activities logged for audit
7. **Query**: Natural language data access

### Data Security Flow
1. **Input**: User provides data (voice/text)
2. **Validation**: Client-side validation
3. **Encryption**: Field-level encryption for PHI
4. **Storage**: Encrypted storage in Supabase
5. **Access Control**: RLS policies + RBAC
6. **Audit**: All access logged
7. **Retrieval**: Decryption on authorized access

## Testing Strategy

### Unit Tests
- Individual function testing
- Specific examples and edge cases
- Mock external dependencies

### Property-Based Tests (fast-check)
- Universal correctness properties
- Minimum 100 iterations per property
- Test across wide input ranges

### Integration Tests
- End-to-end workflows
- Multi-module interactions
- Real service integration

## Compliance Architecture

### HIPAA Requirements
- ✅ Encryption at rest (AES-256)
- ✅ Encryption in transit (TLS 1.2+)
- ✅ Access control (RBAC)
- ✅ Audit logging (7-year retention)
- ✅ MFA required
- ✅ Session timeout (15 minutes)
- ✅ Secure deletion

### 42 CFR Part 2 Requirements
- ✅ Explicit written consent
- ✅ Purpose-specific disclosure
- ✅ Re-disclosure prohibition notices
- ✅ Consent expiration tracking
- ✅ Separate consent records
- ✅ Breach notification procedures
- ✅ Restricted SUD record access

## Future Enhancements

### Phase 2 (Post-MVP)
- Real-time collaboration
- Advanced analytics dashboard
- Predictive risk modeling
- Integration with EHR systems
- Telehealth video integration

### Phase 3 (Scale)
- Multi-organization support
- Advanced reporting
- API for third-party integrations
- Mobile SDK for partner apps
