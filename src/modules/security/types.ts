/**
 * Security Module Types
 * Handles encryption, access control, and security monitoring
 */

export enum DataType {
  PHI = 'PHI',
  PII = 'PII',
  AUDIT_LOG = 'AUDIT_LOG',
  CONSENT = 'CONSENT',
}

export enum Action {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  EXPORT = 'export',
}

export interface Resource {
  type: 'participant' | 'assessment' | 'consent' | 'plan' | 'interaction';
  id: string;
}

export interface Activity {
  userId: string;
  action: string;
  resource: Resource;
  timestamp: Date;
  ipAddress: string;
  deviceId: string;
}

export interface SecurityAlert {
  alertId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  userId: string;
  timestamp: Date;
  requiresAction: boolean;
}

export interface SecurityAlertData {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  userId: string;
  requiresAction: boolean;
}
