/**
 * Session Logger Component
 * Records all interactions, PHI access, and data modifications for compliance auditing
 * Requirements: 5.1, 5.4, 5.5, 5.7, 5.8
 */

import { supabase } from '../../config/supabase';
import { encrypt } from '../security/encryption';
import { DataType } from '../security/types';
import {
  InteractionLog,
  PHIAccessLog,
  DataChangeLog,
  SessionStart,
  AuditQuery,
  AuditLog,
} from './types';

/**
 * Logs an interaction between staff and participant
 * Requirement 5.1: Record interaction with timestamp, user identifier, and action type
 * Requirement 5.3: Record participant ID, staff ID, date, time, duration, type, location, and summary
 * @param interaction - Interaction details to log
 */
export async function logInteraction(interaction: InteractionLog): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('interactions')
      .insert({
        participant_id: interaction.participantId,
        staff_id: interaction.staffId,
        interaction_type: interaction.interactionType,
        interaction_date: interaction.date.toISOString().split('T')[0],
        interaction_time: interaction.time,
        duration_minutes: interaction.duration,
        location: interaction.location,
        summary: interaction.summary,
        follow_up_needed: interaction.followUpNeeded,
        follow_up_date: interaction.followUpDate?.toISOString().split('T')[0],
        linked_goal_id: interaction.linkedGoalId,
      });

    if (error) {
      throw new Error(`Failed to log interaction: ${error.message}`);
    }
  } catch (error) {
    console.error('Error logging interaction:', error);
    throw error;
  }
}

/**
 * Logs PHI access for audit trail
 * Requirement 5.4: Record who accessed PHI, when, and for what purpose
 * @param access - PHI access details to log
 */
export async function logPHIAccess(access: PHIAccessLog): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        log_type: 'PHI_ACCESS',
        user_id: access.userId,
        participant_id: access.participantId,
        access_type: access.accessType,
        data_type: access.dataType,
        access_purpose: access.purpose,
        ip_address: access.ipAddress,
        device_id: access.deviceId,
        timestamp: access.timestamp.toISOString(),
      });

    if (error) {
      throw new Error(`Failed to log PHI access: ${error.message}`);
    }
  } catch (error) {
    console.error('Error logging PHI access:', error);
    throw error;
  }
}

/**
 * Logs data modifications for audit trail
 * Requirement 5.5: Record previous value, new value, and user who made the change
 * @param change - Data change details to log
 */
export async function logDataChange(change: DataChangeLog): Promise<void> {
  try {
    // Encrypt old and new values before storing
    const oldValueEncrypted = await encrypt(change.oldValue, DataType.AUDIT_LOG);
    const newValueEncrypted = await encrypt(change.newValue, DataType.AUDIT_LOG);

    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        log_type: 'DATA_CHANGE',
        user_id: change.userId,
        participant_id: change.participantId,
        table_name: change.tableName,
        record_id: change.recordId,
        field_name: change.fieldName,
        old_value_encrypted: oldValueEncrypted,
        new_value_encrypted: newValueEncrypted,
        change_reason: change.changeReason,
        timestamp: change.timestamp.toISOString(),
      });

    if (error) {
      throw new Error(`Failed to log data change: ${error.message}`);
    }
  } catch (error) {
    console.error('Error logging data change:', error);
    throw error;
  }
}

/**
 * Starts a new session and creates a session record
 * Requirement 5.7: Create session record with start time and session type
 * @param session - Session start details
 * @returns Session ID for tracking
 */
export async function startSession(session: SessionStart): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        log_type: 'SESSION',
        user_id: session.staffId,
        participant_id: session.participantId,
        session_type: session.sessionType,
        session_start: session.startTime.toISOString(),
        timestamp: session.startTime.toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to start session: ${error.message}`);
    }

    if (!data || !data.id) {
      throw new Error('Failed to create session: No session ID returned');
    }

    return data.id;
  } catch (error) {
    console.error('Error starting session:', error);
    throw error;
  }
}

/**
 * Ends a session and updates the session record
 * Requirement 5.8: Update session record with end time and summary
 * @param sessionId - ID of the session to end
 * @param summary - Summary of the session
 */
export async function endSession(sessionId: string, summary: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .update({
        session_end: new Date().toISOString(),
        session_summary: summary,
      })
      .eq('id', sessionId)
      .eq('log_type', 'SESSION');

    if (error) {
      throw new Error(`Failed to end session: ${error.message}`);
    }
  } catch (error) {
    console.error('Error ending session:', error);
    throw error;
  }
}

/**
 * Queries audit logs based on provided criteria
 * @param query - Query parameters for filtering audit logs
 * @returns Array of matching audit log entries
 */
export async function queryAuditLogs(query: AuditQuery): Promise<AuditLog[]> {
  try {
    let supabaseQuery = supabase
      .from('audit_logs')
      .select('*');

    if (query.userId) {
      supabaseQuery = supabaseQuery.eq('user_id', query.userId);
    }

    if (query.participantId) {
      supabaseQuery = supabaseQuery.eq('participant_id', query.participantId);
    }

    if (query.logType) {
      supabaseQuery = supabaseQuery.eq('log_type', query.logType);
    }

    if (query.startDate) {
      supabaseQuery = supabaseQuery.gte('timestamp', query.startDate.toISOString());
    }

    if (query.endDate) {
      supabaseQuery = supabaseQuery.lte('timestamp', query.endDate.toISOString());
    }

    const { data, error } = await supabaseQuery.order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Failed to query audit logs: ${error.message}`);
    }

    // Transform database records to AuditLog format
    return (data || []).map((record) => ({
      id: record.id,
      logType: record.log_type,
      timestamp: new Date(record.timestamp),
      details: {
        userId: record.user_id,
        participantId: record.participant_id,
        accessType: record.access_type,
        dataType: record.data_type,
        purpose: record.access_purpose,
        tableName: record.table_name,
        recordId: record.record_id,
        fieldName: record.field_name,
        sessionType: record.session_type,
        sessionStart: record.session_start,
        sessionEnd: record.session_end,
        sessionSummary: record.session_summary,
        ipAddress: record.ip_address,
        deviceId: record.device_id,
      },
    }));
  } catch (error) {
    console.error('Error querying audit logs:', error);
    throw error;
  }
}
