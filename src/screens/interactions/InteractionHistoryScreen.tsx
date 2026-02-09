/**
 * Interaction History Screen
 * Displays all interactions for a participant with filtering and follow-up reminders
 * Requirements: 5.9
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../../config/supabase';
import { InteractionType } from '../../modules/logging/types';

type InteractionStackParamList = {
  InteractionHistory: {
    participantId: string;
    participantName: string;
  };
  InteractionDetail: {
    interactionId: string;
    participantId: string;
    participantName: string;
  };
  InteractionLog: {
    participantId: string;
    participantName: string;
    mode: 'quick' | 'session';
  };
};

type InteractionHistoryScreenRouteProp = RouteProp<
  InteractionStackParamList,
  'InteractionHistory'
>;
type InteractionHistoryScreenNavigationProp = StackNavigationProp<
  InteractionStackParamList,
  'InteractionHistory'
>;

interface InteractionRecord {
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
}

export const InteractionHistoryScreen: React.FC = () => {
  const navigation = useNavigation<InteractionHistoryScreenNavigationProp>();
  const route = useRoute<InteractionHistoryScreenRouteProp>();
  const { participantId, participantName } = route.params;

  const [interactions, setInteractions] = useState<InteractionRecord[]>([]);
  const [filteredInteractions, setFilteredInteractions] = useState<InteractionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'followUp' | 'recent'>('all');

  useEffect(() => {
    loadInteractions();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [interactions, selectedFilter]);

  const loadInteractions = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .eq('participant_id', participantId)
        .order('interaction_date', { ascending: false })
        .order('interaction_time', { ascending: false });

      if (error) {
        throw error;
      }

      const records: InteractionRecord[] = (data || []).map((record) => ({
        id: record.id,
        interactionType: record.interaction_type as InteractionType,
        interactionDate: record.interaction_date,
        interactionTime: record.interaction_time,
        duration: record.duration_minutes,
        location: record.location,
        summary: record.summary,
        followUpNeeded: record.follow_up_needed,
        followUpDate: record.follow_up_date,
        linkedGoalId: record.linked_goal_id,
        staffId: record.staff_id,
      }));

      setInteractions(records);
    } catch (error) {
      console.error('Error loading interactions:', error);
      Alert.alert('Error', 'Failed to load interaction history');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilter = () => {
    let filtered = [...interactions];

    if (selectedFilter === 'followUp') {
      // Show only interactions with pending follow-ups
      filtered = filtered.filter((interaction) => {
        if (!interaction.followUpNeeded || !interaction.followUpDate) {
          return false;
        }
        const followUpDate = new Date(interaction.followUpDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return followUpDate >= today;
      });
    } else if (selectedFilter === 'recent') {
      // Show interactions from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filtered = filtered.filter((interaction) => {
        const interactionDate = new Date(interaction.interactionDate);
        return interactionDate >= thirtyDaysAgo;
      });
    }

    setFilteredInteractions(filtered);
  };

  const handleInteractionPress = (interactionId: string) => {
    navigation.navigate('InteractionDetail', {
      interactionId,
      participantId,
      participantName,
    });
  };

  const handleAddInteraction = (mode: 'quick' | 'session') => {
    navigation.navigate('InteractionLog', {
      participantId,
      participantName,
      mode,
    });
  };

  const getFollowUpStatus = (interaction: InteractionRecord) => {
    if (!interaction.followUpNeeded || !interaction.followUpDate) {
      return null;
    }

    const followUpDate = new Date(interaction.followUpDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    followUpDate.setHours(0, 0, 0, 0);

    const daysUntil = Math.ceil((followUpDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) {
      return { text: 'Overdue', style: styles.followUpOverdue };
    } else if (daysUntil === 0) {
      return { text: 'Due Today', style: styles.followUpToday };
    } else if (daysUntil <= 7) {
      return { text: `Due in ${daysUntil} days`, style: styles.followUpSoon };
    } else {
      return { text: `Due ${followUpDate.toLocaleDateString()}`, style: styles.followUpFuture };
    }
  };

  const renderInteractionCard = ({ item }: { item: InteractionRecord }) => {
    const followUpStatus = getFollowUpStatus(item);
    const interactionDate = new Date(item.interactionDate);

    return (
      <TouchableOpacity
        style={styles.interactionCard}
        onPress={() => handleInteractionPress(item.id)}
      >
        <View style={styles.interactionCardHeader}>
          <View style={styles.interactionTypeContainer}>
            <Text style={styles.interactionType}>{item.interactionType}</Text>
            {item.duration && (
              <Text style={styles.interactionDuration}>{item.duration} min</Text>
            )}
          </View>
          <Text style={styles.interactionDate}>
            {interactionDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>

        {item.location && (
          <Text style={styles.interactionLocation}>📍 {item.location}</Text>
        )}

        <Text style={styles.interactionSummary} numberOfLines={3}>
          {item.summary}
        </Text>

        {followUpStatus && (
          <View style={[styles.followUpBadge, followUpStatus.style]}>
            <Text style={styles.followUpBadgeText}>{followUpStatus.text}</Text>
          </View>
        )}

        {item.linkedGoalId && (
          <View style={styles.goalBadge}>
            <Text style={styles.goalBadgeText}>🎯 Linked to Goal</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderFollowUpReminders = () => {
    const upcomingFollowUps = interactions.filter((interaction) => {
      if (!interaction.followUpNeeded || !interaction.followUpDate) {
        return false;
      }
      const followUpDate = new Date(interaction.followUpDate);
      const today = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(today.getDate() + 7);
      return followUpDate >= today && followUpDate <= sevenDaysFromNow;
    });

    if (upcomingFollowUps.length === 0) {
      return null;
    }

    return (
      <View style={styles.remindersSection}>
        <Text style={styles.remindersTitle}>
          📅 Upcoming Follow-ups ({upcomingFollowUps.length})
        </Text>
        {upcomingFollowUps.map((interaction) => {
          const followUpStatus = getFollowUpStatus(interaction);
          return (
            <TouchableOpacity
              key={interaction.id}
              style={styles.reminderCard}
              onPress={() => handleInteractionPress(interaction.id)}
            >
              <View style={styles.reminderHeader}>
                <Text style={styles.reminderType}>{interaction.interactionType}</Text>
                {followUpStatus && (
                  <View style={[styles.reminderBadge, followUpStatus.style]}>
                    <Text style={styles.reminderBadgeText}>{followUpStatus.text}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.reminderSummary} numberOfLines={2}>
                {interaction.summary}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading interactions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Interaction History</Text>
        <Text style={styles.participantName}>{participantName}</Text>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedFilter === 'all' && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedFilter === 'all' && styles.filterButtonTextActive,
              ]}
            >
              All ({interactions.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedFilter === 'followUp' && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedFilter('followUp')}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedFilter === 'followUp' && styles.filterButtonTextActive,
              ]}
            >
              Follow-ups
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedFilter === 'recent' && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedFilter('recent')}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedFilter === 'recent' && styles.filterButtonTextActive,
              ]}
            >
              Recent
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Follow-up Reminders */}
      {selectedFilter === 'all' && renderFollowUpReminders()}

      {/* Interaction List */}
      {filteredInteractions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {selectedFilter === 'all'
              ? 'No interactions recorded yet'
              : selectedFilter === 'followUp'
              ? 'No pending follow-ups'
              : 'No recent interactions'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredInteractions}
          renderItem={renderInteractionCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Add Interaction Buttons */}
      <View style={styles.addButtonContainer}>
        <TouchableOpacity
          style={[styles.addButton, styles.addButtonQuick]}
          onPress={() => handleAddInteraction('quick')}
        >
          <Text style={styles.addButtonText}>+ Quick Note</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.addButton, styles.addButtonSession]}
          onPress={() => handleAddInteraction('session')}
        >
          <Text style={styles.addButtonText}>+ Session Note</Text>
        </TouchableOpacity>
      </View>
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
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
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
    marginBottom: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  remindersSection: {
    backgroundColor: '#FFF9E6',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  remindersTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  reminderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reminderType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  reminderBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  reminderBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  reminderSummary: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  interactionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  interactionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  interactionTypeContainer: {
    flex: 1,
  },
  interactionType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  interactionDuration: {
    fontSize: 13,
    color: '#999',
  },
  interactionDate: {
    fontSize: 13,
    color: '#666',
  },
  interactionLocation: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  interactionSummary: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  followUpBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  followUpBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  followUpOverdue: {
    backgroundColor: '#FF3B30',
  },
  followUpToday: {
    backgroundColor: '#FF9500',
  },
  followUpSoon: {
    backgroundColor: '#FF9500',
  },
  followUpFuture: {
    backgroundColor: '#34C759',
  },
  goalBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    marginTop: 4,
  },
  goalBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  addButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 12,
  },
  addButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  addButtonQuick: {
    backgroundColor: '#34C759',
  },
  addButtonSession: {
    backgroundColor: '#007AFF',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
