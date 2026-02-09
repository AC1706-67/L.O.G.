/**
 * Query Service
 * Processes natural language queries using Nova AI for intent interpretation
 * and generates database queries with access control
 * Requirements: 7.1, 7.2, 7.3
 */

import { supabase } from '../../config/supabase';
import { processConversation } from '../ai/novaService';
import { ConversationInput, ConversationContext, Message } from '../ai/types';
import { checkAccess, UserContext, UserRole } from '../security/accessControl';
import { Resource, Action } from '../security/types';
import { logPHIAccess } from '../logging/sessionLogger';
import {
  QueryResult,
  QueryIntent,
  QueryIntentType,
  QueryRecord,
} from './types';

/**
 * Process a natural language query
 * Uses Nova AI to interpret intent and generate appropriate database queries
 * Requirements: 7.1, 7.2, 7.3, 7.6
 */
export async function processQuery(
  query: string,
  userContext: UserContext
): Promise<QueryResult> {
  const startTime = Date.now();

  try {
    // Validate input
    if (!query || query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }

    if (!userContext || !userContext.userId) {
      throw new Error('User context is required');
    }

    // Step 1: Interpret query intent using Nova AI
    const intent = await interpretQueryIntent(query, userContext.userId);

    // Step 2: Check if user has access to requested data (Requirements 7.2, 7.6)
    if (intent.requiresPHI) {
      const hasAccess = await verifyQueryAccess(userContext, intent);
      if (!hasAccess) {
        throw new Error('Access denied: Insufficient permissions to access requested data');
      }
    }

    // Step 3: Generate and execute database query
    const data = await executeQuery(intent, userContext);

    // Step 4: Format response using Nova AI
    const response = await formatQueryResponse(query, intent, data);

    // Step 5: Log query for audit purposes (Requirement 7.8)
    await logQuery(userContext.userId, query, intent, true, response, data, processingTimeMs);

    // Step 6: Log PHI access if applicable (Requirement 7.6)
    if (intent.requiresPHI && intent.entities.length > 0) {
      await logPHIAccess({
        userId: userContext.userId,
        participantId: intent.entities[0], // First entity is typically participant ID
        accessType: 'read',
        dataType: 'query_result',
        purpose: `Natural language query: ${query}`,
        timestamp: new Date(),
        ipAddress: '0.0.0.0', // TODO: Get actual IP address from request context
        deviceId: 'mobile-app', // TODO: Get actual device ID from request context
      });
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      queryId: generateQueryId(),
      originalQuery: query,
      interpretedIntent: intent,
      response,
      data,
      timestamp: new Date(),
      processingTimeMs,
    };
  } catch (error) {
    console.error('Error processing query:', error);

    // Log failed query (Requirement 7.8)
    await logQuery(userContext.userId, query, undefined, false, undefined, undefined, processingTimeMs);

    const processingTimeMs = Date.now() - startTime;

    // Return error result
    return {
      queryId: generateQueryId(),
      originalQuery: query,
      interpretedIntent: {
        intentType: 'count',
        entities: [],
        filters: {},
        requiresPHI: false,
      },
      response: `I'm sorry, I couldn't process your query. ${error instanceof Error ? error.message : 'Please try rephrasing your question.'}`,
      timestamp: new Date(),
      processingTimeMs,
    };
  }
}

/**
 * Interpret query intent using Nova AI
 * Extracts intent type, entities, filters, and PHI requirements
 */
async function interpretQueryIntent(
  query: string,
  userId: string
): Promise<QueryIntent> {
  try {
    // Build context for Nova AI
    const context: ConversationContext = {
      conversationId: generateQueryId(),
      currentModule: 'query',
      previousMessages: [],
      extractedData: {},
    };

    // Create system prompt for query interpretation
    const systemPrompt = buildQueryInterpretationPrompt();

    const messages: Message[] = [
      {
        role: 'system',
        content: systemPrompt,
        timestamp: new Date(),
      },
    ];

    context.previousMessages = messages;

    // Process query with Nova AI
    const input: ConversationInput = {
      text: query,
      context,
      mode: 'text',
    };

    const output = await processConversation(input);

    // Parse intent from Nova response
    const intent = parseQueryIntent(output.response, query);

    return intent;
  } catch (error) {
    console.error('Error interpreting query intent:', error);

    // Return default intent on error
    return {
      intentType: 'count',
      entities: [],
      filters: {},
      requiresPHI: false,
    };
  }
}

/**
 * Build system prompt for query interpretation
 */
function buildQueryInterpretationPrompt(): string {
  return `You are a query interpretation system for a peer recovery program database.
Your job is to analyze natural language queries and extract structured intent.

Query Intent Types:
1. COUNT - Count records matching criteria (e.g., "How many participants are on MAT?")
2. LIST - List records matching criteria (e.g., "Show me participants in recovery > 6 months")
3. DETAIL - Get detailed information about a specific record (e.g., "Pull up John Doe's record")
4. COMPARISON - Compare values or trends (e.g., "Compare BARC-10 scores")
5. TREND - Show trends over time (e.g., "Show enrollment trends this year")

Extract the following information:
- intentType: One of the 5 types above
- entities: Participant names, IDs, or other specific identifiers mentioned
- filters: Criteria for filtering (e.g., {"mat_status": true, "recovery_months": ">6"})
- requiresPHI: true if query requests protected health information

Return a JSON object with this structure:
{
  "intentType": "count|list|detail|comparison|trend",
  "entities": ["entity1", "entity2"],
  "filters": {"field": "value"},
  "requiresPHI": boolean,
  "explanation": "Brief explanation of the interpreted intent"
}

Examples:

Query: "How many participants are currently on MAT?"
Response: {
  "intentType": "count",
  "entities": [],
  "filters": {"mat_status": true},
  "requiresPHI": false,
  "explanation": "Count participants where MAT status is true"
}

Query: "Show me everyone due for 3-month follow-up"
Response: {
  "intentType": "list",
  "entities": [],
  "filters": {"follow_up_due": "3_months"},
  "requiresPHI": true,
  "explanation": "List participants with 3-month follow-up due"
}

Query: "What's John Doe's BARC-10 progress?"
Response: {
  "intentType": "comparison",
  "entities": ["John Doe"],
  "filters": {"assessment_type": "BARC_10"},
  "requiresPHI": true,
  "explanation": "Compare BARC-10 scores over time for John Doe"
}

Be accurate and conservative. If unsure, default to requiresPHI: true for safety.`;
}

/**
 * Parse query intent from Nova response
 */
function parseQueryIntent(response: string, originalQuery: string): QueryIntent {
  try {
    // Try to parse as JSON
    const parsed = JSON.parse(response);

    return {
      intentType: parsed.intentType || 'count',
      entities: parsed.entities || [],
      filters: parsed.filters || {},
      requiresPHI: parsed.requiresPHI !== undefined ? parsed.requiresPHI : true,
    };
  } catch (error) {
    // If parsing fails, use rule-based fallback
    return parseQueryIntentFallback(originalQuery);
  }
}

/**
 * Fallback rule-based query intent parsing
 * Used when Nova AI parsing fails
 */
function parseQueryIntentFallback(query: string): QueryIntent {
  const lowerQuery = query.toLowerCase();

  // Determine intent type
  let intentType: QueryIntentType = 'count';

  if (lowerQuery.includes('how many') || lowerQuery.includes('count')) {
    intentType = 'count';
  } else if (
    lowerQuery.includes('show me') ||
    lowerQuery.includes('list') ||
    lowerQuery.includes('who')
  ) {
    intentType = 'list';
  } else if (
    lowerQuery.includes('pull up') ||
    lowerQuery.includes('get') ||
    lowerQuery.includes('find')
  ) {
    intentType = 'detail';
  } else if (
    lowerQuery.includes('compare') ||
    lowerQuery.includes('progress') ||
    lowerQuery.includes('change')
  ) {
    intentType = 'comparison';
  } else if (
    lowerQuery.includes('trend') ||
    lowerQuery.includes('over time') ||
    lowerQuery.includes('history')
  ) {
    intentType = 'trend';
  }

  // Extract filters based on keywords
  const filters: Record<string, any> = {};

  if (lowerQuery.includes('mat') || lowerQuery.includes('medication-assisted')) {
    filters.mat_status = true;
  }

  if (lowerQuery.includes('recovery')) {
    const monthsMatch = lowerQuery.match(/(\d+)\s*months?/);
    if (monthsMatch) {
      filters.recovery_months = parseInt(monthsMatch[1], 10);
    }
  }

  if (lowerQuery.includes('follow-up') || lowerQuery.includes('followup')) {
    filters.follow_up_needed = true;
  }

  if (lowerQuery.includes('barc-10') || lowerQuery.includes('barc10')) {
    filters.assessment_type = 'BARC_10';
  }

  if (lowerQuery.includes('suprt-c') || lowerQuery.includes('suprtc')) {
    filters.assessment_type = 'SUPRT_C';
  }

  // Determine if PHI is required (conservative approach)
  const requiresPHI =
    intentType === 'detail' ||
    intentType === 'comparison' ||
    intentType === 'list' ||
    lowerQuery.includes('name') ||
    lowerQuery.includes('record') ||
    lowerQuery.includes('assessment') ||
    lowerQuery.includes('score');

  return {
    intentType,
    entities: [],
    filters,
    requiresPHI,
  };
}

/**
 * Verify user has access to execute query
 * Checks permissions based on query intent and requested data
 * Requirements: 7.2, 7.6
 */
async function verifyQueryAccess(userContext: UserContext, intent: QueryIntent): Promise<boolean> {
  try {
    // For queries requesting specific participant data
    if (intent.entities.length > 0) {
      for (const entity of intent.entities) {
        // Check if user has access to this participant
        const resource: Resource = {
          type: 'participant',
          id: entity,
        };

        const hasAccess = await checkAccess(userContext, resource, Action.READ);
        if (!hasAccess) {
          console.warn(`Access denied for user ${userContext.userId} to participant ${entity}`);
          return false;
        }
      }
    }

    // For aggregate queries (count, list, trend), verify user has appropriate role
    // Admins and supervisors can run aggregate queries across all participants
    if (userContext.role === UserRole.ADMIN || userContext.role === UserRole.SUPERVISOR) {
      return true;
    }

    // Peer specialists can only query their assigned participants
    // For aggregate queries, we'll filter results to only their assigned participants
    if (userContext.role === UserRole.PEER_SPECIALIST) {
      // If no specific entities requested, allow the query but results will be filtered
      // to only assigned participants in executeQuery
      return true;
    }

    // Default deny for unknown roles
    return false;
  } catch (error) {
    console.error('Error verifying query access:', error);
    return false;
  }
}

/**
 * Execute database query based on interpreted intent
 */
async function executeQuery(intent: QueryIntent, userContext: UserContext): Promise<any> {
  try {
    switch (intent.intentType) {
      case 'count':
        return await executeCountQuery(intent, userContext);
      case 'list':
        return await executeListQuery(intent, userContext);
      case 'detail':
        return await executeDetailQuery(intent, userContext);
      case 'comparison':
        return await executeComparisonQuery(intent, userContext);
      case 'trend':
        return await executeTrendQuery(intent, userContext);
      default:
        throw new Error(`Unknown intent type: ${intent.intentType}`);
    }
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

/**
 * Execute COUNT query
 * Applies access control filtering based on user role
 */
async function executeCountQuery(intent: QueryIntent, userContext: UserContext): Promise<any> {
  try {
    // Build query based on filters
    let query = supabase.from('participants').select('*', { count: 'exact', head: true });

    // Apply access control: peer specialists can only count their assigned participants
    if (userContext.role === UserRole.PEER_SPECIALIST && userContext.assignedParticipants) {
      query = query.in('id', userContext.assignedParticipants);
    }

    // Apply filters
    query = applyFilters(query, intent.filters);

    // Execute query
    const { count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      count: count || 0,
      filters: intent.filters,
    };
  } catch (error) {
    console.error('Error executing count query:', error);
    throw error;
  }
}

/**
 * Execute LIST query
 * Applies access control filtering based on user role
 */
async function executeListQuery(intent: QueryIntent, userContext: UserContext): Promise<any> {
  try {
    // Build query
    let query = supabase
      .from('participants')
      .select('id, first_name_encrypted, last_name_encrypted, status, recovery_date, mat_status')
      .limit(50); // Limit results for performance

    // Apply access control: peer specialists can only list their assigned participants
    if (userContext.role === UserRole.PEER_SPECIALIST && userContext.assignedParticipants) {
      query = query.in('id', userContext.assignedParticipants);
    }

    // Apply filters
    query = applyFilters(query, intent.filters);

    // Execute query
    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return {
      participants: data || [],
      count: data?.length || 0,
    };
  } catch (error) {
    console.error('Error executing list query:', error);
    throw error;
  }
}

/**
 * Execute DETAIL query
 * Verifies access control before returning participant details
 */
async function executeDetailQuery(intent: QueryIntent, userContext: UserContext): Promise<any> {
  try {
    if (intent.entities.length === 0) {
      throw new Error('No participant specified for detail query');
    }

    const participantId = intent.entities[0];

    // Verify access (already checked in verifyQueryAccess, but double-check for security)
    const resource: Resource = {
      type: 'participant',
      id: participantId,
    };
    const hasAccess = await checkAccess(userContext, resource, Action.READ);
    if (!hasAccess) {
      throw new Error('Access denied to participant details');
    }

    // Get participant details
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('*')
      .eq('id', participantId)
      .single();

    if (participantError) {
      throw participantError;
    }

    // Get recent assessments
    const { data: assessments, error: assessmentsError } = await supabase
      .from('assessments')
      .select('*')
      .eq('participant_id', participantId)
      .order('completed_at', { ascending: false })
      .limit(5);

    if (assessmentsError) {
      throw assessmentsError;
    }

    // Get active recovery plan
    const { data: plan, error: planError } = await supabase
      .from('recovery_plans')
      .select('*, goals(*)')
      .eq('participant_id', participantId)
      .eq('overall_status', 'active')
      .single();

    // Plan error is not critical, participant might not have a plan yet

    return {
      participant,
      assessments: assessments || [],
      recoveryPlan: plan || null,
    };
  } catch (error) {
    console.error('Error executing detail query:', error);
    throw error;
  }
}

/**
 * Execute COMPARISON query
 * Verifies access control before comparing assessment scores
 */
async function executeComparisonQuery(intent: QueryIntent, userContext: UserContext): Promise<any> {
  try {
    if (intent.entities.length === 0) {
      throw new Error('No participant specified for comparison query');
    }

    const participantId = intent.entities[0];

    // Verify access
    const resource: Resource = {
      type: 'participant',
      id: participantId,
    };
    const hasAccess = await checkAccess(userContext, resource, Action.READ);
    if (!hasAccess) {
      throw new Error('Access denied to participant assessment data');
    }

    const assessmentType = intent.filters.assessment_type || 'BARC_10';

    // Get assessments for comparison
    const { data: assessments, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('participant_id', participantId)
      .eq('assessment_type', assessmentType)
      .order('completed_at', { ascending: true });

    if (error) {
      throw error;
    }

    if (!assessments || assessments.length < 2) {
      return {
        message: 'Not enough assessments for comparison',
        assessments: assessments || [],
      };
    }

    // Calculate comparison metrics
    const baseline = assessments[0];
    const current = assessments[assessments.length - 1];

    const baselineScore = baseline.total_score || 0;
    const currentScore = current.total_score || 0;
    const change = currentScore - baselineScore;
    const percentChange = baselineScore > 0 ? (change / baselineScore) * 100 : 0;

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (change > 5) trend = 'improving';
    else if (change < -5) trend = 'declining';

    return {
      baseline: {
        date: baseline.completed_at,
        score: baselineScore,
      },
      current: {
        date: current.completed_at,
        score: currentScore,
      },
      change,
      percentChange: Math.round(percentChange),
      trend,
      assessments,
    };
  } catch (error) {
    console.error('Error executing comparison query:', error);
    throw error;
  }
}

/**
 * Execute TREND query
 * Applies access control filtering based on user role
 */
async function executeTrendQuery(intent: QueryIntent, userContext: UserContext): Promise<any> {
  try {
    // Get enrollment trends for the past 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    let query = supabase
      .from('participants')
      .select('created_at')
      .gte('created_at', sixMonthsAgo.toISOString())
      .order('created_at', { ascending: true });

    // Apply access control: peer specialists can only see trends for their assigned participants
    if (userContext.role === UserRole.PEER_SPECIALIST && userContext.assignedParticipants) {
      query = query.in('id', userContext.assignedParticipants);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Group by month
    const monthCounts: Record<string, number> = {};
    data?.forEach((participant) => {
      const date = new Date(participant.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
    });

    // Convert to array format
    const months = Object.keys(monthCounts).sort();
    const values = months.map((month) => monthCounts[month]);

    return {
      months,
      values,
      total: data?.length || 0,
    };
  } catch (error) {
    console.error('Error executing trend query:', error);
    throw error;
  }
}

/**
 * Apply filters to Supabase query
 */
function applyFilters(query: any, filters: Record<string, any>): any {
  let filteredQuery = query;

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;

    switch (key) {
      case 'mat_status':
        filteredQuery = filteredQuery.eq('mat_status', value);
        break;
      case 'recovery_months':
        // Calculate date threshold
        const monthsAgo = new Date();
        monthsAgo.setMonth(monthsAgo.getMonth() - value);
        filteredQuery = filteredQuery.lte('recovery_date', monthsAgo.toISOString());
        break;
      case 'follow_up_needed':
        filteredQuery = filteredQuery.eq('follow_up_needed', value);
        break;
      case 'status':
        filteredQuery = filteredQuery.eq('status', value);
        break;
      case 'assessment_type':
        // This filter is handled in specific query functions
        break;
      default:
        // Generic equality filter
        filteredQuery = filteredQuery.eq(key, value);
    }
  }

  return filteredQuery;
}

/**
 * Format query response using Nova AI
 * Converts structured data into natural language response
 */
async function formatQueryResponse(
  originalQuery: string,
  intent: QueryIntent,
  data: any
): Promise<string> {
  try {
    // Build formatting prompt
    const systemPrompt = buildResponseFormattingPrompt(intent.intentType);

    const dataString = JSON.stringify(data, null, 2);

    const messages: Message[] = [
      {
        role: 'system',
        content: systemPrompt,
        timestamp: new Date(),
      },
      {
        role: 'user',
        content: `Original Query: ${originalQuery}\n\nData: ${dataString}`,
        timestamp: new Date(),
      },
    ];

    const context: ConversationContext = {
      conversationId: generateQueryId(),
      currentModule: 'query',
      previousMessages: messages,
      extractedData: {},
    };

    const input: ConversationInput = {
      text: `Format this query result into a natural language response`,
      context,
      mode: 'text',
    };

    const output = await processConversation(input);

    return output.response;
  } catch (error) {
    console.error('Error formatting query response:', error);

    // Fallback to simple formatting
    return formatQueryResponseFallback(intent.intentType, data);
  }
}

/**
 * Build response formatting prompt
 */
function buildResponseFormattingPrompt(intentType: QueryIntentType): string {
  return `You are formatting query results into natural language responses for peer specialists.

Intent Type: ${intentType}

Guidelines:
- Be clear and concise
- Use professional but friendly language
- Include relevant numbers and statistics
- Highlight important findings
- Suggest follow-up actions when appropriate
- Format lists and comparisons clearly

Return only the formatted response text, no additional commentary.`;
}

/**
 * Fallback response formatting (rule-based)
 */
function formatQueryResponseFallback(intentType: QueryIntentType, data: any): string {
  switch (intentType) {
    case 'count':
      return `There are ${data.count} participants matching your criteria.`;

    case 'list':
      if (data.count === 0) {
        return 'No participants found matching your criteria.';
      }
      return `Found ${data.count} participants. Here are the results.`;

    case 'detail':
      return 'Here is the detailed information for the participant.';

    case 'comparison':
      if (data.message) {
        return data.message;
      }
      return `Baseline score: ${data.baseline.score}, Current score: ${data.current.score}. Change: ${data.change > 0 ? '+' : ''}${data.change} (${data.percentChange}%). Trend: ${data.trend}.`;

    case 'trend':
      return `Showing trends over ${data.months.length} months with a total of ${data.total} participants.`;

    default:
      return 'Query completed successfully.';
  }
}

/**
 * Log query for audit purposes
 * Requirement 7.8: Store query history with full details
 */
async function logQuery(
  userId: string,
  query: string,
  intent: QueryIntent | undefined,
  successful: boolean,
  response?: string,
  data?: any,
  processingTimeMs?: number
): Promise<void> {
  try {
    // Determine if PHI was accessed
    const accessedPHI = intent?.requiresPHI || false;
    const accessedParticipantIds = intent?.entities || [];

    await supabase.from('queries').insert({
      user_id: userId,
      original_query: query,
      interpreted_intent: intent ? JSON.stringify(intent) : null,
      response: response || '',
      data: data ? JSON.stringify(data) : null,
      successful,
      processing_time_ms: processingTimeMs,
      timestamp: new Date().toISOString(),
      accessed_phi: accessedPHI,
      accessed_participant_ids: accessedParticipantIds.length > 0 ? accessedParticipantIds : null,
    });
  } catch (error) {
    console.error('Error logging query:', error);
    // Don't throw - logging failure shouldn't break the query
  }
}

/**
 * Generate unique query ID
 */
function generateQueryId(): string {
  return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get query suggestions based on user role and context
 */
export async function getSuggestions(partialQuery: string): Promise<string[]> {
  // Return predefined suggestions
  // In a more advanced implementation, this could use Nova AI to generate contextual suggestions
  const allSuggestions = [
    'How many participants are currently on MAT?',
    "Who's been in recovery more than 6 months?",
    'Show me everyone due for 3-month follow-up',
    'Show participants with active recovery plans',
    'List participants who need consent renewal',
    'Show crisis interventions this month',
    'What are the average BARC-10 scores?',
    'Show enrollment trends this year',
    'List participants with incomplete intakes',
    'Show participants due for assessment',
  ];

  if (!partialQuery || partialQuery.trim().length === 0) {
    return allSuggestions;
  }

  // Filter suggestions based on partial query
  const lowerPartial = partialQuery.toLowerCase();
  return allSuggestions.filter((suggestion) =>
    suggestion.toLowerCase().includes(lowerPartial)
  );
}

/**
 * Get query history for a user
 * Requirement 7.8: Retrieve stored query history
 */
export async function getQueryHistory(
  userId: string,
  limit: number = 10
): Promise<QueryRecord[]> {
  try {
    const { data, error } = await supabase
      .from('queries')
      .select('id, original_query, timestamp, successful, response, processing_time_ms, accessed_phi')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (
      data?.map((record) => ({
        queryId: record.id,
        query: record.original_query,
        timestamp: new Date(record.timestamp),
        successful: record.successful,
      })) || []
    );
  } catch (error) {
    console.error('Error getting query history:', error);
    return [];
  }
}
