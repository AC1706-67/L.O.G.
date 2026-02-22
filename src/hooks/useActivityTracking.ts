import { useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

const ACTIVITY_THROTTLE_MS = 2000; // Minimum 2 seconds between activity updates

/**
 * Hook for tracking user activity in components
 * Use this in TextInput components and other interactive elements
 * that PanResponder doesn't catch
 * 
 * Throttling: Activity updates are throttled to once per 2 seconds to prevent
 * excessive state updates during rapid typing or continuous interactions.
 */
export const useActivityTracking = () => {
  const { isAuthenticated, updateActivity } = useAuth();
  const lastActivityUpdate = useRef<number>(0);

  const trackActivity = useCallback(() => {
    if (!isAuthenticated) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - lastActivityUpdate.current;

    if (timeSinceLastUpdate >= ACTIVITY_THROTTLE_MS) {
      lastActivityUpdate.current = now;
      updateActivity();
    }
  }, [isAuthenticated, updateActivity]);

  // Specific handlers for common events
  const onFocus = useCallback(() => {
    trackActivity();
  }, [trackActivity]);

  const onChange = useCallback(() => {
    trackActivity();
  }, [trackActivity]);

  const onPress = useCallback(() => {
    trackActivity();
  }, [trackActivity]);

  const onKeyPress = useCallback(() => {
    trackActivity();
  }, [trackActivity]);

  return {
    trackActivity,
    onFocus,
    onChange,
    onPress,
    onKeyPress,
  };
};
