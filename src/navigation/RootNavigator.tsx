import React from 'react';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { RootStackParamList } from './types';
import { ActivityIndicator, View } from 'react-native';
import { ConsentWorkflowScreen, ConsentFormScreen, ConsentStatusScreen } from '../screens/consent';

const Stack = createStackNavigator<RootStackParamList>();

// Deep linking configuration for notifications
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['logpeerrecovery://', 'https://logpeerrecovery.app'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          MFAVerification: 'mfa',
          ForgotPassword: 'forgot-password',
        },
      },
      Main: {
        screens: {
          Dashboard: 'dashboard',
          Participants: {
            path: 'participants/:participantId?',
          },
          Assessments: {
            path: 'assessments/:assessmentId?',
          },
          Plans: {
            path: 'plans/:planId?',
          },
          More: 'more',
        },
      },
      ConsentWorkflow: 'consent/workflow',
      ConsentForm: 'consent/form',
      ConsentStatus: 'consent/status',
    },
  },
};

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen 
              name="ConsentWorkflow" 
              component={ConsentWorkflowScreen}
              options={{ headerShown: true, title: 'Consent Forms' }}
            />
            <Stack.Screen 
              name="ConsentForm" 
              component={ConsentFormScreen}
              options={{ headerShown: true, title: 'Consent Form' }}
            />
            <Stack.Screen 
              name="ConsentStatus" 
              component={ConsentStatusScreen}
              options={{ headerShown: true, title: 'Consent Status' }}
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
