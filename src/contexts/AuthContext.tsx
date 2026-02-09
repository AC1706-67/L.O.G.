import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../config/supabase';
import { AuthState, User, LoginCredentials, BiometricAuthConfig } from '../types/auth';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<{ requiresMFA: boolean; userId?: string }>;
  verifyMFA: (userId: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  enableBiometric: () => Promise<void>;
  authenticateWithBiometric: () => Promise<boolean>;
  updateActivity: () => void;
  checkSessionTimeout: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isAuthenticated: false,
    isLoading: true,
    lastActivity: Date.now(),
  });

  // Check for existing session on mount
  useEffect(() => {
    checkExistingSession();
  }, []);

  // Auto-logout timer
  useEffect(() => {
    if (!authState.isAuthenticated) return;

    const interval = setInterval(() => {
      if (checkSessionTimeout()) {
        logout();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [authState.isAuthenticated, authState.lastActivity]);

  const checkExistingSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userData) {
          setAuthState({
            user: mapUserData(userData),
            session: {
              sessionId: session.access_token,
              userId: session.user.id,
              startTime: new Date(session.user.created_at),
              lastActivity: new Date(),
              expiresAt: new Date(Date.now() + SESSION_TIMEOUT_MS),
            },
            isAuthenticated: true,
            isLoading: false,
            lastActivity: Date.now(),
          });
        }
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Error checking session:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const login = async (credentials: LoginCredentials): Promise<{ requiresMFA: boolean; userId?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) throw error;

      // Check if user has MFA enabled
      const { data: userData } = await supabase
        .from('users')
        .select('mfa_enabled')
        .eq('id', data.user.id)
        .single();

      if (userData?.mfa_enabled) {
        // Return that MFA is required
        return { requiresMFA: true, userId: data.user.id };
      }

      // Complete login without MFA
      await completeLogin(data.user.id);
      return { requiresMFA: false };
    } catch (error) {
      console.error('Login error:', error);
      throw new Error('Invalid email or password');
    }
  };

  const verifyMFA = async (userId: string, code: string): Promise<void> => {
    // In production, this would verify the MFA code with the backend
    // For now, we'll simulate MFA verification
    try {
      // TODO: Implement actual MFA verification with backend
      // This is a placeholder that accepts any 6-digit code
      if (code.length !== 6) {
        throw new Error('Invalid MFA code');
      }

      await completeLogin(userId);
    } catch (error) {
      console.error('MFA verification error:', error);
      throw new Error('Invalid MFA code');
    }
  };

  const completeLogin = async (userId: string) => {
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!userData) throw new Error('User not found');

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', userId);

    const user = mapUserData(userData);

    setAuthState({
      user,
      session: {
        sessionId: userId,
        userId,
        startTime: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + SESSION_TIMEOUT_MS),
      },
      isAuthenticated: true,
      isLoading: false,
      lastActivity: Date.now(),
    });
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      await SecureStore.deleteItemAsync('biometric_enabled');
      
      setAuthState({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        lastActivity: Date.now(),
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const requestPasswordReset = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    } catch (error) {
      console.error('Password reset request error:', error);
      throw new Error('Failed to send password reset email');
    }
  };

  const resetPassword = async (token: string, newPassword: string) => {
    try {
      // Validate password complexity
      if (!validatePasswordComplexity(newPassword)) {
        throw new Error('Password does not meet complexity requirements');
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Password reset error:', error);
      throw new Error('Failed to reset password');
    }
  };

  const enableBiometric = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) {
        throw new Error('Device does not support biometric authentication');
      }

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        throw new Error('No biometric credentials enrolled on device');
      }

      await SecureStore.setItemAsync('biometric_enabled', 'true');
    } catch (error) {
      console.error('Enable biometric error:', error);
      throw error;
    }
  };

  const authenticateWithBiometric = async (): Promise<boolean> => {
    try {
      const biometricEnabled = await SecureStore.getItemAsync('biometric_enabled');
      if (biometricEnabled !== 'true') return false;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access LOG Peer Recovery',
        fallbackLabel: 'Use password',
      });

      return result.success;
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return false;
    }
  };

  const updateActivity = useCallback(() => {
    setAuthState(prev => ({
      ...prev,
      lastActivity: Date.now(),
    }));
  }, []);

  const checkSessionTimeout = useCallback((): boolean => {
    const timeSinceLastActivity = Date.now() - authState.lastActivity;
    return timeSinceLastActivity >= SESSION_TIMEOUT_MS;
  }, [authState.lastActivity]);

  const mapUserData = (userData: any): User => ({
    id: userData.id,
    email: userData.email,
    role: userData.role,
    firstName: userData.first_name,
    lastName: userData.last_name,
    organizationId: userData.organization_id,
    mfaEnabled: userData.mfa_enabled,
  });

  const validatePasswordComplexity = (password: string): boolean => {
    // Minimum 12 characters, at least one uppercase, one lowercase, one number, one special char
    const minLength = password.length >= 12;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return minLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        verifyMFA,
        logout,
        requestPasswordReset,
        resetPassword,
        enableBiometric,
        authenticateWithBiometric,
        updateActivity,
        checkSessionTimeout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
