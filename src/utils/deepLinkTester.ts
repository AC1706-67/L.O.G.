/**
 * Deep Link Testing Utilities
 * 
 * Helper functions for testing deep link functionality during development.
 * Remove or disable in production builds.
 */

import * as Linking from 'expo-linking';

/**
 * Simulates a Supabase invite callback
 * Useful for testing without sending real emails
 */
export const simulateInviteCallback = async () => {
  const testUrl = Linking.createURL('auth/callback', {
    queryParams: {
      type: 'invite',
      access_token: 'test_access_token_' + Date.now(),
      refresh_token: 'test_refresh_token_' + Date.now(),
    },
  });

  console.log('Simulating invite callback:', testUrl);
  
  // This will trigger the deep link handler
  await Linking.openURL(testUrl);
};

/**
 * Simulates a password recovery callback
 */
export const simulateRecoveryCallback = async () => {
  const testUrl = Linking.createURL('auth/callback', {
    queryParams: {
      type: 'recovery',
      access_token: 'test_access_token_' + Date.now(),
      refresh_token: 'test_refresh_token_' + Date.now(),
    },
  });

  console.log('Simulating recovery callback:', testUrl);
  await Linking.openURL(testUrl);
};

/**
 * Simulates an error callback
 */
export const simulateErrorCallback = async (error: string, description: string) => {
  const testUrl = Linking.createURL('auth/callback', {
    queryParams: {
      type: 'invite',
      error,
      error_description: description,
    },
  });

  console.log('Simulating error callback:', testUrl);
  await Linking.openURL(testUrl);
};

/**
 * Tests if deep linking is properly configured
 */
export const testDeepLinkConfiguration = async (): Promise<{
  canOpenURL: boolean;
  initialURL: string | null;
  scheme: string;
}> => {
  try {
    // Get the app's URL scheme
    const scheme = Linking.createURL('');
    
    // Check if we can handle our own scheme
    const canOpen = await Linking.canOpenURL(scheme);
    
    // Get initial URL (if app was opened via deep link)
    const initialURL = await Linking.getInitialURL();

    const result = {
      canOpenURL: canOpen,
      initialURL,
      scheme,
    };

    console.log('Deep link configuration test:', result);
    return result;
  } catch (error) {
    console.error('Error testing deep link configuration:', error);
    throw error;
  }
};

/**
 * Parses a deep link URL and logs its components
 */
export const debugDeepLink = (url: string) => {
  try {
    const parsed = Linking.parse(url);
    
    console.log('=== Deep Link Debug ===');
    console.log('Full URL:', url);
    console.log('Scheme:', parsed.scheme);
    console.log('Hostname:', parsed.hostname);
    console.log('Path:', parsed.path);
    console.log('Query Params:', parsed.queryParams);
    console.log('=====================');

    return parsed;
  } catch (error) {
    console.error('Error parsing deep link:', error);
    throw error;
  }
};

/**
 * Creates a test invite link with custom parameters
 */
export const createTestInviteLink = (params?: {
  accessToken?: string;
  refreshToken?: string;
  email?: string;
}): string => {
  const queryParams: Record<string, string> = {
    type: 'invite',
    access_token: params?.accessToken || 'test_access_' + Date.now(),
    refresh_token: params?.refreshToken || 'test_refresh_' + Date.now(),
  };

  if (params?.email) {
    queryParams.email = params.email;
  }

  return Linking.createURL('auth/callback', { queryParams });
};

/**
 * Logs all registered URL schemes for the app
 */
export const logRegisteredSchemes = async () => {
  try {
    const schemes = [
      'logpeerrecovery://',
      'https://nkedmosycikakajobaht.supabase.co',
    ];

    console.log('=== Testing URL Schemes ===');
    
    for (const scheme of schemes) {
      const canOpen = await Linking.canOpenURL(scheme);
      console.log(`${scheme}: ${canOpen ? '✅ Can open' : '❌ Cannot open'}`);
    }
    
    console.log('=========================');
  } catch (error) {
    console.error('Error checking schemes:', error);
  }
};

/**
 * Development-only: Add a test button to your app
 * 
 * Example usage in a dev screen:
 * 
 * import { simulateInviteCallback } from './utils/deepLinkTester';
 * 
 * <Button 
 *   title="Test Invite Deep Link" 
 *   onPress={simulateInviteCallback}
 * />
 */

// Export all test functions
export const deepLinkTester = {
  simulateInviteCallback,
  simulateRecoveryCallback,
  simulateErrorCallback,
  testDeepLinkConfiguration,
  debugDeepLink,
  createTestInviteLink,
  logRegisteredSchemes,
};

/**
 * Auto-run configuration test in development
 * Uncomment to enable automatic testing on app start
 */
// if (__DEV__) {
//   setTimeout(() => {
//     testDeepLinkConfiguration();
//     logRegisteredSchemes();
//   }, 2000);
// }
