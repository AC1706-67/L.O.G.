/**
 * Recovery Plan Module Types
 * Handles recovery goal setting and tracking
 */

export enum GoalCategory {
  HOUSING = 'Housing',
  EMPLOYMENT = 'Employment',
  HEALTH = 'Health',
  FAMILY = 'Family',
  RECOVERY = 'Recovery',
  EDUCATION = 'Education',
  LEGAL = 'Legal',
  OTHER = 'Other',
}

export enum GoalStatus {
  NOT_STARTED = 'Not Started',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  ON_HOLD = 'On Hold',
}

export interface ActionStep {
  stepId: string;
  description: string;
  completed: boolean;
  completedDate?: Date;
}

export interface ProgressNote {
  noteId: string;
  date: Date;
  staffId: string;
  note: string;
  linkedInteractionId?: string;
}

export interface GoalData {
  description: string;
  category: GoalCategory;
  targetDate: Date;
  barriersIdentified: string[];
  supportNeeded: string[];
  actionSteps: ActionStep[];
}

export interface Goal extends GoalData {
  goalId: string;
  status: GoalStatus;
  createdDate: Date;
  lastUpdated: Date;
  progressNotes: ProgressNote[];
}

export interface RecoveryPlan {
  planId: string;
  participantId: string;
  createdDate: Date;
  reviewDates: Date[];
  overallStatus: 'active' | 'completed' | 'on_hold';
  goals: Goal[];
}
