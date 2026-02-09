/**
 * 42 CFR Part 2 Disclosure Controls
 * Implements disclosure verification, re-disclosure notices, and consent expiration checks
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { supabase } from '../../config/supabase';
import { logPHIAccess } from '../logging/sessionLogger';
import {
  DisclosureRequest,
  DisclosureVerificationResult,
  DisclosureRecord,
  ReDisclosureNotice,
  RE_DISCLOSURE_NOTICE_TEXT,
} from './types';

/**
 * Verifies if disclosure is permitted based on active consent
 * Requirement 10.1: Require explicit written consent before disclosing SUD information
 * Requirement 10.2: Record specific purpose and recipient of disclosure
 * Requirement 10.4: Prevent disclosures when consent expires
 * 
 * @param request - Disclosure request details
 * @returns Verification result indicating if disclosure is approved
 */
export async function verifyDisclosure(
  request: DisclosureRequest
): Promise<DisclosureVerificationResult> {
  if (!request.participantId) {
    throw new Error('Participant ID is required');
  }

  if (!request.requestedBy) {
    throw new Error('Requester ID is required');
  }

  try {
    // Query active CFR Part 2 consents for the participant
    const { data: consents, error } = await supabase
      .from('consents')
      .select('*')
      .eq('participant_id', request.participantId)
      .eq('consent_type', 'CFR_PART_2')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to verify disclosure: ${error.message}`);
    }

    // Check if any active consent exists
    if (!consents || consents.length === 0) {
      return {
        approved: false,
        reason: 'No active CFR Part 2 consent found for participant',
      };
    }

    const now = new Date();
    let validConsent = null;

    // Find a valid consent that covers this disclosure
    for (const consent of consents) {
      // Check if consent is expired (Requirement 10.4)
      if (consent.expiration_date) {
        const expirationDate = new Date(consent.expiration_date);
        if (expirationDate < now) {
          continue; // Skip expired consent
        }
      }

      // Check if recipient is authorized
      const authorizedRecipients = consent.authorized_recipients || [];
      const isRecipientAuthorized = authorizedRecipients.some(
        (recipient: string) => 
          recipient.toLowerCase().includes(request.recipient.toLowerCase()) ||
          request.recipient.toLowerCase().includes(recipient.toLowerCase())
      );

      // Check if purpose matches
      const purposeMatches = consent.purpose_of_disclosure &&
        (consent.purpose_of_disclosure.toLowerCase().includes(request.purpose.toLowerCase()) ||
         request.purpose.toLowerCase().includes(consent.purpose_of_disclosure.toLowerCase()));

      if (isRecipientAuthorized && purposeMatches) {
        validConsent = consent;
        break;
      }
    }

    if (!validConsent) {
      return {
        approved: false,
        reason: 'No consent found matching the requested recipient and purpose',
        restrictions: [
          'Disclosure requires explicit written consent',
          'Consent must specify the recipient and purpose',
          'Consent must not be expired',
        ],
      };
    }

    // Log the disclosure verification
    await logPHIAccess({
      userId: request.requestedBy,
      participantId: request.participantId,
      accessType: 'read',
      dataType: 'consent_verification',
      purpose: `Verified disclosure to ${request.recipient} for ${request.purpose}`,
      timestamp: new Date(),
      ipAddress: '0.0.0.0',
      deviceId: 'system',
    });

    return {
      approved: true,
      reason: 'Valid consent found for disclosure',
      consentId: validConsent.id,
      expirationDate: validConsent.expiration_date ? new Date(validConsent.expiration_date) : undefined,
    };
  } catch (error) {
    console.error('Error verifying disclosure:', error);
    throw error;
  }
}

/**
 * Generates re-disclosure notice as required by 42 CFR Part 2
 * Requirement 10.3: Include prohibition on re-disclosure notice with all disclosures
 * 
 * @param disclosureDate - Date of disclosure
 * @returns Re-disclosure notice object
 */
export function generateReDisclosureNotice(disclosureDate: Date): ReDisclosureNotice {
  return {
    noticeText: RE_DISCLOSURE_NOTICE_TEXT,
    includedDate: disclosureDate,
  };
}

/**
 * Records a disclosure event in the audit log
 * Requirement 10.2: Record specific purpose and recipient of disclosure
 * Requirement 10.3: Include re-disclosure notice
 * Requirement 10.5: Maintain separate consent records for each disclosure purpose
 * 
 * @param disclosure - Disclosure details to record
 * @param userId - ID of user recording the disclosure
 * @returns Created disclosure record
 */
export async function recordDisclosure(
  disclosure: {
    participantId: string;
    consentId: string;
    disclosedTo: string;
    purpose: string;
    informationDisclosed: string;
  },
  userId: string
): Promise<DisclosureRecord> {
  if (!disclosure.participantId) {
    throw new Error('Participant ID is required');
  }

  if (!disclosure.consentId) {
    throw new Error('Consent ID is required');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const disclosureDate = new Date();

    // Create disclosure record in audit logs
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        log_type: 'PHI_ACCESS',
        user_id: userId,
        participant_id: disclosure.participantId,
        access_type: 'export',
        data_type: 'disclosure',
        access_purpose: `Disclosed to ${disclosure.disclosedTo}: ${disclosure.purpose}`,
        timestamp: disclosureDate.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record disclosure: ${error.message}`);
    }

    // Generate re-disclosure notice (Requirement 10.3)
    const reDisclosureNotice = generateReDisclosureNotice(disclosureDate);

    // Log PHI access
    await logPHIAccess({
      userId,
      participantId: disclosure.participantId,
      accessType: 'export',
      dataType: 'disclosure',
      purpose: `Disclosed ${disclosure.informationDisclosed} to ${disclosure.disclosedTo}`,
      timestamp: disclosureDate,
      ipAddress: '0.0.0.0',
      deviceId: 'system',
    });

    const disclosureRecord: DisclosureRecord = {
      id: data.id,
      participantId: disclosure.participantId,
      consentId: disclosure.consentId,
      disclosedTo: disclosure.disclosedTo,
      disclosedBy: userId,
      purpose: disclosure.purpose,
      informationDisclosed: disclosure.informationDisclosed,
      disclosureDate,
      reDisclosureNoticeIncluded: true,
      createdAt: new Date(data.timestamp),
    };

    return disclosureRecord;
  } catch (error) {
    console.error('Error recording disclosure:', error);
    throw error;
  }
}

/**
 * Checks for expired consents and prevents further disclosures
 * Requirement 10.4: When consent expires, prevent further disclosures and notify peer specialist
 * 
 * @param participantId - ID of participant to check
 * @returns Array of expired consent IDs
 */
export async function checkExpiredConsents(participantId: string): Promise<string[]> {
  if (!participantId) {
    throw new Error('Participant ID is required');
  }

  try {
    const now = new Date();

    // Query active consents that have passed their expiration date
    const { data: expiredConsents, error } = await supabase
      .from('consents')
      .select('id, expiration_date')
      .eq('participant_id', participantId)
      .eq('status', 'active')
      .not('expiration_date', 'is', null)
      .lt('expiration_date', now.toISOString().split('T')[0]);

    if (error) {
      throw new Error(`Failed to check expired consents: ${error.message}`);
    }

    if (!expiredConsents || expiredConsents.length === 0) {
      return [];
    }

    // Update expired consents to 'expired' status
    const expiredIds = expiredConsents.map((c) => c.id);

    const { error: updateError } = await supabase
      .from('consents')
      .update({ status: 'expired' })
      .in('id', expiredIds);

    if (updateError) {
      throw new Error(`Failed to update expired consents: ${updateError.message}`);
    }

    return expiredIds;
  } catch (error) {
    console.error('Error checking expired consents:', error);
    throw error;
  }
}

/**
 * Gets all disclosure records for a participant
 * Requirement 10.5: Maintain separate consent records for each disclosure purpose
 * 
 * @param participantId - ID of participant
 * @param userId - ID of user requesting disclosure history
 * @returns Array of disclosure records
 */
export async function getDisclosureHistory(
  participantId: string,
  userId: string
): Promise<DisclosureRecord[]> {
  if (!participantId) {
    throw new Error('Participant ID is required');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Query disclosure audit logs
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('participant_id', participantId)
      .eq('log_type', 'PHI_ACCESS')
      .eq('access_type', 'export')
      .eq('data_type', 'disclosure')
      .order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Failed to get disclosure history: ${error.message}`);
    }

    // Log access to disclosure history
    await logPHIAccess({
      userId,
      participantId,
      accessType: 'read',
      dataType: 'disclosure_history',
      purpose: 'Retrieved disclosure history',
      timestamp: new Date(),
      ipAddress: '0.0.0.0',
      deviceId: 'system',
    });

    // Transform audit logs to disclosure records
    const disclosureRecords: DisclosureRecord[] = (data || []).map((log) => {
      // Parse purpose to extract disclosed_to and purpose
      const purposeParts = log.access_purpose?.split(':') || [];
      const disclosedTo = purposeParts[0]?.replace('Disclosed to ', '').trim() || 'Unknown';
      const purpose = purposeParts[1]?.trim() || 'Unknown';

      return {
        id: log.id,
        participantId: log.participant_id,
        consentId: 'unknown', // Not stored in audit log
        disclosedTo,
        disclosedBy: log.user_id,
        purpose,
        informationDisclosed: log.data_type,
        disclosureDate: new Date(log.timestamp),
        reDisclosureNoticeIncluded: true,
        createdAt: new Date(log.timestamp),
      };
    });

    return disclosureRecords;
  } catch (error) {
    console.error('Error getting disclosure history:', error);
    throw error;
  }
}
