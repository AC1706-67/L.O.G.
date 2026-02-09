/**
 * Assessment Engine Property-Based Tests
 * Tests universal properties of assessment scoring using fast-check
 * Feature: log-peer-recovery-system
 */

import * as fc from 'fast-check';
import {
  calculateBARC10ScoreFromArray,
  validateBARC10Score,
} from '../assessmentEngine';

describe('Assessment Engine - Property-Based Tests', () => {
  /**
   * Property 15: BARC-10 score calculation
   * For any BARC-10 assessment with all 10 items scored (1-6 each),
   * the total score should equal the sum of individual item scores
   * and fall within the range 10-60
   * Validates: Requirements 4.5
   */
  test('Feature: log-peer-recovery-system, Property 15: BARC-10 score calculation', () => {
    fc.assert(
      fc.property(
        // Generate array of exactly 10 scores, each in range 1-6
        fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 10, maxLength: 10 }),
        (itemScores) => {
          // Calculate total score using the function
          const totalScore = calculateBARC10ScoreFromArray(itemScores);

          // Calculate expected total by summing all scores
          const expectedTotal = itemScores.reduce((sum, score) => sum + score, 0);

          // Property 1: Total score equals sum of individual scores
          expect(totalScore).toBe(expectedTotal);

          // Property 2: Total score is within valid range 10-60
          expect(totalScore).toBeGreaterThanOrEqual(10);
          expect(totalScore).toBeLessThanOrEqual(60);

          // Property 3: Each individual score is valid (1-6)
          itemScores.forEach((score) => {
            expect(validateBARC10Score(score)).toBe(true);
          });
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design doc
    );
  });

  /**
   * Additional property: Score calculation is deterministic
   * The same input should always produce the same output
   */
  test('BARC-10 score calculation is deterministic', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 10, maxLength: 10 }),
        (itemScores) => {
          const score1 = calculateBARC10ScoreFromArray(itemScores);
          const score2 = calculateBARC10ScoreFromArray(itemScores);
          
          // Same input should produce same output
          expect(score1).toBe(score2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Minimum score boundary
   * All scores of 1 should produce total of 10
   */
  test('BARC-10 minimum score boundary (all 1s = 10)', () => {
    const minScores = Array(10).fill(1);
    const totalScore = calculateBARC10ScoreFromArray(minScores);
    expect(totalScore).toBe(10);
  });

  /**
   * Additional property: Maximum score boundary
   * All scores of 6 should produce total of 60
   */
  test('BARC-10 maximum score boundary (all 6s = 60)', () => {
    const maxScores = Array(10).fill(6);
    const totalScore = calculateBARC10ScoreFromArray(maxScores);
    expect(totalScore).toBe(60);
  });

  /**
   * Additional property: Score increases monotonically
   * Increasing any individual score should increase or maintain total
   */
  test('BARC-10 score increases monotonically with individual scores', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 10, maxLength: 10 }),
        fc.integer({ min: 0, max: 9 }),
        (itemScores, indexToIncrease) => {
          const originalScore = calculateBARC10ScoreFromArray(itemScores);
          
          // Increase one score by 1 (ensuring it stays <= 6)
          const increasedScores = [...itemScores];
          increasedScores[indexToIncrease] += 1;
          
          const newScore = calculateBARC10ScoreFromArray(increasedScores);
          
          // New score should be exactly 1 point higher
          expect(newScore).toBe(originalScore + 1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
