/**
 * Logging Module Types
 * Handles interaction and audit logging for compliance
 */

export enum InteractionType {
  SESSION_NOTE = 'Session Note',
  QUICK_NOTE = 'Quick Note',
  PHONE_CALL = 'Phone Call',
  TEXT_MESSAGE = 'Text/Message',
  OUTREACH_ATTEMPT = 'Outreach Attempt',
  CRISIS_INTERVENTION = 'Crisis Intervention',
  HOME_VISIT = 'Home Visit',
  OFFICE_VISIT = 'Office Visit',
  FIELD_ENCOUNTER = 'Field Encounter',
}

export interface InteractionLog {
  participantId: string;
  staffId: string;
  interactionType: InteractionType;
  date: Date;
  time: string;
  duration?: number; // minutes
  location?: string;
  summary: string;
  followUpNeeded: boolean;
  followUpDate?: Date;
  linkedGoalId?: string;
}

export interface PHIAccessLog {
  userId: string;
  participantId: string;
  accessType: 'read' | 'write' | 'delete';
  dataType: string; // e.g., 'intake', 'assessment', 'consent'
  purpose: string;
  timestamp: Date;
  ipAddress: string;
  deviceId: string;
}

export interface DataChangeLog {
  userId: string;
  participantId: string;
  tableName: string;
  recordId: string;
  fieldName: string;
  oldValue: string; // Encrypted
  newValue: string; // Encrypted
  changeReason?: string;
  timestamp: Date;
}

export interface SessionStart {
  staffId: string;
  participantId?: string;
  sessionType: string;
  startTime: Date;
}

export interface AuditQuery {
  userId?: string;
  participantId?: string;
  startDate?: Date;
  endDate?: Date;
  logType?: string;
}

export interface AuditLog {
  id: string;
  logType: string;
  timestamp: Date;
  details: Record<string, any>;
}
