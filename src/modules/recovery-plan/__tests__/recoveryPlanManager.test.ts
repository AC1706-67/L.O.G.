/**
 * Recovery Plan Manager Unit Tests
 * Tests core functionality of recovery plan management
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  createPlan,
  addGoal,
  updateGoalStatus,
  getPlan,
  getGoalsByStatus,
  scheduleReview,
  getUpcomingReviews,
  addProgressNote,
} from '../recoveryPlanManager';
import { GoalCategory, GoalStatus } from '../types';

// Mock Supabase
jest.mock('../../../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Mock session logger
jest.mock('../../logging/sessionLogger', () => ({
  logDataChange: jest.fn(),
}));

describe('Recovery Plan Manager', () => {
  const mockParticipantId = 'participant-123';
  const mockStaffId = 'staff-456';
  const mockPlanId = 'plan-789';
  const mockGoalId = 'goal-abc';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPlan', () => {
    it('should create a new recovery plan', async () => {
      const { supabase } = require('../../../config/supabase');
      const mockPlanData = {
        id: mockPlanId,
        participant_id: mockParticipantId,
        created_date: '2024-01-15',
        review_dates: [],
        overall_status: 'active',
      };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockPlanData,
              error: null,
            }),
          }),
        }),
      });

      const plan = await createPlan(mockParticipantId, mockStaffId);

      expect(plan.planId).toBe(mockPlanId);
      expect(plan.participantId).toBe(mockParticipantId);
      expect(plan.overallStatus).toBe('active');
      expect(plan.goals).toEqual([]);
    });
  });

  describe('addGoal', () => {
    it('should add a goal to a recovery plan', async () => {
      const { supabase } = require('../../../config/supabase');
      const goalData = {
        description: 'Find stable housing',
        category: GoalCategory.HOUSING,
        targetDate: new Date('2024-06-01'),
        barriersIdentified: ['Limited income', 'Poor credit'],
        supportNeeded: ['Housing assistance program', 'Financial counseling'],
        actionSteps: [
          {
            stepId: 'step-1',
            description: 'Apply for housing assistance',
            completed: false,
          },
        ],
      };

      const mockGoalData = {
        id: mockGoalId,
        description: goalData.description,
        category: goalData.category,
        target_date: '2024-06-01',
        status: 'Not Started',
        barriers_identified: goalData.barriersIdentified,
        support_needed: goalData.supportNeeded,
        action_steps: goalData.actionSteps,
        created_date: '2024-01-15',
        last_updated: '2024-01-15T10:00:00Z',
      };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockGoalData,
              error: null,
            }),
          }),
        }),
      });

      const goal = await addGoal(mockPlanId, goalData, mockStaffId);

      expect(goal.goalId).toBe(mockGoalId);
      expect(goal.description).toBe(goalData.description);
      expect(goal.category).toBe(goalData.category);
      expect(goal.status).toBe(GoalStatus.NOT_STARTED);
    });
  });

  describe('updateGoalStatus', () => {
    it('should update goal status and log the change', async () => {
      const { supabase } = require('../../../config/supabase');
      const { logDataChange } = require('../../logging/sessionLogger');

      // Mock fetching current goal
      const selectMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { status: 'Not Started' },
            error: null,
          }),
        }),
      });

      // Mock updating goal
      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      // Mock inserting progress note
      const insertMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'note-123',
              note_date: '2024-01-15',
              staff_id: mockStaffId,
              note: 'Started working on goal',
            },
            error: null,
          }),
        }),
      });

      supabase.from.mockImplementation((table: string) => {
        if (table === 'goals') {
          return {
            select: selectMock,
            update: updateMock,
          };
        }
        if (table === 'progress_notes') {
          return {
            insert: insertMock,
          };
        }
        return {};
      });

      await updateGoalStatus(
        mockGoalId,
        GoalStatus.IN_PROGRESS,
        'Started working on goal',
        mockStaffId,
        mockParticipantId
      );

      expect(logDataChange).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockStaffId,
          participantId: mockParticipantId,
          tableName: 'goals',
          recordId: mockGoalId,
          fieldName: 'status',
          oldValue: 'Not Started',
          newValue: GoalStatus.IN_PROGRESS,
        })
      );
    });
  });

  describe('getPlan', () => {
    it('should retrieve a recovery plan with all goals', async () => {
      const { supabase } = require('../../../config/supabase');

      const mockPlanData = {
        id: mockPlanId,
        participant_id: mockParticipantId,
        created_date: '2024-01-15',
        review_dates: ['2024-04-15', '2024-07-15'],
        overall_status: 'active',
      };

      const mockGoalsData = [
        {
          id: 'goal-1',
          description: 'Find housing',
          category: 'Housing',
          target_date: '2024-06-01',
          status: 'In Progress',
          barriers_identified: [],
          support_needed: [],
          action_steps: [],
          created_date: '2024-01-15',
          last_updated: '2024-01-20T10:00:00Z',
        },
      ];

      supabase.from.mockImplementation((table: string) => {
        if (table === 'recovery_plans') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockPlanData,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'goals') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: mockGoalsData,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'progress_notes') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const plan = await getPlan(mockPlanId);

      expect(plan.planId).toBe(mockPlanId);
      expect(plan.goals).toHaveLength(1);
      expect(plan.goals[0].description).toBe('Find housing');
      expect(plan.reviewDates).toHaveLength(2);
    });
  });

  describe('getGoalsByStatus', () => {
    it('should retrieve goals filtered by status', async () => {
      const { supabase } = require('../../../config/supabase');

      const mockGoalsData = [
        {
          id: 'goal-1',
          description: 'Goal 1',
          category: 'Housing',
          target_date: '2024-06-01',
          status: 'In Progress',
          barriers_identified: [],
          support_needed: [],
          action_steps: [],
          created_date: '2024-01-15',
          last_updated: '2024-01-20T10:00:00Z',
        },
      ];

      supabase.from.mockImplementation((table: string) => {
        if (table === 'goals') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: mockGoalsData,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'progress_notes') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const goals = await getGoalsByStatus(mockPlanId, GoalStatus.IN_PROGRESS);

      expect(goals).toHaveLength(1);
      expect(goals[0].status).toBe(GoalStatus.IN_PROGRESS);
    });
  });

  describe('scheduleReview', () => {
    it('should add a review date to a recovery plan', async () => {
      const { supabase } = require('../../../config/supabase');
      const reviewDate = new Date('2024-04-15');

      const selectMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { review_dates: ['2024-01-15'] },
            error: null,
          }),
        }),
      });

      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      supabase.from.mockReturnValue({
        select: selectMock,
        update: updateMock,
      });

      await scheduleReview(mockPlanId, reviewDate);

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          review_dates: expect.arrayContaining(['2024-01-15', '2024-04-15']),
        })
      );
    });
  });

  describe('getUpcomingReviews', () => {
    it('should return only future review dates', async () => {
      const { supabase } = require('../../../config/supabase');

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const futureDate1 = new Date();
      futureDate1.setDate(futureDate1.getDate() + 10);

      const futureDate2 = new Date();
      futureDate2.setDate(futureDate2.getDate() + 30);

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                review_dates: [
                  pastDate.toISOString().split('T')[0],
                  futureDate1.toISOString().split('T')[0],
                  futureDate2.toISOString().split('T')[0],
                ],
              },
              error: null,
            }),
          }),
        }),
      });

      const upcomingReviews = await getUpcomingReviews(mockPlanId);

      expect(upcomingReviews).toHaveLength(2);
      expect(upcomingReviews[0].getTime()).toBeGreaterThanOrEqual(new Date().setHours(0, 0, 0, 0));
    });
  });
});
