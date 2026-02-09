/**
 * Compliance Module Types
 * Handles 42 CFR Part 2 compliance, disclosure controls, and breach reporting
 */

export interface DisclosureRequest {
  participantId: string;
  requestedBy: string;
  purpose: string;
  recipient: string;
  informationType: string;
  requestDate: Date;
}

export interface DisclosureVerificationResult {
  approved: boolean;
  reason: string;
  consentId?: string;
  expirationDate?: Date;
  restrictions?: string[];
}

export interface DisclosureRecord {
  id: string;
  participantId: string;
  consentId: string;
  disclosedTo: string;
  disclosedBy: string;
  purpose: string;
  informationDisclosed: string;
  disclosureDate: Date;
  reDisclosureNoticeIncluded: boolean;
  createdAt: Date;
}

export interface ReDisclosureNotice {
  noticeText: string;
  includedDate: Date;
  acknowledgedBy?: string;
}

export interface SUDAccessRequest {
  userId: string;
  participantId: string;
  purpose: string;
  documentedNeed: string;
  requestDate: Date;
}

export interface SUDAccessVerificationResult {
  approved: boolean;
  reason: string;
  restrictions?: string[];
  auditRequired: boolean;
}

export interface BreachIncident {
  incidentId: string;
  incidentType: 'unauthorized_access' | 'data_loss' | 'disclosure_violation' | 'system_breach';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedParticipants: string[];
  discoveredDate: Date;
  reportedDate?: Date;
  description: string;
  affectedDataTypes: string[];
  mitigationSteps: string[];
  reportedBy: string;
}

export interface BreachReport {
  reportId: string;
  incidentId: string;
  reportType: 'internal' | 'regulatory' | 'participant_notification';
  generatedDate: Date;
  reportContent: string;
  recipientType: string;
  sentDate?: Date;
  cfrCompliant: boolean;
}

export const RE_DISCLOSURE_NOTICE_TEXT = `
NOTICE: This information has been disclosed to you from records protected by Federal confidentiality rules (42 CFR Part 2). The Federal rules prohibit you from making any further disclosure of this information unless further disclosure is expressly permitted by the written consent of the person to whom it pertains or as otherwise permitted by 42 CFR Part 2. A general authorization for the release of medical or other information is NOT sufficient for this purpose. The Federal rules restrict any use of the information to criminally investigate or prosecute any alcohol or drug abuse patient.
`.trim();
