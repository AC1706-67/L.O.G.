# Security Enhancements Usage Guide

This document provides examples of how to use the newly implemented security features.

## Unauthorized Access Handling

### Example: Checking Access and Handling Denial

```typescript
import { checkAccess, handleUnauthorizedAccess, UserContext, UserRole } from './security';
import { Resource, Action } from './security/types';
import { generateSecurityAlert } from './security/securityService';

async function accessParticipantData(
  userId: string,
  participantId: string,
  ipAddress: string,
  deviceId: string
) {
  // Create user context
  const userContext: UserContext = {
    userId,
    role: UserRole.PEER_SPECIALIST,
    organizationId: 'org-123',
    assignedParticipants: ['participant-1', 'participant-2'], // This user's assigned participants
  };

  // Define the resource being accessed
  const resource: Resource = {
    type: 'participant',
    id: participantId,
  };

  // Check if user has access
  const hasAccess = await checkAccess(userContext, resource, Action.READ);

  if (!hasAccess) {
    // Handle unauthorized access
    const { denied, alert } = await handleUnauthorizedAccess(
      userContext,
      resource,
      Action.READ,
      ipAddress,
      deviceId
    );

    // Generate and store the security alert
    await generateSecurityAlert(alert);

    // Return error to user
    throw new Error('Access denied: You do not have permission to access this participant');
  }

  // Proceed with authorized access
  // ... fetch and return participant data
}
```

### Example: Monitoring Security Alerts

```typescript
import { getSecurityAlerts, resolveSecurityAlert } from './security/securityService';

async function reviewSecurityAlerts() {
  // Get all high-severity alerts
  const highSeverityAlerts = await getSecurityAlerts(undefined, 'high');

  console.log(`Found ${highSeverityAlerts.length} high-severity alerts`);

  for (const alert of highSeverityAlerts) {
    console.log(`Alert: ${alert.description}`);
    console.log(`User: ${alert.userId}`);
    console.log(`Time: ${alert.timestamp}`);
    console.log(`Requires Action: ${alert.requiresAction}`);
  }
}

async function resolveAlert(alertId: string, adminUserId: string) {
  await resolveSecurityAlert(
    alertId,
    adminUserId,
    'Investigated and confirmed user does not have access. No further action needed.'
  );
}
```

## Secure Deletion

### Example: Securely Deleting Participant Data

```typescript
import { secureDelete } from './security/securityService';

async function deleteParticipant(participantId: string) {
  // Define sensitive fields that need secure overwrite
  const sensitiveFields = [
    'first_name_encrypted',
    'last_name_encrypted',
    'ssn_encrypted',
    'email_encrypted',
    'phone_encrypted',
    'address_encrypted',
  ];

  // Perform secure deletion
  // This will:
  // 1. Overwrite sensitive fields with random data
  // 2. Overwrite again with different random data (double overwrite)
  // 3. Delete the record
  // 4. Log the secure deletion in audit logs
  await secureDelete('participants', participantId, sensitiveFields);

  console.log(`Participant ${participantId} securely deleted`);
}
```

### Example: Securely Deleting Consent Records

```typescript
import { secureDelete } from './security/securityService';

async function deleteConsent(consentId: string) {
  const sensitiveFields = [
    'signature_encrypted',
    'witness_signature_encrypted',
  ];

  await secureDelete('consents', consentId, sensitiveFields);

  console.log(`Consent ${consentId} securely deleted`);
}
```

### Example: Securely Deleting Assessment Data

```typescript
import { secureDelete } from './security/securityService';

async function deleteAssessment(assessmentId: string) {
  const sensitiveFields = [
    'conversation_transcript',
    'responses', // JSONB field containing sensitive responses
  ];

  await secureDelete('assessments', assessmentId, sensitiveFields);

  console.log(`Assessment ${assessmentId} securely deleted`);
}
```

## Integration with Access Control

### Example: Complete Access Control Flow

```typescript
import {
  checkAccess,
  handleUnauthorizedAccess,
  UserContext,
  UserRole,
} from './security';
import { Resource, Action } from './security/types';
import { generateSecurityAlert } from './security/securityService';
import { logPHIAccess } from './logging/sessionLogger';

async function accessProtectedResource(
  userContext: UserContext,
  resource: Resource,
  action: Action,
  purpose: string,
  ipAddress: string,
  deviceId: string
) {
  // Step 1: Check access
  const hasAccess = await checkAccess(userContext, resource, action);

  if (!hasAccess) {
    // Step 2: Handle unauthorized access
    const { denied, alert } = await handleUnauthorizedAccess(
      userContext,
      resource,
      action,
      ipAddress,
      deviceId
    );

    // Step 3: Generate security alert
    await generateSecurityAlert(alert);

    // Step 4: Throw error
    throw new Error('Access denied');
  }

  // Step 5: Log authorized PHI access
  await logPHIAccess({
    userId: userContext.userId,
    participantId: resource.id,
    accessType: action,
    dataType: resource.type,
    purpose,
    timestamp: new Date(),
    ipAddress,
    deviceId,
  });

  // Step 6: Proceed with authorized access
  return true;
}
```

## Best Practices

### 1. Always Check Access Before Operations

```typescript
// ❌ BAD: Direct access without checking
async function getParticipant(participantId: string) {
  return await supabase.from('participants').select('*').eq('id', participantId);
}

// ✅ GOOD: Check access first
async function getParticipant(userContext: UserContext, participantId: string) {
  const resource: Resource = { type: 'participant', id: participantId };
  const hasAccess = await checkAccess(userContext, resource, Action.READ);
  
  if (!hasAccess) {
    await handleUnauthorizedAccess(userContext, resource, Action.READ, '...', '...');
    throw new Error('Access denied');
  }
  
  return await supabase.from('participants').select('*').eq('id', participantId);
}
```

### 2. Use Secure Delete for All PHI

```typescript
// ❌ BAD: Direct deletion
async function deleteParticipant(participantId: string) {
  await supabase.from('participants').delete().eq('id', participantId);
}

// ✅ GOOD: Secure deletion with overwrite
async function deleteParticipant(participantId: string) {
  const sensitiveFields = ['first_name_encrypted', 'ssn_encrypted', /* ... */];
  await secureDelete('participants', participantId, sensitiveFields);
}
```

### 3. Monitor and Respond to Security Alerts

```typescript
// Set up periodic monitoring
setInterval(async () => {
  const criticalAlerts = await getSecurityAlerts(undefined, 'critical');
  
  if (criticalAlerts.length > 0) {
    // Send notifications to administrators
    await notifyAdministrators(criticalAlerts);
  }
}, 60000); // Check every minute
```

### 4. Log All Security Events

```typescript
// Always log security-relevant events
async function performSensitiveOperation(userContext: UserContext) {
  try {
    // ... operation logic
    
    // Log success
    await generateSecurityAlert({
      severity: 'low',
      type: 'SENSITIVE_OPERATION_SUCCESS',
      description: `User ${userContext.userId} completed sensitive operation`,
      userId: userContext.userId,
      requiresAction: false,
    });
  } catch (error) {
    // Log failure
    await generateSecurityAlert({
      severity: 'medium',
      type: 'SENSITIVE_OPERATION_FAILURE',
      description: `User ${userContext.userId} failed sensitive operation: ${error.message}`,
      userId: userContext.userId,
      requiresAction: true,
    });
    throw error;
  }
}
```

## Compliance Notes

### HIPAA Compliance
- All unauthorized access attempts are logged in audit logs (immutable)
- Secure deletion meets HIPAA requirements for data disposal
- Security alerts provide accountability and monitoring

### 42 CFR Part 2 Compliance
- Access control enforces minimum necessary access principle
- All access attempts are logged with purpose
- Unauthorized access is immediately denied and logged

### Audit Trail
- All security events are stored in the `audit_logs` table
- Logs are immutable (cannot be updated or deleted)
- Logs include timestamp, user ID, IP address, and device ID
- Logs are retained for minimum 7 years per regulatory requirements
