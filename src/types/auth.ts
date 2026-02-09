// Authentication types for the LOG Peer Recovery System

export interface User {
  id: string;
  email: string;
  role: 'peer_specialist' | 'supervisor' | 'admin';
  firstName: string;
  lastName: string;
  organizationId: string;
  mfaEnabled: boolean;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  lastActivity: number;
}

export interface Session {
  sessionId: string;
  userId: string;
  startTime: Date;
  lastActivity: Date;
  expiresAt: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface MFAVerification {
  userId: string;
  code: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

export interface BiometricAuthConfig {
  enabled: boolean;
  type: 'fingerprint' | 'face' | 'iris' | null;
}
