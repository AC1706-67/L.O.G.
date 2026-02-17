import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { SessionManager } from './src/components/SessionManager';
import { DeepLinkHandler } from './src/components/DeepLinkHandler';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DeepLinkHandler>
          <SessionManager>
            <RootNavigator />
            <StatusBar style="auto" />
          </SessionManager>
        </DeepLinkHandler>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
