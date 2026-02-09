# Consent Module UI Screens

This module provides the user interface for consent capture and management in the LOG Peer Recovery System.

## Components

### 1. ConsentWorkflowScreen
**Purpose**: Manages the flow through multiple consent forms during participant enrollment.

**Features**:
- Displays CFR Part 2 and AI consent forms in required order
- Enforces CFR Part 2 consent before AI consent (Requirement 1.1)
- Shows completion status for each consent type
- Prevents enrollment completion without required consents

**Usage**:
```typescript
navigation.navigate('ConsentWorkflow', {
  participantId: 'uuid',
  participantName: 'John Doe',
  dateOfBirth: new Date('1990-01-01'),
  onComplete: () => {
    // Handle completion
  }
});
```

### 2. ConsentFormScreen
**Purpose**: Displays and captures individual consent forms with digital signatures.

**Features**:
- Renders consent form sections (Requirements 1.2, 1.4)
- Captures digital signatures (Requirement 1.3)
- Collects CFR Part 2 specific fields (purpose, recipients, information)
- Validates required fields before submission
- Encrypts and stores consent with audit trail

**Usage**:
```typescript
navigation.navigate('ConsentForm', {
  participantId: 'uuid',
  participantName: 'John Doe',
  dateOfBirth: new Date('1990-01-01'),
  consentForm: CFR_PART_2_FORM_SCHEMA,
  onComplete: () => {
    // Handle completion
  }
});
```

### 3. ConsentStatusScreen
**Purpose**: Displays consent status dashboard with expiration warnings and revocation interface.

**Features**:
- Shows overall consent status (Requirement 1.9)
- Displays expiration warnings 30 days before expiration (Requirement 1.10)
- Provides consent revocation interface (Requirement 1.11)
- Shows detailed status for each consent type
- Pull-to-refresh functionality

**Usage**:
```typescript
navigation.navigate('ConsentStatus', {
  participantId: 'uuid',
  participantName: 'John Doe'
});
```

### 4. SignatureCapture Component
**Purpose**: Provides digital signature capture functionality.

**Features**:
- Touch-based signature drawing
- Clear and save functionality
- Base64 encoding of signature data
- Modal presentation

**Usage**:
```typescript
<SignatureCapture
  onSave={(signatureData) => {
    // Handle signature data (base64 string)
  }}
  onCancel={() => {
    // Handle cancellation
  }}
/>
```

## Navigation Integration

The consent screens are integrated into the root navigation stack and can be accessed from anywhere in the app:

```typescript
// From RootNavigator.tsx
<Stack.Screen 
  name="ConsentWorkflow" 
  component={ConsentWorkflowScreen}
  options={{ headerShown: true, title: 'Consent Forms' }}
/>
<Stack.Screen 
  name="ConsentForm" 
  component={ConsentFormScreen}
  options={{ headerShown: true, title: 'Consent Form' }}
/>
<Stack.Screen 
  name="ConsentStatus" 
  component={ConsentStatusScreen}
  options={{ headerShown: true, title: 'Consent Status' }}
/>
```

## Requirements Coverage

### Task 16.1: Create consent form screens
- ✅ Implement CFR Part 2 consent form UI (Requirements 1.1, 1.2)
- ✅ Implement AI consent form UI (Requirements 1.3, 1.4)
- ✅ Create digital signature capture (Requirement 1.3)

### Task 16.2: Create consent status display
- ✅ Implement consent status dashboard (Requirement 1.9)
- ✅ Create expiration warnings (Requirement 1.10)
- ✅ Implement revocation interface (Requirement 1.11)

## Data Flow

1. **Enrollment Flow**:
   - User navigates to ConsentWorkflowScreen
   - System checks existing consent status
   - User completes CFR Part 2 consent form (required)
   - User optionally completes AI consent form
   - System validates and stores consents with encryption
   - Audit logs are created for all consent actions

2. **Status Check Flow**:
   - User navigates to ConsentStatusScreen
   - System retrieves consent status from database
   - System calculates days until expiration
   - System displays warnings for expiring consents
   - User can revoke consents if needed

3. **Signature Capture Flow**:
   - User taps signature button
   - SignatureCapture modal appears
   - User draws signature with finger
   - System converts signature to base64
   - Signature is encrypted before storage

## Security Considerations

- All signatures are encrypted using AES-256 before storage
- Consent actions are logged to audit trail
- PHI access is restricted based on consent status
- Consent revocation immediately restricts PHI access
- Screen capture is prevented on sensitive screens

## Future Enhancements

- Add support for coaching agreement consent form
- Add support for acknowledgement of receipt form
- Implement consent renewal workflow
- Add consent history view
- Implement consent export functionality
- Add support for multiple languages
