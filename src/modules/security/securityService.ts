/**
 * Security Service
 * Handles security alert generation and management
 * Requirements: 11.5, 9.7
 */

import { supabase } from '../../config/supabase';
import { SecurityAlert, SecurityAlertData } from './types';

/**
 * Generates a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generates a security alert and stores it in the database
 * Requirement 11.5: Create security alert for unauthorized access
 * 
 * @param alertData - Security alert data
 * @returns The created security alert
 */
export async function generateSecurityAlert(
  alertData: SecurityAlertData
): Promise<SecurityAlert> {
  try {
    const alert: SecurityAlert = {
      alertId: generateUUID(),
      severity: alertData.severity,
      type: alertData.type,
      description: alertData.description,
      userId: alertData.userId,
      timestamp: new Date(),
      requiresAction: alertData.requiresAction,
    };

    // Store alert in audit logs
    const { error } = await supabase.from('audit_logs').insert({
      log_type: 'SECURITY_EVENT',
      user_id: alertData.userId,
      event_type: alertData.type,
      severity: alertData.severity,
      event_description: alertData.description,
      timestamp: alert.timestamp.toISOString(),
    });

    if (error) {
      throw new Error(`Failed to generate security alert: ${error.message}`);
    }

    // In a production system, this would also:
    // - Send notifications to administrators
    // - Trigger automated response workflows
    // - Update security dashboards
    console.warn(`SECURITY ALERT [${alert.severity}]: ${alert.description}`);

    return alert;
  } catch (error) {
    console.error('Error generating security alert:', error);
    throw error;
  }
}

/**
 * Retrieves security alerts for a specific user
 * 
 * @param userId - User ID to get alerts for
 * @param severity - Optional severity filter
 * @returns Array of security alerts
 */
export async function getSecurityAlerts(
  userId?: string,
  severity?: SecurityAlert['severity']
): Promise<SecurityAlert[]> {
  try {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('log_type', 'SECURITY_EVENT');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, error } = await query.order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Failed to retrieve security alerts: ${error.message}`);
    }

    return (data || []).map((record) => ({
      alertId: record.id,
      severity: record.severity,
      type: record.event_type,
      description: record.event_description,
      userId: record.user_id,
      timestamp: new Date(record.timestamp),
      requiresAction: record.severity === 'high' || record.severity === 'critical',
    }));
  } catch (error) {
    console.error('Error retrieving security alerts:', error);
    throw error;
  }
}

/**
 * Marks a security alert as resolved
 * 
 * @param alertId - Alert ID to resolve
 * @param resolvedBy - User ID who resolved the alert
 * @param resolution - Resolution notes
 */
export async function resolveSecurityAlert(
  alertId: string,
  resolvedBy: string,
  resolution: string
): Promise<void> {
  try {
    // In a production system, this would update the alert status
    // For now, we'll add a new audit log entry
    const { error } = await supabase.from('audit_logs').insert({
      log_type: 'SECURITY_EVENT',
      user_id: resolvedBy,
      event_type: 'ALERT_RESOLVED',
      severity: 'low',
      event_description: `Resolved alert ${alertId}: ${resolution}`,
      timestamp: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Failed to resolve security alert: ${error.message}`);
    }
  } catch (error) {
    console.error('Error resolving security alert:', error);
    throw error;
  }
}

/**
 * Securely deletes data by overwriting it before deletion
 * Requirement 9.7: Securely overwrite data to prevent recovery
 * 
 * @param tableName - Name of the table
 * @param recordId - ID of the record to delete
 * @param sensitiveFields - Array of field names containing sensitive data
 */
export async function secureDelete(
  tableName: string,
  recordId: string,
  sensitiveFields: string[]
): Promise<void> {
  try {
    // Step 1: Overwrite sensitive fields with random data
    const overwriteData: Record<string, string> = {};
    for (const field of sensitiveFields) {
      // Generate random string of same length as typical encrypted data
      overwriteData[field] = generateRandomString(256);
    }

    const { error: updateError } = await supabase
      .from(tableName)
      .update(overwriteData)
      .eq('id', recordId);

    if (updateError) {
      throw new Error(`Failed to overwrite data: ${updateError.message}`);
    }

    // Step 2: Overwrite again with different random data (double overwrite)
    const overwriteData2: Record<string, string> = {};
    for (const field of sensitiveFields) {
      overwriteData2[field] = generateRandomString(256);
    }

    const { error: updateError2 } = await supabase
      .from(tableName)
      .update(overwriteData2)
      .eq('id', recordId);

    if (updateError2) {
      throw new Error(`Failed to perform second overwrite: ${updateError2.message}`);
    }

    // Step 3: Delete the record
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .eq('id', recordId);

    if (deleteError) {
      throw new Error(`Failed to delete record: ${deleteError.message}`);
    }

    // Log the secure deletion
    await supabase.from('audit_logs').insert({
      log_type: 'DATA_CHANGE',
      table_name: tableName,
      record_id: recordId,
      event_type: 'SECURE_DELETE',
      event_description: `Securely deleted record from ${tableName}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error performing secure delete:', error);
    throw error;
  }
}

/**
 * Generates a random string of specified length
 * 
 * @param length - Length of the random string
 * @returns Random string
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
