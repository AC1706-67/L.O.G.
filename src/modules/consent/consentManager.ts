/**
 * Consent Manager Component
 * Handles consent capture, storage, and management for 42 CFR Part 2 and AI processing
 * Requirements: 1.1, 1.3, 1.5, 1.7, 1.9, 1.10, 1.11
 */

import { supabase } from '../../config/supabase';
import { encrypt, decryptField } from '../security/encryption';
import { DataType } from '../security/types';
import { logPHIAccess } from '../logging/sessionLogger';
import {
  ConsentData,
  ConsentRecord,
  ConsentStatusResponse,
  ConsentFormSet,
  ConsentType,
  CFR_PART_2_FORM_SCHEMA,
  AI_CONSENT_FORM_SCHEMA,
  COACHING_AGREEMENT_FORM_SCHEMA,
  ACKNOWLEDGEMENT_FORM_SCHEMA,
} from './types';

/**
 * Presents consent forms to user
 * Requirement 1.1: Present CFR Part 2 consent as first required step
 * @param participantId - ID of the participant
 * @returns Set of consent forms to present
 */
export async function presentConsentForms(participantId: string): Promise<ConsentFormSet> {
  if (!participantId) {
    throw new Error('Participant ID is required');
  }

  // Return the consent forms in the required order
  // CFR Part 2 consent must be presented first
  return {
    cfrForm: CFR_PART_2_FORM_SCHEMA,
    aiForm: AI_CONSENT_FORM_SCHEMA,
  };
}

/**
 * Captures consent with signature handling
 * Requirement 1.3: Capture consent with signature
 * Requirement 1.5: Record consent with timestamp, signature, and witness information
 * Requirement 1.7: Create audit entry with all consent details
 * Requirement 1.8: Store consent records in encrypted format
 * @param consent - Consent data to capture
 * @param userId - ID of the user capturing consent
 * @returns Created consent record
 */
export async function captureConsent(
  consent: ConsentData,
  userId: string
): Promise<ConsentRecord> {
  if (!consent.participantId) {
    throw new Error('Participant ID is required');
  }

  if (!consent.signature) {
    throw new Error('Signature is required');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Encrypt sensitive fields
    const signatureEncrypted = await encrypt(consent.signature, DataType.CONSENT);
    const witnessSignatureEncrypted = consent.witnessSignature
      ? await encrypt(consent.witnessSignature, DataType.CONSENT)
      : null;

    // Prepare consent record for database
    const consentRecord = {
      participant_id: consent.participantId,
      consent_type: consent.consentType,
      participant_name: consent.participantName,
      participant_dob: consent.dateOfBirth.toISOString().split('T')[0],
      purpose_of_disclosure: consent.purposeOfDisclosure,
      authorized_recipients: consent.authorizedRecipients,
      information_to_disclose: consent.informationToDisclose,
      expiration_date: consent.expirationDate?.toISOString().split('T')[0],
      signature_encrypted: signatureEncrypted,
      date_signed: consent.dateSigned.toISOString().split('T')[0],
      witness_name: consent.witnessName,
      witness_signature_encrypted: witnessSignatureEncrypted,
      status: 'active',
      created_by: userId,
    };

    // Insert consent record into database
    const { data, error } = await supabase
      .from('consents')
      .insert(consentRecord)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to capture consent: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to capture consent: No data returned');
    }

    // Log PHI access for audit trail (Requirement 1.7)
    await logPHIAccess({
      userId,
      participantId: consent.participantId,
      accessType: 'write',
      dataType: 'consent',
      purpose: `Captured ${consent.consentType} consent`,
      timestamp: new Date(),
      ipAddress: '0.0.0.0', // Will be populated by actual client
      deviceId: 'mobile-app', // Will be populated by actual device
    });

    // Transform database record to ConsentRecord
    const createdRecord: ConsentRecord = {
      id: data.id,
      participantId: data.participant_id,
      consentType: data.consent_type as ConsentType,
      participantName: data.participant_name,
      dateOfBirth: new Date(data.participant_dob),
      purposeOfDisclosure: data.purpose_of_disclosure,
      authorizedRecipients: data.authorized_recipients,
      informationToDisclose: data.information_to_disclose,
      expirationDate: data.expiration_date ? new Date(data.expiration_date) : undefined,
      signature: signatureEncrypted, // Keep encrypted in memory
      dateSigned: new Date(data.date_signed),
      witnessName: data.witness_name,
      witnessSignature: witnessSignatureEncrypted,
      status: data.status,
      revokedDate: data.revoked_date ? new Date(data.revoked_date) : undefined,
      revokedReason: data.revoked_reason,
      createdAt: new Date(data.created_at),
      createdBy: data.created_by,
    };

    return createdRecord;
  } catch (error) {
    console.error('Error capturing consent:', error);
    throw error;
  }
}

/**
 * Gets consent status for a participant
 * Requirement 1.9: Retrieve and display current consent status within 2 seconds
 * @param participantId - ID of the participant
 * @param userId - ID of the user requesting consent status
 * @returns Consent status response
 */
export async function getConsentStatus(
  participantId: string,
  userId: string
): Promise<ConsentStatusResponse> {
  if (!participantId) {
    throw new Error('Participant ID is required');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Query active consents for the participant
    const { data, error } = await supabase
      .from('consents')
      .select('*')
      .eq('participant_id', participantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get consent status: ${error.message}`);
    }

    // Log PHI access for audit trail
    await logPHIAccess({
      userId,
      participantId,
      accessType: 'read',
      dataType: 'consent',
      purpose: 'Retrieved consent status',
      timestamp: new Date(),
      ipAddress: '0.0.0.0',
      deviceId: 'mobile-app',
    });

    // Process consent records
    let hasCFRConsent = false;
    let hasAIConsent = false;
    let cfrExpirationDate: Date | undefined;
    let aiConsentDate: Date | undefined;

    const now = new Date();

    for (const record of data || []) {
      // Check if consent is expired
      const isExpired = record.expiration_date && new Date(record.expiration_date) < now;

      if (record.consent_type === 'CFR_PART_2' && !isExpired) {
        hasCFRConsent = true;
        cfrExpirationDate = record.expiration_date ? new Date(record.expiration_date) : undefined;
      }

      if (record.consent_type === 'AI_PROCESSING' && !isExpired) {
        hasAIConsent = true;
        aiConsentDate = new Date(record.date_signed);
      }
    }

    // Can collect PHI only if CFR Part 2 consent is active
    const canCollectPHI = hasCFRConsent;

    return {
      hasCFRConsent,
      hasAIConsent,
      cfrExpirationDate,
      aiConsentDate,
      canCollectPHI,
    };
  } catch (error) {
    console.error('Error getting consent status:', error);
    throw error;
  }
}

/**
 * Revokes consent for a participant
 * Requirement 1.11: Support consent revocation and immediately restrict access to PHI
 * @param participantId - ID of the participant
 * @param consentType - Type of consent to revoke
 * @param reason - Reason for revocation
 * @param userId - ID of the user revoking consent
 */
export async function revokeConsent(
  participantId: string,
  consentType: ConsentType,
  reason: string,
  userId: string
): Promise<void> {
  if (!participantId) {
    throw new Error('Participant ID is required');
  }

  if (!consentType) {
    throw new Error('Consent type is required');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Update active consents to revoked status
    const { data, error } = await supabase
      .from('consents')
      .update({
        status: 'revoked',
        revoked_date: new Date().toISOString().split('T')[0],
        revoked_reason: reason,
      })
      .eq('participant_id', participantId)
      .eq('consent_type', consentType)
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to revoke consent: ${error.message}`);
    }

    // Log PHI access for audit trail
    await logPHIAccess({
      userId,
      participantId,
      accessType: 'write',
      dataType: 'consent',
      purpose: `Revoked ${consentType} consent: ${reason}`,
      timestamp: new Date(),
      ipAddress: '0.0.0.0',
      deviceId: 'mobile-app',
    });
  } catch (error) {
    console.error('Error revoking consent:', error);
    throw error;
  }
}

/**
 * Gets consents expiring within a specified number of days
 * Requirement 1.10: Track consent expiration dates and notify 30 days before expiration
 * @param daysThreshold - Number of days before expiration to include
 * @param userId - ID of the user requesting expiring consents
 * @returns Array of consent records expiring within threshold
 */
export async function getExpiringConsents(
  daysThreshold: number,
  userId: string
): Promise<ConsentRecord[]> {
  if (daysThreshold < 0) {
    throw new Error('Days threshold must be non-negative');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Calculate threshold date
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    // Query consents expiring within threshold
    const { data, error } = await supabase
      .from('consents')
      .select('*')
      .eq('status', 'active')
      .not('expiration_date', 'is', null)
      .lte('expiration_date', thresholdDate.toISOString().split('T')[0])
      .gte('expiration_date', new Date().toISOString().split('T')[0])
      .order('expiration_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to get expiring consents: ${error.message}`);
    }

    // Transform database records to ConsentRecord format
    const consentRecords: ConsentRecord[] = (data || []).map((record) => ({
      id: record.id,
      participantId: record.participant_id,
      consentType: record.consent_type as ConsentType,
      participantName: record.participant_name,
      dateOfBirth: new Date(record.participant_dob),
      purposeOfDisclosure: record.purpose_of_disclosure,
      authorizedRecipients: record.authorized_recipients,
      informationToDisclose: record.information_to_disclose,
      expirationDate: record.expiration_date ? new Date(record.expiration_date) : undefined,
      signature: record.signature_encrypted,
      dateSigned: new Date(record.date_signed),
      witnessName: record.witness_name,
      witnessSignature: record.witness_signature_encrypted,
      status: record.status,
      revokedDate: record.revoked_date ? new Date(record.revoked_date) : undefined,
      revokedReason: record.revoked_reason,
      createdAt: new Date(record.created_at),
      createdBy: record.created_by,
    }));

    return consentRecords;
  } catch (error) {
    console.error('Error getting expiring consents:', error);
    throw error;
  }
}
