/**
 * Consent Manager Unit Tests
 * Tests for consent capture and management functions
 */

import {
  presentConsentForms,
  captureConsent,
  getConsentStatus,
  revokeConsent,
  getExpiringConsents,
} from '../consentManager';
import {
  ConsentData,
  ConsentType,
  CFR_PART_2_FORM_SCHEMA,
  AI_CONSENT_FORM_SCHEMA,
} from '../types';

// Mock Supabase
jest.mock('../../../config/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === 'consents') {
        return {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => ({
                data: {
                  id: 'test-consent-id',
                  participant_id: 'test-participant-id',
                  consent_type: 'CFR_PART_2',
                  participant_name: 'Test Participant',
                  participant_dob: '1990-01-01',
                  purpose_of_disclosure: 'Peer recovery support',
                  authorized_recipients: ['Peer Specialist'],
                  information_to_disclose: 'Treatment records',
                  expiration_date: '2025-12-31',
                  signature_encrypted: 'encrypted-signature',
                  date_signed: '2024-01-01',
                  witness_name: 'Test Witness',
                  witness_signature_encrypted: 'encrypted-witness-signature',
                  status: 'active',
                  created_at: '2024-01-01T00:00:00Z',
                  created_by: 'test-user-id',
                },
                error: null,
              })),
            })),
          })),
          select: jest.fn(() => ({
            eq: jest.fn((field: string, value: any) => {
              if (field === 'participant_id') {
                return {
                  eq: jest.fn(() => ({
                    order: jest.fn(() => ({
                      data: [
                        {
                          id: 'test-consent-id',
                          participant_id: 'test-participant-id',
                          consent_type: 'CFR_PART_2',
                          participant_name: 'Test Participant',
                          participant_dob: '1990-01-01',
                          expiration_date: '2027-12-31', // Future date
                          date_signed: '2024-01-01',
                          status: 'active',
                          created_at: '2024-01-01T00:00:00Z',
                          created_by: 'test-user-id',
                        },
                      ],
                      error: null,
                    })),
                  })),
                };
              }
              return {
                not: jest.fn(() => ({
                  lte: jest.fn(() => ({
                    gte: jest.fn(() => ({
                      order: jest.fn(() => ({
                        data: [],
                        error: null,
                      })),
                    })),
                  })),
                })),
              };
            }),
          })),
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
    }),
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

describe('Consent Manager', () => {
  describe('presentConsentForms', () => {
    it('should return CFR Part 2 and AI consent forms', async () => {
      const forms = await presentConsentForms('test-participant-id');

      expect(forms).toBeDefined();
      expect(forms.cfrForm).toEqual(CFR_PART_2_FORM_SCHEMA);
      expect(forms.aiForm).toEqual(AI_CONSENT_FORM_SCHEMA);
    });

    it('should throw error if participant ID is missing', async () => {
      await expect(presentConsentForms('')).rejects.toThrow('Participant ID is required');
    });

    it('should present CFR consent before AI consent (Requirement 1.1)', async () => {
      const forms = await presentConsentForms('test-participant-id');

      // Verify both forms are present
      expect(forms.cfrForm).toBeDefined();
      expect(forms.aiForm).toBeDefined();

      // Verify CFR form is type CFR_PART_2
      expect(forms.cfrForm.type).toBe('CFR_PART_2');
      
      // Verify AI form is type AI_PROCESSING
      expect(forms.aiForm.type).toBe('AI_PROCESSING');

      // Verify the structure indicates CFR form should be presented first
      // The ConsentFormSet interface has cfrForm as the first property
      const formKeys = Object.keys(forms);
      expect(formKeys[0]).toBe('cfrForm');
      expect(formKeys[1]).toBe('aiForm');
    });
  });

  describe('captureConsent', () => {
    const validConsent: ConsentData = {
      participantId: 'test-participant-id',
      consentType: 'CFR_PART_2' as ConsentType,
      participantName: 'Test Participant',
      dateOfBirth: new Date('1990-01-01'),
      purposeOfDisclosure: 'Peer recovery support',
      authorizedRecipients: ['Peer Specialist'],
      informationToDisclose: 'Treatment records',
      expirationDate: new Date('2025-12-31'),
      signature: 'base64-signature-data',
      dateSigned: new Date('2024-01-01'),
      witnessName: 'Test Witness',
      witnessSignature: 'base64-witness-signature',
    };

    it('should capture consent with all required fields', async () => {
      const result = await captureConsent(validConsent, 'test-user-id');

      expect(result).toBeDefined();
      expect(result.id).toBe('test-consent-id');
      expect(result.participantId).toBe('test-participant-id');
      expect(result.consentType).toBe('CFR_PART_2');
      expect(result.status).toBe('active');
    });

    it('should throw error if participant ID is missing', async () => {
      const invalidConsent = { ...validConsent, participantId: '' };
      await expect(captureConsent(invalidConsent, 'test-user-id')).rejects.toThrow(
        'Participant ID is required'
      );
    });

    it('should throw error if signature is missing', async () => {
      const invalidConsent = { ...validConsent, signature: '' };
      await expect(captureConsent(invalidConsent, 'test-user-id')).rejects.toThrow(
        'Signature is required'
      );
    });

    it('should throw error if user ID is missing', async () => {
      await expect(captureConsent(validConsent, '')).rejects.toThrow('User ID is required');
    });
  });

  describe('getConsentStatus', () => {
    it('should return consent status for a participant', async () => {
      // Mock returns consent with future expiration date
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const status = await getConsentStatus('test-participant-id', 'test-user-id');

      expect(status).toBeDefined();
      // The mock returns a consent with expiration_date: '2025-12-31'
      // which should be in the future, so hasCFRConsent should be true
      expect(status.hasCFRConsent).toBe(true);
      expect(status.canCollectPHI).toBe(true);
    });

    it('should throw error if participant ID is missing', async () => {
      await expect(getConsentStatus('', 'test-user-id')).rejects.toThrow(
        'Participant ID is required'
      );
    });

    it('should throw error if user ID is missing', async () => {
      await expect(getConsentStatus('test-participant-id', '')).rejects.toThrow(
        'User ID is required'
      );
    });
  });

  describe('revokeConsent', () => {
    it('should revoke consent for a participant', async () => {
      await expect(
        revokeConsent('test-participant-id', 'CFR_PART_2', 'Participant request', 'test-user-id')
      ).resolves.not.toThrow();
    });

    it('should throw error if participant ID is missing', async () => {
      await expect(
        revokeConsent('', 'CFR_PART_2', 'Participant request', 'test-user-id')
      ).rejects.toThrow('Participant ID is required');
    });

    it('should throw error if consent type is missing', async () => {
      await expect(
        revokeConsent('test-participant-id', '' as ConsentType, 'Participant request', 'test-user-id')
      ).rejects.toThrow('Consent type is required');
    });

    it('should throw error if user ID is missing', async () => {
      await expect(
        revokeConsent('test-participant-id', 'CFR_PART_2', 'Participant request', '')
      ).rejects.toThrow('User ID is required');
    });
  });

  describe('getExpiringConsents', () => {
    it('should return expiring consents within threshold', async () => {
      const consents = await getExpiringConsents(30, 'test-user-id');

      expect(consents).toBeDefined();
      expect(Array.isArray(consents)).toBe(true);
    });

    it('should throw error if days threshold is negative', async () => {
      await expect(getExpiringConsents(-1, 'test-user-id')).rejects.toThrow(
        'Days threshold must be non-negative'
      );
    });

    it('should throw error if user ID is missing', async () => {
      await expect(getExpiringConsents(30, '')).rejects.toThrow('User ID is required');
    });
  });

  describe('consent decline handling', () => {
    it('should prevent PHI collection when consent is declined (Requirement 1.6)', async () => {
      // Mock Supabase to return no active consents (simulating declined consent)
      const { supabase } = require('../../../config/supabase');
      supabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                data: [], // No consents returned - participant declined
                error: null,
              })),
            })),
          })),
        })),
      }));

      // Get consent status for participant who declined consent
      const status = await getConsentStatus('declined-participant-id', 'test-user-id');

      // Verify that PHI collection is prevented
      expect(status.hasCFRConsent).toBe(false);
      expect(status.hasAIConsent).toBe(false);
      expect(status.canCollectPHI).toBe(false);

      // When canCollectPHI is false, the system should prevent PHI collection
      // This flag is checked before any PHI operations
      expect(status.canCollectPHI).toBe(false);
    });
  });
});
