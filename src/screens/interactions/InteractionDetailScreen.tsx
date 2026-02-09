/**
 * Interaction Detail Screen
 * Displays detailed view of a single interaction
 * Requirements: 5.9
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../../config/supabase';
import { InteractionType } from '../../modules/logging/types';

type InteractionStackParamList = {
  InteractionDetail: {
    interactionId: string;
    participantId: string;
    participantName: string;
  };
};

type InteractionDetailScreenRouteProp = RouteProp<
  InteractionStackParamList,
  'InteractionDetail'
>;
type InteractionDetailScreenNavigationProp = StackNavigationProp<
  InteractionStackParamList,
  'InteractionDetail'
>;

interface InteractionDetail {
  id: string;
  interactionType: InteractionType;
  interactionDate: string;
  interactionTime: string;
  duration?: number;
  location?: string;
  summary: string;
  followUpNeeded: boolean;
  followUpDate?: string;
  linkedGoalId?: string;
  staffId: string;
  createdAt: string;
}

export const InteractionDetailScreen: React.FC = () => {
  const navigation = useNavigation<InteractionDetailScreenNavigationProp>();
  const route = useRoute<InteractionDetailScreenRouteProp>();
  const { interactionId, participantId, participantName } = route.params;

  const [interaction, setInteraction] = useState<InteractionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInteraction();
  }, []);

  const loadInteraction = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .eq('id', interactionId)
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setInteraction({
          id: data.id,
          interactionType: data.interaction_type as InteractionType,
          interactionDate: data.interaction_date,
          interactionTime: data.interaction_time,
          duration: data.duration_minutes,
          location: data.location,
          summary: data.summary,
          followUpNeeded: data.follow_up_needed,
          followUpDate: data.follow_up_date,
          linkedGoalId: data.linked_goal_id,
          staffId: data.staff_id,
          createdAt: data.created_at,
        });
      }
    } catch (error) {
      console.error('Error loading interaction:', error);
      Alert.alert('Error', 'Failed to load interaction details');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !interaction) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading details...</Text>
      </View>
    );
  }

  const interactionDate = new Date(interaction.interactionDate);
  const followUpDate = interaction.followUpDate ? new Date(interaction.followUpDate) : null;
  const createdAt = new Date(interaction.createdAt);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{interaction.interactionType}</Text>
          <Text style={styles.participantName}>{participantName}</Text>
        </View>

        {/* Date and Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date & Time</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date:</Text>
            <Text style={styles.infoValue}>
              {interactionDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Time:</Text>
            <Text style={styles.infoValue}>{interaction.interactionTime}</Text>
          </View>
          {interaction.duration && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Duration:</Text>
              <Text style={styles.infoValue}>{interaction.duration} minutes</Text>
            </View>
          )}
        </View>

        {/* Location */}
        {interaction.location && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <Text style={styles.infoValue}>📍 {interaction.location}</Text>
          </View>
        )}

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.summaryText}>{interaction.summary}</Text>
        </View>

        {/* Follow-up */}
        {interaction.followUpNeeded && (
          <View style={[styles.section, styles.followUpSection]}>
            <Text style={styles.sectionTitle}>Follow-up Required</Text>
            {followUpDate && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Due Date:</Text>
                <Text style={styles.infoValue}>
                  {followUpDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </View>
            )}
            {interaction.linkedGoalId && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Linked Goal:</Text>
                <Text style={styles.infoValue}>{interaction.linkedGoalId}</Text>
              </View>
            )}
          </View>
        )}

        {/* Metadata */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metadata</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Staff ID:</Text>
            <Text style={styles.infoValue}>{interaction.staffId}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Recorded:</Text>
            <Text style={styles.infoValue}>
              {createdAt.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}{' '}
              at {createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Back to History</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  participantName: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  followUpSection: {
    backgroundColor: '#FFF9E6',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 100,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  summaryText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  backButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
