import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to track user activity and update the last activity timestamp
 * This helps with session timeout management
 */
export const useActivityTracker = () => {
  const { updateActivity, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    // Update activity on mount
    updateActivity();

    // Note: In a real implementation, you would track various user interactions
    // such as touches, scrolls, keyboard input, etc.
    // For now, we'll just update on mount and let the SessionManager handle timeouts
  }, [isAuthenticated, updateActivity]);

  return { updateActivity };
};
