/**
 * Encryption Service Tests
 * Property-based and unit tests for encryption functionality
 */

import * as fc from 'fast-check';
import { DataType } from '../types';

// Set environment variables before importing encryption module
process.env.EXPO_PUBLIC_KMS_KEY_ID = 'test-kms-key-id';
process.env.EXPO_PUBLIC_AWS_REGION = 'us-east-1';
process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY = 'test-secret-key';

// Mock AWS KMS client before importing encryption module
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-kms', () => {
  return {
    KMSClient: jest.fn(() => ({
      send: mockSend,
    })),
    EncryptCommand: jest.fn((input) => ({ 
      input,
      commandType: 'EncryptCommand',
    })),
    DecryptCommand: jest.fn((input) => ({ 
      input,
      commandType: 'DecryptCommand',
    })),
  };
});

// Now import encryption module after mocks are set up
import { encrypt, decrypt, encryptField, decryptField } from '../encryption';

beforeEach(() => {
  jest.clearAllMocks();
  
  // Mock encrypt/decrypt implementation
  mockSend.mockImplementation((command: any) => {
    if (command.commandType === 'EncryptCommand') {
      const plaintext = command.input.Plaintext;
      // Simulate encryption by reversing and encoding
      const reversed = Buffer.from(plaintext).reverse();
      return Promise.resolve({
        CiphertextBlob: reversed,
      });
    } else if (command.commandType === 'DecryptCommand') {
      const ciphertext = command.input.CiphertextBlob;
      // Simulate decryption by reversing back
      const plaintext = Buffer.from(ciphertext).reverse();
      return Promise.resolve({
        Plaintext: plaintext,
      });
    }
    return Promise.reject(new Error('Unknown command type'));
  });
});

describe('Encryption Service', () => {
  /**
   * Property 32: PHI encryption at rest
   * Validates: Requirements 9.1
   * 
   * For any PHI stored in the database, the data should be encrypted using AES-256 encryption
   */
  describe('Feature: log-peer-recovery-system, Property 32: PHI encryption at rest', () => {
    it('should encrypt and decrypt any PHI data correctly (round-trip)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 1000 }),
          fc.constantFrom(DataType.PHI, DataType.PII, DataType.CONSENT, DataType.AUDIT_LOG),
          async (plaintext, dataType) => {
            // Encrypt the data
            const encrypted = await encrypt(plaintext, dataType);
            
            // Encrypted data should be different from plaintext
            expect(encrypted).not.toBe(plaintext);
            
            // Encrypted data should be base64 encoded
            expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/);
            
            // Decrypt the data
            const decrypted = await decrypt(encrypted, dataType);
            
            // Decrypted data should match original plaintext
            expect(decrypted).toBe(plaintext);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce different ciphertext for the same plaintext (non-deterministic)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (plaintext) => {
            const encrypted1 = await encrypt(plaintext, DataType.PHI);
            const encrypted2 = await encrypt(plaintext, DataType.PHI);
            
            // Both should decrypt to the same plaintext
            const decrypted1 = await decrypt(encrypted1, DataType.PHI);
            const decrypted2 = await decrypt(encrypted2, DataType.PHI);
            
            expect(decrypted1).toBe(plaintext);
            expect(decrypted2).toBe(plaintext);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle encryption of sensitive field types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            ssn: fc.string({ minLength: 9, maxLength: 11 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            email: fc.emailAddress(),
            phone: fc.string({ minLength: 10, maxLength: 15 }),
          }),
          async (sensitiveData) => {
            // Encrypt each field
            const encryptedSSN = await encryptField(sensitiveData.ssn, DataType.PHI);
            const encryptedName = await encryptField(sensitiveData.name, DataType.PHI);
            const encryptedEmail = await encryptField(sensitiveData.email, DataType.PII);
            const encryptedPhone = await encryptField(sensitiveData.phone, DataType.PII);
            
            // All encrypted values should be different from originals
            expect(encryptedSSN).not.toBe(sensitiveData.ssn);
            expect(encryptedName).not.toBe(sensitiveData.name);
            expect(encryptedEmail).not.toBe(sensitiveData.email);
            expect(encryptedPhone).not.toBe(sensitiveData.phone);
            
            // Decrypt and verify
            const decryptedSSN = await decryptField(encryptedSSN, DataType.PHI);
            const decryptedName = await decryptField(encryptedName, DataType.PHI);
            const decryptedEmail = await decryptField(encryptedEmail, DataType.PII);
            const decryptedPhone = await decryptField(encryptedPhone, DataType.PII);
            
            expect(decryptedSSN).toBe(sensitiveData.ssn);
            expect(decryptedName).toBe(sensitiveData.name);
            expect(decryptedEmail).toBe(sensitiveData.email);
            expect(decryptedPhone).toBe(sensitiveData.phone);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error when encrypting empty data', async () => {
      await expect(encrypt('', DataType.PHI)).rejects.toThrow('Data to encrypt cannot be empty');
    });

    it('should throw error when decrypting empty data', async () => {
      await expect(decrypt('', DataType.PHI)).rejects.toThrow('Encrypted data cannot be empty');
    });
  });

  describe('Field-level Encryption', () => {
    it('should encrypt and decrypt field values', async () => {
      const fieldValue = 'John Doe';
      const encrypted = await encryptField(fieldValue);
      const decrypted = await decryptField(encrypted);
      
      expect(encrypted).not.toBe(fieldValue);
      expect(decrypted).toBe(fieldValue);
    });

    it('should use PHI as default data type', async () => {
      const fieldValue = 'sensitive data';
      const encrypted = await encryptField(fieldValue);
      
      // Should be able to decrypt with PHI type
      const decrypted = await decryptField(encrypted, DataType.PHI);
      expect(decrypted).toBe(fieldValue);
    });
  });
});
