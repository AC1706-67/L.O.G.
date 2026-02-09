/**
 * Assessment Module Types
 * Handles SUPRT-C and BARC-10 conversational assessments
 */

export enum AssessmentType {
  SUPRT_C = 'SUPRT_C',
  BARC_10 = 'BARC_10',
}

export interface AssessmentSession {
  sessionId: string;
  participantId: string;
  assessmentType: AssessmentType;
  startedAt: Date;
  currentQuestionIndex: number;
  totalQuestions: number;
  responses: AssessmentResponse[];
  isComplete: boolean;
}

export interface AssessmentResponse {
  questionId: string;
  questionText: string;
  rawResponse: string; // Natural language response
  extractedValue: any; // Structured data extracted by Nova
  score?: number; // For scored items
  timestamp: Date;
}

export interface AssessmentResult {
  assessmentId: string;
  participantId: string;
  assessmentType: AssessmentType;
  completedAt: Date;
  totalScore?: number; // For BARC-10
  itemScores?: Record<string, number>;
  responses: AssessmentResponse[];
  interpretation?: string;
  conversationTranscript: string;
}

export interface ProgressComparison {
  baselineScore: number;
  currentScore: number;
  change: number;
  percentChange: number;
  trend: 'improving' | 'stable' | 'declining';
  visualization: any; // Chart data structure
}
