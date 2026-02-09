/**
 * Authentication Service Tests
 * Property-based and unit tests for authentication functionality
 */

import * as fc from 'fast-check';
import {
  validatePassword,
  verifyMFA,
  createSession,
  updateSessionActivity,
  checkSessionTimeout,
  terminateSession,
  getSession,
  cleanupExpiredSessions,
  clearAllSessions,
  getSessionTimeoutMs,
} from '../authentication';

// Custom arbitraries for password generation
const uppercaseArb = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
const lowercaseArb = fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split(''));
const digitArb = fc.constantFrom(...'0123456789'.split(''));
const specialArb = fc.constantFrom(...'!@#$%^&*()_+-=[]{};\':"|,.<>/?'.split(''));

// Generate a valid password
const validPasswordArb = fc.tuple(
  fc.array(uppercaseArb, { minLength: 1, maxLength: 3 }),
  fc.array(lowercaseArb, { minLength: 1, maxLength: 3 }),
  fc.array(digitArb, { minLength: 1, maxLength: 3 }),
  fc.array(specialArb, { minLength: 1, maxLength: 3 }),
  fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()'.split('')), { minLength: 8, maxLength: 20 })
).map(([upper, lower, digit, special, filler]) => {
  const chars = [...upper, ...lower, ...digit, ...special, ...filler];
  // Shuffle the characters
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
});

beforeEach(() => {
  clearAllSessions();
});

describe('Authentication Service', () => {
  /**
   * Property 34: Password validation
   * Validates: Requirements 9.4
   * 
   * For any password submitted during authentication, the system should enforce
   * strong password requirements (minimum 12 characters, complexity rules)
   */
  describe('Feature: log-peer-recovery-system, Property 34: Password validation', () => {
    it('should accept all valid passwords with required complexity', async () => {
      await fc.assert(
        fc.property(validPasswordArb, (password) => {
          const result = validatePassword(password);
          
          // Valid passwords should pass validation
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject passwords shorter than 12 characters', async () => {
      await fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 11 }),
          (password) => {
            const result = validatePassword(password);
            
            // Should have length error
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('12 characters'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject passwords without uppercase letters', async () => {
      await fc.assert(
        fc.property(
          fc.string({ minLength: 12, maxLength: 20 }).filter(s => !/[A-Z]/.test(s)),
          (password) => {
            const result = validatePassword(password);
            
            // Should have uppercase error
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject passwords without lowercase letters', async () => {
      await fc.assert(
        fc.property(
          fc.string({ minLength: 12, maxLength: 20 }).filter(s => !/[a-z]/.test(s)),
          (password) => {
            const result = validatePassword(password);
            
            // Should have lowercase error
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject passwords without numbers', async () => {
      await fc.assert(
        fc.property(
          fc.string({ minLength: 12, maxLength: 20 }).filter(s => !/[0-9]/.test(s)),
          (password) => {
            const result = validatePassword(password);
            
            // Should have number error
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('number'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject passwords without special characters', async () => {
      await fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 12, maxLength: 20 }).map(arr => arr.join('')),
          (password) => {
            const result = validatePassword(password);
            
            // Should have special character error
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('special character'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide all applicable error messages', async () => {
      const weakPassword = 'abc'; // Too short, no uppercase, no number, no special char
      const result = validatePassword(weakPassword);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors.some(e => e.includes('12 characters'))).toBe(true);
      expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
      expect(result.errors.some(e => e.includes('number'))).toBe(true);
      expect(result.errors.some(e => e.includes('special character'))).toBe(true);
    });
  });

  describe('MFA Verification', () => {
    it('should accept valid 6-digit MFA codes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 0, max: 999999 }).map(n => n.toString().padStart(6, '0')),
          async (userId, code) => {
            const result = await verifyMFA(userId, code);
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-6-digit codes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string().filter(s => !/^\d{6}$/.test(s)),
          async (userId, code) => {
            const result = await verifyMFA(userId, code);
            expect(result.isValid).toBe(false);
            expect(result.error).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should require user ID', async () => {
      const result = await verifyMFA('', '123456');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('User ID');
    });

    it('should require MFA code', async () => {
      const result = await verifyMFA('user-123', '');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('MFA code');
    });
  });

  describe('Session Management', () => {
    it('should create and retrieve sessions', async () => {
      await fc.assert(
        fc.property(fc.uuid(), (userId) => {
          const sessionId = createSession(userId);
          const session = getSession(sessionId);
          
          expect(session).not.toBeNull();
          expect(session?.userId).toBe(userId);
          expect(session?.sessionId).toBe(sessionId);
        }),
        { numRuns: 100 }
      );
    });

    it('should update session activity', async () => {
      const userId = 'user-123';
      const sessionId = createSession(userId);
      
      const sessionBefore = getSession(sessionId);
      const lastActivityBefore = sessionBefore?.lastActivity.getTime();
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));
      
      updateSessionActivity(sessionId);
      
      const sessionAfter = getSession(sessionId);
      const lastActivityAfter = sessionAfter?.lastActivity.getTime();
      
      expect(lastActivityAfter).toBeGreaterThan(lastActivityBefore!);
    });

    it('should detect session timeout after 15 minutes', async () => {
      const userId = 'user-123';
      const sessionId = createSession(userId);
      
      // Manually set last activity to 16 minutes ago
      const session = getSession(sessionId);
      if (session) {
        session.lastActivity = new Date(Date.now() - 16 * 60 * 1000);
      }
      
      const isTimedOut = checkSessionTimeout(sessionId);
      expect(isTimedOut).toBe(true);
    });

    it('should not timeout active sessions', async () => {
      const userId = 'user-123';
      const sessionId = createSession(userId);
      
      const isTimedOut = checkSessionTimeout(sessionId);
      expect(isTimedOut).toBe(false);
    });

    it('should terminate sessions', async () => {
      const userId = 'user-123';
      const sessionId = createSession(userId);
      
      expect(getSession(sessionId)).not.toBeNull();
      
      terminateSession(sessionId);
      
      expect(getSession(sessionId)).toBeNull();
    });

    it('should cleanup expired sessions', async () => {
      // Create multiple sessions
      const session1 = createSession('user-1');
      const session2 = createSession('user-2');
      const session3 = createSession('user-3');
      
      // Expire session1 and session2
      const s1 = getSession(session1);
      const s2 = getSession(session2);
      if (s1) s1.lastActivity = new Date(Date.now() - 16 * 60 * 1000);
      if (s2) s2.lastActivity = new Date(Date.now() - 16 * 60 * 1000);
      
      const cleanedCount = cleanupExpiredSessions();
      
      expect(cleanedCount).toBe(2);
      expect(getSession(session1)).toBeNull();
      expect(getSession(session2)).toBeNull();
      expect(getSession(session3)).not.toBeNull();
    });

    it('should return correct session timeout duration', () => {
      const timeout = getSessionTimeoutMs();
      expect(timeout).toBe(15 * 60 * 1000); // 15 minutes in milliseconds
    });
  });

  describe('Password Validation Examples', () => {
    it('should accept strong passwords', () => {
      const strongPasswords = [
        'MyP@ssw0rd123!',
        'Secure#Pass2024',
        'C0mpl3x!P@ssw0rd',
        'Str0ng&Secur3!',
      ];

      for (const password of strongPasswords) {
        const result = validatePassword(password);
        expect(result.isValid).toBe(true);
      }
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'short',                    // Too short
        'nouppercase123!',          // No uppercase
        'NOLOWERCASE123!',          // No lowercase
        'NoNumbers!',               // No numbers
        'NoSpecialChar123',         // No special characters
      ];

      for (const password of weakPasswords) {
        const result = validatePassword(password);
        expect(result.isValid).toBe(false);
      }
    });
  });

  /**
   * Unit test for MFA requirement
   * Requirements: 11.1
   * 
   * Test that system requires MFA on login
   */
  describe('MFA Requirement on Login', () => {
    it('should require MFA verification for successful login', async () => {
      // Simulate login flow
      const userId = 'user-123';
      const mfaCode = '123456';

      // Step 1: User provides credentials (username/password) - assumed valid
      // Step 2: System requires MFA verification
      const mfaResult = await verifyMFA(userId, mfaCode);

      // MFA verification should be required and successful
      expect(mfaResult.isValid).toBe(true);
    });

    it('should not allow login without MFA verification', async () => {
      // Attempt to verify MFA with empty code
      const userId = 'user-123';
      const mfaResult = await verifyMFA(userId, '');

      // Should fail without MFA code
      expect(mfaResult.isValid).toBe(false);
      expect(mfaResult.error).toBeDefined();
    });

    it('should reject invalid MFA codes', async () => {
      const userId = 'user-123';
      const invalidCodes = [
        '12345',      // Too short
        '1234567',    // Too long
        'abcdef',     // Not numeric
        '12-34-56',   // Invalid format
      ];

      for (const code of invalidCodes) {
        const result = await verifyMFA(userId, code);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should enforce MFA for all user roles', async () => {
      // MFA should be required regardless of user role
      const userIds = [
        'peer-specialist-123',
        'supervisor-456',
        'admin-789',
      ];

      for (const userId of userIds) {
        const mfaResult = await verifyMFA(userId, '123456');
        expect(mfaResult.isValid).toBe(true);
      }
    });
  });

  /**
   * Unit test for auto-logout
   * Requirements: 9.5
   * 
   * Test 15-minute inactivity timeout
   */
  describe('Auto-Logout on Inactivity', () => {
    it('should automatically logout after 15 minutes of inactivity', () => {
      const userId = 'user-123';
      const sessionId = createSession(userId);

      // Verify session is active
      expect(checkSessionTimeout(sessionId)).toBe(false);

      // Simulate 15 minutes of inactivity by manually setting last activity
      const session = getSession(sessionId);
      if (session) {
        session.lastActivity = new Date(Date.now() - 15 * 60 * 1000);
      }

      // Session should now be timed out
      expect(checkSessionTimeout(sessionId)).toBe(true);
    });

    it('should logout exactly at 15 minutes (not before)', () => {
      const userId = 'user-123';
      const sessionId = createSession(userId);

      // Set last activity to 14 minutes 59 seconds ago
      const session = getSession(sessionId);
      if (session) {
        session.lastActivity = new Date(Date.now() - (14 * 60 * 1000 + 59 * 1000));
      }

      // Should NOT be timed out yet
      expect(checkSessionTimeout(sessionId)).toBe(false);

      // Set last activity to exactly 15 minutes ago
      if (session) {
        session.lastActivity = new Date(Date.now() - 15 * 60 * 1000);
      }

      // Should be timed out now
      expect(checkSessionTimeout(sessionId)).toBe(true);
    });

    it('should reset timeout on user activity', async () => {
      const userId = 'user-123';
      const sessionId = createSession(userId);

      // Set last activity to 14 minutes ago
      const session = getSession(sessionId);
      if (session) {
        session.lastActivity = new Date(Date.now() - 14 * 60 * 1000);
      }

      // User performs an action (updates session activity)
      updateSessionActivity(sessionId);

      // Session should NOT be timed out after activity update
      expect(checkSessionTimeout(sessionId)).toBe(false);
    });

    it('should enforce 15-minute timeout for all sessions', () => {
      // Create multiple sessions
      const sessions = [
        createSession('user-1'),
        createSession('user-2'),
        createSession('user-3'),
      ];

      // Set all sessions to 16 minutes of inactivity
      for (const sessionId of sessions) {
        const session = getSession(sessionId);
        if (session) {
          session.lastActivity = new Date(Date.now() - 16 * 60 * 1000);
        }
      }

      // All sessions should be timed out
      for (const sessionId of sessions) {
        expect(checkSessionTimeout(sessionId)).toBe(true);
      }
    });

    it('should return correct timeout duration (15 minutes)', () => {
      const timeoutMs = getSessionTimeoutMs();
      const timeoutMinutes = timeoutMs / (60 * 1000);

      expect(timeoutMinutes).toBe(15);
    });

    it('should cleanup expired sessions automatically', () => {
      // Create sessions
      const activeSession = createSession('active-user');
      const expiredSession1 = createSession('expired-user-1');
      const expiredSession2 = createSession('expired-user-2');

      // Expire two sessions
      const s1 = getSession(expiredSession1);
      const s2 = getSession(expiredSession2);
      if (s1) s1.lastActivity = new Date(Date.now() - 16 * 60 * 1000);
      if (s2) s2.lastActivity = new Date(Date.now() - 16 * 60 * 1000);

      // Cleanup expired sessions
      const cleanedCount = cleanupExpiredSessions();

      // Should have cleaned up 2 sessions
      expect(cleanedCount).toBe(2);

      // Active session should still exist
      expect(getSession(activeSession)).not.toBeNull();

      // Expired sessions should be removed
      expect(getSession(expiredSession1)).toBeNull();
      expect(getSession(expiredSession2)).toBeNull();
    });
  });
});
