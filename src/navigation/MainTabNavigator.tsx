import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DashboardScreen } from '../screens/main/DashboardScreen';
import { ParticipantsScreen } from '../screens/main/ParticipantsScreen';
import { AssessmentsScreen } from '../screens/main/AssessmentsScreen';
import { PlansScreen } from '../screens/main/PlansScreen';
import { MoreScreen } from '../screens/main/MoreScreen';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        headerShown: true,
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          title: 'Dashboard',
        }}
      />
      <Tab.Screen
        name="Participants"
        component={ParticipantsScreen}
        options={{
          tabBarLabel: 'Participants',
          title: 'Participants',
        }}
      />
      <Tab.Screen
        name="Assessments"
        component={AssessmentsScreen}
        options={{
          tabBarLabel: 'Assessments',
          title: 'Assessments',
        }}
      />
      <Tab.Screen
        name="Plans"
        component={PlansScreen}
        options={{
          tabBarLabel: 'Plans',
          title: 'Recovery Plans',
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          tabBarLabel: 'More',
          title: 'More',
        }}
      />
    </Tab.Navigator>
  );
};
