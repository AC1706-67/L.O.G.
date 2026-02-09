/**
 * Nova AI Service
 * Centralized interface to Amazon Nova via AWS Bedrock for all AI operations
 */

import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient, BEDROCK_CONFIG } from '../../config/aws';
import {
  ConversationInput,
  ConversationOutput,
  ConversationContext,
  Message,
  ExtractedData,
  DataSchema,
  TranscriptionResult,
  CrisisAssessment,
} from './types';

/**
 * Process conversational input using Amazon Nova
 * Handles both voice and text input with context management
 */
export async function processConversation(
  input: ConversationInput
): Promise<ConversationOutput> {
  try {
    // Handle voice input by transcribing first
    let inputText = input.text;
    if (input.mode === 'voice' && input.audio) {
      const transcription = await transcribeVoice(input.audio);
      inputText = transcription.text;
    }

    if (!inputText) {
      throw new Error('No input text provided');
    }

    // Build conversation history for context
    const messages = buildMessageHistory(input.context, inputText);

    // Invoke Nova model
    const response = await invokeNova(messages, input.context);

    // Parse response and extract structured data
    const output = parseNovaResponse(response, input.context);

    return output;
  } catch (error) {
    console.error('Error processing conversation:', error);
    throw new Error(`Failed to process conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract structured data from natural language text
 * Uses schema-based extraction with confidence scoring
 */
export async function extractStructuredData(
  text: string,
  schema: DataSchema
): Promise<ExtractedData> {
  try {
    // Validate input
    if (!text || text.trim().length === 0) {
      throw new Error('Input text cannot be empty');
    }

    if (!schema || !schema.fields || Object.keys(schema.fields).length === 0) {
      throw new Error('Schema must contain at least one field');
    }

    // Build extraction prompt
    const systemPrompt = buildExtractionPrompt(schema);
    const messages: Message[] = [
      {
        role: 'system',
        content: systemPrompt,
        timestamp: new Date(),
      },
      {
        role: 'user',
        content: text,
        timestamp: new Date(),
      },
    ];

    // Invoke Nova for extraction
    const response = await invokeNova(messages);

    // Parse extracted data
    const extracted = parseExtractedData(response, schema);

    // Validate extracted data against schema
    const validated = validateExtractedData(extracted, schema);

    return validated;
  } catch (error) {
    console.error('Error extracting structured data:', error);
    throw new Error(`Failed to extract structured data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate follow-up questions based on conversation context
 */
export async function generateFollowUp(
  context: ConversationContext
): Promise<string> {
  try {
    const systemPrompt = buildFollowUpPrompt(context);
    const messages: Message[] = [
      {
        role: 'system',
        content: systemPrompt,
        timestamp: new Date(),
      },
    ];

    const response = await invokeNova(messages, context);
    return response.trim();
  } catch (error) {
    console.error('Error generating follow-up:', error);
    throw new Error(`Failed to generate follow-up: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Build message history for Nova context
 */
function buildMessageHistory(
  context: ConversationContext,
  currentInput: string
): Message[] {
  const systemPrompt = buildSystemPrompt(context);
  
  const messages: Message[] = [
    {
      role: 'system',
      content: systemPrompt,
      timestamp: new Date(),
    },
    ...context.previousMessages,
    {
      role: 'user',
      content: currentInput,
      timestamp: new Date(),
    },
  ];

  return messages;
}

/**
 * Build system prompt based on current module and context
 */
function buildSystemPrompt(context: ConversationContext): string {
  const basePrompt = `You are a compassionate AI assistant helping peer specialists in substance use disorder recovery programs. 
Your role is to facilitate natural conversations while extracting structured data for clinical records.

Current Module: ${context.currentModule}
${context.currentSection ? `Current Section: ${context.currentSection}` : ''}

Guidelines:
- Be empathetic and supportive
- Ask clarifying questions when responses are unclear
- Detect sensitive topics and adjust tone appropriately
- Extract structured data accurately
- Flag potential crisis situations immediately
- Maintain HIPAA compliance - never store or transmit data insecurely`;

  // Add module-specific guidance
  const moduleGuidance = getModuleGuidance(context.currentModule);
  
  return `${basePrompt}\n\n${moduleGuidance}`;
}

/**
 * Get module-specific guidance for system prompt
 */
function getModuleGuidance(module: string): string {
  const guidance: Record<string, string> = {
    intake: `You are collecting participant intake information. Ask questions naturally and extract data into structured fields. 
Be patient and allow participants to share information at their own pace.`,
    
    assessment: `You are conducting a clinical assessment. Follow the assessment protocol while maintaining a conversational tone. 
Ensure all required questions are answered and scores are accurately captured.`,
    
    goal_setting: `You are helping create a recovery action plan. Facilitate collaborative goal-setting and extract specific, 
measurable goals with action steps and timelines.`,
    
    interaction: `You are logging an interaction or session note. Extract key details including type, duration, summary, 
and any follow-up needs.`,
    
    query: `You are processing a natural language query about participant data. Interpret the intent, identify required data, 
and format responses clearly.`,
  };

  return guidance[module] || 'Assist the peer specialist with their current task.';
}

/**
 * Build extraction prompt for structured data
 */
function buildExtractionPrompt(schema: DataSchema): string {
  const fieldDescriptions = Object.entries(schema.fields)
    .map(([name, field]) => `- ${name}: ${field.description} (${field.type}, ${field.required ? 'required' : 'optional'})`)
    .join('\n');

  return `Extract structured data from the user's text according to this schema:

${fieldDescriptions}

Return a JSON object with:
1. "fields": extracted field values
2. "confidence": confidence score (0-1) for each field
3. "missingFields": array of required fields not found

Be accurate and conservative with confidence scores. If information is unclear or missing, indicate low confidence.`;
}

/**
 * Build follow-up prompt
 */
function buildFollowUpPrompt(context: ConversationContext): string {
  const extractedFields = Object.keys(context.extractedData).join(', ');
  
  return `Based on the conversation history and extracted data (${extractedFields}), 
generate the next appropriate question to continue the ${context.currentModule} process.

The question should:
- Be natural and conversational
- Build on previous responses
- Fill gaps in required information
- Be sensitive to the participant's emotional state

Return only the question text, nothing else.`;
}

/**
 * Invoke Nova model via Bedrock
 */
async function invokeNova(
  messages: Message[],
  context?: ConversationContext
): Promise<string> {
  try {
    // Format messages for Nova API
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Build request payload
    const payload = {
      messages: formattedMessages,
      max_tokens: BEDROCK_CONFIG.maxTokens,
      temperature: BEDROCK_CONFIG.temperature,
      top_p: BEDROCK_CONFIG.topP,
    };

    // Invoke model
    const command = new InvokeModelCommand({
      modelId: BEDROCK_CONFIG.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await bedrockClient.send(command);

    // Parse response
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Extract text from response (format may vary by model)
    const responseText = responseBody.content?.[0]?.text || responseBody.completion || '';

    return responseText;
  } catch (error) {
    console.error('Error invoking Nova:', error);
    throw new Error(`Failed to invoke Nova: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse Nova response and extract conversation output
 */
function parseNovaResponse(
  response: string,
  context: ConversationContext
): ConversationOutput {
  // Try to parse as JSON first (for structured responses)
  let parsedResponse: any;
  try {
    parsedResponse = JSON.parse(response);
  } catch {
    // Not JSON, treat as plain text response
    parsedResponse = { response: response };
  }

  // Detect sensitive topics
  const detectedSensitiveTopic = detectSensitiveTopic(response);

  // Extract structured data if present
  const extractedData = parsedResponse.extractedData || parsedResponse.fields || undefined;

  // Determine if clarification is needed
  const requiresClarification = 
    response.toLowerCase().includes('could you clarify') ||
    response.toLowerCase().includes('i\'m not sure') ||
    (parsedResponse.confidence && parsedResponse.confidence < 0.7);

  return {
    response: parsedResponse.response || response,
    extractedData,
    nextQuestion: parsedResponse.nextQuestion,
    confidence: parsedResponse.confidence || 0.8,
    requiresClarification,
    detectedSensitiveTopic,
  };
}

/**
 * Parse extracted data from Nova response
 */
function parseExtractedData(
  response: string,
  schema: DataSchema
): ExtractedData {
  try {
    const parsed = JSON.parse(response);
    
    return {
      fields: parsed.fields || {},
      confidence: parsed.confidence || {},
      missingFields: parsed.missingFields || [],
    };
  } catch (error) {
    // If parsing fails, return empty extraction
    return {
      fields: {},
      confidence: {},
      missingFields: Object.keys(schema.fields),
    };
  }
}

/**
 * Validate extracted data against schema
 * Ensures required fields are present and confidence scores are reasonable
 */
function validateExtractedData(
  extracted: ExtractedData,
  schema: DataSchema
): ExtractedData {
  const validated: ExtractedData = {
    fields: { ...extracted.fields },
    confidence: { ...extracted.confidence },
    missingFields: [],
  };

  // Check for required fields
  for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
    if (fieldSchema.required && !extracted.fields[fieldName]) {
      validated.missingFields.push(fieldName);
    }

    // Ensure confidence scores are in valid range
    if (extracted.confidence[fieldName] !== undefined) {
      const confidence = extracted.confidence[fieldName];
      if (confidence < 0 || confidence > 1) {
        validated.confidence[fieldName] = Math.max(0, Math.min(1, confidence));
      }
    } else if (extracted.fields[fieldName] !== undefined) {
      // Default confidence if not provided
      validated.confidence[fieldName] = 0.5;
    }
  }

  return validated;
}

/**
 * Check if extracted data needs clarification
 * Returns true if any required field has low confidence or is missing
 */
export function needsClarification(extracted: ExtractedData, schema: DataSchema): boolean {
  // Check for missing required fields
  if (extracted.missingFields.length > 0) {
    return true;
  }

  // Check for low confidence on required fields
  for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
    if (fieldSchema.required) {
      const confidence = extracted.confidence[fieldName];
      if (confidence !== undefined && confidence < 0.7) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Detect sensitive topics in conversation
 */
function detectSensitiveTopic(text: string): boolean {
  const sensitiveKeywords = [
    'suicide',
    'self-harm',
    'abuse',
    'trauma',
    'overdose',
    'relapse',
    'crisis',
    'emergency',
  ];

  const lowerText = text.toLowerCase();
  return sensitiveKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Transcribe voice input to text using AWS Transcribe
 * Implements fallback to text input on failure
 */
export async function transcribeVoice(audioData: Blob): Promise<TranscriptionResult> {
  try {
    // Validate input
    if (!audioData || audioData.size === 0) {
      throw new Error('Audio data cannot be empty');
    }

    // For React Native, we need to handle audio differently
    // This is a simplified implementation that would need platform-specific handling
    
    // Convert Blob to ArrayBuffer
    const arrayBuffer = await audioData.arrayBuffer();
    const audioBytes = new Uint8Array(arrayBuffer);

    // In a real implementation, we would:
    // 1. Upload audio to S3
    // 2. Start transcription job with AWS Transcribe
    // 3. Poll for completion
    // 4. Retrieve transcript
    
    // For now, we'll use a direct approach with Bedrock's audio capabilities
    // Note: This is a placeholder - actual implementation would use AWS Transcribe Streaming
    
    const result = await transcribeWithBedrock(audioBytes);
    
    return result;
  } catch (error) {
    console.error('Error transcribing voice:', error);
    
    // Implement fallback: return error result that triggers text input
    throw new Error(`Voice transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please use text input.`);
  }
}

/**
 * Transcribe audio using Bedrock (placeholder for actual AWS Transcribe)
 * In production, this should use AWS Transcribe Streaming API
 */
async function transcribeWithBedrock(audioBytes: Uint8Array): Promise<TranscriptionResult> {
  // This is a simplified placeholder
  // Real implementation would use AWS Transcribe StartStreamTranscriptionCommand
  
  // For now, return a mock result to demonstrate the interface
  // In production, replace with actual AWS Transcribe integration
  
  return {
    text: '', // Would contain transcribed text
    confidence: 0.0,
    language: 'en-US',
    duration: 0,
  };
}

/**
 * Check if voice transcription is available
 * Returns false if AWS Transcribe is not configured or unavailable
 */
export function isVoiceTranscriptionAvailable(): boolean {
  try {
    // Check if AWS credentials are configured
    const hasCredentials = 
      process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID && 
      process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY;
    
    return !!hasCredentials;
  } catch {
    return false;
  }
}

/**
 * Handle voice transcription with automatic fallback to text
 * This is the recommended way to handle voice input in the application
 */
export async function transcribeVoiceWithFallback(
  audioData: Blob,
  onFallbackToText: () => void
): Promise<TranscriptionResult | null> {
  try {
    // Check if voice transcription is available
    if (!isVoiceTranscriptionAvailable()) {
      console.warn('Voice transcription not available, falling back to text input');
      onFallbackToText();
      return null;
    }

    // Attempt transcription
    const result = await transcribeVoice(audioData);
    
    // Check if transcription was successful
    if (!result.text || result.confidence < 0.5) {
      console.warn('Low confidence transcription, falling back to text input');
      onFallbackToText();
      return null;
    }

    return result;
  } catch (error) {
    console.error('Voice transcription failed, falling back to text input:', error);
    onFallbackToText();
    return null;
  }
}

/**
 * Format notes into professional reports
 * Uses Nova AI to transform informal notes into structured professional reports
 */
export async function formatReport(notes: string, reportType: string): Promise<string> {
  try {
    // Validate input
    if (!notes || notes.trim().length === 0) {
      throw new Error('Notes cannot be empty');
    }

    if (!reportType) {
      throw new Error('Report type must be specified');
    }

    // Build report formatting prompt
    const systemPrompt = buildReportFormattingPrompt(reportType);
    const messages: Message[] = [
      {
        role: 'system',
        content: systemPrompt,
        timestamp: new Date(),
      },
      {
        role: 'user',
        content: notes,
        timestamp: new Date(),
      },
    ];

    // Invoke Nova for formatting
    const formattedReport = await invokeNova(messages);

    return formattedReport.trim();
  } catch (error) {
    console.error('Error formatting report:', error);
    throw new Error(`Failed to format report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Build report formatting prompt based on report type
 */
function buildReportFormattingPrompt(reportType: string): string {
  const templates: Record<string, string> = {
    session_note: `Format the following informal notes into a professional session note report.

Structure:
- Date and Time
- Participant Information
- Session Type and Duration
- Summary of Discussion
- Key Points and Observations
- Action Items and Follow-up
- Peer Specialist Signature Line

Use professional clinical language while maintaining accuracy. Organize information logically and ensure HIPAA compliance.`,

    assessment_report: `Format the following assessment notes into a professional assessment report.

Structure:
- Assessment Information (Type, Date, Conducted By)
- Participant Demographics
- Assessment Results
- Score Interpretation
- Clinical Observations
- Recommendations
- Next Steps

Use clinical terminology appropriately. Present scores and interpretations clearly. Maintain professional tone.`,

    progress_note: `Format the following notes into a professional progress note.

Structure:
- Date and Time
- Participant Name and ID
- Progress Summary
- Goal Status Updates
- Barriers and Challenges
- Interventions and Support Provided
- Plan for Next Session
- Signature Line

Focus on measurable progress. Use objective language. Highlight both achievements and areas needing attention.`,

    intake_summary: `Format the following intake information into a comprehensive intake summary report.

Structure:
- Participant Demographics
- Contact Information
- Substance Use History
- Health Information
- Social Determinants of Health
- Support System
- Insurance and Services
- Initial Assessment and Recommendations

Organize information by category. Use clear headings. Ensure all critical information is included.`,

    crisis_report: `Format the following crisis intervention notes into a formal crisis report.

Structure:
- Date, Time, and Location
- Participant Information
- Crisis Description and Severity
- Risk Assessment
- Immediate Interventions Taken
- Resources Provided
- Safety Plan
- Follow-up Actions Required
- Notifications Made

Use clear, factual language. Document timeline of events. Include all safety measures taken.`,
  };

  const template = templates[reportType] || templates.session_note;

  return `${template}

Important Guidelines:
- Maintain HIPAA compliance - use appropriate identifiers
- Use professional, objective language
- Organize information logically with clear sections
- Ensure accuracy - do not add information not present in the notes
- Use proper grammar, spelling, and punctuation
- Format for readability with appropriate spacing and structure

Return only the formatted report, no additional commentary.`;
}

/**
 * Get available report types
 */
export function getAvailableReportTypes(): string[] {
  return [
    'session_note',
    'assessment_report',
    'progress_note',
    'intake_summary',
    'crisis_report',
  ];
}

/**
 * Validate report type
 */
export function isValidReportType(reportType: string): boolean {
  return getAvailableReportTypes().includes(reportType);
}

/**
 * Detect crisis indicators in conversation
 * Analyzes conversation history for signs of immediate risk
 */
export async function detectCrisis(conversationHistory: Message[]): Promise<CrisisAssessment> {
  try {
    // Validate input
    if (!conversationHistory || conversationHistory.length === 0) {
      return {
        isCrisis: false,
        riskLevel: 'low',
        indicators: [],
        recommendedActions: [],
      };
    }

    // Build crisis detection prompt
    const systemPrompt = buildCrisisDetectionPrompt();
    
    // Combine conversation history into context
    const conversationText = conversationHistory
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const messages: Message[] = [
      {
        role: 'system',
        content: systemPrompt,
        timestamp: new Date(),
      },
      {
        role: 'user',
        content: `Analyze this conversation for crisis indicators:\n\n${conversationText}`,
        timestamp: new Date(),
      },
    ];

    // Invoke Nova for crisis detection
    const response = await invokeNova(messages);

    // Parse crisis assessment
    const assessment = parseCrisisAssessment(response);

    // Also perform rule-based detection as a safety net
    const ruleBasedAssessment = performRuleBasedCrisisDetection(conversationHistory);

    // Combine AI and rule-based assessments (take the higher risk level)
    const finalAssessment = combineAssessments(assessment, ruleBasedAssessment);

    return finalAssessment;
  } catch (error) {
    console.error('Error detecting crisis:', error);
    
    // On error, perform rule-based detection as fallback
    return performRuleBasedCrisisDetection(conversationHistory);
  }
}

/**
 * Build crisis detection prompt
 */
function buildCrisisDetectionPrompt(): string {
  return `You are a crisis detection system for substance use disorder recovery programs. 
Analyze conversations for signs of immediate risk or crisis situations.

Crisis Indicators to Detect:
1. Suicidal ideation or self-harm intent
2. Homicidal ideation or intent to harm others
3. Active substance use or imminent relapse
4. Severe withdrawal symptoms
5. Medical emergency
6. Domestic violence or abuse
7. Severe mental health crisis
8. Loss of housing or immediate safety concerns
9. Legal crisis requiring immediate attention
10. Overdose risk or recent overdose

Risk Levels:
- IMMEDIATE: Active suicidal/homicidal ideation, overdose, medical emergency
- HIGH: Recent relapse, severe symptoms, safety concerns, abuse situation
- MEDIUM: Expressed distress, risk factors present, concerning statements
- LOW: No significant crisis indicators detected

Return a JSON object with:
{
  "isCrisis": boolean,
  "riskLevel": "immediate" | "high" | "medium" | "low",
  "indicators": ["list of specific indicators found"],
  "recommendedActions": ["list of recommended immediate actions"]
}

Be conservative - err on the side of caution. If in doubt, escalate the risk level.`;
}

/**
 * Parse crisis assessment from Nova response
 */
function parseCrisisAssessment(response: string): CrisisAssessment {
  try {
    const parsed = JSON.parse(response);
    
    return {
      isCrisis: parsed.isCrisis || false,
      riskLevel: parsed.riskLevel || 'low',
      indicators: parsed.indicators || [],
      recommendedActions: parsed.recommendedActions || [],
    };
  } catch (error) {
    // If parsing fails, return safe default
    return {
      isCrisis: false,
      riskLevel: 'low',
      indicators: [],
      recommendedActions: [],
    };
  }
}

/**
 * Perform rule-based crisis detection as a safety net
 * This runs independently of AI to catch critical keywords
 */
function performRuleBasedCrisisDetection(conversationHistory: Message[]): CrisisAssessment {
  const conversationText = conversationHistory
    .map(msg => msg.content)
    .join(' ')
    .toLowerCase();

  const indicators: string[] = [];
  let riskLevel: CrisisAssessment['riskLevel'] = 'low';
  const recommendedActions: string[] = [];

  // Immediate risk keywords
  const immediateKeywords = [
    'kill myself',
    'end my life',
    'suicide',
    'want to die',
    'overdose',
    'overdosed',
    'can\'t go on',
    'better off dead',
    'goodbye forever',
  ];

  // High risk keywords
  const highRiskKeywords = [
    'relapsed',
    'using again',
    'bought drugs',
    'self-harm',
    'cut myself',
    'hurt myself',
    'abuse',
    'beaten',
    'threatened',
    'homeless',
    'nowhere to go',
  ];

  // Medium risk keywords
  const mediumRiskKeywords = [
    'struggling',
    'can\'t cope',
    'overwhelming',
    'hopeless',
    'worthless',
    'giving up',
    'craving',
    'tempted',
  ];

  // Check for immediate risk
  for (const keyword of immediateKeywords) {
    if (conversationText.includes(keyword)) {
      indicators.push(`Immediate risk indicator: "${keyword}"`);
      riskLevel = 'immediate';
    }
  }

  // Check for high risk
  if (riskLevel !== 'immediate') {
    for (const keyword of highRiskKeywords) {
      if (conversationText.includes(keyword)) {
        indicators.push(`High risk indicator: "${keyword}"`);
        if (riskLevel !== 'high') {
          riskLevel = 'high';
        }
      }
    }
  }

  // Check for medium risk
  if (riskLevel === 'low') {
    for (const keyword of mediumRiskKeywords) {
      if (conversationText.includes(keyword)) {
        indicators.push(`Medium risk indicator: "${keyword}"`);
        riskLevel = 'medium';
      }
    }
  }

  // Generate recommended actions based on risk level
  if (riskLevel === 'immediate') {
    recommendedActions.push(
      'IMMEDIATE ACTION REQUIRED',
      'Contact emergency services (911) if participant is in immediate danger',
      'Do not leave participant alone',
      'Contact crisis hotline: 988 Suicide & Crisis Lifeline',
      'Notify supervisor immediately',
      'Implement safety plan',
      'Consider involuntary commitment if necessary'
    );
  } else if (riskLevel === 'high') {
    recommendedActions.push(
      'Contact supervisor for guidance',
      'Assess immediate safety',
      'Provide crisis resources and hotlines',
      'Schedule urgent follow-up within 24 hours',
      'Review and update safety plan',
      'Consider increasing support frequency'
    );
  } else if (riskLevel === 'medium') {
    recommendedActions.push(
      'Explore concerns in more depth',
      'Assess coping strategies',
      'Provide support resources',
      'Schedule follow-up within 3-5 days',
      'Document concerns in session notes',
      'Consider referral to additional services'
    );
  }

  return {
    isCrisis: riskLevel === 'immediate' || riskLevel === 'high',
    riskLevel,
    indicators,
    recommendedActions,
  };
}

/**
 * Combine AI and rule-based assessments
 * Takes the higher risk level for safety
 */
function combineAssessments(
  aiAssessment: CrisisAssessment,
  ruleBasedAssessment: CrisisAssessment
): CrisisAssessment {
  const riskLevels: Record<string, number> = {
    immediate: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const aiRiskScore = riskLevels[aiAssessment.riskLevel] || 1;
  const ruleRiskScore = riskLevels[ruleBasedAssessment.riskLevel] || 1;

  const finalRiskLevel = aiRiskScore >= ruleRiskScore 
    ? aiAssessment.riskLevel 
    : ruleBasedAssessment.riskLevel;

  const isCrisis = aiAssessment.isCrisis || ruleBasedAssessment.isCrisis;

  // Combine indicators and actions, removing duplicates
  const allIndicators = [...aiAssessment.indicators, ...ruleBasedAssessment.indicators];
  const uniqueIndicators = Array.from(new Set(allIndicators));

  const allActions = [...aiAssessment.recommendedActions, ...ruleBasedAssessment.recommendedActions];
  const uniqueActions = Array.from(new Set(allActions));

  return {
    isCrisis,
    riskLevel: finalRiskLevel,
    indicators: uniqueIndicators,
    recommendedActions: uniqueActions,
  };
}

/**
 * Get crisis resources and hotlines
 */
export function getCrisisResources(): {
  name: string;
  phone: string;
  description: string;
}[] {
  return [
    {
      name: '988 Suicide & Crisis Lifeline',
      phone: '988',
      description: '24/7 free and confidential support for people in distress',
    },
    {
      name: 'Crisis Text Line',
      phone: 'Text HOME to 741741',
      description: 'Free 24/7 support via text message',
    },
    {
      name: 'SAMHSA National Helpline',
      phone: '1-800-662-4357',
      description: 'Treatment referral and information service for substance use disorders',
    },
    {
      name: 'National Domestic Violence Hotline',
      phone: '1-800-799-7233',
      description: '24/7 support for domestic violence situations',
    },
    {
      name: 'Emergency Services',
      phone: '911',
      description: 'For immediate life-threatening emergencies',
    },
  ];
}
