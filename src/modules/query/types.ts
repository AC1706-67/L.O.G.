/**
 * Query Module Types
 * Handles natural language queries via Nova AI
 */

export type QueryIntentType = 'count' | 'list' | 'detail' | 'comparison' | 'trend';

export interface QueryIntent {
  intentType: QueryIntentType;
  entities: string[]; // Extracted entities (participant names, dates, etc.)
  filters: Record<string, any>;
  requiresPHI: boolean;
}

export interface QueryResult {
  queryId: string;
  originalQuery: string;
  interpretedIntent: QueryIntent;
  response: string; // Natural language response
  data?: any; // Structured data if applicable
  visualizations?: any[];
  timestamp: Date;
  processingTimeMs: number;
}

export interface QueryRecord {
  queryId: string;
  query: string;
  timestamp: Date;
  successful: boolean;
}
