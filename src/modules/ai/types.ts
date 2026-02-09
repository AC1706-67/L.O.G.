/**
 * AI Module Types
 * Handles Nova AI integration for conversational interfaces
 */

export type ConversationMode = 'voice' | 'text';
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export interface ConversationContext {
  conversationId: string;
  participantId?: string;
  currentModule: string; // 'intake', 'assessment', 'goal_setting', etc.
  currentSection?: string;
  previousMessages: Message[];
  extractedData: Record<string, any>;
}

export interface ConversationInput {
  text?: string;
  audio?: Blob;
  context: ConversationContext;
  mode: ConversationMode;
}

export interface ConversationOutput {
  response: string; // Nova's response text
  extractedData?: Record<string, any>; // Structured data extracted
  nextQuestion?: string; // Suggested next question
  confidence: number; // 0-1 confidence in extraction
  requiresClarification: boolean;
  detectedSensitiveTopic: boolean;
}

export interface DataSchema {
  fields: Record<string, FieldSchema>;
}

export interface FieldSchema {
  type: string;
  required: boolean;
  description: string;
  validation?: any;
}

export interface ExtractedData {
  fields: Record<string, any>;
  confidence: Record<string, number>;
  missingFields: string[];
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  duration: number;
}

export interface CrisisAssessment {
  isCrisis: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'immediate';
  indicators: string[];
  recommendedActions: string[];
}
