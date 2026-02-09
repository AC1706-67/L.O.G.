/**
 * Assessment Engine Component
 * Administers SUPRT-C and BARC-10 assessments conversationally with automatic scoring
 * Requirements: 3.1, 4.1, 3.8, 3.10, 4.5, 4.7, 4.8
 */

import { supabase } from '../../config/supabase';
import { logPHIAccess } from '../logging/sessionLogger';
import {
  AssessmentType,
  AssessmentSession,
  AssessmentResponse,
  AssessmentResult,
  ProgressComparison,
} from './types';

/**
 * BARC-10 Questions
 * 10 questions scored on 1-6 scale (Strongly Disagree to Strongly Agree)
 */
const BARC10_QUESTIONS = [
  { id: 'q1', text: 'Sobriety/recovery is the most important thing in my life' },
  { id: 'q2', text: 'I am happy with my life' },
  { id: 'q3', text: 'I have enough energy to complete the tasks I set myself' },
  { id: 'q4', text: 'I regard my life as challenging and fulfilling without the need for using drugs or alcohol' },
  { id: 'q5', text: 'I am proud of the community I live in and feel a part of it' },
  { id: 'q6', text: 'I have a network of friends and family who support me in my recovery' },
  { id: 'q7', text: 'I am happy dealing with a range of professional people' },
  { id: 'q8', text: 'I am making good progress on my recovery journey' },
  { id: 'q9', text: 'I am happy in my own home' },
  { id: 'q10', text: 'I take full responsibility for my actions' },
];

/**
 * SUPRT-C total question count
 * Demographics + Social Drivers + Client Outcomes (12-item wellness scale + QOL)
 */
const SUPRTC_TOTAL_QUESTIONS = 30; // Approximate, varies by responses

/**
 * Starts a new SUPRT-C assessment session
 * Requirement 3.1: Present assessment questions in conversational format
 * @param participantId - ID of the participant taking the assessment
 * @param conductedBy - ID of the staff member conducting the assessment
 * @returns Assessment session object
 */
export async function startSUPRTC(
  participantId: string,
  conductedBy: string
): Promise<AssessmentSession> {
  try {
    // Create assessment record in database
    const { data, error } = await supabase
      .from('assessments')
      .insert({
        participant_id: participantId,
        assessment_type: AssessmentType.SUPRT_C,
        started_at: new Date().toISOString(),
        is_complete: false,
        conducted_by: conductedBy,
        responses: [],
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to start SUPRT-C assessment: ${error.message}`);
    }

    if (!data || !data.id) {
      throw new Error('Failed to create SUPRT-C assessment: No ID returned');
    }

    // Log PHI access
    await logPHIAccess({
      userId: conductedBy,
      participantId,
      accessType: 'write',
      dataType: 'assessment',
      purpose: 'SUPRT-C assessment initiation',
      timestamp: new Date(),
      ipAddress: 'mobile-app',
      deviceId: 'mobile-device',
    });

    // Return session object
    const session: AssessmentSession = {
      sessionId: data.id,
      participantId,
      assessmentType: AssessmentType.SUPRT_C,
      startedAt: new Date(),
      currentQuestionIndex: 0,
      totalQuestions: SUPRTC_TOTAL_QUESTIONS,
      responses: [],
      isComplete: false,
    };

    return session;
  } catch (error) {
    console.error('Error starting SUPRT-C assessment:', error);
    throw error;
  }
}

/**
 * Starts a new BARC-10 assessment session
 * Requirement 4.1: Present all 10 questions in conversational format
 * @param participantId - ID of the participant taking the assessment
 * @param conductedBy - ID of the staff member conducting the assessment
 * @returns Assessment session object
 */
export async function startBARC10(
  participantId: string,
  conductedBy: string
): Promise<AssessmentSession> {
  try {
    // Create assessment record in database
    const { data, error } = await supabase
      .from('assessments')
      .insert({
        participant_id: participantId,
        assessment_type: AssessmentType.BARC_10,
        started_at: new Date().toISOString(),
        is_complete: false,
        conducted_by: conductedBy,
        responses: [],
        item_scores: {},
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to start BARC-10 assessment: ${error.message}`);
    }

    if (!data || !data.id) {
      throw new Error('Failed to create BARC-10 assessment: No ID returned');
    }

    // Log PHI access
    await logPHIAccess({
      userId: conductedBy,
      participantId,
      accessType: 'write',
      dataType: 'assessment',
      purpose: 'BARC-10 assessment initiation',
      timestamp: new Date(),
      ipAddress: 'mobile-app',
      deviceId: 'mobile-device',
    });

    // Return session object
    const session: AssessmentSession = {
      sessionId: data.id,
      participantId,
      assessmentType: AssessmentType.BARC_10,
      startedAt: new Date(),
      currentQuestionIndex: 0,
      totalQuestions: BARC10_QUESTIONS.length,
      responses: [],
      isComplete: false,
    };

    return session;
  } catch (error) {
    console.error('Error starting BARC-10 assessment:', error);
    throw error;
  }
}

/**
 * Processes a response during an assessment session
 * Captures the raw response and updates the session state
 * @param sessionId - ID of the assessment session
 * @param response - The response object containing question and answer data
 * @returns Updated assessment progress
 */
export async function processResponse(
  sessionId: string,
  response: AssessmentResponse
): Promise<AssessmentSession> {
  try {
    // Fetch current assessment state
    const { data: assessment, error: fetchError } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !assessment) {
      throw new Error(`Failed to fetch assessment: ${fetchError?.message || 'Not found'}`);
    }

    // Add new response to responses array
    const currentResponses = assessment.responses || [];
    currentResponses.push({
      questionId: response.questionId,
      questionText: response.questionText,
      rawResponse: response.rawResponse,
      extractedValue: response.extractedValue,
      score: response.score,
      timestamp: response.timestamp.toISOString(),
    });

    // Update item scores for BARC-10
    let itemScores = assessment.item_scores || {};
    if (assessment.assessment_type === AssessmentType.BARC_10 && response.score) {
      itemScores[response.questionId] = response.score;
    }

    // Update assessment in database
    const { error: updateError } = await supabase
      .from('assessments')
      .update({
        responses: currentResponses,
        item_scores: itemScores,
      })
      .eq('id', sessionId);

    if (updateError) {
      throw new Error(`Failed to update assessment: ${updateError.message}`);
    }

    // Return updated session state
    const session: AssessmentSession = {
      sessionId,
      participantId: assessment.participant_id,
      assessmentType: assessment.assessment_type as AssessmentType,
      startedAt: new Date(assessment.started_at),
      currentQuestionIndex: currentResponses.length,
      totalQuestions:
        assessment.assessment_type === AssessmentType.BARC_10
          ? BARC10_QUESTIONS.length
          : SUPRTC_TOTAL_QUESTIONS,
      responses: currentResponses.map((r: any) => ({
        ...r,
        timestamp: new Date(r.timestamp),
      })),
      isComplete: assessment.is_complete,
    };

    return session;
  } catch (error) {
    console.error('Error processing assessment response:', error);
    throw error;
  }
}

/**
 * Gets the current question for a BARC-10 assessment
 * @param currentIndex - Current question index (0-based)
 * @returns Question object or null if complete
 */
export function getBARC10Question(currentIndex: number): { id: string; text: string } | null {
  if (currentIndex >= BARC10_QUESTIONS.length) {
    return null;
  }
  return BARC10_QUESTIONS[currentIndex];
}

/**
 * Gets all BARC-10 questions
 * @returns Array of all BARC-10 questions
 */
export function getAllBARC10Questions(): Array<{ id: string; text: string }> {
  return BARC10_QUESTIONS;
}

/**
 * Validates a BARC-10 item score
 * Requirement 4.5: Implement 1-6 scale validation
 * @param score - Score to validate
 * @returns True if score is valid (1-6), false otherwise
 */
export function validateBARC10Score(score: number): boolean {
  return Number.isInteger(score) && score >= 1 && score <= 6;
}

/**
 * Calculates the total BARC-10 score from item scores
 * Requirement 4.5: Calculate total score (10-60 range)
 * @param itemScores - Object mapping question IDs to scores (1-6 each)
 * @returns Total BARC-10 score (10-60)
 * @throws Error if scores are invalid or incomplete
 */
export function calculateBARC10Score(itemScores: Record<string, number>): number {
  // Validate we have all 10 scores
  const scoreKeys = Object.keys(itemScores);
  if (scoreKeys.length !== 10) {
    throw new Error(`BARC-10 requires 10 item scores, got ${scoreKeys.length}`);
  }

  // Validate each score is in range 1-6
  let totalScore = 0;
  for (let i = 1; i <= 10; i++) {
    const questionId = `q${i}`;
    const score = itemScores[questionId];

    if (score === undefined) {
      throw new Error(`Missing score for question ${questionId}`);
    }

    if (!validateBARC10Score(score)) {
      throw new Error(`Invalid score for ${questionId}: ${score}. Must be 1-6.`);
    }

    totalScore += score;
  }

  // Total score should be in range 10-60
  if (totalScore < 10 || totalScore > 60) {
    throw new Error(`Invalid total score: ${totalScore}. Must be 10-60.`);
  }

  return totalScore;
}

/**
 * Calculates BARC-10 score from an array of scores
 * Alternative interface for property-based testing
 * @param scores - Array of 10 scores (1-6 each)
 * @returns Total BARC-10 score (10-60)
 */
export function calculateBARC10ScoreFromArray(scores: number[]): number {
  if (scores.length !== 10) {
    throw new Error(`BARC-10 requires 10 scores, got ${scores.length}`);
  }

  const itemScores: Record<string, number> = {};
  scores.forEach((score, index) => {
    itemScores[`q${index + 1}`] = score;
  });

  return calculateBARC10Score(itemScores);
}

/**
 * Calculates the BARC-10 score for a completed assessment and stores it
 * Requirement 4.5: Calculate and store total score
 * @param sessionId - ID of the assessment session
 * @returns Assessment result with calculated score
 */
export async function calculateScore(sessionId: string): Promise<AssessmentResult> {
  try {
    // Fetch assessment
    const { data: assessment, error: fetchError } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !assessment) {
      throw new Error(`Failed to fetch assessment: ${fetchError?.message || 'Not found'}`);
    }

    // Only calculate score for BARC-10
    if (assessment.assessment_type !== AssessmentType.BARC_10) {
      throw new Error('Score calculation only supported for BARC-10 assessments');
    }

    // Calculate total score
    const itemScores = assessment.item_scores || {};
    const totalScore = calculateBARC10Score(itemScores);

    // Generate interpretation
    let interpretation = '';
    if (totalScore >= 50) {
      interpretation = 'High recovery capital - Strong foundation for sustained recovery';
    } else if (totalScore >= 35) {
      interpretation = 'Moderate recovery capital - Good progress with room for growth';
    } else if (totalScore >= 20) {
      interpretation = 'Low recovery capital - Significant support needed';
    } else {
      interpretation = 'Very low recovery capital - Intensive support recommended';
    }

    // Update assessment with score and mark as complete
    const { error: updateError } = await supabase
      .from('assessments')
      .update({
        total_score: totalScore,
        interpretation,
        is_complete: true,
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      throw new Error(`Failed to update assessment score: ${updateError.message}`);
    }

    // Build conversation transcript from responses
    const responses = assessment.responses || [];
    const transcript = responses
      .map((r: any) => `Q: ${r.questionText}\nA: ${r.rawResponse}`)
      .join('\n\n');

    // Return result
    const result: AssessmentResult = {
      assessmentId: sessionId,
      participantId: assessment.participant_id,
      assessmentType: AssessmentType.BARC_10,
      completedAt: new Date(),
      totalScore,
      itemScores,
      responses: responses.map((r: any) => ({
        ...r,
        timestamp: new Date(r.timestamp),
      })),
      interpretation,
      conversationTranscript: transcript,
    };

    return result;
  } catch (error) {
    console.error('Error calculating assessment score:', error);
    throw error;
  }
}

/**
 * Stores a complete assessment with all responses and metadata
 * Requirement 3.8: Store complete baseline assessment with timestamp
 * Requirement 4.7: Store complete BARC-10 with item scores, total score, and transcript
 * @param sessionId - ID of the assessment session
 * @param conversationTranscript - Full conversation transcript
 * @param conductedBy - ID of staff member who conducted the assessment
 * @returns Stored assessment result
 */
export async function storeAssessment(
  sessionId: string,
  conversationTranscript: string,
  conductedBy: string
): Promise<AssessmentResult> {
  try {
    // Fetch current assessment
    const { data: assessment, error: fetchError } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !assessment) {
      throw new Error(`Failed to fetch assessment: ${fetchError?.message || 'Not found'}`);
    }

    // Update assessment with transcript and completion
    const { error: updateError } = await supabase
      .from('assessments')
      .update({
        conversation_transcript: conversationTranscript,
        is_complete: true,
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      throw new Error(`Failed to store assessment: ${updateError.message}`);
    }

    // Log PHI access for assessment completion
    // Requirement 3.10: Session logger records full conversation transcript and extracted data
    await logPHIAccess({
      userId: conductedBy,
      participantId: assessment.participant_id,
      accessType: 'write',
      dataType: 'assessment',
      purpose: `${assessment.assessment_type} assessment completion`,
      timestamp: new Date(),
      ipAddress: 'mobile-app',
      deviceId: 'mobile-device',
    });

    // Build result object
    const result: AssessmentResult = {
      assessmentId: sessionId,
      participantId: assessment.participant_id,
      assessmentType: assessment.assessment_type as AssessmentType,
      completedAt: new Date(),
      totalScore: assessment.total_score,
      itemScores: assessment.item_scores,
      responses: (assessment.responses || []).map((r: any) => ({
        ...r,
        timestamp: new Date(r.timestamp),
      })),
      interpretation: assessment.interpretation,
      conversationTranscript,
    };

    return result;
  } catch (error) {
    console.error('Error storing assessment:', error);
    throw error;
  }
}

/**
 * Retrieves assessment history for a participant
 * @param participantId - ID of the participant
 * @param assessmentType - Type of assessment to retrieve (optional)
 * @returns Array of assessment results
 */
export async function getAssessmentHistory(
  participantId: string,
  assessmentType?: AssessmentType
): Promise<AssessmentResult[]> {
  try {
    let query = supabase
      .from('assessments')
      .select('*')
      .eq('participant_id', participantId)
      .eq('is_complete', true)
      .order('completed_at', { ascending: false });

    if (assessmentType) {
      query = query.eq('assessment_type', assessmentType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch assessment history: ${error.message}`);
    }

    return (data || []).map((assessment) => ({
      assessmentId: assessment.id,
      participantId: assessment.participant_id,
      assessmentType: assessment.assessment_type as AssessmentType,
      completedAt: new Date(assessment.completed_at),
      totalScore: assessment.total_score,
      itemScores: assessment.item_scores,
      responses: (assessment.responses || []).map((r: any) => ({
        ...r,
        timestamp: new Date(r.timestamp),
      })),
      interpretation: assessment.interpretation,
      conversationTranscript: assessment.conversation_transcript || '',
    }));
  } catch (error) {
    console.error('Error fetching assessment history:', error);
    throw error;
  }
}

/**
 * Compares a current BARC-10 score to the baseline assessment
 * Requirement 4.8: Calculate score change, percent change, trend, and generate visualization data
 * @param participantId - ID of the participant
 * @param currentScore - Current BARC-10 score to compare
 * @returns Progress comparison with baseline
 */
export async function compareToBaseline(
  participantId: string,
  currentScore: number
): Promise<ProgressComparison> {
  try {
    // Fetch all BARC-10 assessments for participant, ordered by completion date
    const { data: assessments, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('participant_id', participantId)
      .eq('assessment_type', AssessmentType.BARC_10)
      .eq('is_complete', true)
      .order('completed_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch assessments: ${error.message}`);
    }

    if (!assessments || assessments.length === 0) {
      throw new Error('No baseline assessment found for participant');
    }

    // First assessment is the baseline
    const baselineScore = assessments[0].total_score;

    if (baselineScore === undefined || baselineScore === null) {
      throw new Error('Baseline assessment has no score');
    }

    // Calculate change metrics
    const change = currentScore - baselineScore;
    const percentChange = baselineScore !== 0 ? (change / baselineScore) * 100 : 0;

    // Determine trend
    let trend: 'improving' | 'stable' | 'declining';
    if (change > 3) {
      // Improvement threshold: +3 points
      trend = 'improving';
    } else if (change < -3) {
      // Decline threshold: -3 points
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    // Generate visualization data (time series of all scores)
    const visualization = {
      type: 'line',
      data: assessments.map((assessment, index) => ({
        x: new Date(assessment.completed_at).toISOString(),
        y: assessment.total_score,
        label: index === 0 ? 'Baseline' : `Follow-up ${index}`,
      })),
      currentPoint: {
        x: new Date().toISOString(),
        y: currentScore,
        label: 'Current',
      },
    };

    const comparison: ProgressComparison = {
      baselineScore,
      currentScore,
      change,
      percentChange: Math.round(percentChange * 10) / 10, // Round to 1 decimal
      trend,
      visualization,
    };

    return comparison;
  } catch (error) {
    console.error('Error comparing to baseline:', error);
    throw error;
  }
}

/**
 * Gets the baseline assessment for a participant
 * @param participantId - ID of the participant
 * @param assessmentType - Type of assessment
 * @returns Baseline assessment result or null if not found
 */
export async function getBaselineAssessment(
  participantId: string,
  assessmentType: AssessmentType
): Promise<AssessmentResult | null> {
  try {
    const { data: assessment, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('participant_id', participantId)
      .eq('assessment_type', assessmentType)
      .eq('is_complete', true)
      .order('completed_at', { ascending: true })
      .limit(1)
      .single();

    if (error || !assessment) {
      return null;
    }

    return {
      assessmentId: assessment.id,
      participantId: assessment.participant_id,
      assessmentType: assessment.assessment_type as AssessmentType,
      completedAt: new Date(assessment.completed_at),
      totalScore: assessment.total_score,
      itemScores: assessment.item_scores,
      responses: (assessment.responses || []).map((r: any) => ({
        ...r,
        timestamp: new Date(r.timestamp),
      })),
      interpretation: assessment.interpretation,
      conversationTranscript: assessment.conversation_transcript || '',
    };
  } catch (error) {
    console.error('Error fetching baseline assessment:', error);
    return null;
  }
}
