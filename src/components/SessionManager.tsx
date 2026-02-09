import React, { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus, Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const SCREEN_LOCK_TIMEOUT = 30000; // 30 seconds
const WARNING_BEFORE_LOGOUT = 60000; // 1 minute warning before auto-logout
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export const SessionManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, logout, updateActivity, checkSessionTimeout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [showLockScreen, setShowLockScreen] = useState(false);
  const [timeUntilLogout, setTimeUntilLogout] = useState(0);
  
  const appState = useRef(AppState.currentState);
  const backgroundTime = useRef<number | null>(null);
  const warningTimer = useRef<NodeJS.Timeout | null>(null);
  const logoutTimer = useRef<NodeJS.Timeout | null>(null);

  // Monitor app state changes for screen lock
  useEffect(() => {
    if (!isAuthenticated) return;

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);

  // Monitor session timeout
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      if (checkSessionTimeout()) {
        handleSessionTimeout();
      } else {
        // Check if we should show warning
        const timeSinceActivity = Date.now() - (Date.now() - SESSION_TIMEOUT);
        if (timeSinceActivity >= SESSION_TIMEOUT - WARNING_BEFORE_LOGOUT && !showWarning) {
          showTimeoutWarning();
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, showWarning]);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
      // App went to background
      backgroundTime.current = Date.now();
    }

    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground
      if (backgroundTime.current) {
        const timeInBackground = Date.now() - backgroundTime.current;
        
        if (timeInBackground >= SCREEN_LOCK_TIMEOUT) {
          setShowLockScreen(true);
        }
        
        backgroundTime.current = null;
      }
    }

    appState.current = nextAppState;
  };

  const showTimeoutWarning = () => {
    setShowWarning(true);
    setTimeUntilLogout(60); // 60 seconds

    // Countdown timer
    const countdown = setInterval(() => {
      setTimeUntilLogout(prev => {
        if (prev <= 1) {
          clearInterval(countdown);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-logout after warning period
    logoutTimer.current = setTimeout(() => {
      handleSessionTimeout();
    }, WARNING_BEFORE_LOGOUT);
  };

  const handleSessionTimeout = async () => {
    setShowWarning(false);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    await logout();
  };

  const handleStayLoggedIn = () => {
    setShowWarning(false);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    updateActivity();
  };

  const handleUnlock = () => {
    setShowLockScreen(false);
    updateActivity();
  };

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <>
      {children}

      {/* Session Timeout Warning Modal */}
      <Modal
        visible={showWarning}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Session Timeout Warning</Text>
            <Text style={styles.modalText}>
              Your session will expire in {timeUntilLogout} seconds due to inactivity.
            </Text>
            <Text style={styles.modalSubtext}>
              Would you like to stay logged in?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.logoutButton]}
                onPress={handleSessionTimeout}
              >
                <Text style={styles.logoutButtonText}>Logout</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.stayButton]}
                onPress={handleStayLoggedIn}
              >
                <Text style={styles.stayButtonText}>Stay Logged In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Screen Lock Modal */}
      <Modal
        visible={showLockScreen}
        transparent={false}
        animationType="fade"
      >
        <View style={styles.lockScreen}>
          <Text style={styles.lockTitle}>Screen Locked</Text>
          <Text style={styles.lockText}>
            The app was locked for security after being in the background.
          </Text>

          <TouchableOpacity
            style={styles.unlockButton}
            onPress={handleUnlock}
          >
            <Text style={styles.unlockButtonText}>Unlock</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButton: {
    backgroundColor: '#f5f5f5',
  },
  logoutButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  stayButton: {
    backgroundColor: '#007AFF',
  },
  stayButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  lockScreen: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lockTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  lockText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  unlockButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 8,
  },
  unlockButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
