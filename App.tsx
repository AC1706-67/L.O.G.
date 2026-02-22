import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { SessionManager } from './src/components/SessionManager';
import { ActivityTracker } from './src/components/ActivityTracker';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SessionManager>
          <ActivityTracker>
            <RootNavigator />
            <StatusBar style="auto" />
          </ActivityTracker>
        </SessionManager>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
