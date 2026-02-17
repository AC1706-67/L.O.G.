import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../config/supabase';

interface DeepLinkHandlerProps {
  children: React.ReactNode;
  onAuthSuccess?: () => void;
  onAuthError?: (error: Error) => void;
}

/**
 * DeepLinkHandler - Handles Supabase invite deep links
 * 
 * This component:
 * 1. Listens for incoming deep links
 * 2. Detects Supabase auth callbacks (invite, password reset, etc.)
 * 3. Exchanges auth codes for sessions using PKCE flow
 * 4. Persists sessions automatically via Supabase client
 * 5. Updates auth state throughout the app
 */
export const DeepLinkHandler: React.FC<DeepLinkHandlerProps> = ({
  children,
  onAuthSuccess,
  onAuthError,
}) => {
  const [isProcessingLink, setIsProcessingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    // Handle initial URL if app was opened via deep link
    handleInitialURL();

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  const handleInitialURL = async () => {
    try {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await processDeepLink(initialUrl);
      }
    } catch (error) {
      console.error('Error handling initial URL:', error);
    }
  };

  const handleDeepLink = async (event: { url: string }) => {
    await processDeepLink(event.url);
  };

  const processDeepLink = async (url: string) => {
    try {
      console.log('Processing deep link:', url);
      
      // Parse the URL
      const parsed = Linking.parse(url);
      const { queryParams } = parsed;

      // Check if this is a Supabase auth callback
      if (isSupabaseAuthCallback(queryParams)) {
        setIsProcessingLink(true);
        setLinkError(null);

        await handleSupabaseAuthCallback(queryParams);

        setIsProcessingLink(false);
        onAuthSuccess?.();
      }
    } catch (error) {
      console.error('Error processing deep link:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process authentication link';
      setLinkError(errorMessage);
      setIsProcessingLink(false);
      onAuthError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  };

  /**
   * Checks if the URL contains Supabase auth parameters
   */
  const isSupabaseAuthCallback = (params: Record<string, any>): boolean => {
    // Supabase auth callbacks contain these parameters
    return !!(
      params.type || // invite, recovery, magiclink, etc.
      params.access_token ||
      params.refresh_token ||
      params.error ||
      params.error_description
    );
  };

  /**
   * Handles Supabase authentication callback
   * Supports: invite, password recovery, magic link, email confirmation
   */
  const handleSupabaseAuthCallback = async (params: Record<string, any>) => {
    // Check for errors first
    if (params.error) {
      throw new Error(params.error_description || params.error);
    }

    // Handle different auth types
    const authType = params.type;

    switch (authType) {
      case 'invite':
        await handleInviteCallback(params);
        break;
      
      case 'recovery':
        await handleRecoveryCallback(params);
        break;
      
      case 'magiclink':
        await handleMagicLinkCallback(params);
        break;
      
      case 'signup':
      case 'email':
        await handleEmailConfirmationCallback(params);
        break;
      
      default:
        // Generic token exchange for any auth callback
        await handleGenericAuthCallback(params);
    }
  };

  /**
   * Handles invite link callback
   * User clicks invite email -> app opens -> this exchanges the code for a session
   */
  const handleInviteCallback = async (params: Record<string, any>) => {
    console.log('Handling invite callback');

    // With PKCE flow, Supabase automatically exchanges the code
    // We just need to verify the session was created
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      throw new Error(`Invite authentication failed: ${error.message}`);
    }

    if (!session) {
      // If no session yet, try to exchange tokens manually
      if (params.access_token && params.refresh_token) {
        const { data, error: setSessionError } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });

        if (setSessionError) {
          throw new Error(`Failed to set session: ${setSessionError.message}`);
        }

        console.log('Invite session created successfully');
      } else {
        throw new Error('No session or tokens found in invite callback');
      }
    } else {
      console.log('Invite session already exists');
    }
  };

  /**
   * Handles password recovery callback
   */
  const handleRecoveryCallback = async (params: Record<string, any>) => {
    console.log('Handling recovery callback');

    if (params.access_token && params.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });

      if (error) {
        throw new Error(`Recovery authentication failed: ${error.message}`);
      }

      console.log('Recovery session created - user can now reset password');
    }
  };

  /**
   * Handles magic link callback
   */
  const handleMagicLinkCallback = async (params: Record<string, any>) => {
    console.log('Handling magic link callback');

    if (params.access_token && params.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });

      if (error) {
        throw new Error(`Magic link authentication failed: ${error.message}`);
      }

      console.log('Magic link session created successfully');
    }
  };

  /**
   * Handles email confirmation callback
   */
  const handleEmailConfirmationCallback = async (params: Record<string, any>) => {
    console.log('Handling email confirmation callback');

    if (params.access_token && params.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });

      if (error) {
        throw new Error(`Email confirmation failed: ${error.message}`);
      }

      console.log('Email confirmed and session created');
    }
  };

  /**
   * Generic handler for any auth callback with tokens
   */
  const handleGenericAuthCallback = async (params: Record<string, any>) => {
    console.log('Handling generic auth callback');

    if (params.access_token && params.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });

      if (error) {
        throw new Error(`Authentication failed: ${error.message}`);
      }

      console.log('Session created successfully');
    }
  };

  // Show loading overlay while processing deep link
  if (isProcessingLink) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Completing authentication...</Text>
      </View>
    );
  }

  // Show error overlay if link processing failed
  if (linkError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Authentication Error</Text>
        <Text style={styles.errorText}>{linkError}</Text>
        <Text style={styles.errorHint}>Please try again or contact support.</Text>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
