/**
 * Property-Based Tests for Session Logger
 * Feature: log-peer-recovery-system
 * Tests universal properties that should hold for all valid inputs
 */

import * as fc from 'fast-check';
import { logInteraction, logPHIAccess, logDataChange, startSession, endSession } from '../sessionLogger';
import { InteractionType, InteractionLog } from '../types';
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

describe('Session Logger - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 18: Interaction logging with required fields
   * For any logged interaction, the record should include participant ID, staff ID, 
   * date, time, interaction type, and summary
   * Validates: Requirements 5.1, 5.3
   */
  test('Feature: log-peer-recovery-system, Property 18: Interaction logging with required fields', async () => {
    // Generator for valid UUIDs
    const uuidArbitrary = fc.uuid();

    // Generator for interaction types
    const interactionTypeArbitrary = fc.constantFrom(
      InteractionType.SESSION_NOTE,
      InteractionType.QUICK_NOTE,
      InteractionType.PHONE_CALL,
      InteractionType.TEXT_MESSAGE,
      InteractionType.OUTREACH_ATTEMPT,
      InteractionType.CRISIS_INTERVENTION,
      InteractionType.HOME_VISIT,
      InteractionType.OFFICE_VISIT,
      InteractionType.FIELD_ENCOUNTER
    );

    // Generator for dates (within reasonable range)
    const dateArbitrary = fc.date({
      min: new Date('2020-01-01'),
      max: new Date('2030-12-31'),
    });

    // Generator for time strings (HH:MM format)
    const timeArbitrary = fc.tuple(
      fc.integer({ min: 0, max: 23 }),
      fc.integer({ min: 0, max: 59 })
    ).map(([hour, minute]) => 
      `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    );

    // Generator for non-empty summary strings
    const summaryArbitrary = fc.string({ minLength: 1, maxLength: 500 });

    // Generator for optional duration (1-480 minutes, or undefined)
    const durationArbitrary = fc.option(
      fc.integer({ min: 1, max: 480 }),
      { nil: undefined }
    );

    // Generator for optional location
    const locationArbitrary = fc.option(
      fc.string({ minLength: 1, maxLength: 100 }),
      { nil: undefined }
    );

    // Generator for follow-up needed flag
    const followUpNeededArbitrary = fc.boolean();

    // Generator for optional follow-up date
    const followUpDateArbitrary = fc.option(dateArbitrary, { nil: undefined });

    // Generator for optional linked goal ID
    const linkedGoalIdArbitrary = fc.option(uuidArbitrary, { nil: undefined });

    // Combined generator for complete InteractionLog
    const interactionLogArbitrary = fc.record({
      participantId: uuidArbitrary,
      staffId: uuidArbitrary,
      interactionType: interactionTypeArbitrary,
      date: dateArbitrary,
      time: timeArbitrary,
      duration: durationArbitrary,
      location: locationArbitrary,
      summary: summaryArbitrary,
      followUpNeeded: followUpNeededArbitrary,
      followUpDate: followUpDateArbitrary,
      linkedGoalId: linkedGoalIdArbitrary,
    }).filter((interaction) => {
      // Filter out invalid dates (NaN)
      if (isNaN(interaction.date.getTime())) {
        return false;
      }
      if (interaction.followUpDate && isNaN(interaction.followUpDate.getTime())) {
        return false;
      }
      // Filter out empty or whitespace-only summaries
      if (!interaction.summary || interaction.summary.trim().length === 0) {
        return false;
      }
      return true;
    });

    await fc.assert(
      fc.asyncProperty(interactionLogArbitrary, async (interaction: InteractionLog) => {
        // Setup mock to capture the insert call
        let capturedInsertData: any = null;
        const mockInsert = jest.fn((data) => {
          capturedInsertData = data;
          return Promise.resolve({ data: {}, error: null });
        });

        (supabase.from as jest.Mock).mockReturnValue({
          insert: mockInsert,
        });

        // Execute the function
        await logInteraction(interaction);

        // Verify that supabase.from was called with 'interactions' table
        expect(supabase.from).toHaveBeenCalledWith('interactions');

        // Verify that insert was called
        expect(mockInsert).toHaveBeenCalled();

        // Property: All required fields must be present in the logged record
        expect(capturedInsertData).toBeDefined();
        expect(capturedInsertData.participant_id).toBe(interaction.participantId);
        expect(capturedInsertData.staff_id).toBe(interaction.staffId);
        expect(capturedInsertData.interaction_type).toBe(interaction.interactionType);
        expect(capturedInsertData.summary).toBe(interaction.summary);

        // Verify date is properly formatted (YYYY-MM-DD)
        expect(capturedInsertData.interaction_date).toBe(
          interaction.date.toISOString().split('T')[0]
        );

        // Verify time is preserved
        expect(capturedInsertData.interaction_time).toBe(interaction.time);

        // Verify optional fields are handled correctly
        expect(capturedInsertData.duration_minutes).toBe(interaction.duration);
        expect(capturedInsertData.location).toBe(interaction.location);
        expect(capturedInsertData.follow_up_needed).toBe(interaction.followUpNeeded);
        
        if (interaction.followUpDate) {
          expect(capturedInsertData.follow_up_date).toBe(
            interaction.followUpDate.toISOString().split('T')[0]
          );
        } else {
          expect(capturedInsertData.follow_up_date).toBeUndefined();
        }

        expect(capturedInsertData.linked_goal_id).toBe(interaction.linkedGoalId);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 19: PHI access logging
   * For any PHI access event, the audit log should record who accessed it, when, and for what purpose
   * Validates: Requirements 5.4
   */
  test('Feature: log-peer-recovery-system, Property 19: PHI access logging', async () => {
    // Generator for valid UUIDs
    const uuidArbitrary = fc.uuid();

    // Generator for access types
    const accessTypeArbitrary = fc.constantFrom('read', 'write', 'delete');

    // Generator for data types (PHI categories)
    const dataTypeArbitrary = fc.constantFrom(
      'intake',
      'assessment',
      'consent',
      'interaction',
      'recovery_plan',
      'participant_demographics',
      'health_information',
      'substance_use_history'
    );

    // Generator for purpose strings (non-empty)
    const purposeArbitrary = fc.string({ minLength: 5, maxLength: 200 });

    // Generator for timestamps (within reasonable range)
    const timestampArbitrary = fc.date({
      min: new Date('2020-01-01'),
      max: new Date('2030-12-31'),
    });

    // Generator for IP addresses (simplified IPv4)
    const ipAddressArbitrary = fc.tuple(
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 })
    ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

    // Generator for device IDs
    const deviceIdArbitrary = fc.string({ minLength: 10, maxLength: 50 });

    // Combined generator for complete PHIAccessLog
    const phiAccessLogArbitrary = fc.record({
      userId: uuidArbitrary,
      participantId: uuidArbitrary,
      accessType: accessTypeArbitrary,
      dataType: dataTypeArbitrary,
      purpose: purposeArbitrary,
      timestamp: timestampArbitrary,
      ipAddress: ipAddressArbitrary,
      deviceId: deviceIdArbitrary,
    }).filter((access) => {
      // Filter out invalid timestamps (NaN)
      if (isNaN(access.timestamp.getTime())) {
        return false;
      }
      // Filter out empty or whitespace-only purposes
      if (!access.purpose || access.purpose.trim().length === 0) {
        return false;
      }
      return true;
    });

    await fc.assert(
      fc.asyncProperty(phiAccessLogArbitrary, async (access) => {
        // Setup mock to capture the insert call
        let capturedInsertData: any = null;
        const mockInsert = jest.fn((data) => {
          capturedInsertData = data;
          return Promise.resolve({ data: {}, error: null });
        });

        (supabase.from as jest.Mock).mockReturnValue({
          insert: mockInsert,
        });

        // Execute the function
        await logPHIAccess(access);

        // Verify that supabase.from was called with 'audit_logs' table
        expect(supabase.from).toHaveBeenCalledWith('audit_logs');

        // Verify that insert was called
        expect(mockInsert).toHaveBeenCalled();

        // Property: All required fields must be present in the logged record
        expect(capturedInsertData).toBeDefined();
        
        // Verify log type is PHI_ACCESS
        expect(capturedInsertData.log_type).toBe('PHI_ACCESS');
        
        // Verify who accessed it (user_id)
        expect(capturedInsertData.user_id).toBe(access.userId);
        
        // Verify which participant's PHI was accessed
        expect(capturedInsertData.participant_id).toBe(access.participantId);
        
        // Verify when it was accessed (timestamp)
        expect(capturedInsertData.timestamp).toBe(access.timestamp.toISOString());
        
        // Verify for what purpose (access_purpose)
        expect(capturedInsertData.access_purpose).toBe(access.purpose);
        
        // Verify access type (read/write/delete)
        expect(capturedInsertData.access_type).toBe(access.accessType);
        
        // Verify data type (what kind of PHI)
        expect(capturedInsertData.data_type).toBe(access.dataType);
        
        // Verify IP address is logged
        expect(capturedInsertData.ip_address).toBe(access.ipAddress);
        
        // Verify device ID is logged
        expect(capturedInsertData.device_id).toBe(access.deviceId);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 20: Data change logging
   * For any data modification, the audit log should record the previous value, new value, 
   * and user who made the change
   * Validates: Requirements 5.5
   */
  test('Feature: log-peer-recovery-system, Property 20: Data change logging', async () => {
    // Generator for valid UUIDs
    const uuidArbitrary = fc.uuid();

    // Generator for table names (common tables in the system)
    const tableNameArbitrary = fc.constantFrom(
      'participants',
      'consents',
      'intake_sessions',
      'assessments',
      'interactions',
      'recovery_plans',
      'goals',
      'progress_notes'
    );

    // Generator for field names (common fields that might be modified)
    const fieldNameArbitrary = fc.constantFrom(
      'phone',
      'email',
      'address',
      'status',
      'summary',
      'description',
      'target_date',
      'notes',
      'rating',
      'score'
    );

    // Generator for field values (strings representing old/new values)
    const fieldValueArbitrary = fc.string({ minLength: 1, maxLength: 200 });

    // Generator for optional change reason
    const changeReasonArbitrary = fc.option(
      fc.string({ minLength: 5, maxLength: 300 }),
      { nil: undefined }
    );

    // Generator for timestamps (within reasonable range)
    const timestampArbitrary = fc.date({
      min: new Date('2020-01-01'),
      max: new Date('2030-12-31'),
    });

    // Combined generator for complete DataChangeLog
    const dataChangeLogArbitrary = fc.record({
      userId: uuidArbitrary,
      participantId: uuidArbitrary,
      tableName: tableNameArbitrary,
      recordId: uuidArbitrary,
      fieldName: fieldNameArbitrary,
      oldValue: fieldValueArbitrary,
      newValue: fieldValueArbitrary,
      changeReason: changeReasonArbitrary,
      timestamp: timestampArbitrary,
    }).filter((change) => {
      // Filter out invalid timestamps (NaN)
      if (isNaN(change.timestamp.getTime())) {
        return false;
      }
      // Filter out cases where old and new values are identical (not a real change)
      if (change.oldValue === change.newValue) {
        return false;
      }
      // Filter out empty or whitespace-only values
      if (!change.oldValue || change.oldValue.trim().length === 0) {
        return false;
      }
      if (!change.newValue || change.newValue.trim().length === 0) {
        return false;
      }
      return true;
    });

    // Import the encryption mock
    const { encrypt } = require('../../security/encryption');

    await fc.assert(
      fc.asyncProperty(dataChangeLogArbitrary, async (change) => {
        // Setup mock to capture the insert call
        let capturedInsertData: any = null;
        const mockInsert = jest.fn((data) => {
          capturedInsertData = data;
          return Promise.resolve({ data: {}, error: null });
        });

        (supabase.from as jest.Mock).mockReturnValue({
          insert: mockInsert,
        });

        // Execute the function
        await logDataChange(change);

        // Verify that supabase.from was called with 'audit_logs' table
        expect(supabase.from).toHaveBeenCalledWith('audit_logs');

        // Verify that insert was called
        expect(mockInsert).toHaveBeenCalled();

        // Property: All required fields must be present in the logged record
        expect(capturedInsertData).toBeDefined();
        
        // Verify log type is DATA_CHANGE
        expect(capturedInsertData.log_type).toBe('DATA_CHANGE');
        
        // Verify user who made the change is recorded
        expect(capturedInsertData.user_id).toBe(change.userId);
        
        // Verify participant ID is recorded
        expect(capturedInsertData.participant_id).toBe(change.participantId);
        
        // Verify table and record information
        expect(capturedInsertData.table_name).toBe(change.tableName);
        expect(capturedInsertData.record_id).toBe(change.recordId);
        expect(capturedInsertData.field_name).toBe(change.fieldName);
        
        // Verify previous value is recorded (encrypted)
        expect(capturedInsertData.old_value_encrypted).toBe(`encrypted_${change.oldValue}`);
        
        // Verify new value is recorded (encrypted)
        expect(capturedInsertData.new_value_encrypted).toBe(`encrypted_${change.newValue}`);
        
        // Verify timestamp is recorded
        expect(capturedInsertData.timestamp).toBe(change.timestamp.toISOString());
        
        // Verify change reason is recorded (if provided)
        expect(capturedInsertData.change_reason).toBe(change.changeReason);
        
        // Verify encryption was called for both old and new values
        expect(encrypt).toHaveBeenCalledWith(change.oldValue, expect.any(String));
        expect(encrypt).toHaveBeenCalledWith(change.newValue, expect.any(String));
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22: Session lifecycle logging
   * For any session, when started, a session record should be created with start time and session type;
   * when ended, the record should be updated with end time and summary
   * Validates: Requirements 5.7, 5.8
   */
  test('Feature: log-peer-recovery-system, Property 22: Session lifecycle logging', async () => {
    // Generator for valid UUIDs
    const uuidArbitrary = fc.uuid();

    // Generator for session types (common session types in the system)
    const sessionTypeArbitrary = fc.constantFrom(
      'intake',
      'assessment',
      'goal_setting',
      'follow_up',
      'crisis_intervention',
      'administrative',
      'consultation',
      'case_review'
    );

    // Generator for start timestamps (within reasonable range)
    const startTimeArbitrary = fc.date({
      min: new Date('2020-01-01'),
      max: new Date('2030-12-31'),
    });

    // Generator for session summaries (non-empty strings)
    const summaryArbitrary = fc.string({ minLength: 10, maxLength: 500 });

    // Generator for optional participant ID (some sessions may not have a participant)
    const optionalParticipantIdArbitrary = fc.option(uuidArbitrary, { nil: undefined });

    // Combined generator for session lifecycle
    const sessionLifecycleArbitrary = fc.record({
      staffId: uuidArbitrary,
      participantId: optionalParticipantIdArbitrary,
      sessionType: sessionTypeArbitrary,
      startTime: startTimeArbitrary,
      summary: summaryArbitrary,
    }).filter((session) => {
      // Filter out invalid timestamps (NaN)
      if (isNaN(session.startTime.getTime())) {
        return false;
      }
      // Filter out empty or whitespace-only summaries
      if (!session.summary || session.summary.trim().length === 0) {
        return false;
      }
      return true;
    });

    await fc.assert(
      fc.asyncProperty(sessionLifecycleArbitrary, async (session) => {
        // Setup mocks for startSession
        let capturedStartData: any = null;
        const mockSessionId = fc.sample(fc.uuid(), 1)[0];
        
        const mockSelectSingle = jest.fn().mockResolvedValue({
          data: { id: mockSessionId },
          error: null,
        });
        
        const mockSelect = jest.fn().mockReturnValue({
          single: mockSelectSingle,
        });
        
        const mockInsert = jest.fn((data) => {
          capturedStartData = data;
          return {
            select: mockSelect,
          };
        });

        // Setup mocks for endSession
        let capturedEndData: any = null;
        const mockEqSecond = jest.fn().mockResolvedValue({ data: {}, error: null });
        const mockEqFirst = jest.fn().mockReturnValue({
          eq: mockEqSecond,
        });
        const mockUpdate = jest.fn((data) => {
          capturedEndData = data;
          return {
            eq: mockEqFirst,
          };
        });

        // Mock supabase.from to return appropriate methods based on call order
        let callCount = 0;
        (supabase.from as jest.Mock).mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // First call is for startSession (insert)
            return { insert: mockInsert };
          } else {
            // Second call is for endSession (update)
            return { update: mockUpdate };
          }
        });

        // Execute startSession
        const sessionId = await startSession({
          staffId: session.staffId,
          participantId: session.participantId,
          sessionType: session.sessionType,
          startTime: session.startTime,
        });

        // Property Part 1: When session is started, a record should be created with start time and session type
        
        // Verify that supabase.from was called with 'audit_logs' table
        expect(supabase.from).toHaveBeenCalledWith('audit_logs');
        
        // Verify that insert was called
        expect(mockInsert).toHaveBeenCalled();
        
        // Verify session ID was returned
        expect(sessionId).toBe(mockSessionId);
        
        // Verify all required fields are present in the session start record
        expect(capturedStartData).toBeDefined();
        expect(capturedStartData.log_type).toBe('SESSION');
        expect(capturedStartData.user_id).toBe(session.staffId);
        expect(capturedStartData.participant_id).toBe(session.participantId);
        expect(capturedStartData.session_type).toBe(session.sessionType);
        expect(capturedStartData.session_start).toBe(session.startTime.toISOString());
        expect(capturedStartData.timestamp).toBe(session.startTime.toISOString());
        
        // Execute endSession
        await endSession(sessionId, session.summary);

        // Property Part 2: When session is ended, the record should be updated with end time and summary
        
        // Verify that supabase.from was called again with 'audit_logs' table
        expect(supabase.from).toHaveBeenCalledWith('audit_logs');
        
        // Verify that update was called
        expect(mockUpdate).toHaveBeenCalled();
        
        // Verify the update includes end time and summary
        expect(capturedEndData).toBeDefined();
        expect(capturedEndData.session_end).toBeDefined();
        expect(capturedEndData.session_summary).toBe(session.summary);
        
        // Verify the update targets the correct session ID
        expect(mockEqFirst).toHaveBeenCalledWith('id', sessionId);
        expect(mockEqSecond).toHaveBeenCalledWith('log_type', 'SESSION');
        
        // Verify that session_end is a valid ISO timestamp
        const endTime = new Date(capturedEndData.session_end);
        expect(endTime.getTime()).not.toBeNaN();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 21: Log encryption
   * For any audit log entry stored in the database, the entry should be encrypted before storage
   * Validates: Requirements 5.6
   */
  test('Feature: log-peer-recovery-system, Property 21: Log encryption', async () => {
    // Generator for valid UUIDs
    const uuidArbitrary = fc.uuid();

    // Generator for log types
    const logTypeArbitrary = fc.constantFrom(
      'PHI_ACCESS',
      'DATA_CHANGE',
      'SESSION',
      'SECURITY_EVENT'
    );

    // Generator for sensitive data that should be encrypted
    const sensitiveDataArbitrary = fc.string({ minLength: 1, maxLength: 500 });

    // Generator for timestamps (within reasonable range)
    const timestampArbitrary = fc.date({
      min: new Date('2020-01-01'),
      max: new Date('2030-12-31'),
    });

    // Generator for table names
    const tableNameArbitrary = fc.constantFrom(
      'participants',
      'consents',
      'assessments',
      'interactions',
      'recovery_plans'
    );

    // Generator for field names
    const fieldNameArbitrary = fc.constantFrom(
      'phone',
      'email',
      'address',
      'ssn',
      'notes',
      'summary'
    );

    // Combined generator for audit log entries with sensitive data
    const auditLogArbitrary = fc.record({
      userId: uuidArbitrary,
      participantId: uuidArbitrary,
      logType: logTypeArbitrary,
      timestamp: timestampArbitrary,
      // For DATA_CHANGE logs
      tableName: tableNameArbitrary,
      recordId: uuidArbitrary,
      fieldName: fieldNameArbitrary,
      oldValue: sensitiveDataArbitrary,
      newValue: sensitiveDataArbitrary,
      changeReason: fc.option(fc.string({ minLength: 5, maxLength: 200 }), { nil: undefined }),
    }).filter((log) => {
      // Filter out invalid timestamps
      if (isNaN(log.timestamp.getTime())) {
        return false;
      }
      // Filter out empty values
      if (!log.oldValue || log.oldValue.trim().length === 0) {
        return false;
      }
      if (!log.newValue || log.newValue.trim().length === 0) {
        return false;
      }
      // Filter out cases where old and new values are identical
      if (log.oldValue === log.newValue) {
        return false;
      }
      return true;
    });

    // Import the encryption mock
    const { encrypt } = require('../../security/encryption');

    await fc.assert(
      fc.asyncProperty(auditLogArbitrary, async (log) => {
        // Setup mock to capture the insert call
        let capturedInsertData: any = null;
        const mockInsert = jest.fn((data) => {
          capturedInsertData = data;
          return Promise.resolve({ data: {}, error: null });
        });

        (supabase.from as jest.Mock).mockReturnValue({
          insert: mockInsert,
        });

        // Create a DataChangeLog from the generated data
        const dataChangeLog = {
          userId: log.userId,
          participantId: log.participantId,
          tableName: log.tableName,
          recordId: log.recordId,
          fieldName: log.fieldName,
          oldValue: log.oldValue,
          newValue: log.newValue,
          changeReason: log.changeReason,
          timestamp: log.timestamp,
        };

        // Execute the function (logDataChange encrypts sensitive values)
        await logDataChange(dataChangeLog);

        // Verify that supabase.from was called with 'audit_logs' table
        expect(supabase.from).toHaveBeenCalledWith('audit_logs');

        // Verify that insert was called
        expect(mockInsert).toHaveBeenCalled();

        // Property: Sensitive data in audit logs must be encrypted before storage
        expect(capturedInsertData).toBeDefined();
        
        // Verify that old_value_encrypted is present and encrypted
        expect(capturedInsertData.old_value_encrypted).toBeDefined();
        expect(capturedInsertData.old_value_encrypted).toBe(`encrypted_${log.oldValue}`);
        
        // Verify that new_value_encrypted is present and encrypted
        expect(capturedInsertData.new_value_encrypted).toBeDefined();
        expect(capturedInsertData.new_value_encrypted).toBe(`encrypted_${log.newValue}`);
        
        // Verify that the original unencrypted values are NOT stored
        expect(capturedInsertData.old_value).toBeUndefined();
        expect(capturedInsertData.new_value).toBeUndefined();
        
        // Verify that encryption was called with the correct DataType
        expect(encrypt).toHaveBeenCalledWith(log.oldValue, expect.any(String));
        expect(encrypt).toHaveBeenCalledWith(log.newValue, expect.any(String));
        
        // Verify that the encrypted values are different from the original values
        // (unless the mock returns the same value, which it doesn't in our case)
        expect(capturedInsertData.old_value_encrypted).not.toBe(log.oldValue);
        expect(capturedInsertData.new_value_encrypted).not.toBe(log.newValue);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 23: Follow-up tracking
   * For any interaction where follow-up is needed, the system should record the follow-up flag,
   * follow-up date, and linked goal ID if applicable
   * Validates: Requirements 5.9
   */
  test('Feature: log-peer-recovery-system, Property 23: Follow-up tracking', async () => {
    // Generator for valid UUIDs
    const uuidArbitrary = fc.uuid();

    // Generator for interaction types
    const interactionTypeArbitrary = fc.constantFrom(
      InteractionType.SESSION_NOTE,
      InteractionType.QUICK_NOTE,
      InteractionType.PHONE_CALL,
      InteractionType.TEXT_MESSAGE,
      InteractionType.OUTREACH_ATTEMPT,
      InteractionType.CRISIS_INTERVENTION,
      InteractionType.HOME_VISIT,
      InteractionType.OFFICE_VISIT,
      InteractionType.FIELD_ENCOUNTER
    );

    // Generator for dates (within reasonable range)
    const dateArbitrary = fc.date({
      min: new Date('2020-01-01'),
      max: new Date('2030-12-31'),
    });

    // Generator for time strings (HH:MM format)
    const timeArbitrary = fc.tuple(
      fc.integer({ min: 0, max: 23 }),
      fc.integer({ min: 0, max: 59 })
    ).map(([hour, minute]) => 
      `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    );

    // Generator for non-empty summary strings
    const summaryArbitrary = fc.string({ minLength: 1, maxLength: 500 });

    // Generator for optional duration (1-480 minutes, or undefined)
    const durationArbitrary = fc.option(
      fc.integer({ min: 1, max: 480 }),
      { nil: undefined }
    );

    // Generator for optional location
    const locationArbitrary = fc.option(
      fc.string({ minLength: 1, maxLength: 100 }),
      { nil: undefined }
    );

    // Generator for follow-up date (must be in the future relative to interaction date)
    const followUpDateArbitrary = fc.date({
      min: new Date('2020-01-02'),
      max: new Date('2031-12-31'),
    });

    // Generator for optional linked goal ID
    const linkedGoalIdArbitrary = fc.option(uuidArbitrary, { nil: undefined });

    // Combined generator for InteractionLog with follow-up needed
    const interactionWithFollowUpArbitrary = fc.record({
      participantId: uuidArbitrary,
      staffId: uuidArbitrary,
      interactionType: interactionTypeArbitrary,
      date: dateArbitrary,
      time: timeArbitrary,
      duration: durationArbitrary,
      location: locationArbitrary,
      summary: summaryArbitrary,
      followUpNeeded: fc.constant(true), // Always true for this property test
      followUpDate: followUpDateArbitrary,
      linkedGoalId: linkedGoalIdArbitrary,
    }).filter((interaction) => {
      // Filter out invalid dates (NaN)
      if (isNaN(interaction.date.getTime())) {
        return false;
      }
      if (isNaN(interaction.followUpDate.getTime())) {
        return false;
      }
      // Filter out empty or whitespace-only summaries
      if (!interaction.summary || interaction.summary.trim().length === 0) {
        return false;
      }
      // Filter out cases where follow-up date is before interaction date
      if (interaction.followUpDate <= interaction.date) {
        return false;
      }
      return true;
    });

    await fc.assert(
      fc.asyncProperty(interactionWithFollowUpArbitrary, async (interaction: InteractionLog) => {
        // Setup mock to capture the insert call
        let capturedInsertData: any = null;
        const mockInsert = jest.fn((data) => {
          capturedInsertData = data;
          return Promise.resolve({ data: {}, error: null });
        });

        (supabase.from as jest.Mock).mockReturnValue({
          insert: mockInsert,
        });

        // Execute the function
        await logInteraction(interaction);

        // Verify that supabase.from was called with 'interactions' table
        expect(supabase.from).toHaveBeenCalledWith('interactions');

        // Verify that insert was called
        expect(mockInsert).toHaveBeenCalled();

        // Property: For any interaction where follow-up is needed, the system should record:
        // 1. The follow-up flag
        // 2. The follow-up date
        // 3. The linked goal ID (if applicable)
        
        expect(capturedInsertData).toBeDefined();
        
        // Verify follow-up flag is recorded and set to true
        expect(capturedInsertData.follow_up_needed).toBe(true);
        expect(capturedInsertData.follow_up_needed).toBe(interaction.followUpNeeded);
        
        // Verify follow-up date is recorded and properly formatted (YYYY-MM-DD)
        expect(capturedInsertData.follow_up_date).toBeDefined();
        expect(capturedInsertData.follow_up_date).toBe(
          interaction.followUpDate.toISOString().split('T')[0]
        );
        
        // Verify the follow-up date is a valid date string
        const parsedFollowUpDate = new Date(capturedInsertData.follow_up_date);
        expect(parsedFollowUpDate.getTime()).not.toBeNaN();
        
        // Verify linked goal ID is recorded (if provided)
        if (interaction.linkedGoalId) {
          expect(capturedInsertData.linked_goal_id).toBe(interaction.linkedGoalId);
          // Verify it's a valid UUID format
          expect(capturedInsertData.linked_goal_id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          );
        } else {
          // If no linked goal ID provided, it should be undefined or null
          expect(capturedInsertData.linked_goal_id).toBeUndefined();
        }
        
        // Verify all three components are present when follow-up is needed
        expect(capturedInsertData.follow_up_needed).toBe(true);
        expect(capturedInsertData.follow_up_date).toBeDefined();
        // linked_goal_id is optional but should be handled correctly
        
        // Additional verification: ensure the follow-up date is after the interaction date
        const interactionDate = new Date(capturedInsertData.interaction_date);
        const followUpDate = new Date(capturedInsertData.follow_up_date);
        expect(followUpDate.getTime()).toBeGreaterThan(interactionDate.getTime());
      }),
      { numRuns: 100 }
    );
  });
});
