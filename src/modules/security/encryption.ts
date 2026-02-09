/**
 * Encryption Service
 * Provides AES-256 encryption/decryption with AWS KMS key management
 * Requirements: 9.1, 1.8
 */

import { KMSClient, DecryptCommand, EncryptCommand } from '@aws-sdk/client-kms';
import { DataType } from './types';

// Lazy initialization of KMS client
let kmsClient: KMSClient | null = null;

function getKMSClient(): KMSClient {
  if (!kmsClient) {
    const awsRegion = process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1';
    const awsAccessKeyId = process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID || '';
    const awsSecretAccessKey = process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY || '';
    
    kmsClient = new KMSClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });
  }
  return kmsClient;
}

function getKMSKeyId(): string {
  const kmsKeyId = process.env.EXPO_PUBLIC_KMS_KEY_ID || '';
  if (!kmsKeyId) {
    throw new Error('KMS Key ID not configured. Set EXPO_PUBLIC_KMS_KEY_ID in environment');
  }
  return kmsKeyId;
}

/**
 * Encrypts data using AES-256 with AWS KMS
 * @param data - Plain text data to encrypt
 * @param dataType - Type of data being encrypted (PHI, PII, etc.)
 * @returns Base64 encoded encrypted data
 */
export async function encrypt(data: string, dataType: DataType): Promise<string> {
  if (!data) {
    throw new Error('Data to encrypt cannot be empty');
  }

  const kmsKeyId = getKMSKeyId();
  const client = getKMSClient();

  try {
    // Convert string to Uint8Array
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(data);

    // Encrypt using AWS KMS
    const command = new EncryptCommand({
      KeyId: kmsKeyId,
      Plaintext: plaintext,
      EncryptionContext: {
        dataType: dataType,
        timestamp: new Date().toISOString(),
      },
    });

    const response = await client.send(command);

    if (!response.CiphertextBlob) {
      throw new Error('Encryption failed: No ciphertext returned');
    }

    // Convert Uint8Array to Base64 string for storage
    const base64 = Buffer.from(response.CiphertextBlob).toString('base64');
    return base64;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error(`Failed to encrypt ${dataType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypts data that was encrypted with AWS KMS
 * @param encryptedData - Base64 encoded encrypted data
 * @param dataType - Type of data being decrypted (for validation)
 * @returns Decrypted plain text data
 */
export async function decrypt(encryptedData: string, dataType: DataType): Promise<string> {
  if (!encryptedData) {
    throw new Error('Encrypted data cannot be empty');
  }

  const kmsKeyId = getKMSKeyId();
  const client = getKMSClient();

  try {
    // Convert Base64 string to Uint8Array
    const ciphertext = Buffer.from(encryptedData, 'base64');

    // Decrypt using AWS KMS
    const command = new DecryptCommand({
      CiphertextBlob: ciphertext,
      KeyId: kmsKeyId,
      EncryptionContext: {
        dataType: dataType,
      },
    });

    const response = await client.send(command);

    if (!response.Plaintext) {
      throw new Error('Decryption failed: No plaintext returned');
    }

    // Convert Uint8Array to string
    const decoder = new TextDecoder();
    const plaintext = decoder.decode(response.Plaintext);
    return plaintext;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error(`Failed to decrypt ${dataType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Encrypts a field value for database storage
 * Convenience wrapper for field-level encryption
 * @param fieldValue - The field value to encrypt
 * @param fieldType - The type of field (determines encryption context)
 * @returns Encrypted field value
 */
export async function encryptField(fieldValue: string, fieldType: DataType = DataType.PHI): Promise<string> {
  return encrypt(fieldValue, fieldType);
}

/**
 * Decrypts a field value from database storage
 * Convenience wrapper for field-level decryption
 * @param encryptedValue - The encrypted field value
 * @param fieldType - The type of field (must match encryption context)
 * @returns Decrypted field value
 */
export async function decryptField(encryptedValue: string, fieldType: DataType = DataType.PHI): Promise<string> {
  return decrypt(encryptedValue, fieldType);
}
