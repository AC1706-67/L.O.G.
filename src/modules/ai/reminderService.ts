/**
 * Reminder Service
 * Tracks assessment due dates and generates reminders for peer specialists
 */

import { supabase } from '../../config/supabase';

export interface AssessmentReminder {
  participantId: string;
  participantName: string;
  assessmentType: 'SUPRT_C' | 'BARC_10' | 'SSM';
  dueDate: Date;
  lastAssessmentDate?: Date;
  assignedPeerId: string;
  daysUntilDue: number;
  priority: 'low' | 'medium' | 'high' | 'overdue';
}

export interface ReminderSettings {
  advanceNoticeDays: number; // Default: 7 days
  overdueCheckEnabled: boolean;
  reminderFrequency: 'daily' | 'weekly';
}

const DEFAULT_SETTINGS: ReminderSettings = {
  advanceNoticeDays: 7,
  overdueCheckEnabled: true,
  reminderFrequency: 'daily',
};

/**
 * Get assessment due date reminders for a peer specialist
 * Returns assessments due within the specified number of days
 */
export async function getAssessmentReminders(
  peerId: string,
  settings: Partial<ReminderSettings> = {}
): Promise<AssessmentReminder[]> {
  try {
    const config = { ...DEFAULT_SETTINGS, ...settings };
    const reminders: AssessmentReminder[] = [];

    // Get all participants assigned to this peer
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('id, first_name_encrypted, last_name_encrypted, created_at')
      .eq('assigned_peer_id', peerId)
      .eq('status', 'active');

    if (participantsError) {
      throw participantsError;
    }

    if (!participants || participants.length === 0) {
      return [];
    }

    // For each participant, check assessment due dates
    for (const participant of participants) {
      const participantReminders = await getParticipantAssessmentReminders(
        participant.id,
        participant.first_name_encrypted,
        participant.last_name_encrypted,
        peerId,
        config
      );
      reminders.push(...participantReminders);
    }

    // Sort by priority and due date
    reminders.sort((a, b) => {
      const priorityOrder = { overdue: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

    return reminders;
  } catch (error) {
    console.error('Error getting assessment reminders:', error);
    throw new Error(`Failed to get assessment reminders: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get assessment reminders for a specific participant
 */
async function getParticipantAssessmentReminders(
  participantId: string,
  firstNameEncrypted: string,
  lastNameEncrypted: string,
  peerId: string,
  settings: ReminderSettings
): Promise<AssessmentReminder[]> {
  const reminders: AssessmentReminder[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get last assessments for each type
  const { data: assessments, error } = await supabase
    .from('assessments')
    .select('assessment_type, completed_at')
    .eq('participant_id', participantId)
    .eq('is_complete', true)
    .order('completed_at', { ascending: false });

  if (error) {
    console.error('Error fetching assessments:', error);
    return [];
  }

  // Define assessment schedules (in days)
  const assessmentSchedules: Record<string, number> = {
    SUPRT_C: 90, // Quarterly
    BARC_10: 90, // Quarterly
    SSM: 90, // Initial, 3-month, 6-month, 1-year
  };

  // Check each assessment type
  for (const [assessmentType, intervalDays] of Object.entries(assessmentSchedules)) {
    const lastAssessment = assessments?.find(a => a.assessment_type === assessmentType);
    
    let dueDate: Date;
    let lastAssessmentDate: Date | undefined;

    if (lastAssessment) {
      // Calculate next due date based on last assessment
      lastAssessmentDate = new Date(lastAssessment.completed_at);
      dueDate = new Date(lastAssessmentDate);
      dueDate.setDate(dueDate.getDate() + intervalDays);
    } else {
      // No previous assessment - due immediately or based on enrollment
      dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + 7); // Give 7 days for initial assessment
    }

    // Calculate days until due
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Determine if reminder should be shown
    const shouldRemind = 
      daysUntilDue <= settings.advanceNoticeDays || 
      (settings.overdueCheckEnabled && daysUntilDue < 0);

    if (shouldRemind) {
      // Determine priority
      let priority: AssessmentReminder['priority'];
      if (daysUntilDue < 0) {
        priority = 'overdue';
      } else if (daysUntilDue <= 2) {
        priority = 'high';
      } else if (daysUntilDue <= 5) {
        priority = 'medium';
      } else {
        priority = 'low';
      }

      reminders.push({
        participantId,
        participantName: `${firstNameEncrypted} ${lastNameEncrypted}`, // Would need decryption in real app
        assessmentType: assessmentType as 'SUPRT_C' | 'BARC_10' | 'SSM',
        dueDate,
        lastAssessmentDate,
        assignedPeerId: peerId,
        daysUntilDue,
        priority,
      });
    }
  }

  return reminders;
}

/**
 * Generate reminder notification text
 */
export function generateReminderText(reminder: AssessmentReminder): string {
  const assessmentNames: Record<string, string> = {
    SUPRT_C: 'SUPRT-C Baseline Assessment',
    BARC_10: 'BARC-10 Assessment',
    SSM: 'Self-Sufficiency Matrix',
  };

  const assessmentName = assessmentNames[reminder.assessmentType] || reminder.assessmentType;

  if (reminder.priority === 'overdue') {
    const daysOverdue = Math.abs(reminder.daysUntilDue);
    return `OVERDUE: ${assessmentName} for ${reminder.participantName} was due ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} ago.`;
  } else {
    return `REMINDER: ${assessmentName} for ${reminder.participantName} is due in ${reminder.daysUntilDue} day${reminder.daysUntilDue !== 1 ? 's' : ''}.`;
  }
}

/**
 * Get reminder summary for a peer specialist
 */
export async function getReminderSummary(
  peerId: string,
  settings: Partial<ReminderSettings> = {}
): Promise<{
  totalReminders: number;
  overdueCount: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  reminders: AssessmentReminder[];
}> {
  const reminders = await getAssessmentReminders(peerId, settings);

  return {
    totalReminders: reminders.length,
    overdueCount: reminders.filter(r => r.priority === 'overdue').length,
    highPriorityCount: reminders.filter(r => r.priority === 'high').length,
    mediumPriorityCount: reminders.filter(r => r.priority === 'medium').length,
    lowPriorityCount: reminders.filter(r => r.priority === 'low').length,
    reminders,
  };
}

/**
 * Mark reminder as acknowledged
 * This could be used to track when peer specialists have seen reminders
 */
export async function acknowledgeReminder(
  peerId: string,
  participantId: string,
  assessmentType: string
): Promise<void> {
  try {
    // In a full implementation, this would log the acknowledgment
    // For now, we'll just log it
    console.log(`Reminder acknowledged: Peer ${peerId}, Participant ${participantId}, Assessment ${assessmentType}`);
    
    // Could store acknowledgments in a separate table for tracking
  } catch (error) {
    console.error('Error acknowledging reminder:', error);
  }
}

/**
 * Calculate next assessment due date based on assessment type and last completion
 */
export function calculateNextDueDate(
  assessmentType: 'SUPRT_C' | 'BARC_10' | 'SSM',
  lastCompletedDate?: Date
): Date {
  const intervalDays: Record<string, number> = {
    SUPRT_C: 90,
    BARC_10: 90,
    SSM: 90,
  };

  const interval = intervalDays[assessmentType] || 90;
  const baseDate = lastCompletedDate || new Date();
  
  const dueDate = new Date(baseDate);
  dueDate.setDate(dueDate.getDate() + interval);
  
  return dueDate;
}
