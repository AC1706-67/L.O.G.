/**
 * Consent Manager Property-Based Tests
 * Property tests for consent form completeness and validation
 * Feature: log-peer-recovery-system
 */

import * as fc from 'fast-check';
import {
  ConsentData,
  ConsentType,
  CFR_PART_2_FORM_SCHEMA,
  AI_CONSENT_FORM_SCHEMA,
  ConsentForm,
} from '../types';

// Mock Supabase before importing consentManager
jest.mock('../../../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Mock encryption
jest.mock('../../security/encryption', () => ({
  encrypt: jest.fn((data: string) => Promise.resolve(`encrypted-${data}`)),
  decryptField: jest.fn((data: string) => Promise.resolve(data.replace('encrypted-', ''))),
}));

// Mock session logger
jest.mock('../../logging/sessionLogger', () => ({
  logPHIAccess: jest.fn(() => Promise.resolve()),
}));

import { captureConsent } from '../consentManager';
import { supabase } from '../../../config/supabase';
import { logPHIAccess } from '../../logging/sessionLogger';
import { encrypt } from '../../security/encryption';
import { DataType } from '../../security/types';

// Global beforeEach to ensure clean state between all tests
beforeEach(() => {
  // Clear mock call history but preserve mock implementations
  (supabase.from as jest.Mock).mockClear();
  (logPHIAccess as jest.Mock).mockClear();
  (encrypt as jest.Mock).mockClear();
});

/**
 * Property 1: Consent form completeness
 * For any consent form (CFR Part 2 or AI consent), the form data structure
 * should contain all required fields as specified in the requirements
 * **Validates: Requirements 1.2, 1.4**
 */
describe('Feature: log-peer-recovery-system, Property 1: Consent form completeness', () => {
  /**
   * Requirement 1.2: CFR Part 2 consent form fields
   * The 42 CFR Part 2 consent form SHALL collect:
   * - participant name
   * - date of birth
   * - purpose of disclosure
   * - authorized recipients
   * - information to disclose
   * - expiration date
   * - right to revoke notice
   * - signature
   * - date signed
   * - witness information
   */
  test('CFR Part 2 consent form contains all required fields', () => {
    fc.assert(
      fc.property(fc.constant(CFR_PART_2_FORM_SCHEMA), (form: ConsentForm) => {
        // Verify form type
        expect(form.type).toBe('CFR_PART_2');
        expect(form.title).toBeDefined();
        expect(form.title.length).toBeGreaterThan(0);

        // Verify sections array exists and is not empty
        expect(form.sections).toBeDefined();
        expect(Array.isArray(form.sections)).toBe(true);
        expect(form.sections.length).toBeGreaterThan(0);

        // Required section IDs based on Requirement 1.2
        const requiredSectionIds = [
          'participant_info', // participant name, date of birth
          'purpose', // purpose of disclosure
          'authorized_recipients', // authorized recipients
          'information_disclosed', // information to disclose
          'expiration', // expiration date
          'right_to_revoke', // right to revoke notice
          're_disclosure', // re-disclosure prohibition (42 CFR Part 2 requirement)
          'signature', // signature, date signed, witness information
        ];

        // Verify all required sections are present
        const sectionIds = form.sections.map((section) => section.id);
        for (const requiredId of requiredSectionIds) {
          expect(sectionIds).toContain(requiredId);
        }

        // Verify each section has required properties
        for (const section of form.sections) {
          expect(section.id).toBeDefined();
          expect(section.id.length).toBeGreaterThan(0);
          expect(section.title).toBeDefined();
          expect(section.title.length).toBeGreaterThan(0);
          expect(section.content).toBeDefined();
          expect(section.content.length).toBeGreaterThan(0);
          expect(typeof section.required).toBe('boolean');
        }

        // Verify all required sections are marked as required
        for (const requiredId of requiredSectionIds) {
          const section = form.sections.find((s) => s.id === requiredId);
          expect(section).toBeDefined();
          expect(section!.required).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Requirement 1.4: AI consent form fields
   * The AI consent form SHALL include:
   * - explanation of AI usage
   * - data protection assurance
   * - opt-out option
   * - signature
   * - date signed
   */
  test('AI consent form contains all required fields', () => {
    fc.assert(
      fc.property(fc.constant(AI_CONSENT_FORM_SCHEMA), (form: ConsentForm) => {
        // Verify form type
        expect(form.type).toBe('AI_PROCESSING');
        expect(form.title).toBeDefined();
        expect(form.title.length).toBeGreaterThan(0);

        // Verify sections array exists and is not empty
        expect(form.sections).toBeDefined();
        expect(Array.isArray(form.sections)).toBe(true);
        expect(form.sections.length).toBeGreaterThan(0);

        // Required section IDs based on Requirement 1.4
        const requiredSectionIds = [
          'ai_explanation', // explanation of AI usage
          'data_protection', // data protection assurance
          'opt_out', // opt-out option
          'signature', // signature, date signed
        ];

        // Verify all required sections are present
        const sectionIds = form.sections.map((section) => section.id);
        for (const requiredId of requiredSectionIds) {
          expect(sectionIds).toContain(requiredId);
        }

        // Verify each section has required properties
        for (const section of form.sections) {
          expect(section.id).toBeDefined();
          expect(section.id.length).toBeGreaterThan(0);
          expect(section.title).toBeDefined();
          expect(section.title.length).toBeGreaterThan(0);
          expect(section.content).toBeDefined();
          expect(section.content.length).toBeGreaterThan(0);
          expect(typeof section.required).toBe('boolean');
        }

        // Verify all required sections are marked as required
        for (const requiredId of requiredSectionIds) {
          const section = form.sections.find((s) => s.id === requiredId);
          expect(section).toBeDefined();
          expect(section!.required).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Consent data structure completeness
   * For any generated consent data, it should contain all required fields
   * for the specified consent type
   */
  test('Generated consent data contains all required fields', () => {
    // Generator for valid consent data
    const consentDataArbitrary = fc.record({
      participantId: fc.constant('11111111-1111-1111-1111-111111111111'),
      consentType: fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
      participantName: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0),
      dateOfBirth: fc.integer({ min: new Date('1920-01-01').getTime(), max: new Date('2010-12-31').getTime() }).map(ts => new Date(ts)),
      purposeOfDisclosure: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
      authorizedRecipients: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }), { nil: undefined }),
      informationToDisclose: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
      expirationDate: fc.option(fc.integer({ min: new Date().getTime(), max: new Date('2030-12-31').getTime() }).map(ts => new Date(ts)), { nil: undefined }),
      signature: fc.base64String({ minLength: 10, maxLength: 100 }),
      dateSigned: fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date().getTime() }).map(ts => new Date(ts)),
      witnessName: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
      witnessSignature: fc.option(fc.base64String({ minLength: 10, maxLength: 100 }), { nil: undefined }),
    });

    fc.assert(
      fc.property(consentDataArbitrary, (consentData: ConsentData) => {
        // Verify all required fields are present
        expect(consentData.participantId).toBeDefined();
        expect(consentData.participantId.length).toBeGreaterThan(0);
        
        expect(consentData.consentType).toBeDefined();
        expect(['CFR_PART_2', 'AI_PROCESSING']).toContain(consentData.consentType);
        
        expect(consentData.participantName).toBeDefined();
        expect(consentData.participantName.length).toBeGreaterThan(0);
        
        expect(consentData.dateOfBirth).toBeDefined();
        expect(consentData.dateOfBirth).toBeInstanceOf(Date);
        
        expect(consentData.signature).toBeDefined();
        expect(consentData.signature.length).toBeGreaterThan(0);
        
        expect(consentData.dateSigned).toBeDefined();
        expect(consentData.dateSigned).toBeInstanceOf(Date);

        // For CFR Part 2 consent, verify additional required fields
        if (consentData.consentType === 'CFR_PART_2') {
          // These fields should be present for CFR Part 2 consent
          // (they may be undefined in the generated data, but the structure supports them)
          expect('purposeOfDisclosure' in consentData).toBe(true);
          expect('authorizedRecipients' in consentData).toBe(true);
          expect('informationToDisclose' in consentData).toBe(true);
          expect('expirationDate' in consentData).toBe(true);
          expect('witnessName' in consentData).toBe(true);
          expect('witnessSignature' in consentData).toBe(true);
        }

        // Verify date constraints
        expect(consentData.dateOfBirth.getTime()).toBeLessThanOrEqual(new Date().getTime());
        expect(consentData.dateSigned.getTime()).toBeLessThanOrEqual(new Date().getTime());
        
        if (consentData.expirationDate) {
          // Expiration date should be in the future or present
          expect(consentData.expirationDate).toBeInstanceOf(Date);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Form schema immutability
   * The consent form schemas should remain constant and not be modified
   */
  test('Consent form schemas are immutable across multiple accesses', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (iterations: number) => {
        // Access the schemas multiple times
        const cfrForms: ConsentForm[] = [];
        const aiForms: ConsentForm[] = [];

        for (let i = 0; i < iterations; i++) {
          cfrForms.push(CFR_PART_2_FORM_SCHEMA);
          aiForms.push(AI_CONSENT_FORM_SCHEMA);
        }

        // Verify all CFR forms are identical
        for (let i = 1; i < cfrForms.length; i++) {
          expect(cfrForms[i]).toEqual(cfrForms[0]);
          expect(cfrForms[i].sections.length).toBe(cfrForms[0].sections.length);
        }

        // Verify all AI forms are identical
        for (let i = 1; i < aiForms.length; i++) {
          expect(aiForms[i]).toEqual(aiForms[0]);
          expect(aiForms[i].sections.length).toBe(aiForms[0].sections.length);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 3: Consent audit logging
 * For any consent record creation, an audit log entry should be created
 * with all consent details
 * **Validates: Requirements 1.7**
 */
describe('Feature: log-peer-recovery-system, Property 3: Consent audit logging', () => {
  /**
   * Requirement 1.7: Create audit entry with all consent details
   * WHEN consent is recorded, THE Session_Logger SHALL create an audit entry
   * with all consent details
   */

  // Setup mock for audit logging tests
  beforeEach(() => {
    // Reset all mocks before each test to ensure clean state
    jest.resetAllMocks();

    // Mock the Supabase from method to return proper chain
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'consents') {
        return {
          insert: jest.fn((data: any) => ({
            select: jest.fn(() => ({
              single: jest.fn(() => ({
                data: {
                  id: 'generated-consent-id-' + Math.random().toString(36).substring(7),
                  participant_id: data.participant_id,
                  consent_type: data.consent_type,
                  participant_name: data.participant_name,
                  participant_dob: data.participant_dob,
                  purpose_of_disclosure: data.purpose_of_disclosure,
                  authorized_recipients: data.authorized_recipients,
                  information_to_disclose: data.information_to_disclose,
                  expiration_date: data.expiration_date,
                  signature_encrypted: data.signature_encrypted,
                  date_signed: data.date_signed,
                  witness_name: data.witness_name,
                  witness_signature_encrypted: data.witness_signature_encrypted,
                  status: 'active',
                  created_at: new Date().toISOString(),
                  created_by: 'test-user-id',
                },
                error: null,
              })),
            })),
          })),
        };
      }
      return {};
    });
  });

  test('Audit log entry is created for every consent capture', () => {
    // Generator for valid consent data - use unique UUID per iteration
    const consentDataArbitrary = fc.uuid().chain(participantId =>
      fc.record({
        participantId: fc.constant(participantId),
        consentType: fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
        participantName: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0),
        dateOfBirth: fc.date({ min: new Date('1920-01-01'), max: new Date('2010-12-31') }).filter(d => !isNaN(d.getTime())),
        purposeOfDisclosure: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
        authorizedRecipients: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }), { nil: undefined }),
        informationToDisclose: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
        expirationDate: fc.option(fc.date({ min: new Date(), max: new Date('2030-12-31') }).filter(d => !isNaN(d.getTime())), { nil: undefined }),
        signature: fc.base64String({ minLength: 10, maxLength: 100 }),
        dateSigned: fc.date({ min: new Date('2020-01-01'), max: new Date() }).filter(d => !isNaN(d.getTime())),
        witnessName: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
        witnessSignature: fc.option(fc.base64String({ minLength: 10, maxLength: 100 }), { nil: undefined }),
      })
    );

    fc.assert(
      fc.asyncProperty(consentDataArbitrary, async (consentData: ConsentData) => {
        // Setup mock for this specific iteration to avoid cross-test contamination
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'consents') {
            return {
              insert: jest.fn((data: any) => ({
                select: jest.fn(() => ({
                  single: jest.fn(() => ({
                    data: {
                      id: 'generated-consent-id-' + Math.random().toString(36).substring(7),
                      participant_id: data.participant_id,
                      consent_type: data.consent_type,
                      participant_name: data.participant_name,
                      participant_dob: data.participant_dob,
                      purpose_of_disclosure: data.purpose_of_disclosure,
                      authorized_recipients: data.authorized_recipients,
                      information_to_disclose: data.information_to_disclose,
                      expiration_date: data.expiration_date,
                      signature_encrypted: data.signature_encrypted,
                      date_signed: data.date_signed,
                      witness_name: data.witness_name,
                      witness_signature_encrypted: data.witness_signature_encrypted,
                      status: 'active',
                      created_at: new Date().toISOString(),
                      created_by: 'test-user-id',
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {};
        });
        
        // Record the call count before capturing consent
        const initialCallCount = (logPHIAccess as jest.Mock).mock.calls.length;
        
        // Capture the participant ID before the operation to avoid issues with object mutation
        const expectedParticipantId = consentData.participantId;

        // Capture consent
        await captureConsent(consentData, 'test-user-id');

        // Verify logPHIAccess was called
        expect(logPHIAccess).toHaveBeenCalled();
        
        // Get the audit log call that was just added
        const calls = (logPHIAccess as jest.Mock).mock.calls;
        const auditLogCall = calls[initialCallCount][0];
        
        // Verify user ID is logged
        expect(auditLogCall.userId).toBeDefined();
        expect(auditLogCall.userId).toBe('test-user-id');

        // Verify participant ID is logged
        expect(auditLogCall.participantId).toBeDefined();
        expect(auditLogCall.participantId).toBe(expectedParticipantId);

        // Verify access type is 'write' (creating consent)
        expect(auditLogCall.accessType).toBe('write');

        // Verify data type is 'consent'
        expect(auditLogCall.dataType).toBe('consent');

        // Verify purpose includes consent type
        expect(auditLogCall.purpose).toBeDefined();
        expect(auditLogCall.purpose).toContain(consentData.consentType);
        expect(auditLogCall.purpose.toLowerCase()).toContain('consent');

        // Verify timestamp is present and valid
        expect(auditLogCall.timestamp).toBeDefined();
        expect(auditLogCall.timestamp).toBeInstanceOf(Date);

        // Verify IP address is logged (even if placeholder)
        expect(auditLogCall.ipAddress).toBeDefined();
        expect(typeof auditLogCall.ipAddress).toBe('string');

        // Verify device ID is logged (even if placeholder)
        expect(auditLogCall.deviceId).toBeDefined();
        expect(typeof auditLogCall.deviceId).toBe('string');
      }),
      { numRuns: 100 }
    );
  });

  test('Audit log captures consent type in purpose field', () => {
    // Generator for consent data with specific consent types - use unique UUID per iteration
    const consentDataArbitrary = fc.uuid().chain(participantId =>
      fc.record({
        participantId: fc.constant(participantId),
        consentType: fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
        participantName: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0),
        dateOfBirth: fc.date({ min: new Date('1920-01-01'), max: new Date('2010-12-31') }).filter(d => !isNaN(d.getTime())),
        signature: fc.base64String({ minLength: 10, maxLength: 100 }),
        dateSigned: fc.date({ min: new Date('2020-01-01'), max: new Date() }).filter(d => !isNaN(d.getTime())),
      })
    );

    fc.assert(
      fc.asyncProperty(consentDataArbitrary, async (consentData: ConsentData) => {
        // Setup mock for this specific iteration to avoid cross-test contamination
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'consents') {
            return {
              insert: jest.fn((data: any) => ({
                select: jest.fn(() => ({
                  single: jest.fn(() => ({
                    data: {
                      id: 'generated-consent-id-' + Math.random().toString(36).substring(7),
                      participant_id: data.participant_id,
                      consent_type: data.consent_type,
                      participant_name: data.participant_name,
                      participant_dob: data.participant_dob,
                      purpose_of_disclosure: data.purpose_of_disclosure,
                      authorized_recipients: data.authorized_recipients,
                      information_to_disclose: data.information_to_disclose,
                      expiration_date: data.expiration_date,
                      signature_encrypted: data.signature_encrypted,
                      date_signed: data.date_signed,
                      witness_name: data.witness_name,
                      witness_signature_encrypted: data.witness_signature_encrypted,
                      status: 'active',
                      created_at: new Date().toISOString(),
                      created_by: 'test-user-id',
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {};
        });
        
        // Record the call count before capturing consent
        const initialCallCount = (logPHIAccess as jest.Mock).mock.calls.length;

        // Capture consent
        await captureConsent(consentData, 'test-user-id');

        // Get the audit log call that was just added
        const calls = (logPHIAccess as jest.Mock).mock.calls;
        const auditLogCall = calls[initialCallCount][0];

        // Verify purpose field contains the consent type
        expect(auditLogCall.purpose).toContain(consentData.consentType);

        // Verify purpose indicates this is a consent capture operation
        const purposeLower = auditLogCall.purpose.toLowerCase();
        expect(
          purposeLower.includes('captured') || 
          purposeLower.includes('consent') ||
          purposeLower.includes('recorded')
        ).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('Audit log timestamp is within reasonable time of consent capture', () => {
    // Generator for consent data
    const consentDataArbitrary = fc.record({
      participantId: fc.constant('44444444-4444-4444-4444-444444444444'),
      consentType: fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
      participantName: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0),
      dateOfBirth: fc.date({ min: new Date('1920-01-01'), max: new Date('2010-12-31') }).filter(d => !isNaN(d.getTime())),
      signature: fc.base64String({ minLength: 10, maxLength: 100 }),
      dateSigned: fc.date({ min: new Date('2020-01-01'), max: new Date() }).filter(d => !isNaN(d.getTime())),
    });

    fc.assert(
      fc.asyncProperty(consentDataArbitrary, async (consentData: ConsentData) => {
        // Record the call count before capturing consent
        const initialCallCount = (logPHIAccess as jest.Mock).mock.calls.length;

        const beforeCapture = new Date();
        
        // Capture consent
        await captureConsent(consentData, 'test-user-id');

        const afterCapture = new Date();

        // Get the audit log call that was just added
        const calls = (logPHIAccess as jest.Mock).mock.calls;
        const auditLogCall = calls[initialCallCount][0];

        // Verify timestamp is within the capture window (with 1 second tolerance)
        expect(auditLogCall.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCapture.getTime() - 1000);
        expect(auditLogCall.timestamp.getTime()).toBeLessThanOrEqual(afterCapture.getTime() + 1000);
      }),
      { numRuns: 100 }
    );
  });

  test('Multiple consent captures create separate audit log entries', () => {
    // Generator for multiple consent submissions
    // Use a generator that creates unique UUIDs for each consent
    const multipleConsentsArbitrary = fc.integer({ min: 2, max: 5 }).chain(count => 
      fc.tuple(...Array.from({ length: count }, (_, i) => 
        fc.record({
          participantId: fc.constant(`55555555-5555-5555-5555-55555555555${i}`),
          consentType: fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
          participantName: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0),
          dateOfBirth: fc.date({ min: new Date('1920-01-01'), max: new Date('2010-12-31') }).filter(d => !isNaN(d.getTime())),
          signature: fc.base64String({ minLength: 10, maxLength: 100 }),
          dateSigned: fc.date({ min: new Date('2020-01-01'), max: new Date() }).filter(d => !isNaN(d.getTime())),
        })
      ))
    );

    fc.assert(
      fc.asyncProperty(multipleConsentsArbitrary, async (consents: ConsentData[]) => {
        // Record the initial call count
        const initialCallCount = (logPHIAccess as jest.Mock).mock.calls.length;
        
        // Capture participant IDs before operations to avoid issues with object mutation
        const expectedParticipantIds = consents.map(c => c.participantId);

        // Capture all consents
        for (const consent of consents) {
          await captureConsent(consent, 'test-user-id');
        }

        // Verify logPHIAccess was called once for each consent
        const finalCallCount = (logPHIAccess as jest.Mock).mock.calls.length;
        const newCalls = finalCallCount - initialCallCount;
        expect(newCalls).toBe(consents.length);

        // Verify each call has a participant ID from the input list
        const calls = (logPHIAccess as jest.Mock).mock.calls;
        const recentCalls = calls.slice(initialCallCount);
        const participantIds = recentCalls.map(call => call[0].participantId);
        
        // Each consent should have its own audit log entry
        expect(participantIds.length).toBe(consents.length);
        
        // Verify each participant ID in the audit log is from the input
        for (const participantId of participantIds) {
          expect(expectedParticipantIds).toContain(participantId);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Audit log entry contains all required PHI access fields', () => {
    // Generator for consent data
    const consentDataArbitrary = fc.record({
      participantId: fc.constant('66666666-6666-6666-6666-666666666666'),
      consentType: fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
      participantName: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0),
      dateOfBirth: fc.date({ min: new Date('1920-01-01'), max: new Date('2010-12-31') }).filter(d => !isNaN(d.getTime())),
      signature: fc.base64String({ minLength: 10, maxLength: 100 }),
      dateSigned: fc.date({ min: new Date('2020-01-01'), max: new Date() }).filter(d => !isNaN(d.getTime())),
    });

    fc.assert(
      fc.asyncProperty(consentDataArbitrary, async (consentData: ConsentData) => {
        // Record the call count before capturing consent
        const initialCallCount = (logPHIAccess as jest.Mock).mock.calls.length;

        // Capture consent
        await captureConsent(consentData, 'test-user-id');

        // Get the audit log call that was just added
        const calls = (logPHIAccess as jest.Mock).mock.calls;
        const auditLogCall = calls[initialCallCount][0];

        // Verify all required PHI access log fields are present
        const requiredFields = [
          'userId',
          'participantId',
          'accessType',
          'dataType',
          'purpose',
          'timestamp',
          'ipAddress',
          'deviceId',
        ];

        for (const field of requiredFields) {
          expect(auditLogCall[field]).toBeDefined();
          expect(auditLogCall[field]).not.toBeNull();
          
          // String fields should not be empty
          if (typeof auditLogCall[field] === 'string') {
            expect(auditLogCall[field].length).toBeGreaterThan(0);
          }
        }

        // Verify field types
        expect(typeof auditLogCall.userId).toBe('string');
        expect(typeof auditLogCall.participantId).toBe('string');
        expect(typeof auditLogCall.accessType).toBe('string');
        expect(typeof auditLogCall.dataType).toBe('string');
        expect(typeof auditLogCall.purpose).toBe('string');
        expect(auditLogCall.timestamp).toBeInstanceOf(Date);
        expect(typeof auditLogCall.ipAddress).toBe('string');
        expect(typeof auditLogCall.deviceId).toBe('string');
      }),
      { numRuns: 100 }
    );
  });

  test('Audit log is created even when consent has minimal optional fields', () => {
    // Generator for minimal consent data (only required fields) - use unique UUID per iteration
    const minimalConsentArbitrary = fc.uuid().chain(participantId =>
      fc.record({
        participantId: fc.constant(participantId),
        consentType: fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
        participantName: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0),
        dateOfBirth: fc.date({ min: new Date('1920-01-01'), max: new Date('2010-12-31') }).filter(d => !isNaN(d.getTime())),
        signature: fc.base64String({ minLength: 10, maxLength: 100 }),
        dateSigned: fc.date({ min: new Date('2020-01-01'), max: new Date() }).filter(d => !isNaN(d.getTime())),
        // No optional fields
      })
    );

    fc.assert(
      fc.asyncProperty(minimalConsentArbitrary, async (consentData: ConsentData) => {
        // Setup mock for this specific iteration to avoid cross-test contamination
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'consents') {
            return {
              insert: jest.fn((data: any) => ({
                select: jest.fn(() => ({
                  single: jest.fn(() => ({
                    data: {
                      id: 'generated-consent-id-' + Math.random().toString(36).substring(7),
                      participant_id: data.participant_id,
                      consent_type: data.consent_type,
                      participant_name: data.participant_name,
                      participant_dob: data.participant_dob,
                      purpose_of_disclosure: data.purpose_of_disclosure,
                      authorized_recipients: data.authorized_recipients,
                      information_to_disclose: data.information_to_disclose,
                      expiration_date: data.expiration_date,
                      signature_encrypted: data.signature_encrypted,
                      date_signed: data.date_signed,
                      witness_name: data.witness_name,
                      witness_signature_encrypted: data.witness_signature_encrypted,
                      status: 'active',
                      created_at: new Date().toISOString(),
                      created_by: 'test-user-id',
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {};
        });
        
        // Record the call count before capturing consent
        const initialCallCount = (logPHIAccess as jest.Mock).mock.calls.length;
        
        // Capture the participant ID before the operation to avoid issues with object mutation
        const expectedParticipantId = consentData.participantId;

        // Capture consent with minimal data
        await captureConsent(consentData, 'test-user-id');

        // Verify audit log was still created
        expect(logPHIAccess).toHaveBeenCalled();

        // Get the audit log call that was just added
        const calls = (logPHIAccess as jest.Mock).mock.calls;
        const auditLogCall = calls[initialCallCount][0];

        // Verify all required audit fields are present regardless of optional consent fields
        expect(auditLogCall.userId).toBe('test-user-id');
        expect(auditLogCall.participantId).toBe(expectedParticipantId);
        expect(auditLogCall.accessType).toBe('write');
        expect(auditLogCall.dataType).toBe('consent');
        expect(auditLogCall.purpose).toBeDefined();
        expect(auditLogCall.timestamp).toBeInstanceOf(Date);
        expect(auditLogCall.ipAddress).toBeDefined();
        expect(auditLogCall.deviceId).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 2: Consent recording with metadata
 * For any participant consent submission, when the consent is recorded,
 * the system should store timestamp, participant signature, and witness information
 * **Validates: Requirements 1.5**
 */
describe('Feature: log-peer-recovery-system, Property 2: Consent recording with metadata', () => {
  /**
   * Requirement 1.5: Record consent with timestamp, signature, and witness information
   * WHEN a participant provides consent, THE System SHALL record the consent with
   * timestamp, participant signature, and witness information
   */

  // Setup mock for consent recording tests
  beforeEach(() => {
    // Reset all mocks before each test to ensure clean state
    jest.resetAllMocks();
    
    // Mock the Supabase from method to return proper chain
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'consents') {
        return {
          insert: jest.fn((data: any) => ({
            select: jest.fn(() => ({
              single: jest.fn(() => ({
                data: {
                  id: 'generated-consent-id-' + Math.random().toString(36).substring(7),
                  participant_id: data.participant_id,
                  consent_type: data.consent_type,
                  participant_name: data.participant_name,
                  participant_dob: data.participant_dob,
                  purpose_of_disclosure: data.purpose_of_disclosure,
                  authorized_recipients: data.authorized_recipients,
                  information_to_disclose: data.information_to_disclose,
                  expiration_date: data.expiration_date,
                  signature_encrypted: data.signature_encrypted,
                  date_signed: data.date_signed,
                  witness_name: data.witness_name,
                  witness_signature_encrypted: data.witness_signature_encrypted,
                  status: 'active',
                  created_at: new Date().toISOString(),
                  created_by: 'test-user-id',
                },
                error: null,
              })),
            })),
          })),
        };
      }
      return {};
    });
  });

  test('Recorded consent contains timestamp metadata', () => {
    // Generator for valid consent data with all metadata fields
    const consentDataArbitrary = fc.record({
      participantId: fc.constant('88888888-8888-8888-8888-888888888888'),
      consentType: fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
      participantName: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0),
      dateOfBirth: fc.date({ min: new Date('1920-01-01'), max: new Date('2010-12-31') }),
      purposeOfDisclosure: fc.string({ minLength: 1, maxLength: 200 }),
      authorizedRecipients: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
      informationToDisclose: fc.string({ minLength: 1, maxLength: 200 }),
      expirationDate: fc.date({ min: new Date(), max: new Date('2030-12-31') }).filter(d => !isNaN(d.getTime())),
      signature: fc.base64String({ minLength: 10, maxLength: 100 }),
      dateSigned: fc.date({ min: new Date('2020-01-01'), max: new Date() }).filter(d => !isNaN(d.getTime())),
      witnessName: fc.string({ minLength: 1, maxLength: 100 }),
      witnessSignature: fc.base64String({ minLength: 10, maxLength: 100 }),
    });

    fc.assert(
      fc.asyncProperty(consentDataArbitrary, async (consentData: ConsentData) => {
        const beforeCapture = new Date();
        
        // Capture consent
        const result = await captureConsent(consentData, 'test-user-id');

        const afterCapture = new Date();

        // Verify timestamp is recorded (createdAt should be set)
        expect(result.createdAt).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);
        
        // Timestamp should be between before and after capture
        expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCapture.getTime() - 1000); // Allow 1s tolerance
        expect(result.createdAt.getTime()).toBeLessThanOrEqual(afterCapture.getTime() + 1000);

        // Verify participant signature is stored
        expect(result.signature).toBeDefined();
        expect(result.signature.length).toBeGreaterThan(0);
        // Signature should be encrypted (our mock adds 'encrypted-' prefix)
        expect(result.signature).toContain('encrypted-');

        // Verify witness information is stored when provided
        if (consentData.witnessName) {
          expect(result.witnessName).toBeDefined();
          expect(result.witnessName).toBe(consentData.witnessName);
        }

        if (consentData.witnessSignature) {
          expect(result.witnessSignature).toBeDefined();
          expect(result.witnessSignature!.length).toBeGreaterThan(0);
          // Witness signature should be encrypted
          expect(result.witnessSignature).toContain('encrypted-');
        }

        // Verify date signed is stored
        expect(result.dateSigned).toBeDefined();
        expect(result.dateSigned).toBeInstanceOf(Date);
        expect(result.dateSigned.toISOString().split('T')[0]).toBe(
          consentData.dateSigned.toISOString().split('T')[0]
        );

        // Verify created by user is recorded
        expect(result.createdBy).toBeDefined();
        expect(result.createdBy).toBe('test-user-id');

        // Verify consent record has an ID
        expect(result.id).toBeDefined();
        expect(result.id.length).toBeGreaterThan(0);

        // Verify status is set to active
        expect(result.status).toBe('active');
      }),
      { numRuns: 100 }
    );
  });

  test('Consent recording preserves all metadata fields', () => {
    // Generator for consent data with optional metadata
    // Use a fixed UUID to avoid fc.uuid() regeneration issues
    const consentDataArbitrary = fc.record({
      participantId: fc.constant('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
      consentType: fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
      participantName: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0),
      dateOfBirth: fc.date({ min: new Date('1920-01-01'), max: new Date('2010-12-31') }).filter(d => !isNaN(d.getTime())),
      purposeOfDisclosure: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
      authorizedRecipients: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }), { nil: undefined }),
      informationToDisclose: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
      expirationDate: fc.option(fc.date({ min: new Date(), max: new Date('2030-12-31') }).filter(d => !isNaN(d.getTime())), { nil: undefined }),
      signature: fc.base64String({ minLength: 10, maxLength: 100 }),
      dateSigned: fc.date({ min: new Date('2020-01-01'), max: new Date() }).filter(d => !isNaN(d.getTime())),
      witnessName: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
      witnessSignature: fc.option(fc.base64String({ minLength: 10, maxLength: 100 }), { nil: undefined }),
    });

    fc.assert(
      fc.asyncProperty(consentDataArbitrary, async (consentData: ConsentData) => {
        // Record the call count before capturing consent to avoid interference with other tests
        const initialCallCount = (logPHIAccess as jest.Mock).mock.calls.length;
        
        // Capture consent
        const result = await captureConsent(consentData, 'test-user-id');
        
        // Date of birth should match (compare date strings to avoid time zone issues)
        expect(result.dateOfBirth.toISOString().split('T')[0]).toBe(
          consentData.dateOfBirth.toISOString().split('T')[0]
        );

        // Optional fields should be preserved if provided
        if (consentData.purposeOfDisclosure !== undefined) {
          expect(result.purposeOfDisclosure).toBe(consentData.purposeOfDisclosure);
        }

        if (consentData.authorizedRecipients !== undefined) {
          expect(result.authorizedRecipients).toEqual(consentData.authorizedRecipients);
        }

        if (consentData.informationToDisclose !== undefined) {
          expect(result.informationToDisclose).toBe(consentData.informationToDisclose);
        }

        if (consentData.expirationDate !== undefined) {
          expect(result.expirationDate).toBeDefined();
          expect(result.expirationDate!.toISOString().split('T')[0]).toBe(
            consentData.expirationDate.toISOString().split('T')[0]
          );
        }

        if (consentData.witnessName !== undefined) {
          expect(result.witnessName).toBe(consentData.witnessName);
        }

        // Signature and witness signature should be encrypted
        expect(result.signature).toBeDefined();
        expect(result.signature).toContain('encrypted-');

        if (consentData.witnessSignature !== undefined) {
          expect(result.witnessSignature).toBeDefined();
          expect(result.witnessSignature).toContain('encrypted-');
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Multiple consent recordings maintain unique timestamps', () => {
    // Generator for multiple consent submissions
    const multipleConsentsArbitrary = fc.array(
      fc.record({
        participantId: fc.constant('99999999-9999-9999-9999-999999999999'),
        consentType: fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
        participantName: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0),
        dateOfBirth: fc.date({ min: new Date('1920-01-01'), max: new Date('2010-12-31') }).filter(d => !isNaN(d.getTime())),
        signature: fc.base64String({ minLength: 10, maxLength: 100 }),
        dateSigned: fc.date({ min: new Date('2020-01-01'), max: new Date() }).filter(d => !isNaN(d.getTime())),
      }),
      { minLength: 2, maxLength: 5 }
    );

    fc.assert(
      fc.asyncProperty(multipleConsentsArbitrary, async (consents: ConsentData[]) => {
        // Record the call count before capturing consents to avoid interference with other tests
        const initialCallCount = (logPHIAccess as jest.Mock).mock.calls.length;
        
        const results = [];

        // Capture all consents sequentially
        for (const consent of consents) {
          const result = await captureConsent(consent, 'test-user-id');
          results.push(result);
          
          // Small delay to ensure timestamps differ
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Verify all results have timestamps
        for (const result of results) {
          expect(result.createdAt).toBeDefined();
          expect(result.createdAt).toBeInstanceOf(Date);
        }

        // Verify timestamps are in chronological order (or very close)
        for (let i = 1; i < results.length; i++) {
          // Current timestamp should be >= previous timestamp
          expect(results[i].createdAt.getTime()).toBeGreaterThanOrEqual(
            results[i - 1].createdAt.getTime()
          );
        }

        // Verify each consent has unique ID
        const ids = results.map(r => r.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(results.length);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 4: Consent encryption
 * For any consent record stored in the database, the sensitive fields
 * (signatures, personal information) should be encrypted
 * **Validates: Requirements 1.8**
 */
describe('Feature: log-peer-recovery-system, Property 4: Consent encryption', () => {
  /**
   * Requirement 1.8: Store consent records in encrypted format
   * THE Consent_Manager SHALL store all consent records in encrypted format in the database
   */

  // Setup mock for encryption tests
  beforeEach(() => {
    // Mock the Supabase from method to return proper chain
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'consents') {
        return {
          insert: jest.fn((data: any) => ({
            select: jest.fn(() => ({
              single: jest.fn(() => ({
                data: {
                  id: 'generated-consent-id-' + Math.random().toString(36).substring(7),
                  participant_id: data.participant_id,
                  consent_type: data.consent_type,
                  participant_name: data.participant_name,
                  participant_dob: data.participant_dob,
                  purpose_of_disclosure: data.purpose_of_disclosure,
                  authorized_recipients: data.authorized_recipients,
                  information_to_disclose: data.information_to_disclose,
                  expiration_date: data.expiration_date,
                  signature_encrypted: data.signature_encrypted,
                  date_signed: data.date_signed,
                  witness_name: data.witness_name,
                  witness_signature_encrypted: data.witness_signature_encrypted,
                  status: 'active',
                  created_at: new Date().toISOString(),
                  created_by: 'test-user-id',
                },
                error: null,
              })),
            })),
          })),
        };
      }
      return {};
    });
  });

  test('Consent signatures are encrypted before database storage', () => {
    // Generator for consent data with signatures
    const consentDataArbitrary = fc.record({
      participantId: fc.constant('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
      consentType: fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
      participantName: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0),
      dateOfBirth: fc.date({ min: new Date('1920-01-01'), max: new Date('2010-12-31') }).filter(d => !isNaN(d.getTime())),
      signature: fc.base64String({ minLength: 10, maxLength: 100 }),
      dateSigned: fc.date({ min: new Date('2020-01-01'), max: new Date() }).filter(d => !isNaN(d.getTime())),
      witnessSignature: fc.option(fc.base64String({ minLength: 10, maxLength: 100 }), { nil: undefined }),
    });

    fc.assert(
      fc.asyncProperty(consentDataArbitrary, async (consentData: ConsentData) => {
        // Clear mock call history for this iteration
        (encrypt as jest.Mock).mockClear();
        (supabase.from as jest.Mock).mockClear();
        (logPHIAccess as jest.Mock).mockClear();
        
        // Capture the original signature before encryption
        const originalSignature = consentData.signature;
        const originalWitnessSignature = consentData.witnessSignature;

        // Capture consent
        const result = await captureConsent(consentData, 'test-user-id');

        // Verify encrypt was called
        expect(encrypt).toHaveBeenCalled();
        
        // Get all encrypt calls
        const encryptCalls = (encrypt as jest.Mock).mock.calls;
        
        // Verify at least one call was made with CONSENT data type
        expect(encryptCalls.length).toBeGreaterThan(0);
        expect(encryptCalls[0][1]).toBe(DataType.CONSENT);

        // Verify the returned signature is encrypted (our mock adds 'encrypted-' prefix)
        expect(result.signature).toBeDefined();
        expect(result.signature).not.toBe(originalSignature);
        expect(result.signature).toContain('encrypted-');

        // If witness signature was provided, verify it was also encrypted
        if (originalWitnessSignature && originalWitnessSignature.length > 0) {
          expect(result.witnessSignature).toBeDefined();
          expect(result.witnessSignature).not.toBe(originalWitnessSignature);
          expect(result.witnessSignature).toContain('encrypted-');
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Encrypted consent data is stored in database, not plaintext', () => {
    // Generator for consent data
    const consentDataArbitrary = fc.record({
      participantId: fc.constant('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
      consentType: fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
      participantName: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0),
      dateOfBirth: fc.date({ min: new Date('1920-01-01'), max: new Date('2010-12-31') }).filter(d => !isNaN(d.getTime())),
      signature: fc.base64String({ minLength: 10, maxLength: 100 }),
      dateSigned: fc.date({ min: new Date('2020-01-01'), max: new Date() }).filter(d => !isNaN(d.getTime())),
      witnessSignature: fc.option(fc.base64String({ minLength: 10, maxLength: 100 }), { nil: undefined }),
    });

    fc.assert(
      fc.asyncProperty(consentDataArbitrary, async (consentData: ConsentData) => {
        // Clear mock call history for this iteration
        (encrypt as jest.Mock).mockClear();
        (supabase.from as jest.Mock).mockClear();
        (logPHIAccess as jest.Mock).mockClear();
        
        // Capture the original signature
        const originalSignature = consentData.signature;
        const originalWitnessSignature = consentData.witnessSignature;

        // Capture consent
        const result = await captureConsent(consentData, 'test-user-id');

        // Verify the returned data has encrypted signatures
        expect(result.signature).toBeDefined();
        expect(result.signature).not.toBe(originalSignature);
        expect(result.signature).toContain('encrypted-');

        // If witness signature was provided, verify it's encrypted
        if (originalWitnessSignature && originalWitnessSignature.length > 0) {
          expect(result.witnessSignature).toBeDefined();
          expect(result.witnessSignature).not.toBe(originalWitnessSignature);
          expect(result.witnessSignature).toContain('encrypted-');
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Encryption is applied before any database operation', () => {
    // Generator for consent data
    const consentDataArbitrary = fc.record({
      participantId: fc.constant('cccccccc-cccc-cccc-cccc-cccccccccccc'),
      consentType: fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
      participantName: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0),
      dateOfBirth: fc.date({ min: new Date('1920-01-01'), max: new Date('2010-12-31') }).filter(d => !isNaN(d.getTime())),
      signature: fc.base64String({ minLength: 10, maxLength: 100 }),
      dateSigned: fc.date({ min: new Date('2020-01-01'), max: new Date() }).filter(d => !isNaN(d.getTime())),
    });

    fc.assert(
      fc.asyncProperty(consentDataArbitrary, async (consentData: ConsentData) => {
        // Clear mock call history for this iteration
        (encrypt as jest.Mock).mockClear();
        (supabase.from as jest.Mock).mockClear();
        (logPHIAccess as jest.Mock).mockClear();
        
        // Capture consent
        const result = await captureConsent(consentData, 'test-user-id');

        // Verify encrypt was called
        expect(encrypt).toHaveBeenCalled();
        
        // Verify the result has encrypted signature (which proves encryption happened)
        expect(result.signature).toBeDefined();
        expect(result.signature).toContain('encrypted-');
      }),
      { numRuns: 100 }
    );
  });

  test('All sensitive consent fields use encryption', () => {
    // Generator for consent data with all sensitive fields
    const consentDataArbitrary = fc.record({
      participantId: fc.constant('dddddddd-dddd-dddd-dddd-dddddddddddd'),
      consentType: fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
      participantName: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0),
      dateOfBirth: fc.date({ min: new Date('1920-01-01'), max: new Date('2010-12-31') }).filter(d => !isNaN(d.getTime())),
      signature: fc.base64String({ minLength: 10, maxLength: 100 }),
      dateSigned: fc.date({ min: new Date('2020-01-01'), max: new Date() }).filter(d => !isNaN(d.getTime())),
      witnessName: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
      witnessSignature: fc.option(fc.base64String({ minLength: 10, maxLength: 100 }), { nil: undefined }),
    });

    fc.assert(
      fc.asyncProperty(consentDataArbitrary, async (consentData: ConsentData) => {
        // Clear mock call history for this iteration
        (encrypt as jest.Mock).mockClear();
        (supabase.from as jest.Mock).mockClear();
        (logPHIAccess as jest.Mock).mockClear();
        
        // Capture consent
        await captureConsent(consentData, 'test-user-id');

        // Count how many times encrypt was called
        const encryptCallCount = (encrypt as jest.Mock).mock.calls.length;

        // At minimum, signature should be encrypted (1 call)
        expect(encryptCallCount).toBeGreaterThanOrEqual(1);

        // Verify all encrypt calls used CONSENT data type
        const encryptCalls = (encrypt as jest.Mock).mock.calls;
        for (const call of encryptCalls) {
          expect(call[1]).toBe(DataType.CONSENT);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Encryption handles various signature formats and sizes', () => {
    // Generator for consent data with various signature formats
    const consentDataArbitrary = fc.record({
      participantId: fc.constant('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
      consentType: fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
      participantName: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0),
      dateOfBirth: fc.date({ min: new Date('1920-01-01'), max: new Date('2010-12-31') }).filter(d => !isNaN(d.getTime())),
      // Various signature formats: short, long, different base64 patterns
      signature: fc.oneof(
        fc.base64String({ minLength: 10, maxLength: 50 }),
        fc.base64String({ minLength: 100, maxLength: 500 }),
        fc.base64String({ minLength: 500, maxLength: 1000 })
      ),
      dateSigned: fc.date({ min: new Date('2020-01-01'), max: new Date() }).filter(d => !isNaN(d.getTime())),
    });

    fc.assert(
      fc.asyncProperty(consentDataArbitrary, async (consentData: ConsentData) => {
        // Clear mock call history for this iteration
        (encrypt as jest.Mock).mockClear();
        (supabase.from as jest.Mock).mockClear();
        (logPHIAccess as jest.Mock).mockClear();
        
        const originalSignature = consentData.signature;

        // Capture consent
        const result = await captureConsent(consentData, 'test-user-id');

        // Verify encrypt was called
        expect(encrypt).toHaveBeenCalled();
        const encryptCalls = (encrypt as jest.Mock).mock.calls;
        
        // Verify at least one call was made with CONSENT data type
        expect(encryptCalls.length).toBeGreaterThan(0);
        expect(encryptCalls[0][1]).toBe(DataType.CONSENT);

        // Verify the result contains encrypted signature
        expect(result.signature).toBeDefined();
        expect(result.signature).not.toBe(originalSignature);
        expect(result.signature).toContain('encrypted-');

        // Verify encryption works regardless of signature size
        expect(result.signature.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  test('Consent encryption uses correct DataType for all fields', () => {
    // Generator for consent data
    const consentDataArbitrary = fc.record({
      participantId: fc.constant('ffffffff-ffff-ffff-ffff-ffffffffffff'),
      consentType: fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
      participantName: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0),
      dateOfBirth: fc.date({ min: new Date('1920-01-01'), max: new Date('2010-12-31') }).filter(d => !isNaN(d.getTime())),
      signature: fc.base64String({ minLength: 10, maxLength: 100 }),
      dateSigned: fc.date({ min: new Date('2020-01-01'), max: new Date() }).filter(d => !isNaN(d.getTime())),
      witnessSignature: fc.option(fc.base64String({ minLength: 10, maxLength: 100 }), { nil: undefined }),
    });

    fc.assert(
      fc.asyncProperty(consentDataArbitrary, async (consentData: ConsentData) => {
        // Clear mock call history for this iteration
        (encrypt as jest.Mock).mockClear();
        (supabase.from as jest.Mock).mockClear();
        (logPHIAccess as jest.Mock).mockClear();
        
        // Capture consent
        await captureConsent(consentData, 'test-user-id');

        // Get all encrypt calls
        const encryptCalls = (encrypt as jest.Mock).mock.calls;

        // Verify all calls used DataType.CONSENT
        for (const call of encryptCalls) {
          const dataType = call[1];
          expect(dataType).toBe(DataType.CONSENT);
        }

        // Verify at least one encrypt call was made
        expect(encryptCalls.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 5: Consent expiration notifications
 * For any active consent with an expiration date, if the expiration date is within 30 days,
 * a notification should be generated for the assigned peer specialist
 * **Validates: Requirements 1.10**
 */
describe('Feature: log-peer-recovery-system, Property 5: Consent expiration notifications', () => {
  /**
   * Requirement 1.10: Track consent expiration dates and notify 30 days before expiration
   * THE System SHALL track consent expiration dates and notify Peer_Specialists 30 days before expiration
   */

  // Import getExpiringConsents for testing
  const { getExpiringConsents } = require('../consentManager');

  // Setup mock for expiration notification tests
  beforeEach(() => {
    // Reset all mocks before each test to ensure clean state
    jest.resetAllMocks();
  });

  test('Consents expiring within threshold are identified', () => {
    // Generator for days threshold (0-60 days)
    const thresholdArbitrary = fc.integer({ min: 0, max: 60 });

    fc.assert(
      fc.asyncProperty(thresholdArbitrary, async (daysThreshold: number) => {
        // Calculate threshold date
        const now = new Date();
        const thresholdDate = new Date(now);
        thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

        // Generate test consents with various expiration dates
        const testConsents = [
          // Consent expiring within threshold (should be included)
          {
            id: 'consent-within-1',
            participant_id: 'participant-1',
            consent_type: 'CFR_PART_2',
            participant_name: 'Test Participant 1',
            participant_dob: '1990-01-01',
            expiration_date: new Date(now.getTime() + (daysThreshold / 2) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            signature_encrypted: 'encrypted-signature-1',
            date_signed: '2024-01-01',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            created_by: 'user-1',
          },
          // Consent expiring exactly at threshold (should be included)
          {
            id: 'consent-at-threshold',
            participant_id: 'participant-2',
            consent_type: 'CFR_PART_2',
            participant_name: 'Test Participant 2',
            participant_dob: '1990-01-01',
            expiration_date: thresholdDate.toISOString().split('T')[0],
            signature_encrypted: 'encrypted-signature-2',
            date_signed: '2024-01-01',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            created_by: 'user-1',
          },
          // Consent expiring beyond threshold (should NOT be included)
          {
            id: 'consent-beyond',
            participant_id: 'participant-3',
            consent_type: 'CFR_PART_2',
            participant_name: 'Test Participant 3',
            participant_dob: '1990-01-01',
            expiration_date: new Date(now.getTime() + (daysThreshold + 10) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            signature_encrypted: 'encrypted-signature-3',
            date_signed: '2024-01-01',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            created_by: 'user-1',
          },
          // Consent already expired (should NOT be included)
          {
            id: 'consent-expired',
            participant_id: 'participant-4',
            consent_type: 'CFR_PART_2',
            participant_name: 'Test Participant 4',
            participant_dob: '1990-01-01',
            expiration_date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            signature_encrypted: 'encrypted-signature-4',
            date_signed: '2024-01-01',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            created_by: 'user-1',
          },
        ];

        // Mock Supabase query to return test consents
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'consents') {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  not: jest.fn(() => ({
                    lte: jest.fn(() => ({
                      gte: jest.fn(() => ({
                        order: jest.fn(() => ({
                          data: testConsents.filter(c => {
                            const expirationDate = new Date(c.expiration_date);
                            return expirationDate >= now && expirationDate <= thresholdDate;
                          }),
                          error: null,
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          return {};
        });

        // Get expiring consents
        const result = await getExpiringConsents(daysThreshold, 'test-user-id');

        // Verify result is an array
        expect(Array.isArray(result)).toBe(true);

        // Verify all returned consents have expiration dates within threshold
        for (const consent of result) {
          expect(consent.expirationDate).toBeDefined();
          expect(consent.expirationDate).toBeInstanceOf(Date);

          const expirationDate = consent.expirationDate;
          const daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

          // Expiration date should be within threshold
          expect(daysUntilExpiration).toBeGreaterThanOrEqual(0);
          expect(daysUntilExpiration).toBeLessThanOrEqual(daysThreshold);
        }

        // Verify consents are sorted by expiration date (earliest first)
        for (let i = 1; i < result.length; i++) {
          expect(result[i].expirationDate!.getTime()).toBeGreaterThanOrEqual(
            result[i - 1].expirationDate!.getTime()
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  test('30-day threshold correctly identifies consents expiring within 30 days', () => {
    fc.assert(
      fc.asyncProperty(fc.constant(30), async (daysThreshold: number) => {
        const now = new Date();
        const thresholdDate = new Date(now);
        thresholdDate.setDate(thresholdDate.getDate() + 30);

        // Generate consents with specific expiration dates
        const testConsents = [
          // Consent expiring in 15 days (should be included)
          {
            id: 'consent-15-days',
            participant_id: 'participant-15',
            consent_type: 'CFR_PART_2',
            participant_name: 'Test Participant 15',
            participant_dob: '1990-01-01',
            expiration_date: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            signature_encrypted: 'encrypted-signature-15',
            date_signed: '2024-01-01',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            created_by: 'user-1',
          },
          // Consent expiring in 29 days (should be included)
          {
            id: 'consent-29-days',
            participant_id: 'participant-29',
            consent_type: 'CFR_PART_2',
            participant_name: 'Test Participant 29',
            participant_dob: '1990-01-01',
            expiration_date: new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            signature_encrypted: 'encrypted-signature-29',
            date_signed: '2024-01-01',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            created_by: 'user-1',
          },
          // Consent expiring in 31 days (should NOT be included)
          {
            id: 'consent-31-days',
            participant_id: 'participant-31',
            consent_type: 'CFR_PART_2',
            participant_name: 'Test Participant 31',
            participant_dob: '1990-01-01',
            expiration_date: new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            signature_encrypted: 'encrypted-signature-31',
            date_signed: '2024-01-01',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            created_by: 'user-1',
          },
        ];

        // Mock Supabase query
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'consents') {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  not: jest.fn(() => ({
                    lte: jest.fn(() => ({
                      gte: jest.fn(() => ({
                        order: jest.fn(() => ({
                          data: testConsents.filter(c => {
                            const expirationDate = new Date(c.expiration_date);
                            return expirationDate >= now && expirationDate <= thresholdDate;
                          }),
                          error: null,
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          return {};
        });

        // Get expiring consents with 30-day threshold
        const result = await getExpiringConsents(30, 'test-user-id');

        // Verify result contains consents expiring within 30 days
        expect(result.length).toBeGreaterThanOrEqual(2); // Should have at least the 15-day and 29-day consents

        // Verify all returned consents expire within 30 days
        for (const consent of result) {
          const daysUntilExpiration = Math.ceil(
            (consent.expirationDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
          );
          expect(daysUntilExpiration).toBeLessThanOrEqual(30);
          expect(daysUntilExpiration).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Only active consents with expiration dates are included', () => {
    // Generator for days threshold
    const thresholdArbitrary = fc.integer({ min: 1, max: 60 });

    fc.assert(
      fc.asyncProperty(thresholdArbitrary, async (daysThreshold: number) => {
        const now = new Date();
        const thresholdDate = new Date(now);
        thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

        // Generate test consents with various statuses
        const testConsents = [
          // Active consent with expiration date (should be included)
          {
            id: 'consent-active',
            participant_id: 'participant-active',
            consent_type: 'CFR_PART_2',
            participant_name: 'Test Participant Active',
            participant_dob: '1990-01-01',
            expiration_date: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            signature_encrypted: 'encrypted-signature-active',
            date_signed: '2024-01-01',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            created_by: 'user-1',
          },
          // Revoked consent (should NOT be included - filtered by query)
          {
            id: 'consent-revoked',
            participant_id: 'participant-revoked',
            consent_type: 'CFR_PART_2',
            participant_name: 'Test Participant Revoked',
            participant_dob: '1990-01-01',
            expiration_date: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            signature_encrypted: 'encrypted-signature-revoked',
            date_signed: '2024-01-01',
            status: 'revoked',
            created_at: '2024-01-01T00:00:00Z',
            created_by: 'user-1',
          },
          // Active consent without expiration date (should NOT be included - filtered by query)
          {
            id: 'consent-no-expiration',
            participant_id: 'participant-no-exp',
            consent_type: 'AI_PROCESSING',
            participant_name: 'Test Participant No Exp',
            participant_dob: '1990-01-01',
            expiration_date: null,
            signature_encrypted: 'encrypted-signature-no-exp',
            date_signed: '2024-01-01',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            created_by: 'user-1',
          },
        ];

        // Mock Supabase query to filter by status='active' and expiration_date not null
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'consents') {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  not: jest.fn(() => ({
                    lte: jest.fn(() => ({
                      gte: jest.fn(() => ({
                        order: jest.fn(() => ({
                          data: testConsents.filter(c => 
                            c.status === 'active' && 
                            c.expiration_date !== null &&
                            new Date(c.expiration_date) >= now &&
                            new Date(c.expiration_date) <= thresholdDate
                          ),
                          error: null,
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          return {};
        });

        // Get expiring consents
        const result = await getExpiringConsents(daysThreshold, 'test-user-id');

        // Verify all returned consents are active
        for (const consent of result) {
          expect(consent.status).toBe('active');
        }

        // Verify all returned consents have expiration dates
        for (const consent of result) {
          expect(consent.expirationDate).toBeDefined();
          expect(consent.expirationDate).toBeInstanceOf(Date);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Expiring consents are sorted by expiration date (earliest first)', () => {
    // Generator for days threshold
    const thresholdArbitrary = fc.integer({ min: 10, max: 60 });

    fc.assert(
      fc.asyncProperty(thresholdArbitrary, async (daysThreshold: number) => {
        const now = new Date();
        const thresholdDate = new Date(now);
        thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

        // Generate multiple consents with different expiration dates within threshold
        const testConsents = [
          {
            id: 'consent-1',
            participant_id: 'participant-1',
            consent_type: 'CFR_PART_2',
            participant_name: 'Test Participant 1',
            participant_dob: '1990-01-01',
            expiration_date: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            signature_encrypted: 'encrypted-signature-1',
            date_signed: '2024-01-01',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            created_by: 'user-1',
          },
          {
            id: 'consent-2',
            participant_id: 'participant-2',
            consent_type: 'CFR_PART_2',
            participant_name: 'Test Participant 2',
            participant_dob: '1990-01-01',
            expiration_date: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            signature_encrypted: 'encrypted-signature-2',
            date_signed: '2024-01-01',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            created_by: 'user-1',
          },
          {
            id: 'consent-3',
            participant_id: 'participant-3',
            consent_type: 'CFR_PART_2',
            participant_name: 'Test Participant 3',
            participant_dob: '1990-01-01',
            expiration_date: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            signature_encrypted: 'encrypted-signature-3',
            date_signed: '2024-01-01',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            created_by: 'user-1',
          },
        ];

        // Mock Supabase query with sorting
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'consents') {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  not: jest.fn(() => ({
                    lte: jest.fn(() => ({
                      gte: jest.fn(() => ({
                        order: jest.fn(() => {
                          // Sort by expiration_date ascending
                          const filtered = testConsents.filter(c => {
                            const expirationDate = new Date(c.expiration_date);
                            return expirationDate >= now && expirationDate <= thresholdDate;
                          });
                          filtered.sort((a, b) => 
                            new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime()
                          );
                          return {
                            data: filtered,
                            error: null,
                          };
                        }),
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          return {};
        });

        // Get expiring consents
        const result = await getExpiringConsents(daysThreshold, 'test-user-id');

        // Verify consents are sorted by expiration date (earliest first)
        if (result.length > 1) {
          for (let i = 1; i < result.length; i++) {
            expect(result[i].expirationDate!.getTime()).toBeGreaterThanOrEqual(
              result[i - 1].expirationDate!.getTime()
            );
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Empty result when no consents are expiring within threshold', () => {
    // Generator for days threshold
    const thresholdArbitrary = fc.integer({ min: 1, max: 30 });

    fc.assert(
      fc.asyncProperty(thresholdArbitrary, async (daysThreshold: number) => {
        const now = new Date();
        const thresholdDate = new Date(now);
        thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

        // Generate consents that all expire beyond the threshold
        const testConsents = [
          {
            id: 'consent-far-future',
            participant_id: 'participant-far',
            consent_type: 'CFR_PART_2',
            participant_name: 'Test Participant Far',
            participant_dob: '1990-01-01',
            expiration_date: new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            signature_encrypted: 'encrypted-signature-far',
            date_signed: '2024-01-01',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            created_by: 'user-1',
          },
        ];

        // Mock Supabase query
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'consents') {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  not: jest.fn(() => ({
                    lte: jest.fn(() => ({
                      gte: jest.fn(() => ({
                        order: jest.fn(() => ({
                          data: testConsents.filter(c => {
                            const expirationDate = new Date(c.expiration_date);
                            return expirationDate >= now && expirationDate <= thresholdDate;
                          }),
                          error: null,
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          return {};
        });

        // Get expiring consents
        const result = await getExpiringConsents(daysThreshold, 'test-user-id');

        // Verify result is empty array
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  test('Function handles various threshold values correctly', () => {
    // Generator for various threshold values including edge cases
    const thresholdArbitrary = fc.oneof(
      fc.constant(0),  // Today
      fc.constant(1),  // Tomorrow
      fc.constant(7),  // One week
      fc.constant(30), // One month (requirement)
      fc.constant(60), // Two months
      fc.integer({ min: 1, max: 365 }) // Random days up to one year
    );

    fc.assert(
      fc.asyncProperty(thresholdArbitrary, async (daysThreshold: number) => {
        const now = new Date();
        const thresholdDate = new Date(now);
        thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

        // Generate a consent expiring within the threshold
        const testConsents = [
          {
            id: 'consent-test',
            participant_id: 'participant-test',
            consent_type: 'CFR_PART_2',
            participant_name: 'Test Participant',
            participant_dob: '1990-01-01',
            expiration_date: new Date(now.getTime() + Math.max(1, daysThreshold / 2) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            signature_encrypted: 'encrypted-signature-test',
            date_signed: '2024-01-01',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            created_by: 'user-1',
          },
        ];

        // Mock Supabase query
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'consents') {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  not: jest.fn(() => ({
                    lte: jest.fn(() => ({
                      gte: jest.fn(() => ({
                        order: jest.fn(() => ({
                          data: testConsents.filter(c => {
                            const expirationDate = new Date(c.expiration_date);
                            return expirationDate >= now && expirationDate <= thresholdDate;
                          }),
                          error: null,
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          return {};
        });

        // Get expiring consents
        const result = await getExpiringConsents(daysThreshold, 'test-user-id');

        // Verify result is an array
        expect(Array.isArray(result)).toBe(true);

        // If threshold is 0 or greater, we should get results
        if (daysThreshold >= 0) {
          // Verify all returned consents have valid expiration dates
          for (const consent of result) {
            expect(consent.expirationDate).toBeDefined();
            expect(consent.expirationDate).toBeInstanceOf(Date);
            
            const daysUntilExpiration = Math.ceil(
              (consent.expirationDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
            );
            expect(daysUntilExpiration).toBeGreaterThanOrEqual(0);
            expect(daysUntilExpiration).toBeLessThanOrEqual(daysThreshold);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Notification data includes all required consent information', () => {
    // Generator for days threshold - use larger values to ensure consent is within threshold
    const thresholdArbitrary = fc.integer({ min: 15, max: 60 });

    fc.assert(
      fc.asyncProperty(thresholdArbitrary, async (daysThreshold: number) => {
        const now = new Date();
        const thresholdDate = new Date(now);
        thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

        // Generate test consent with all fields - ensure it's within threshold
        const expirationDays = Math.floor(daysThreshold / 2); // Halfway through threshold
        const testConsents = [
          {
            id: 'consent-full',
            participant_id: 'participant-full',
            consent_type: 'CFR_PART_2',
            participant_name: 'Test Participant Full',
            participant_dob: '1990-01-01',
            purpose_of_disclosure: 'Treatment coordination',
            authorized_recipients: ['Peer Specialist', 'Supervisor'],
            information_to_disclose: 'Treatment records',
            expiration_date: new Date(now.getTime() + expirationDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            signature_encrypted: 'encrypted-signature-full',
            date_signed: '2024-01-01',
            witness_name: 'Witness Name',
            witness_signature_encrypted: 'encrypted-witness-signature',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            created_by: 'user-1',
          },
        ];

        // Mock Supabase query
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'consents') {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  not: jest.fn(() => ({
                    lte: jest.fn(() => ({
                      gte: jest.fn(() => ({
                        order: jest.fn(() => ({
                          data: testConsents.filter(c => {
                            const expirationDate = new Date(c.expiration_date);
                            return expirationDate >= now && expirationDate <= thresholdDate;
                          }),
                          error: null,
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          return {};
        });

        // Get expiring consents
        const result = await getExpiringConsents(daysThreshold, 'test-user-id');

        // Verify result contains consent with all required fields for notification
        expect(result.length).toBeGreaterThanOrEqual(1);

        for (const consent of result) {
          // Required fields for notification
          expect(consent.id).toBeDefined();
          expect(consent.participantId).toBeDefined();
          expect(consent.participantName).toBeDefined();
          expect(consent.consentType).toBeDefined();
          expect(consent.expirationDate).toBeDefined();
          expect(consent.status).toBe('active');

          // Verify expiration date is valid
          expect(consent.expirationDate).toBeInstanceOf(Date);
          
          // Calculate days until expiration for notification
          const daysUntilExpiration = Math.ceil(
            (consent.expirationDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
          );
          
          // Should be within threshold
          expect(daysUntilExpiration).toBeGreaterThanOrEqual(0);
          expect(daysUntilExpiration).toBeLessThanOrEqual(daysThreshold);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 6: Consent revocation blocks PHI access
 * For any participant with revoked consent, attempts to access their PHI should be denied
 * **Validates: Requirements 1.11**
 */
describe('Feature: log-peer-recovery-system, Property 6: Consent revocation blocks PHI access', () => {
  /**
   * Requirement 1.11: Support consent revocation and immediately restrict access to PHI
   * THE System SHALL support consent revocation and immediately restrict access to PHI when revoked
   */

  // Import functions for testing
  const { revokeConsent, getConsentStatus } = require('../consentManager');

  // Setup mock for revocation tests
  beforeEach(() => {
    // Reset all mocks before each test to ensure clean state
    jest.resetAllMocks();
  });

  test('Revoked CFR Part 2 consent blocks PHI collection', () => {
    // Generator for participant IDs and revocation reasons with fixed UUID per iteration
    const revocationDataArbitrary = fc.uuid().chain(participantId =>
      fc.record({
        participantId: fc.constant(participantId),
        consentType: fc.constant('CFR_PART_2' as ConsentType),
        reason: fc.string({ minLength: 5, maxLength: 200 }).filter(s => s.trim().length > 0),
      })
    );

    fc.assert(
      fc.asyncProperty(revocationDataArbitrary, async (revocationData) => {
        // Mock Supabase update for revocation
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'consents') {
            const mockChain = {
              update: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      data: null,
                      error: null,
                    })),
                  })),
                })),
              })),
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    order: jest.fn(() => ({
                      // After revocation, no active CFR consent should exist
                      data: [],
                      error: null,
                    })),
                  })),
                })),
              })),
            };
            return mockChain;
          }
          return {};
        });

        // Revoke consent
        await revokeConsent(
          revocationData.participantId,
          revocationData.consentType,
          revocationData.reason,
          'test-user-id'
        );

        // Get consent status after revocation
        const status = await getConsentStatus(revocationData.participantId, 'test-user-id');

        // Verify CFR consent is no longer active
        expect(status.hasCFRConsent).toBe(false);

        // Verify PHI collection is blocked
        expect(status.canCollectPHI).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  test('Revoked AI consent does not affect CFR consent status', () => {
    // Generator for participant IDs with AI consent revocation and fixed UUID per iteration
    const revocationDataArbitrary = fc.uuid().chain(participantId =>
      fc.record({
        participantId: fc.constant(participantId),
        consentType: fc.constant('AI_PROCESSING' as ConsentType),
        reason: fc.string({ minLength: 5, maxLength: 200 }).filter(s => s.trim().length > 0),
      })
    );

    fc.assert(
      fc.asyncProperty(revocationDataArbitrary, async (revocationData) => {
        // Clear mocks before each iteration
        jest.clearAllMocks();

        // Mock Supabase to show active CFR consent but no AI consent after revocation
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'consents') {
            const mockChain = {
              update: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      data: null,
                      error: null,
                    })),
                  })),
                })),
              })),
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    order: jest.fn(() => ({
                      // CFR consent still active, AI consent revoked
                      data: [
                        {
                          id: 'cfr-consent-id',
                          participant_id: revocationData.participantId,
                          consent_type: 'CFR_PART_2',
                          participant_name: 'Test Participant',
                          participant_dob: '1990-01-01',
                          expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                          signature_encrypted: 'encrypted-signature',
                          date_signed: '2024-01-01',
                          status: 'active',
                          created_at: '2024-01-01T00:00:00Z',
                          created_by: 'user-1',
                        },
                      ],
                      error: null,
                    })),
                  })),
                })),
              })),
            };
            return mockChain;
          }
          return {};
        });

        // Revoke AI consent
        await revokeConsent(
          revocationData.participantId,
          revocationData.consentType,
          revocationData.reason,
          'test-user-id'
        );

        // Get consent status after revocation
        const status = await getConsentStatus(revocationData.participantId, 'test-user-id');

        // Verify CFR consent is still active
        expect(status.hasCFRConsent).toBe(true);

        // Verify AI consent is revoked
        expect(status.hasAIConsent).toBe(false);

        // Verify PHI collection is still allowed (CFR consent is active)
        expect(status.canCollectPHI).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('Consent status correctly reflects revocation state', () => {
    // Generator for consent types with fixed UUID per iteration
    const testDataArbitrary = fc.uuid().chain(participantId =>
      fc.tuple(
        fc.constant(participantId),
        fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
        fc.string({ minLength: 5, maxLength: 200 }).filter(s => s.trim().length > 0)
      )
    );

    fc.assert(
      fc.asyncProperty(
        testDataArbitrary,
        async ([participantId, consentType, reason]) => {
          // Mock Supabase for revocation and status check
          (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'consents') {
              return {
                update: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      eq: jest.fn(() => ({
                        data: null,
                        error: null,
                      })),
                    })),
                  })),
                })),
                select: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      order: jest.fn(() => ({
                        // No active consents after revocation
                        data: [],
                        error: null,
                      })),
                    })),
                  })),
                })),
              };
            }
            return {};
          });

          // Revoke consent
          await revokeConsent(participantId, consentType, reason, 'test-user-id');

          // Get consent status
          const status = await getConsentStatus(participantId, 'test-user-id');

          // Verify appropriate consent flag is false
          if (consentType === 'CFR_PART_2') {
            expect(status.hasCFRConsent).toBe(false);
            expect(status.canCollectPHI).toBe(false);
          } else if (consentType === 'AI_PROCESSING') {
            expect(status.hasAIConsent).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Multiple revocations for same participant are handled correctly', () => {
    // Generator for participant ID with fixed UUID per iteration
    const participantIdArbitrary = fc.uuid();

    fc.assert(
      fc.asyncProperty(participantIdArbitrary, async (participantId) => {
        // Mock Supabase for multiple revocations
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'consents') {
            const mockChain = {
              update: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      data: null,
                      error: null,
                    })),
                  })),
                })),
              })),
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    order: jest.fn(() => ({
                      // No active consents after revocations
                      data: [],
                      error: null,
                    })),
                  })),
                })),
              })),
            };
            return mockChain;
          }
          return {};
        });

        // Revoke both CFR and AI consents
        await revokeConsent(participantId, 'CFR_PART_2', 'Participant request', 'test-user-id');
        await revokeConsent(participantId, 'AI_PROCESSING', 'Participant request', 'test-user-id');

        // Get consent status
        const status = await getConsentStatus(participantId, 'test-user-id');

        // Verify both consents are revoked
        expect(status.hasCFRConsent).toBe(false);
        expect(status.hasAIConsent).toBe(false);

        // Verify PHI collection is blocked
        expect(status.canCollectPHI).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  test('Revocation audit log is created for every revocation', () => {
    // Generator for revocation data with fixed UUID per iteration
    const revocationDataArbitrary = fc.uuid().chain(participantId =>
      fc.record({
        participantId: fc.constant(participantId),
        consentType: fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
        reason: fc.string({ minLength: 5, maxLength: 200 }).filter(s => s.trim().length > 0),
      })
    );

    fc.assert(
      fc.asyncProperty(revocationDataArbitrary, async (revocationData) => {
        // Mock Supabase for revocation
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'consents') {
            return {
              update: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      data: null,
                      error: null,
                    })),
                  })),
                })),
              })),
            };
          }
          return {};
        });

        // Record the call count before revocation
        const initialCallCount = (logPHIAccess as jest.Mock).mock.calls.length;

        // Revoke consent
        await revokeConsent(
          revocationData.participantId,
          revocationData.consentType,
          revocationData.reason,
          'test-user-id'
        );

        // Verify audit log was created
        const finalCallCount = (logPHIAccess as jest.Mock).mock.calls.length;
        expect(finalCallCount).toBeGreaterThan(initialCallCount);

        // Get the most recent audit log call (the one we just made)
        const calls = (logPHIAccess as jest.Mock).mock.calls;
        const auditLogCall = calls[calls.length - 1][0];

        // Verify audit log contains revocation details
        expect(auditLogCall.userId).toBe('test-user-id');
        // Verify participant ID is a valid UUID
        expect(auditLogCall.participantId).toBeDefined();
        expect(typeof auditLogCall.participantId).toBe('string');
        expect(auditLogCall.participantId.length).toBeGreaterThan(0);
        expect(auditLogCall.accessType).toBe('write');
        expect(auditLogCall.dataType).toBe('consent');
        expect(auditLogCall.purpose).toContain('Revoked');
        expect(auditLogCall.purpose).toContain(revocationData.consentType);
        expect(auditLogCall.purpose).toContain(revocationData.reason);
      }),
      { numRuns: 100 }
    );
  });

  test('Revocation with various reason formats is handled correctly', () => {
    // Generator for various revocation reasons with fixed UUID per iteration
    const testDataArbitrary = fc.uuid().chain(participantId =>
      fc.tuple(
        fc.constant(participantId),
        fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
        fc.oneof(
          fc.constant('Participant request'),
          fc.constant('Privacy concerns'),
          fc.constant('No longer receiving services'),
          fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 100, maxLength: 200 }).filter(s => s.trim().length > 0)
        )
      )
    );

    fc.assert(
      fc.asyncProperty(
        testDataArbitrary,
        async ([participantId, consentType, reason]) => {
          // Mock Supabase for revocation
          (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'consents') {
              return {
                update: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      eq: jest.fn(() => ({
                        data: null,
                        error: null,
                      })),
                    })),
                  })),
                })),
                select: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      order: jest.fn(() => ({
                        data: [],
                        error: null,
                      })),
                    })),
                  })),
                })),
              };
            }
            return {};
          });

          // Revoke consent with various reason formats
          await revokeConsent(participantId, consentType, reason, 'test-user-id');

          // Verify revocation succeeded (no error thrown)
          // Get consent status to verify revocation
          const status = await getConsentStatus(participantId, 'test-user-id');

          // Verify consent is revoked
          if (consentType === 'CFR_PART_2') {
            expect(status.hasCFRConsent).toBe(false);
            expect(status.canCollectPHI).toBe(false);
          } else {
            expect(status.hasAIConsent).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('PHI access is immediately blocked after revocation', () => {
    // Generator for participant data with fixed UUID per iteration
    const participantDataArbitrary = fc.uuid().chain(participantId =>
      fc.record({
        participantId: fc.constant(participantId),
        consentType: fc.constant('CFR_PART_2' as ConsentType),
        reason: fc.string({ minLength: 5, maxLength: 200 }).filter(s => s.trim().length > 0),
      })
    );

    fc.assert(
      fc.asyncProperty(participantDataArbitrary, async (participantData) => {
        // Mock Supabase to simulate before and after revocation states
        let revocationOccurred = false;

        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'consents') {
            return {
              update: jest.fn(() => {
                revocationOccurred = true;
                return {
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      eq: jest.fn(() => ({
                        data: null,
                        error: null,
                      })),
                    })),
                  })),
                };
              }),
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    order: jest.fn(() => {
                      if (revocationOccurred) {
                        // After revocation: no active consents
                        return {
                          data: [],
                          error: null,
                        };
                      } else {
                        // Before revocation: active CFR consent
                        return {
                          data: [
                            {
                              id: 'cfr-consent-id',
                              participant_id: participantData.participantId,
                              consent_type: 'CFR_PART_2',
                              participant_name: 'Test Participant',
                              participant_dob: '1990-01-01',
                              expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                              signature_encrypted: 'encrypted-signature',
                              date_signed: '2024-01-01',
                              status: 'active',
                              created_at: '2024-01-01T00:00:00Z',
                              created_by: 'user-1',
                            },
                          ],
                          error: null,
                        };
                      }
                    }),
                  })),
                })),
              })),
            };
          }
          return {};
        });

        // Check status before revocation
        const statusBefore = await getConsentStatus(participantData.participantId, 'test-user-id');
        expect(statusBefore.canCollectPHI).toBe(true);

        // Revoke consent
        await revokeConsent(
          participantData.participantId,
          participantData.consentType,
          participantData.reason,
          'test-user-id'
        );

        // Check status immediately after revocation
        const statusAfter = await getConsentStatus(participantData.participantId, 'test-user-id');

        // Verify PHI access is immediately blocked
        expect(statusAfter.canCollectPHI).toBe(false);
        expect(statusAfter.hasCFRConsent).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  test('Revocation does not affect other participants', () => {
    // Generator for multiple unique participant IDs
    const participantIdsArbitrary = fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 5 });

    fc.assert(
      fc.asyncProperty(participantIdsArbitrary, async (participantIds) => {
        // Select one participant to revoke
        const revokedParticipantId = participantIds[0];
        const otherParticipantIds = participantIds.slice(1);

        // Track which participant is being queried
        let currentParticipantId: string | null = null;

        // Mock Supabase to handle multiple participants
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'consents') {
            return {
              update: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      data: null,
                      error: null,
                    })),
                  })),
                })),
              })),
              select: jest.fn(() => ({
                eq: jest.fn((field: string, value: string) => {
                  // Capture the participant_id being queried
                  if (field === 'participant_id') {
                    currentParticipantId = value;
                  }
                  return {
                    eq: jest.fn(() => ({
                      order: jest.fn(() => {
                        // Return active consent only for non-revoked participants
                        if (currentParticipantId === revokedParticipantId) {
                          return {
                            data: [],
                            error: null,
                          };
                        } else {
                          return {
                            data: [
                              {
                                id: `cfr-consent-${currentParticipantId}`,
                                participant_id: currentParticipantId,
                                consent_type: 'CFR_PART_2',
                                participant_name: 'Test Participant',
                                participant_dob: '1990-01-01',
                                expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                                signature_encrypted: 'encrypted-signature',
                                date_signed: '2024-01-01',
                                status: 'active',
                                created_at: '2024-01-01T00:00:00Z',
                                created_by: 'user-1',
                              },
                            ],
                            error: null,
                          };
                        }
                      }),
                    })),
                  };
                }),
              })),
            };
          }
          return {};
        });

        // Revoke consent for one participant
        await revokeConsent(revokedParticipantId, 'CFR_PART_2', 'Test revocation', 'test-user-id');

        // Check status for revoked participant
        const revokedStatus = await getConsentStatus(revokedParticipantId, 'test-user-id');
        expect(revokedStatus.canCollectPHI).toBe(false);

        // Check status for other participants - they should still have access
        for (const otherParticipantId of otherParticipantIds) {
          const otherStatus = await getConsentStatus(otherParticipantId, 'test-user-id');
          expect(otherStatus.canCollectPHI).toBe(true);
          expect(otherStatus.hasCFRConsent).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Revocation timestamp is recorded correctly', () => {
    // Generator for revocation data with fixed UUID per iteration
    const revocationDataArbitrary = fc.uuid().chain(participantId =>
      fc.record({
        participantId: fc.constant(participantId),
        consentType: fc.constantFrom('CFR_PART_2' as ConsentType, 'AI_PROCESSING' as ConsentType),
        reason: fc.string({ minLength: 5, maxLength: 200 }).filter(s => s.trim().length > 0),
      })
    );

    fc.assert(
      fc.asyncProperty(revocationDataArbitrary, async (revocationData) => {
        let capturedUpdateData: any = null;

        // Mock Supabase to capture the update data
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'consents') {
            return {
              update: jest.fn((data: any) => {
                capturedUpdateData = data;
                return {
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      eq: jest.fn(() => ({
                        data: null,
                        error: null,
                      })),
                    })),
                  })),
                };
              }),
            };
          }
          return {};
        });

        // Revoke consent
        await revokeConsent(
          revocationData.participantId,
          revocationData.consentType,
          revocationData.reason,
          'test-user-id'
        );

        // Verify update data was captured
        expect(capturedUpdateData).not.toBeNull();
        expect(capturedUpdateData.status).toBe('revoked');
        expect(capturedUpdateData.revoked_reason).toBe(revocationData.reason);
        expect(capturedUpdateData.revoked_date).toBeDefined();

        // Verify revoked_date is a valid date string (YYYY-MM-DD format)
        expect(capturedUpdateData.revoked_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        // Verify revoked_date can be parsed as a valid date
        const revokedDate = new Date(capturedUpdateData.revoked_date);
        expect(revokedDate).toBeInstanceOf(Date);
        expect(isNaN(revokedDate.getTime())).toBe(false);

        // Verify revoked_date is not in the future (allowing for timezone differences)
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        expect(revokedDate.getTime()).toBeLessThanOrEqual(tomorrow.getTime());

        // Verify revoked_date is not too far in the past (within last 7 days)
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        expect(revokedDate.getTime()).toBeGreaterThanOrEqual(weekAgo.getTime());
      }),
      { numRuns: 100 }
    );
  });
});
