import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SessionManager } from './src/components/SessionManager';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SessionManager>
          <RootNavigator />
          <StatusBar style="auto" />
        </SessionManager>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
