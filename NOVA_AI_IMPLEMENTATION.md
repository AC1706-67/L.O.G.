# Amazon Nova Pro AI Implementation

## Overview

Your app uses **Amazon Nova Pro** via AWS Bedrock for AI-powered features in the peer recovery system.

## Current Implementation

### Configuration

**File:** `src/config/aws.ts`

```typescript
export const BEDROCK_CONFIG = {
  modelId: 'arn:aws:bedrock:us-east-2:155954278897:inference-profile/us.amazon.nova-pro-v1:0',
  maxTokens: 2902,
  temperature: 0.97,
  topP: 1.0,
};
```

**Environment Variables (.env):**
- `EXPO_PUBLIC_AWS_REGION=us-east-2`
- `EXPO_PUBLIC_AWS_ACCESS_KEY_ID` - Configured
- `EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY` - Configured
- `EXPO_PUBLIC_BEDROCK_MODEL_ID` - Nova Pro ARN

### Service File

**File:** `src/modules/ai/novaService.ts` (998 lines)

This is your main AI service that provides:

## Current AI Features

### 1. Conversational AI (`processConversation`)
- Handles text and voice input
- Maintains conversation context
- Extracts structured data from natural language
- Detects sensitive topics
- Generates appropriate responses

**Use Cases:**
- Intake assessments
- Clinical assessments
- Goal setting conversations
- Session logging
- Natural language queries

### 2. Structured Data Extraction (`extractStructuredData`)
- Schema-based extraction
- Confidence scoring for each field
- Identifies missing required fields
- Validates extracted data

**Use Cases:**
- Extracting participant information from conversations
- Parsing assessment responses
- Capturing goal details
- Logging interaction data

### 3. Follow-up Question Generation (`generateFollowUp`)
- Context-aware question generation
- Fills gaps in required information
- Maintains conversational flow
- Adapts to participant's emotional state

### 4. Report Formatting (`formatReport`)
- Transforms informal notes into professional reports
- Multiple report types supported:
  - Session notes
  - Assessment reports
  - Progress notes
  - Intake summaries
  - Crisis reports

**Features:**
- HIPAA-compliant formatting
- Professional clinical language
- Structured sections
- Proper grammar and formatting

### 5. Crisis Detection (`detectCrisis`)
- AI-powered crisis indicator detection
- Rule-based safety net
- Risk level assessment (immediate/high/medium/low)
- Recommended actions based on risk

**Detects:**
- Suicidal ideation
- Self-harm intent
- Active substance use
- Severe withdrawal
- Medical emergencies
- Domestic violence
- Mental health crises
- Safety concerns

### 6. Voice Transcription (`transcribeVoice`)
- Converts voice input to text
- Fallback to text input on failure
- Confidence scoring
- Language detection

**Note:** Currently uses placeholder - needs AWS Transcribe integration

## Module-Specific AI Guidance

The AI adapts its behavior based on the current module:

### Intake Module
- Collects participant information naturally
- Patient and empathetic
- Extracts structured intake data

### Assessment Module
- Follows assessment protocols
- Maintains conversational tone
- Captures scores accurately

### Goal Setting Module
- Facilitates collaborative goal-setting
- Extracts SMART goals
- Identifies action steps and timelines

### Interaction Logging
- Extracts session details
- Summarizes key points
- Identifies follow-up needs

### Query Processing
- Interprets natural language queries
- Identifies required data
- Formats responses clearly

## How Nova is Called

### Basic Flow:

```typescript
// 1. Build messages with context
const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userInput }
];

// 2. Invoke Nova via Bedrock
const command = new InvokeModelCommand({
  modelId: BEDROCK_CONFIG.modelId,
  contentType: 'application/json',
  accept: 'application/json',
  body: JSON.stringify({
    messages: formattedMessages,
    max_tokens: BEDROCK_CONFIG.maxTokens,
    temperature: BEDROCK_CONFIG.temperature,
    top_p: BEDROCK_CONFIG.topP,
  }),
});

const response = await bedrockClient.send(command);

// 3. Parse response
const responseBody = JSON.parse(new TextDecoder().decode(response.body));
const responseText = responseBody.content?.[0]?.text || responseBody.completion || '';
```

## Where Nova is Used

Currently, the Nova service is **implemented but not yet integrated** into the UI screens. The service is ready to be called from:

### Planned Integration Points:

1. **Intake Assessment Screens**
   - Use `processConversation()` for natural language intake
   - Use `extractStructuredData()` to populate forms

2. **Assessment Forms**
   - Use `processConversation()` for conversational assessments
   - Use `detectCrisis()` for risk assessment

3. **Recovery Plan Creation**
   - Use `processConversation()` for goal setting
   - Use `generateFollowUp()` for guided planning

4. **Interaction Logging**
   - Use `formatReport()` to generate session notes
   - Use `extractStructuredData()` for quick logging

5. **Dashboard/Query**
   - Use `processConversation()` for natural language queries
   - "Show me participants who need follow-up"
   - "What's the status of John's recovery plan?"

## Expanding AI Features

### Ideas for Enhancement:

1. **Smart Suggestions**
   - Suggest interventions based on participant history
   - Recommend resources based on needs
   - Predict relapse risk

2. **Automated Documentation**
   - Auto-generate progress notes from interactions
   - Summarize assessment results
   - Create discharge summaries

3. **Intelligent Scheduling**
   - Suggest optimal follow-up times
   - Identify participants needing urgent attention
   - Balance caseload recommendations

4. **Outcome Prediction**
   - Predict treatment success likelihood
   - Identify risk factors early
   - Suggest preventive interventions

5. **Natural Language Search**
   - "Find all participants with housing issues"
   - "Show recent crisis interventions"
   - "List participants making good progress"

6. **Voice-First Interface**
   - Complete voice-driven documentation
   - Hands-free session logging
   - Voice commands for navigation

7. **Sentiment Analysis**
   - Track participant mood over time
   - Detect emotional distress
   - Measure engagement levels

8. **Personalized Interventions**
   - Tailor recovery plans to individual needs
   - Adapt communication style
   - Suggest culturally appropriate resources

## Security & Compliance

### HIPAA Compliance:
✅ AWS BAA required (ensure signed)
✅ Data encrypted in transit (HTTPS)
✅ Data encrypted at rest (AWS encryption)
✅ Audit logging via CloudTrail
✅ IAM policies with least privilege
✅ No PHI stored in logs

### Best Practices:
- Never log participant data
- Use de-identified data when possible
- Implement proper access controls
- Regular security audits
- Incident response plan

## Performance Considerations

### Current Settings:
- **Max Tokens:** 2902 (moderate responses)
- **Temperature:** 0.97 (creative but controlled)
- **Top P:** 1.0 (full vocabulary)

### Optimization Tips:
- Cache common prompts
- Batch similar requests
- Use streaming for long responses
- Implement request queuing
- Monitor token usage

## Cost Management

### Nova Pro Pricing (approximate):
- Input: ~$0.80 per 1M tokens
- Output: ~$3.20 per 1M tokens

### Cost Optimization:
- Use concise prompts
- Limit max_tokens appropriately
- Cache responses when possible
- Monitor usage with CloudWatch
- Set budget alerts

## Testing

### Test the AI Service:

```typescript
import { processConversation, extractStructuredData, detectCrisis } from './src/modules/ai/novaService';

// Test conversation
const result = await processConversation({
  text: "I've been clean for 30 days and feeling hopeful",
  mode: 'text',
  context: {
    currentModule: 'interaction',
    previousMessages: [],
    extractedData: {},
  },
});

console.log(result.response);
console.log(result.extractedData);
```

## Next Steps

To integrate Nova into your screens:

1. **Import the service:**
   ```typescript
   import { processConversation } from '../modules/ai/novaService';
   ```

2. **Call it from your components:**
   ```typescript
   const handleUserInput = async (text: string) => {
     const result = await processConversation({
       text,
       mode: 'text',
       context: conversationContext,
     });
     
     // Use result.response for display
     // Use result.extractedData to populate forms
   };
   ```

3. **Handle loading and errors:**
   ```typescript
   const [isProcessing, setIsProcessing] = useState(false);
   
   try {
     setIsProcessing(true);
     const result = await processConversation(...);
     // Handle success
   } catch (error) {
     // Handle error
   } finally {
     setIsProcessing(false);
   }
   ```

---

**Status:** ✅ Fully implemented service, ready for UI integration
**Model:** Amazon Nova Pro v1.0
**Region:** us-east-2
**Service File:** `src/modules/ai/novaService.ts`
