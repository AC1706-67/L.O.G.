/**
 * Recovery Plan Screen
 * Main screen for viewing and managing a participant's recovery plan
 * Requirements: 6.1, 6.6, 6.7
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
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RecoveryPlan, Goal, GoalStatus } from '../../modules/recovery-plan/types';
import { getPlan, createPlan } from '../../modules/recovery-plan/recoveryPlanManager';

type RecoveryPlanStackParamList = {
  RecoveryPlan: {
    participantId: string;
    participantName: string;
    planId?: string;
  };
  CreateGoal: {
    planId: string;
    participantId: string;
    participantName: string;
    onGoalCreated: () => void;
  };
  GoalDetail: {
    goalId: string;
    planId: string;
    participantId: string;
    participantName: string;
    onGoalUpdated: () => void;
  };
};

type RecoveryPlanScreenRouteProp = RouteProp<RecoveryPlanStackParamList, 'RecoveryPlan'>;
type RecoveryPlanScreenNavigationProp = StackNavigationProp<
  RecoveryPlanStackParamList,
  'RecoveryPlan'
>;

export const RecoveryPlanScreen: React.FC = () => {
  const navigation = useNavigation<RecoveryPlanScreenNavigationProp>();
  const route = useRoute<RecoveryPlanScreenRouteProp>();
  const { participantId, participantName, planId: initialPlanId } = route.params;

  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [filterStatus, setFilterStatus] = useState<GoalStatus | 'all'>('all');

  useEffect(() => {
    loadPlan();
  }, [initialPlanId]);

  const loadPlan = async () => {
    try {
      setIsLoading(true);

      if (initialPlanId) {
        const planData = await getPlan(initialPlanId);
        setPlan(planData);
      } else {
        // Check if participant has an existing plan
        // In a real app, we'd query for existing plans
        setPlan(null);
      }
    } catch (error) {
      console.error('Error loading recovery plan:', error);
      Alert.alert('Error', 'Failed to load recovery plan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    Alert.alert(
      'Create Recovery Plan',
      `Create a new recovery plan for ${participantName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async () => {
            try {
              setIsCreatingPlan(true);
              // TODO: Get current user ID from auth context
              const createdBy = 'current-user-id';
              const newPlan = await createPlan(participantId, createdBy);
              setPlan(newPlan);
            } catch (error) {
              console.error('Error creating plan:', error);
              Alert.alert('Error', 'Failed to create recovery plan');
            } finally {
              setIsCreatingPlan(false);
            }
          },
        },
      ]
    );
  };

  const handleAddGoal = () => {
    if (!plan) return;

    navigation.navigate('CreateGoal', {
      planId: plan.planId,
      participantId,
      participantName,
      onGoalCreated: loadPlan,
    });
  };

  const handleGoalPress = (goal: Goal) => {
    if (!plan) return;

    navigation.navigate('GoalDetail', {
      goalId: goal.goalId,
      planId: plan.planId,
      participantId,
      participantName,
      onGoalUpdated: loadPlan,
    });
  };

  const getFilteredGoals = (): Goal[] => {
    if (!plan) return [];
    if (filterStatus === 'all') return plan.goals;
    return plan.goals.filter((goal) => goal.status === filterStatus);
  };

  const getGoalStatusColor = (status: GoalStatus): string => {
    switch (status) {
      case GoalStatus.NOT_STARTED:
        return '#999';
      case GoalStatus.IN_PROGRESS:
        return '#007AFF';
      case GoalStatus.COMPLETED:
        return '#4CAF50';
      case GoalStatus.ON_HOLD:
        return '#FF9500';
      default:
        return '#999';
    }
  };

  const getGoalStatusIcon = (status: GoalStatus): string => {
    switch (status) {
      case GoalStatus.NOT_STARTED:
        return '○';
      case GoalStatus.IN_PROGRESS:
        return '◐';
      case GoalStatus.COMPLETED:
        return '●';
      case GoalStatus.ON_HOLD:
        return '⏸';
      default:
        return '○';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading recovery plan...</Text>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>No Recovery Plan</Text>
        <Text style={styles.emptyMessage}>
          {participantName} doesn't have a recovery plan yet.
        </Text>
        <TouchableOpacity
          style={styles.createPlanButton}
          onPress={handleCreatePlan}
          disabled={isCreatingPlan}
        >
          {isCreatingPlan ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.createPlanButtonText}>Create Recovery Plan</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  const filteredGoals = getFilteredGoals();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Recovery Plan</Text>
        <Text style={styles.participantName}>{participantName}</Text>
        <Text style={styles.planDate}>
          Created: {plan.createdDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[styles.filterTab, filterStatus === 'all' && styles.filterTabActive]}
          onPress={() => setFilterStatus('all')}
        >
          <Text style={[styles.filterTabText, filterStatus === 'all' && styles.filterTabTextActive]}>
            All ({plan.goals.length})
          </Text>
        </TouchableOpacity>
        {Object.values(GoalStatus).map((status) => {
          const count = plan.goals.filter((g) => g.status === status).length;
          return (
            <TouchableOpacity
              key={status}
              style={[styles.filterTab, filterStatus === status && styles.filterTabActive]}
              onPress={() => setFilterStatus(status)}
            >
              <Text
                style={[styles.filterTabText, filterStatus === status && styles.filterTabTextActive]}
              >
                {status} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Goals List */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {filteredGoals.length === 0 ? (
          <View style={styles.emptyGoalsContainer}>
            <Text style={styles.emptyGoalsText}>
              {filterStatus === 'all'
                ? 'No goals yet. Add a goal to get started.'
                : `No ${filterStatus.toLowerCase()} goals.`}
            </Text>
          </View>
        ) : (
          filteredGoals.map((goal) => (
            <TouchableOpacity
              key={goal.goalId}
              style={styles.goalCard}
              onPress={() => handleGoalPress(goal)}
            >
              <View style={styles.goalCardHeader}>
                <View style={styles.goalStatusContainer}>
                  <Text
                    style={[
                      styles.goalStatusIcon,
                      { color: getGoalStatusColor(goal.status) },
                    ]}
                  >
                    {getGoalStatusIcon(goal.status)}
                  </Text>
                  <Text style={styles.goalCategory}>{goal.category}</Text>
                </View>
                <Text style={[styles.goalStatus, { color: getGoalStatusColor(goal.status) }]}>
                  {goal.status}
                </Text>
              </View>

              <Text style={styles.goalDescription}>{goal.description}</Text>

              <View style={styles.goalFooter}>
                <Text style={styles.goalDate}>
                  Target: {goal.targetDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
                {goal.actionSteps.length > 0 && (
                  <Text style={styles.goalSteps}>
                    {goal.actionSteps.filter((s) => s.completed).length}/{goal.actionSteps.length} steps
                  </Text>
                )}
              </View>

              {goal.progressNotes.length > 0 && (
                <View style={styles.latestNoteContainer}>
                  <Text style={styles.latestNoteLabel}>Latest note:</Text>
                  <Text style={styles.latestNoteText} numberOfLines={2}>
                    {goal.progressNotes[0].note}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Add Goal Button */}
      <TouchableOpacity style={styles.addButton} onPress={handleAddGoal}>
        <Text style={styles.addButtonText}>+ Add Goal</Text>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  createPlanButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  createPlanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
    marginBottom: 4,
  },
  planDate: {
    fontSize: 14,
    color: '#999',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  filterTabActive: {
    backgroundColor: '#007AFF',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  emptyGoalsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyGoalsText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  goalCard: {
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
  goalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalStatusIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  goalCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  goalStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  goalDescription: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    lineHeight: 22,
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalDate: {
    fontSize: 13,
    color: '#666',
  },
  goalSteps: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  latestNoteContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  latestNoteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 4,
  },
  latestNoteText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#007AFF',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
