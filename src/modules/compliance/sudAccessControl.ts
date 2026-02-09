/**
 * SUD Record Access Control
 * Implements specialized access control for substance use disorder records
 * Requirement 10.7: Restrict access to SUD records to only authorized personnel with documented need
 */

import { supabase } from '../../config/supabase';
import { checkAccess, UserContext } from '../security/accessControl';
import { Resource, Action } from '../security/types';
import { logPHIAccess } from '../logging/sessionLogger';
import { SUDAccessRequest, SUDAccessVerificationResult } from './types';

/**
 * SUD-related data types that require special access control
 */
export const SUD_DATA_TYPES = [
  'substance_use_history',
  'mat_information',
  'treatment_history',
  'sud_diagnosis',
  'recovery_path',
  'assessment_suprt_c',
  'assessment_barc_10',
];

/**
 * Verifies if a user has documented need to access SUD records
 * Requirement 10.7: Restrict access to SUD records to authorized personnel with documented need
 * 
 * @param request - SUD access request with documented need
 * @returns Verification result indicating if access is approved
 */
export async function verifySUDAccess(
  request: SUDAccessRequest
): Promise<SUDAccessVerificationResult> {
  if (!request.userId) {
    throw new Error('User ID is required');
  }

  if (!request.participantId) {
    throw new Error('Participant ID is required');
  }

  if (!request.documentedNeed) {
    throw new Error('Documented need is required for SUD record access');
  }

  try {
    // Get user information to determine role and context
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, organization_id')
      .eq('id', request.userId)
      .single();

    if (userError || !userData) {
      return {
        approved: false,
        reason: 'User not found or invalid',
        auditRequired: true,
      };
    }

    // Get participant information
    const { data: participantData, error: participantError } = await supabase
      .from('participants')
      .select('id, assigned_peer_id, organization_id')
      .eq('id', request.participantId)
      .single();

    if (participantError || !participantData) {
      return {
        approved: false,
        reason: 'Participant not found',
        auditRequired: true,
      };
    }

    // Check if user and participant are in the same organization
    if (userData.organization_id !== participantData.organization_id) {
      await logUnauthorizedSUDAccess(request, 'Different organization');
      return {
        approved: false,
        reason: 'User and participant are not in the same organization',
        restrictions: ['SUD records can only be accessed within the same organization'],
        auditRequired: true,
      };
    }

    // Build user context for access control check
    const userContext: UserContext = {
      userId: request.userId,
      role: userData.role,
      organizationId: userData.organization_id,
      assignedParticipants: participantData.assigned_peer_id === request.userId 
        ? [request.participantId] 
        : [],
    };

    // Check basic access permissions using existing access control
    const resource: Resource = {
      type: 'participant',
      id: request.participantId,
    };

    const hasBasicAccess = await checkAccess(userContext, resource, Action.READ);

    if (!hasBasicAccess) {
      await logUnauthorizedSUDAccess(request, 'No basic access permissions');
      return {
        approved: false,
        reason: 'User does not have basic access permissions to this participant',
        restrictions: [
          'SUD records require minimum necessary access',
          'User must be assigned to participant or have supervisor/admin role',
        ],
        auditRequired: true,
      };
    }

    // Verify documented need is substantial
    if (request.documentedNeed.length < 10) {
      return {
        approved: false,
        reason: 'Documented need must be substantial (minimum 10 characters)',
        restrictions: ['Provide detailed justification for accessing SUD records'],
        auditRequired: true,
      };
    }

    // Check if user has active CFR Part 2 consent for the participant
    const { data: consents, error: consentError } = await supabase
      .from('consents')
      .select('id, expiration_date')
      .eq('participant_id', request.participantId)
      .eq('consent_type', 'CFR_PART_2')
      .eq('status', 'active');

    if (consentError) {
      throw new Error(`Failed to verify consent: ${consentError.message}`);
    }

    if (!consents || consents.length === 0) {
      await logUnauthorizedSUDAccess(request, 'No active CFR Part 2 consent');
      return {
        approved: false,
        reason: 'No active CFR Part 2 consent found for participant',
        restrictions: ['SUD records require active CFR Part 2 consent'],
        auditRequired: true,
      };
    }

    // Check if consent is expired
    const now = new Date();
    const validConsent = consents.find((c) => {
      if (!c.expiration_date) return true;
      return new Date(c.expiration_date) >= now;
    });

    if (!validConsent) {
      await logUnauthorizedSUDAccess(request, 'Consent expired');
      return {
        approved: false,
        reason: 'CFR Part 2 consent has expired',
        restrictions: ['Renew consent before accessing SUD records'],
        auditRequired: true,
      };
    }

    // Log the approved SUD access with documented need
    await logPHIAccess({
      userId: request.userId,
      participantId: request.participantId,
      accessType: 'read',
      dataType: 'sud_records',
      purpose: `SUD access - Documented need: ${request.documentedNeed}`,
      timestamp: new Date(),
      ipAddress: '0.0.0.0',
      deviceId: 'system',
    });

    return {
      approved: true,
      reason: 'Access approved with documented need and valid consent',
      auditRequired: true,
    };
  } catch (error) {
    console.error('Error verifying SUD access:', error);
    throw error;
  }
}

/**
 * Logs unauthorized SUD access attempts
 * 
 * @param request - The access request that was denied
 * @param reason - Reason for denial
 */
async function logUnauthorizedSUDAccess(
  request: SUDAccessRequest,
  reason: string
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      log_type: 'SECURITY_EVENT',
      user_id: request.userId,
      participant_id: request.participantId,
      event_type: 'unauthorized_sud_access',
      severity: 'high',
      event_description: `Unauthorized SUD access attempt: ${reason}. Documented need: ${request.documentedNeed}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error logging unauthorized SUD access:', error);
  }
}

/**
 * Checks if a data type is SUD-related and requires special access control
 * 
 * @param dataType - The data type to check
 * @returns true if data type is SUD-related
 */
export function isSUDDataType(dataType: string): boolean {
  return SUD_DATA_TYPES.some((sudType) =>
    dataType.toLowerCase().includes(sudType.toLowerCase())
  );
}

/**
 * Wrapper function to check SUD access before allowing data retrieval
 * 
 * @param userId - ID of user requesting access
 * @param participantId - ID of participant whose SUD data is being accessed
 * @param dataType - Type of SUD data being accessed
 * @param documentedNeed - Documented justification for access
 * @returns true if access is approved
 */
export async function checkSUDAccess(
  userId: string,
  participantId: string,
  dataType: string,
  documentedNeed: string
): Promise<boolean> {
  // Only apply SUD access control if data type is SUD-related
  if (!isSUDDataType(dataType)) {
    return true; // Not SUD data, use regular access control
  }

  const request: SUDAccessRequest = {
    userId,
    participantId,
    purpose: `Access ${dataType}`,
    documentedNeed,
    requestDate: new Date(),
  };

  const result = await verifySUDAccess(request);
  return result.approved;
}

/**
 * Gets SUD access audit trail for a participant
 * 
 * @param participantId - ID of participant
 * @param userId - ID of user requesting audit trail
 * @returns Array of SUD access records
 */
export async function getSUDAccessAudit(
  participantId: string,
  userId: string
): Promise<any[]> {
  if (!participantId) {
    throw new Error('Participant ID is required');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Query SUD access logs
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('participant_id', participantId)
      .eq('data_type', 'sud_records')
      .order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Failed to get SUD access audit: ${error.message}`);
    }

    // Log access to audit trail
    await logPHIAccess({
      userId,
      participantId,
      accessType: 'read',
      dataType: 'sud_access_audit',
      purpose: 'Retrieved SUD access audit trail',
      timestamp: new Date(),
      ipAddress: '0.0.0.0',
      deviceId: 'system',
    });

    return data || [];
  } catch (error) {
    console.error('Error getting SUD access audit:', error);
    throw error;
  }
}
