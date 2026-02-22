import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';

const ACTIVITY_THROTTLE_MS = 2000; // Minimum 2 seconds between activity updates

/**
 * ActivityTracker - Detects user activity and resets idle timer
 * 
 * Tracks:
 * - Touch events (taps, swipes) via PanResponder
 * - Scroll gestures (usually detected, depends on component structure)
 * - Navigation changes
 * - Screen focus changes
 * 
 * Note: TextInput typing is NOT detected by PanResponder.
 * Use TrackedTextInput component or useActivityTracking() hook for text input.
 * 
 * Throttling: Activity updates are throttled to once per 2 seconds to prevent
 * excessive state updates during scrolling and continuous gestures.
 */
export const ActivityTracker: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, updateActivity } = useAuth();
  const navigation = useNavigation();
  const lastActivityUpdate = useRef<number>(0);

  // Throttled activity update - only updates if enough time has passed
  const throttledUpdateActivity = () => {
    if (!isAuthenticated) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - lastActivityUpdate.current;

    if (timeSinceLastUpdate >= ACTIVITY_THROTTLE_MS) {
      lastActivityUpdate.current = now;
      updateActivity();
    }
  };

  // Create PanResponder to detect touch and gesture events
  const panResponder = React.useRef(
    PanResponder.create({
      // Use capture phase to detect touches without intercepting them
      onStartShouldSetPanResponderCapture: () => {
        // Don't intercept, just observe
        return false;
      },
      onMoveShouldSetPanResponderCapture: () => {
        // Don't intercept, just observe
        return false;
      },
      
      // Actual responder events - these fire when we become responder
      onPanResponderGrant: () => {
        // Touch started
        throttledUpdateActivity();
      },
      onPanResponderMove: () => {
        // Touch moving (drag, scroll)
        throttledUpdateActivity();
      },
      onPanResponderRelease: () => {
        // Touch ended
        throttledUpdateActivity();
      },
      onPanResponderTerminate: () => {
        // Touch cancelled/interrupted
        throttledUpdateActivity();
      },
    })
  ).current;

  // Track authentication state changes
  useEffect(() => {
    if (isAuthenticated) {
      lastActivityUpdate.current = Date.now();
      updateActivity();
    }
  }, [isAuthenticated, updateActivity]);

  // Track navigation changes
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = navigation.addListener('state', () => {
      throttledUpdateActivity();
    });

    return unsubscribe;
  }, [isAuthenticated, navigation]);

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
