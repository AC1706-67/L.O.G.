export { supabase } from './supabase';
export { bedrockClient, transcribeClient, BEDROCK_CONFIG } from './aws';

/**
 * Application Configuration
 */
export const APP_CONFIG = {
  environment: process.env.EXPO_PUBLIC_ENVIRONMENT || 'development',
  sessionTimeoutMinutes: 15,
  autoSaveIntervalSeconds: 30,
  screenLockTimeoutSeconds: 30,
  consentExpirationWarningDays: 30,
  auditLogRetentionYears: 7,
};

/**
 * Security Configuration
 */
export const SECURITY_CONFIG = {
  encryptionAlgorithm: 'AES-256',
  passwordMinLength: 12,
  mfaRequired: true,
  biometricAuthEnabled: true,
  screenCapturePreventionEnabled: true,
};
