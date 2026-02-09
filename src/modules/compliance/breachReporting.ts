/**
 * Breach Reporting
 * Implements incident report generation and CFR Part 2 compliant notifications
 * Requirement 10.6: Generate incident reports compliant with 42 CFR Part 2 breach notification requirements
 */

import { supabase } from '../../config/supabase';
import { logPHIAccess } from '../logging/sessionLogger';
import { BreachIncident, BreachReport } from './types';

/**
 * Creates a breach incident record
 * 
 * @param incident - Breach incident details
 * @param reportedBy - ID of user reporting the breach
 * @returns Created breach incident
 */
export async function reportBreachIncident(
  incident: Omit<BreachIncident, 'incidentId' | 'reportedBy'>,
  reportedBy: string
): Promise<BreachIncident> {
  if (!reportedBy) {
    throw new Error('Reporter ID is required');
  }

  if (!incident.incidentType) {
    throw new Error('Incident type is required');
  }

  if (!incident.affectedParticipants || incident.affectedParticipants.length === 0) {
    throw new Error('At least one affected participant is required');
  }

  try {
    const incidentId = `BREACH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const reportedDate = new Date();

    // Create security event in audit log
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        log_type: 'SECURITY_EVENT',
        user_id: reportedBy,
        event_type: incident.incidentType,
        severity: incident.severity,
        event_description: `Breach Incident ${incidentId}: ${incident.description}. Affected participants: ${incident.affectedParticipants.length}. Data types: ${incident.affectedDataTypes.join(', ')}`,
        timestamp: reportedDate.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to report breach incident: ${error.message}`);
    }

    // Log PHI access for each affected participant
    for (const participantId of incident.affectedParticipants) {
      await logPHIAccess({
        userId: reportedBy,
        participantId,
        accessType: 'read',
        dataType: 'breach_incident',
        purpose: `Breach incident reported: ${incidentId}`,
        timestamp: reportedDate,
        ipAddress: '0.0.0.0',
        deviceId: 'system',
      });
    }

    const breachIncident: BreachIncident = {
      incidentId,
      incidentType: incident.incidentType,
      severity: incident.severity,
      affectedParticipants: incident.affectedParticipants,
      discoveredDate: incident.discoveredDate,
      reportedDate,
      description: incident.description,
      affectedDataTypes: incident.affectedDataTypes,
      mitigationSteps: incident.mitigationSteps,
      reportedBy,
    };

    return breachIncident;
  } catch (error) {
    console.error('Error reporting breach incident:', error);
    throw error;
  }
}

/**
 * Generates a CFR Part 2 compliant breach notification report
 * Requirement 10.6: Generate incident reports compliant with 42 CFR Part 2
 * 
 * @param incidentId - ID of the breach incident
 * @param reportType - Type of report to generate
 * @param userId - ID of user generating the report
 * @returns Generated breach report
 */
export async function generateBreachReport(
  incidentId: string,
  reportType: 'internal' | 'regulatory' | 'participant_notification',
  userId: string
): Promise<BreachReport> {
  if (!incidentId) {
    throw new Error('Incident ID is required');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Retrieve incident details from audit log
    const { data: incidents, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('log_type', 'SECURITY_EVENT')
      .ilike('event_description', `%${incidentId}%`)
      .order('timestamp', { ascending: false })
      .limit(1);

    if (error || !incidents || incidents.length === 0) {
      throw new Error(`Breach incident ${incidentId} not found`);
    }

    const incident = incidents[0];
    const generatedDate = new Date();
    const reportId = `REPORT-${incidentId}-${reportType.toUpperCase()}-${Date.now()}`;

    // Generate report content based on type
    let reportContent = '';

    if (reportType === 'internal') {
      reportContent = generateInternalReport(incident, incidentId);
    } else if (reportType === 'regulatory') {
      reportContent = generateRegulatoryReport(incident, incidentId);
    } else if (reportType === 'participant_notification') {
      reportContent = generateParticipantNotification(incident, incidentId);
    }

    // Create breach report record
    const breachReport: BreachReport = {
      reportId,
      incidentId,
      reportType,
      generatedDate,
      reportContent,
      recipientType: reportType === 'participant_notification' ? 'participant' : 'organization',
      cfrCompliant: true,
    };

    // Log report generation
    await supabase.from('audit_logs').insert({
      log_type: 'SECURITY_EVENT',
      user_id: userId,
      event_type: 'breach_report_generated',
      severity: 'medium',
      event_description: `Generated ${reportType} breach report ${reportId} for incident ${incidentId}`,
      timestamp: generatedDate.toISOString(),
    });

    return breachReport;
  } catch (error) {
    console.error('Error generating breach report:', error);
    throw error;
  }
}

/**
 * Generates internal breach report for organizational use
 */
function generateInternalReport(incident: any, incidentId: string): string {
  const timestamp = new Date(incident.timestamp);
  
  return `
INTERNAL BREACH INCIDENT REPORT
================================

Incident ID: ${incidentId}
Report Generated: ${new Date().toISOString()}
Incident Type: ${incident.event_type}
Severity: ${incident.severity}
Discovered: ${timestamp.toISOString()}

INCIDENT DESCRIPTION
--------------------
${incident.event_description}

AFFECTED DATA
-------------
This incident may have affected protected health information (PHI) and substance use disorder (SUD) treatment records protected under 42 CFR Part 2.

IMMEDIATE ACTIONS REQUIRED
--------------------------
1. Contain the breach and prevent further unauthorized access
2. Assess the scope of affected participants and data types
3. Document all mitigation steps taken
4. Notify affected participants as required by law
5. Report to regulatory authorities if required
6. Review and update security controls to prevent recurrence

COMPLIANCE REQUIREMENTS
-----------------------
Under 42 CFR Part 2, breaches of SUD treatment records require:
- Immediate investigation and containment
- Notification to affected individuals
- Documentation of the breach and response
- Reporting to appropriate authorities as required by state and federal law

NEXT STEPS
----------
1. Complete detailed incident investigation
2. Generate regulatory report if required
3. Generate participant notifications
4. Implement corrective actions
5. Update security policies and procedures

This report is confidential and protected by attorney-client privilege.
`.trim();
}

/**
 * Generates regulatory breach report for authorities
 */
function generateRegulatoryReport(incident: any, incidentId: string): string {
  const timestamp = new Date(incident.timestamp);
  
  return `
REGULATORY BREACH NOTIFICATION REPORT
======================================

INCIDENT IDENTIFICATION
-----------------------
Incident ID: ${incidentId}
Report Date: ${new Date().toISOString()}
Incident Date: ${timestamp.toISOString()}
Incident Type: ${incident.event_type}
Severity Level: ${incident.severity}

ORGANIZATION INFORMATION
------------------------
Organization: LOG Peer Recovery System
Contact: [Organization Contact Information]
Address: [Organization Address]

INCIDENT DESCRIPTION
--------------------
${incident.event_description}

AFFECTED INFORMATION
--------------------
This incident involved protected health information (PHI) and substance use disorder (SUD) treatment records protected under 42 CFR Part 2 federal confidentiality regulations.

Types of information potentially affected:
- Substance use disorder treatment records
- Assessment results
- Recovery plans
- Interaction notes
- Participant identifying information

DISCOVERY AND RESPONSE
----------------------
Discovery Date: ${timestamp.toISOString()}
Response Actions:
- Immediate containment measures implemented
- Affected participants identified
- Security controls reviewed and enhanced
- Incident investigation initiated

NOTIFICATION ACTIONS
--------------------
Affected participants will be notified in accordance with applicable federal and state breach notification requirements.

COMPLIANCE STATEMENT
--------------------
This report is submitted in compliance with 42 CFR Part 2 breach notification requirements and applicable state and federal laws governing the protection of health information.

The organization has implemented corrective actions to prevent similar incidents and continues to maintain HIPAA-compliant security measures for all protected health information.

Submitted by: [Authorized Representative]
Date: ${new Date().toISOString()}
`.trim();
}

/**
 * Generates participant notification letter
 */
function generateParticipantNotification(incident: any, incidentId: string): string {
  const timestamp = new Date(incident.timestamp);
  
  return `
NOTICE OF BREACH OF PROTECTED HEALTH INFORMATION
=================================================

Date: ${new Date().toLocaleDateString()}

Dear Participant,

We are writing to inform you of a security incident that may have affected your protected health information, including substance use disorder treatment records protected under federal confidentiality regulations (42 CFR Part 2).

WHAT HAPPENED
-------------
On ${timestamp.toLocaleDateString()}, we discovered a security incident involving our peer recovery management system. We immediately took steps to investigate and contain the incident.

WHAT INFORMATION WAS INVOLVED
-----------------------------
The incident may have affected the following types of information:
- Your name and contact information
- Substance use disorder treatment records
- Assessment results
- Recovery plan information
- Interaction notes with peer specialists

WHAT WE ARE DOING
-----------------
We take the security of your information very seriously. Upon discovering this incident, we:
- Immediately contained the breach
- Launched a thorough investigation
- Enhanced our security measures
- Reported the incident to appropriate authorities as required by law

WHAT YOU CAN DO
---------------
We recommend that you:
- Review any communications from our organization carefully
- Contact us if you have questions or concerns
- Monitor for any suspicious activity related to your information
- Exercise your rights under HIPAA and 42 CFR Part 2

YOUR RIGHTS
-----------
Under federal law, you have the right to:
- Access your health information
- Request corrections to your records
- Receive an accounting of disclosures
- File a complaint if you believe your privacy rights have been violated

CONTACT INFORMATION
-------------------
If you have questions or concerns about this incident, please contact:
[Organization Contact Information]
Phone: [Phone Number]
Email: [Email Address]

You may also file a complaint with:
- U.S. Department of Health and Human Services
- Office for Civil Rights
- Website: www.hhs.gov/ocr/privacy/hipaa/complaints/

We sincerely apologize for this incident and any concern it may cause. We remain committed to protecting your privacy and the security of your information.

Sincerely,

[Organization Name]
[Authorized Representative]

---
This notice is provided in compliance with 42 CFR Part 2 and HIPAA breach notification requirements.
`.trim();
}

/**
 * Gets all breach incidents for an organization
 * 
 * @param organizationId - ID of organization
 * @param userId - ID of user requesting breach history
 * @returns Array of breach incidents
 */
export async function getBreachIncidents(
  organizationId: string,
  userId: string
): Promise<any[]> {
  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Query breach incidents from audit logs
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('log_type', 'SECURITY_EVENT')
      .in('event_type', [
        'unauthorized_access',
        'data_loss',
        'disclosure_violation',
        'system_breach',
      ])
      .order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Failed to get breach incidents: ${error.message}`);
    }

    // Log access to breach history
    await supabase.from('audit_logs').insert({
      log_type: 'SECURITY_EVENT',
      user_id: userId,
      event_type: 'breach_history_accessed',
      severity: 'low',
      event_description: 'Accessed breach incident history',
      timestamp: new Date().toISOString(),
    });

    return data || [];
  } catch (error) {
    console.error('Error getting breach incidents:', error);
    throw error;
  }
}

/**
 * Marks a breach report as sent
 * 
 * @param reportId - ID of the report
 * @param userId - ID of user marking report as sent
 */
export async function markReportSent(reportId: string, userId: string): Promise<void> {
  if (!reportId) {
    throw new Error('Report ID is required');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    await supabase.from('audit_logs').insert({
      log_type: 'SECURITY_EVENT',
      user_id: userId,
      event_type: 'breach_report_sent',
      severity: 'low',
      event_description: `Breach report ${reportId} marked as sent`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error marking report as sent:', error);
    throw error;
  }
}
