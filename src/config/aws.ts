import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { TranscribeClient } from '@aws-sdk/client-transcribe';

const awsRegion = process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1';
const awsAccessKeyId = process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID || '';
const awsSecretAccessKey = process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY || '';

if (!awsAccessKeyId || !awsSecretAccessKey) {
  console.warn('AWS credentials not configured. Please set AWS credentials in .env file');
}

/**
 * AWS Bedrock Runtime Client for Amazon Nova AI
 * Used for conversational AI and structured data extraction
 */
export const bedrockClient = new BedrockRuntimeClient({
  region: awsRegion,
  credentials: {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
  },
});

/**
 * AWS Transcribe Client for voice-to-text conversion
 * Used for voice input processing
 */
export const transcribeClient = new TranscribeClient({
  region: awsRegion,
  credentials: {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
  },
});

/**
 * Bedrock Model Configuration
 */
export const BEDROCK_CONFIG = {
  modelId: process.env.EXPO_PUBLIC_BEDROCK_MODEL_ID || 'amazon.nova-2-sonic-v1:0',
  maxTokens: 2048,
  temperature: 0.7,
  topP: 0.9,
};

/**
 * HIPAA Compliance Notes:
 * 1. Ensure AWS account has BAA signed
 * 2. Use HIPAA-eligible AWS services only
 * 3. Enable CloudTrail for audit logging
 * 4. Configure encryption at rest and in transit
 * 5. Implement proper IAM policies with least privilege
 */
