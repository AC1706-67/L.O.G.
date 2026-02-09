/**
 * Session Logger Tests
 * Tests for core logging functions
 */

import {
  logInteraction,
  logPHIAccess,
  logDataChange,
  startSession,
  endSession,
} from '../sessionLogger';
import { InteractionType } from '../types';
import { supabase } from '../../../config/supabase';

// Mock Supabase
jest.mock('../../../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Mock encryption
jest.mock('../../security/encryption', () => ({
  encrypt: jest.fn((data: string) => Promise.resolve(`encrypted_${data}`)),
  decrypt: jest.fn((data: string) => Promise.resolve(data.replace('encrypted_', ''))),
}));

describe('Session Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logInteraction', () => {
    it('should log an interaction with all required fields', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: {}, error: null });
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const interaction = {
        participantId: 'participant-123',
        staffId: 'staff-456',
        interactionType: InteractionType.SESSION_NOTE,
        date: new Date('2024-01-15'),
        time: '14:30',
        duration: 45,
        location: 'Office',
        summary: 'Discussed recovery goals',
        followUpNeeded: true,
        followUpDate: new Date('2024-01-22'),
        linkedGoalId: 'goal-789',
      };

      await logInteraction(interaction);

      expect(supabase.from).toHaveBeenCalledWith('interactions');
      expect(mockInsert).toHaveBeenCalledWith({
        participant_id: 'participant-123',
        staff_id: 'staff-456',
        interaction_type: InteractionType.SESSION_NOTE,
        interaction_date: '2024-01-15',
        interaction_time: '14:30',
        duration_minutes: 45,
        location: 'Office',
        summary: 'Discussed recovery goals',
        follow_up_needed: true,
        follow_up_date: '2024-01-22',
        linked_goal_id: 'goal-789',
      });
    });

    it('should handle optional fields correctly', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: {}, error: null });
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const interaction = {
        participantId: 'participant-123',
        staffId: 'staff-456',
        interactionType: InteractionType.QUICK_NOTE,
        date: new Date('2024-01-15'),
        time: '14:30',
        summary: 'Quick check-in',
        followUpNeeded: false,
      };

      await logInteraction(interaction);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          participant_id: 'participant-123',
          staff_id: 'staff-456',
          summary: 'Quick check-in',
          follow_up_needed: false,
          duration_minutes: undefined,
          location: undefined,
          follow_up_date: undefined,
          linked_goal_id: undefined,
        })
      );
    });
  });

  describe('logPHIAccess', () => {
    it('should log PHI access with all required fields', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: {}, error: null });
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const access = {
        userId: 'user-123',
        participantId: 'participant-456',
        accessType: 'read' as const,
        dataType: 'intake',
        purpose: 'Review participant information',
        timestamp: new Date('2024-01-15T14:30:00Z'),
        ipAddress: '192.168.1.1',
        deviceId: 'device-789',
      };

      await logPHIAccess(access);

      expect(supabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockInsert).toHaveBeenCalledWith({
        log_type: 'PHI_ACCESS',
        user_id: 'user-123',
        participant_id: 'participant-456',
        access_type: 'read',
        data_type: 'intake',
        access_purpose: 'Review participant information',
        ip_address: '192.168.1.1',
        device_id: 'device-789',
        timestamp: '2024-01-15T14:30:00.000Z',
      });
    });
  });

  describe('logDataChange', () => {
    it('should log data changes with encrypted values', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: {}, error: null });
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const change = {
        userId: 'user-123',
        participantId: 'participant-456',
        tableName: 'participants',
        recordId: 'record-789',
        fieldName: 'phone',
        oldValue: '555-1234',
        newValue: '555-5678',
        changeReason: 'Participant updated contact info',
        timestamp: new Date('2024-01-15T14:30:00Z'),
      };

      await logDataChange(change);

      expect(supabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockInsert).toHaveBeenCalledWith({
        log_type: 'DATA_CHANGE',
        user_id: 'user-123',
        participant_id: 'participant-456',
        table_name: 'participants',
        record_id: 'record-789',
        field_name: 'phone',
        old_value_encrypted: 'encrypted_555-1234',
        new_value_encrypted: 'encrypted_555-5678',
        change_reason: 'Participant updated contact info',
        timestamp: '2024-01-15T14:30:00.000Z',
      });
    });
  });

  describe('startSession', () => {
    it('should create a session record and return session ID', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 'session-123' },
          error: null,
        }),
      });
      const mockInsert = jest.fn().mockReturnValue({
        select: mockSelect,
      });
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const session = {
        staffId: 'staff-456',
        participantId: 'participant-789',
        sessionType: 'intake',
        startTime: new Date('2024-01-15T14:30:00Z'),
      };

      const sessionId = await startSession(session);

      expect(sessionId).toBe('session-123');
      expect(supabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockInsert).toHaveBeenCalledWith({
        log_type: 'SESSION',
        user_id: 'staff-456',
        participant_id: 'participant-789',
        session_type: 'intake',
        session_start: '2024-01-15T14:30:00.000Z',
        timestamp: '2024-01-15T14:30:00.000Z',
      });
    });

    it('should handle sessions without participant ID', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 'session-123' },
          error: null,
        }),
      });
      const mockInsert = jest.fn().mockReturnValue({
        select: mockSelect,
      });
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const session = {
        staffId: 'staff-456',
        sessionType: 'administrative',
        startTime: new Date('2024-01-15T14:30:00Z'),
      };

      const sessionId = await startSession(session);

      expect(sessionId).toBe('session-123');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'staff-456',
          participant_id: undefined,
          session_type: 'administrative',
        })
      );
    });
  });

  describe('endSession', () => {
    it('should update session record with end time and summary', async () => {
      const mockEq = jest.fn().mockResolvedValue({ data: {}, error: null });
      const mockEqFirst = jest.fn().mockReturnValue({
        eq: mockEq,
      });
      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockEqFirst,
      });
      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      await endSession('session-123', 'Completed intake session');

      expect(supabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          session_summary: 'Completed intake session',
        })
      );
      expect(mockEqFirst).toHaveBeenCalledWith('id', 'session-123');
      expect(mockEq).toHaveBeenCalledWith('log_type', 'SESSION');
    });
  });
});
