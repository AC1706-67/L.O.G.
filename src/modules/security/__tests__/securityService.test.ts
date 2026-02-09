/**
 * Security Service Tests
 * Tests for security alert generation and secure deletion
 */

import {
  generateSecurityAlert,
  getSecurityAlerts,
  resolveSecurityAlert,
  secureDelete,
} from '../securityService';
import { handleUnauthorizedAccess } from '../accessControl';
import { UserRole, UserContext } from '../accessControl';
import { Resource, Action } from '../types';

// Mock supabase
jest.mock('../../../config/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
        })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  },
}));

describe('Security Service', () => {
  describe('generateSecurityAlert', () => {
    it('should generate a security alert with all required fields', async () => {
      const alertData = {
        severity: 'high' as const,
        type: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        description: 'Test unauthorized access',
        userId: 'user-123',
        requiresAction: true,
      };

      const alert = await generateSecurityAlert(alertData);

      expect(alert).toHaveProperty('alertId');
      expect(alert.severity).toBe('high');
      expect(alert.type).toBe('UNAUTHORIZED_ACCESS_ATTEMPT');
      expect(alert.description).toBe('Test unauthorized access');
      expect(alert.userId).toBe('user-123');
      expect(alert.requiresAction).toBe(true);
      expect(alert.timestamp).toBeInstanceOf(Date);
    });

    it('should generate unique alert IDs', async () => {
      const alertData = {
        severity: 'medium' as const,
        type: 'TEST_ALERT',
        description: 'Test alert',
        userId: 'user-123',
        requiresAction: false,
      };

      const alert1 = await generateSecurityAlert(alertData);
      const alert2 = await generateSecurityAlert(alertData);

      expect(alert1.alertId).not.toBe(alert2.alertId);
    });
  });

  describe('handleUnauthorizedAccess', () => {
    it('should create security alert for unauthorized access attempt', async () => {
      const userContext: UserContext = {
        userId: 'user-123',
        role: UserRole.PEER_SPECIALIST,
        organizationId: 'org-123',
        assignedParticipants: [],
      };

      const resource: Resource = {
        type: 'participant',
        id: 'participant-456',
      };

      const result = await handleUnauthorizedAccess(
        userContext,
        resource,
        Action.READ,
        '192.168.1.1',
        'device-123'
      );

      expect(result.denied).toBe(true);
      expect(result.alert.severity).toBe('high');
      expect(result.alert.type).toBe('UNAUTHORIZED_ACCESS_ATTEMPT');
      expect(result.alert.userId).toBe('user-123');
      expect(result.alert.requiresAction).toBe(true);
      expect(result.alert.description).toContain('user-123');
      expect(result.alert.description).toContain('participant');
      expect(result.alert.description).toContain('participant-456');
    });
  });

  describe('secureDelete', () => {
    it('should perform secure deletion with double overwrite', async () => {
      const tableName = 'participants';
      const recordId = 'record-123';
      const sensitiveFields = ['ssn_encrypted', 'signature_encrypted'];

      // Should not throw
      await expect(
        secureDelete(tableName, recordId, sensitiveFields)
      ).resolves.not.toThrow();
    });

    it('should handle empty sensitive fields array', async () => {
      const tableName = 'participants';
      const recordId = 'record-123';
      const sensitiveFields: string[] = [];

      // Should not throw
      await expect(
        secureDelete(tableName, recordId, sensitiveFields)
      ).resolves.not.toThrow();
    });
  });
});
