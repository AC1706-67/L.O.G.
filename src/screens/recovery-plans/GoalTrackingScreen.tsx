/**
 * Goal Tracking Screen
 * Advanced interface for tracking goals with filters and progress visualization
 * Requirements: 6.7, 6.9
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
import { RecoveryPlan, Goal, GoalStatus, GoalCategory } from '../../modules/recovery-plan/types';
import { getPlan, getGoalsByStatus } from '../../modules/recovery-plan/recoveryPlanManager';

type GoalTrackingStackParamList = {
  GoalTracking: {
    planId: string;
    participantId: string;
    participantName: string;
  };
  GoalDetail: {
    goalId: string;
    planId: string;
    participantId: string;
    participantName: string;
    onGoalUpdated: () => void;
  };
};

type GoalTrackingScreenRouteProp = RouteProp<GoalTrackingStackParamList, 'GoalTracking'>;
type GoalTrackingScreenNavigationProp = StackNavigationProp<
  GoalTrackingStackParamList,
  'GoalTracking'
>;

export const GoalTrackingScreen: React.FC = () => {
  const navigation = useNavigation<GoalTrackingScreenNavigationProp>();
  const route = useRoute<GoalTrackingScreenRouteProp>();
  const { planId, participantId, participantName } = route.params;

  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<GoalStatus | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<GoalCategory | 'all'>('all');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);

  useEffect(() => {
    loadPlan();
  }, []);

  const loadPlan = async () => {
    try {
      setIsLoading(true);
      const planData = await getPlan(planId);
      setPlan(planData);
    } catch (error) {
      console.error('Error loading recovery plan:', error);
      Alert.alert('Error', 'Failed to load recovery plan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoalPress = (goal: Goal) => {
    navigation.navigate('GoalDetail', {
      goalId: goal.goalId,
      planId,
      participantId,
      participantName,
      onGoalUpdated: loadPlan,
    });
  };

  const getFilteredGoals = (): Goal[] => {
    if (!plan) return [];

    let filtered = plan.goals;

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter((goal) => goal.status === filterStatus);
    }

    // Filter by category
    if (filterCategory !== 'all') {
      filtered = filtered.filter((goal) => goal.category === filterCategory);
    }

    return filtered;
  };

  const getGoalStats = () => {
    if (!plan) return { total: 0, notStarted: 0, inProgress: 0, completed: 0, onHold: 0 };

    return {
      total: plan.goals.length,
      notStarted: plan.goals.filter((g) => g.status === GoalStatus.NOT_STARTED).length,
      inProgress: plan.goals.filter((g) => g.status === GoalStatus.IN_PROGRESS).length,
      completed: plan.goals.filter((g) => g.status === GoalStatus.COMPLETED).length,
      onHold: plan.goals.filter((g) => g.status === GoalStatus.ON_HOLD).length,
    };
  };

  const getCategoryStats = () => {
    if (!plan) return {};

    const stats: Record<string, number> = {};
    Object.values(GoalCategory).forEach((category) => {
      stats[category] = plan.goals.filter((g) => g.category === category).length;
    });
    return stats;
  };

  const getOverallProgress = (): number => {
    if (!plan || plan.goals.length === 0) return 0;

    let totalProgress = 0;
    plan.goals.forEach((goal) => {
      if (goal.status === GoalStatus.COMPLETED) {
        totalProgress += 100;
      } else if (goal.status === GoalStatus.IN_PROGRESS) {
        // Calculate progress based on action steps
        if (goal.actionSteps.length > 0) {
          const completedSteps = goal.actionSteps.filter((s) => s.completed).length;
          totalProgress += (completedSteps / goal.actionSteps.length) * 100;
        } else {
          totalProgress += 50; // Assume 50% if no action steps
        }
      }
      // Not started and on hold contribute 0%
    });

    return Math.round(totalProgress / plan.goals.length);
  };

  const getStatusColor = (status: GoalStatus): string => {
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

  const getStatusIcon = (status: GoalStatus): string => {
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
        <Text style={styles.loadingText}>Loading goal tracking...</Text>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No recovery plan found</Text>
      </View>
    );
  }

  const stats = getGoalStats();
  const categoryStats = getCategoryStats();
  const overallProgress = getOverallProgress();
  const filteredGoals = getFilteredGoals();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Goal Tracking</Text>
        <Text style={styles.participantName}>{participantName}</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Overall Progress Card */}
        <View style={styles.progressCard}>
          <Text style={styles.progressCardTitle}>Overall Progress</Text>
          <View style={styles.progressCircleContainer}>
            <View style={styles.progressCircle}>
              <Text style={styles.progressPercentage}>{overallProgress}%</Text>
              <Text style={styles.progressLabel}>Complete</Text>
            </View>
          </View>
          <View style={styles.progressStats}>
            <View style={styles.progressStatItem}>
              <Text style={styles.progressStatValue}>{stats.completed}</Text>
              <Text style={styles.progressStatLabel}>Completed</Text>
            </View>
            <View style={styles.progressStatItem}>
              <Text style={styles.progressStatValue}>{stats.inProgress}</Text>
              <Text style={styles.progressStatLabel}>In Progress</Text>
            </View>
            <View style={styles.progressStatItem}>
              <Text style={styles.progressStatValue}>{stats.notStarted}</Text>
              <Text style={styles.progressStatLabel}>Not Started</Text>
            </View>
          </View>
        </View>

        {/* Status Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Filter by Status</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChips}
          >
            <TouchableOpacity
              style={[styles.filterChip, filterStatus === 'all' && styles.filterChipActive]}
              onPress={() => setFilterStatus('all')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterStatus === 'all' && styles.filterChipTextActive,
                ]}
              >
                All ({stats.total})
              </Text>
            </TouchableOpacity>
            {Object.values(GoalStatus).map((status) => {
              const count =
                status === GoalStatus.NOT_STARTED
                  ? stats.notStarted
                  : status === GoalStatus.IN_PROGRESS
                  ? stats.inProgress
                  : status === GoalStatus.COMPLETED
                  ? stats.completed
                  : stats.onHold;

              return (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterChip,
                    filterStatus === status && styles.filterChipActive,
                    { borderColor: getStatusColor(status) },
                  ]}
                  onPress={() => setFilterStatus(status)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filterStatus === status && styles.filterChipTextActive,
                    ]}
                  >
                    {getStatusIcon(status)} {status} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Category Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Filter by Category</Text>
          <TouchableOpacity
            style={styles.categoryFilterButton}
            onPress={() => setShowCategoryFilter(!showCategoryFilter)}
          >
            <Text style={styles.categoryFilterText}>
              {filterCategory === 'all' ? 'All Categories' : filterCategory}
            </Text>
            <Text style={styles.pickerArrow}>{showCategoryFilter ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showCategoryFilter && (
            <View style={styles.categoryOptions}>
              <TouchableOpacity
                style={styles.categoryOption}
                onPress={() => {
                  setFilterCategory('all');
                  setShowCategoryFilter(false);
                }}
              >
                <Text
                  style={[
                    styles.categoryOptionText,
                    filterCategory === 'all' && styles.categoryOptionTextSelected,
                  ]}
                >
                  All Categories ({stats.total})
                </Text>
              </TouchableOpacity>
              {Object.values(GoalCategory).map((category) => (
                <TouchableOpacity
                  key={category}
                  style={styles.categoryOption}
                  onPress={() => {
                    setFilterCategory(category);
                    setShowCategoryFilter(false);
                  }}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      filterCategory === category && styles.categoryOptionTextSelected,
                    ]}
                  >
                    {category} ({categoryStats[category] || 0})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Goals List */}
        <View style={styles.goalsSection}>
          <Text style={styles.goalsSectionTitle}>
            Goals ({filteredGoals.length})
          </Text>

          {filteredGoals.length === 0 ? (
            <View style={styles.emptyGoalsContainer}>
              <Text style={styles.emptyGoalsText}>
                No goals match the selected filters
              </Text>
            </View>
          ) : (
            filteredGoals.map((goal) => {
              const completedSteps = goal.actionSteps.filter((s) => s.completed).length;
              const totalSteps = goal.actionSteps.length;
              const stepProgress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

              return (
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
                          { color: getStatusColor(goal.status) },
                        ]}
                      >
                        {getStatusIcon(goal.status)}
                      </Text>
                      <Text style={styles.goalCategory}>{goal.category}</Text>
                    </View>
                    <Text style={[styles.goalStatus, { color: getStatusColor(goal.status) }]}>
                      {goal.status}
                    </Text>
                  </View>

                  <Text style={styles.goalDescription}>{goal.description}</Text>

                  {/* Action Steps Progress */}
                  {totalSteps > 0 && (
                    <View style={styles.stepProgressContainer}>
                      <View style={styles.stepProgressBar}>
                        <View
                          style={[
                            styles.stepProgressFill,
                            { width: `${stepProgress}%`, backgroundColor: getStatusColor(goal.status) },
                          ]}
                        />
                      </View>
                      <Text style={styles.stepProgressText}>
                        {completedSteps}/{totalSteps} steps
                      </Text>
                    </View>
                  )}

                  <View style={styles.goalFooter}>
                    <Text style={styles.goalDate}>
                      Target: {goal.targetDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    {goal.progressNotes.length > 0 && (
                      <Text style={styles.goalNotes}>
                        {goal.progressNotes.length} note{goal.progressNotes.length !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
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
  emptyText: {
    fontSize: 16,
    color: '#999',
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
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  progressCircleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  progressCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
  },
  progressPercentage: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  progressStatItem: {
    alignItems: 'center',
  },
  progressStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  progressStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  filterChips: {
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  filterChipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  categoryFilterButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryFilterText: {
    fontSize: 15,
    color: '#333',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#999',
  },
  categoryOptions: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    marginTop: 8,
  },
  categoryOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryOptionText: {
    fontSize: 15,
    color: '#333',
  },
  categoryOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  goalsSection: {
    marginTop: 8,
  },
  goalsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
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
  stepProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 8,
  },
  stepProgressFill: {
    height: '100%',
  },
  stepProgressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    minWidth: 60,
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
  goalNotes: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
});
