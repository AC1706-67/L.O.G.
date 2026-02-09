/**
 * Recovery Plan Manager Component
 * Creates and tracks participant recovery goals collaboratively
 * Requirements: 6.1, 6.6, 6.7, 6.9, 6.10
 */

import { supabase } from '../../config/supabase';
import { logDataChange } from '../logging/sessionLogger';
import {
  RecoveryPlan,
  Goal,
  GoalData,
  GoalStatus,
  ProgressNote,
} from './types';

/**
 * Creates a new recovery plan for a participant
 * Requirement 6.1: Create new Recovery_Plan record linked to participant with creation date and overall status
 * @param participantId - ID of the participant
 * @param createdBy - ID of the staff member creating the plan
 * @returns The created recovery plan
 */
export async function createPlan(
  participantId: string,
  createdBy: string
): Promise<RecoveryPlan> {
  try {
    const { data, error } = await supabase
      .from('recovery_plans')
      .insert({
        participant_id: participantId,
        created_date: new Date().toISOString().split('T')[0],
        review_dates: [],
        overall_status: 'active',
        created_by: createdBy,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create recovery plan: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create recovery plan: No data returned');
    }

    return {
      planId: data.id,
      participantId: data.participant_id,
      createdDate: new Date(data.created_date),
      reviewDates: (data.review_dates || []).map((date: string) => new Date(date)),
      overallStatus: data.overall_status,
      goals: [],
    };
  } catch (error) {
    console.error('Error creating recovery plan:', error);
    throw error;
  }
}

/**
 * Adds a goal to an existing recovery plan
 * Requirement 6.6: Store all goals with timestamps and participant agreement confirmation
 * @param planId - ID of the recovery plan
 * @param goal - Goal data to add
 * @param createdBy - ID of the staff member creating the goal
 * @returns The created goal
 */
export async function addGoal(
  planId: string,
  goal: GoalData,
  createdBy: string
): Promise<Goal> {
  try {
    const { data, error } = await supabase
      .from('goals')
      .insert({
        plan_id: planId,
        description: goal.description,
        category: goal.category,
        target_date: goal.targetDate.toISOString().split('T')[0],
        status: 'Not Started',
        barriers_identified: goal.barriersIdentified,
        support_needed: goal.supportNeeded,
        action_steps: goal.actionSteps,
        created_date: new Date().toISOString().split('T')[0],
        created_by: createdBy,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to add goal: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to add goal: No data returned');
    }

    return {
      goalId: data.id,
      description: data.description,
      category: data.category,
      targetDate: new Date(data.target_date),
      status: data.status as GoalStatus,
      barriersIdentified: data.barriers_identified || [],
      supportNeeded: data.support_needed || [],
      actionSteps: data.action_steps || [],
      createdDate: new Date(data.created_date),
      lastUpdated: new Date(data.last_updated),
      progressNotes: [],
    };
  } catch (error) {
    console.error('Error adding goal:', error);
    throw error;
  }
}

/**
 * Updates the status of a goal
 * Requirement 6.9: Integrate with session logger for goal changes
 * @param goalId - ID of the goal to update
 * @param status - New status for the goal
 * @param notes - Progress notes explaining the status change
 * @param userId - ID of the user making the change
 * @param participantId - ID of the participant (for audit logging)
 */
export async function updateGoalStatus(
  goalId: string,
  status: GoalStatus,
  notes: string,
  userId: string,
  participantId: string
): Promise<void> {
  try {
    // Get current goal status for audit logging
    const { data: currentGoal, error: fetchError } = await supabase
      .from('goals')
      .select('status')
      .eq('id', goalId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch current goal: ${fetchError.message}`);
    }

    const oldStatus = currentGoal?.status || 'Unknown';

    // Update goal status
    const { error: updateError } = await supabase
      .from('goals')
      .update({
        status,
        last_updated: new Date().toISOString(),
      })
      .eq('id', goalId);

    if (updateError) {
      throw new Error(`Failed to update goal status: ${updateError.message}`);
    }

    // Log the data change for audit trail
    await logDataChange({
      userId,
      participantId,
      tableName: 'goals',
      recordId: goalId,
      fieldName: 'status',
      oldValue: oldStatus,
      newValue: status,
      changeReason: notes,
      timestamp: new Date(),
    });

    // Add progress note if provided
    if (notes) {
      await addProgressNote(goalId, userId, notes);
    }
  } catch (error) {
    console.error('Error updating goal status:', error);
    throw error;
  }
}

/**
 * Adds a progress note to a goal
 * Requirement 6.9: Create progress note functions
 * @param goalId - ID of the goal
 * @param staffId - ID of the staff member adding the note
 * @param note - Progress note text
 * @param linkedInteractionId - Optional ID of related interaction
 * @returns The created progress note
 */
export async function addProgressNote(
  goalId: string,
  staffId: string,
  note: string,
  linkedInteractionId?: string
): Promise<ProgressNote> {
  try {
    const { data, error } = await supabase
      .from('progress_notes')
      .insert({
        goal_id: goalId,
        note_date: new Date().toISOString().split('T')[0],
        staff_id: staffId,
        note,
        linked_interaction_id: linkedInteractionId,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to add progress note: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to add progress note: No data returned');
    }

    return {
      noteId: data.id,
      date: new Date(data.note_date),
      staffId: data.staff_id,
      note: data.note,
      linkedInteractionId: data.linked_interaction_id,
    };
  } catch (error) {
    console.error('Error adding progress note:', error);
    throw error;
  }
}

/**
 * Retrieves a recovery plan with all its goals
 * Requirement 6.7: Display all goals with current status and progress indicators
 * @param planId - ID of the recovery plan
 * @returns The recovery plan with all goals
 */
export async function getPlan(planId: string): Promise<RecoveryPlan> {
  try {
    // Fetch the plan
    const { data: planData, error: planError } = await supabase
      .from('recovery_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError) {
      throw new Error(`Failed to fetch recovery plan: ${planError.message}`);
    }

    if (!planData) {
      throw new Error('Recovery plan not found');
    }

    // Fetch all goals for this plan
    const { data: goalsData, error: goalsError } = await supabase
      .from('goals')
      .select('*')
      .eq('plan_id', planId)
      .order('created_date', { ascending: true });

    if (goalsError) {
      throw new Error(`Failed to fetch goals: ${goalsError.message}`);
    }

    // Fetch progress notes for all goals
    const goals: Goal[] = await Promise.all(
      (goalsData || []).map(async (goalData) => {
        const { data: notesData, error: notesError } = await supabase
          .from('progress_notes')
          .select('*')
          .eq('goal_id', goalData.id)
          .order('note_date', { ascending: false });

        if (notesError) {
          console.error(`Failed to fetch progress notes for goal ${goalData.id}:`, notesError);
        }

        const progressNotes: ProgressNote[] = (notesData || []).map((note) => ({
          noteId: note.id,
          date: new Date(note.note_date),
          staffId: note.staff_id,
          note: note.note,
          linkedInteractionId: note.linked_interaction_id,
        }));

        return {
          goalId: goalData.id,
          description: goalData.description,
          category: goalData.category,
          targetDate: new Date(goalData.target_date),
          status: goalData.status as GoalStatus,
          barriersIdentified: goalData.barriers_identified || [],
          supportNeeded: goalData.support_needed || [],
          actionSteps: goalData.action_steps || [],
          createdDate: new Date(goalData.created_date),
          lastUpdated: new Date(goalData.last_updated),
          progressNotes,
        };
      })
    );

    return {
      planId: planData.id,
      participantId: planData.participant_id,
      createdDate: new Date(planData.created_date),
      reviewDates: (planData.review_dates || []).map((date: string) => new Date(date)),
      overallStatus: planData.overall_status,
      goals,
    };
  } catch (error) {
    console.error('Error fetching recovery plan:', error);
    throw error;
  }
}

/**
 * Retrieves goals filtered by status
 * Requirement 6.7: Support filtering goals by status
 * @param planId - ID of the recovery plan
 * @param status - Status to filter by
 * @returns Array of goals with the specified status
 */
export async function getGoalsByStatus(
  planId: string,
  status: GoalStatus
): Promise<Goal[]> {
  try {
    const { data: goalsData, error } = await supabase
      .from('goals')
      .select('*')
      .eq('plan_id', planId)
      .eq('status', status)
      .order('created_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch goals by status: ${error.message}`);
    }

    // Fetch progress notes for each goal
    const goals: Goal[] = await Promise.all(
      (goalsData || []).map(async (goalData) => {
        const { data: notesData, error: notesError } = await supabase
          .from('progress_notes')
          .select('*')
          .eq('goal_id', goalData.id)
          .order('note_date', { ascending: false });

        if (notesError) {
          console.error(`Failed to fetch progress notes for goal ${goalData.id}:`, notesError);
        }

        const progressNotes: ProgressNote[] = (notesData || []).map((note) => ({
          noteId: note.id,
          date: new Date(note.note_date),
          staffId: note.staff_id,
          note: note.note,
          linkedInteractionId: note.linked_interaction_id,
        }));

        return {
          goalId: goalData.id,
          description: goalData.description,
          category: goalData.category,
          targetDate: new Date(goalData.target_date),
          status: goalData.status as GoalStatus,
          barriersIdentified: goalData.barriers_identified || [],
          supportNeeded: goalData.support_needed || [],
          actionSteps: goalData.action_steps || [],
          createdDate: new Date(goalData.created_date),
          lastUpdated: new Date(goalData.last_updated),
          progressNotes,
        };
      })
    );

    return goals;
  } catch (error) {
    console.error('Error fetching goals by status:', error);
    throw error;
  }
}

/**
 * Schedules a review date for a recovery plan
 * Requirement 6.10: Track review dates for periodic plan reassessment
 * @param planId - ID of the recovery plan
 * @param reviewDate - Date to schedule the review
 */
export async function scheduleReview(
  planId: string,
  reviewDate: Date
): Promise<void> {
  try {
    // Fetch current review dates
    const { data: planData, error: fetchError } = await supabase
      .from('recovery_plans')
      .select('review_dates')
      .eq('id', planId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch recovery plan: ${fetchError.message}`);
    }

    const currentReviewDates = planData?.review_dates || [];
    const reviewDateString = reviewDate.toISOString().split('T')[0];

    // Add new review date if not already present
    if (!currentReviewDates.includes(reviewDateString)) {
      const updatedReviewDates = [...currentReviewDates, reviewDateString].sort();

      const { error: updateError } = await supabase
        .from('recovery_plans')
        .update({
          review_dates: updatedReviewDates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

      if (updateError) {
        throw new Error(`Failed to schedule review: ${updateError.message}`);
      }
    }
  } catch (error) {
    console.error('Error scheduling review:', error);
    throw error;
  }
}

/**
 * Gets upcoming review dates for a recovery plan
 * Requirement 6.10: Implement review date reminders
 * @param planId - ID of the recovery plan
 * @returns Array of upcoming review dates
 */
export async function getUpcomingReviews(planId: string): Promise<Date[]> {
  try {
    const { data, error } = await supabase
      .from('recovery_plans')
      .select('review_dates')
      .eq('id', planId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch review dates: ${error.message}`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reviewDates = (data?.review_dates || [])
      .map((date: string) => new Date(date))
      .filter((date: Date) => date >= today)
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());

    return reviewDates;
  } catch (error) {
    console.error('Error fetching upcoming reviews:', error);
    throw error;
  }
}
