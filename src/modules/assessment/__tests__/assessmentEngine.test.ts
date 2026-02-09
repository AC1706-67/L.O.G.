/**
 * Assessment Engine Unit Tests
 * Tests core assessment functionality
 */

import {
  validateBARC10Score,
  calculateBARC10Score,
  calculateBARC10ScoreFromArray,
  getBARC10Question,
  getAllBARC10Questions,
} from '../assessmentEngine';

describe('Assessment Engine', () => {
  describe('validateBARC10Score', () => {
    it('should accept valid scores 1-6', () => {
      expect(validateBARC10Score(1)).toBe(true);
      expect(validateBARC10Score(2)).toBe(true);
      expect(validateBARC10Score(3)).toBe(true);
      expect(validateBARC10Score(4)).toBe(true);
      expect(validateBARC10Score(5)).toBe(true);
      expect(validateBARC10Score(6)).toBe(true);
    });

    it('should reject scores outside 1-6 range', () => {
      expect(validateBARC10Score(0)).toBe(false);
      expect(validateBARC10Score(7)).toBe(false);
      expect(validateBARC10Score(-1)).toBe(false);
      expect(validateBARC10Score(100)).toBe(false);
    });

    it('should reject non-integer scores', () => {
      expect(validateBARC10Score(3.5)).toBe(false);
      expect(validateBARC10Score(2.1)).toBe(false);
    });
  });

  describe('calculateBARC10Score', () => {
    it('should calculate correct total for valid scores', () => {
      const itemScores = {
        q1: 6,
        q2: 5,
        q3: 4,
        q4: 3,
        q5: 2,
        q6: 1,
        q7: 6,
        q8: 5,
        q9: 4,
        q10: 3,
      };
      const total = calculateBARC10Score(itemScores);
      expect(total).toBe(39);
    });

    it('should calculate minimum score (10)', () => {
      const itemScores = {
        q1: 1,
        q2: 1,
        q3: 1,
        q4: 1,
        q5: 1,
        q6: 1,
        q7: 1,
        q8: 1,
        q9: 1,
        q10: 1,
      };
      const total = calculateBARC10Score(itemScores);
      expect(total).toBe(10);
    });

    it('should calculate maximum score (60)', () => {
      const itemScores = {
        q1: 6,
        q2: 6,
        q3: 6,
        q4: 6,
        q5: 6,
        q6: 6,
        q7: 6,
        q8: 6,
        q9: 6,
        q10: 6,
      };
      const total = calculateBARC10Score(itemScores);
      expect(total).toBe(60);
    });

    it('should throw error for missing scores', () => {
      const itemScores = {
        q1: 6,
        q2: 5,
        q3: 4,
        // Missing q4-q10
      };
      expect(() => calculateBARC10Score(itemScores)).toThrow();
    });

    it('should throw error for invalid score values', () => {
      const itemScores = {
        q1: 6,
        q2: 5,
        q3: 4,
        q4: 3,
        q5: 2,
        q6: 1,
        q7: 6,
        q8: 5,
        q9: 7, // Invalid: > 6
        q10: 3,
      };
      expect(() => calculateBARC10Score(itemScores)).toThrow();
    });
  });

  describe('calculateBARC10ScoreFromArray', () => {
    it('should calculate score from array of 10 scores', () => {
      const scores = [6, 5, 4, 3, 2, 1, 6, 5, 4, 3];
      const total = calculateBARC10ScoreFromArray(scores);
      expect(total).toBe(39);
    });

    it('should throw error for wrong array length', () => {
      const scores = [6, 5, 4, 3, 2];
      expect(() => calculateBARC10ScoreFromArray(scores)).toThrow();
    });
  });

  describe('getBARC10Question', () => {
    it('should return question for valid index', () => {
      const question = getBARC10Question(0);
      expect(question).not.toBeNull();
      expect(question?.id).toBe('q1');
      expect(question?.text).toContain('Sobriety');
    });

    it('should return null for index >= 10', () => {
      const question = getBARC10Question(10);
      expect(question).toBeNull();
    });

    it('should return last question for index 9', () => {
      const question = getBARC10Question(9);
      expect(question).not.toBeNull();
      expect(question?.id).toBe('q10');
    });
  });

  describe('getAllBARC10Questions', () => {
    it('should return all 10 questions', () => {
      const questions = getAllBARC10Questions();
      expect(questions).toHaveLength(10);
      expect(questions[0].id).toBe('q1');
      expect(questions[9].id).toBe('q10');
    });
  });
});
