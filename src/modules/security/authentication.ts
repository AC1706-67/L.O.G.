/**
 * Authentication Service
 * Provides MFA verification, password validation, and session timeout monitoring
 * Requirements: 11.1, 9.4, 9.5
 */

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Session information
 */
export interface SessionInfo {
  sessionId: string;
  userId: string;
  lastActivity: Date;
  createdAt: Date;
}

/**
 * MFA verification result
 */
export interface MFAVerificationResult {
  isValid: boolean;
  error?: string;
}

// Session storage (in production, this would be in database or Redis)
const activeSessions: Map<string, SessionInfo> = new Map();

// Session timeout in milliseconds (15 minutes)
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Validates password against complexity requirements
 * Requirements: 9.4
 * 
 * Password must:
 * - Be at least 12 characters long
 * - Contain at least one uppercase letter
 * - Contain at least one lowercase letter
 * - Contain at least one number
 * - Contain at least one special character
 * 
 * @param password - The password to validate
 * @returns Validation result with errors if any
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Check minimum length
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Verifies MFA code
 * Requirements: 11.1
 * 
 * In production, this would integrate with an MFA provider (e.g., TOTP, SMS)
 * For now, this is a placeholder implementation
 * 
 * @param userId - The user ID
 * @param code - The MFA code to verify
 * @returns Verification result
 */
export async function verifyMFA(userId: string, code: string): Promise<MFAVerificationResult> {
  if (!userId) {
    return {
      isValid: false,
      error: 'User ID is required',
    };
  }

  if (!code) {
    return {
      isValid: false,
      error: 'MFA code is required',
    };
  }

  // Validate code format (6 digits)
  if (!/^\d{6}$/.test(code)) {
    return {
      isValid: false,
      error: 'MFA code must be 6 digits',
    };
  }

  // In production, verify against TOTP secret or SMS code
  // For now, accept any 6-digit code as valid
  // TODO: Integrate with actual MFA provider (e.g., Google Authenticator, Authy)
  
  return {
    isValid: true,
  };
}

/**
 * Creates a new session for a user
 * 
 * @param userId - The user ID
 * @returns Session ID
 */
export function createSession(userId: string): string {
  const sessionId = generateSessionId();
  const session: SessionInfo = {
    sessionId,
    userId,
    lastActivity: new Date(),
    createdAt: new Date(),
  };

  activeSessions.set(sessionId, session);
  return sessionId;
}

/**
 * Updates session activity timestamp
 * 
 * @param sessionId - The session ID
 * @returns true if session was updated, false if session not found
 */
export function updateSessionActivity(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return false;
  }

  session.lastActivity = new Date();
  activeSessions.set(sessionId, session);
  return true;
}

/**
 * Checks if a session has timed out
 * Requirements: 9.5
 * 
 * Sessions timeout after 15 minutes of inactivity
 * 
 * @param sessionId - The session ID
 * @returns true if session has timed out, false otherwise
 */
export function checkSessionTimeout(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return true; // Session not found, consider it timed out
  }

  const now = new Date().getTime();
  const lastActivity = session.lastActivity.getTime();
  const timeSinceActivity = now - lastActivity;

  return timeSinceActivity >= SESSION_TIMEOUT_MS;
}

/**
 * Terminates a session
 * 
 * @param sessionId - The session ID
 */
export function terminateSession(sessionId: string): void {
  activeSessions.delete(sessionId);
}

/**
 * Gets session information
 * 
 * @param sessionId - The session ID
 * @returns Session info or null if not found
 */
export function getSession(sessionId: string): SessionInfo | null {
  return activeSessions.get(sessionId) || null;
}

/**
 * Cleans up expired sessions
 * Should be called periodically (e.g., every minute)
 * 
 * @returns Number of sessions cleaned up
 */
export function cleanupExpiredSessions(): number {
  let cleanedCount = 0;

  for (const [sessionId, session] of activeSessions.entries()) {
    const now = new Date().getTime();
    const lastActivity = session.lastActivity.getTime();
    const timeSinceActivity = now - lastActivity;

    if (timeSinceActivity >= SESSION_TIMEOUT_MS) {
      activeSessions.delete(sessionId);
      cleanedCount++;
    }
  }

  return cleanedCount;
}

/**
 * Clears all sessions (for testing purposes)
 */
export function clearAllSessions(): void {
  activeSessions.clear();
}

/**
 * Generates a unique session ID
 * 
 * @returns Session ID
 */
function generateSessionId(): string {
  // In production, use a cryptographically secure random generator
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Gets the session timeout duration in milliseconds
 * 
 * @returns Timeout duration in ms
 */
export function getSessionTimeoutMs(): number {
  return SESSION_TIMEOUT_MS;
}
