/**
 * Goal Detail Screen
 * Detailed view and status update interface for a specific goal
 * Requirements: 6.6, 6.7
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Goal, GoalStatus, ActionStep } from '../../modules/recovery-plan/types';
import { getPlan, updateGoalStatus } from '../../modules/recovery-plan/recoveryPlanManager';

type GoalDetailStackParamList = {
  GoalDetail: {
    goalId: string;
    planId: string;
    participantId: string;
    participantName: string;
    onGoalUpdated: () => void;
  };
};

type GoalDetailScreenRouteProp = RouteProp<GoalDetailStackParamList, 'GoalDetail'>;
type GoalDetailScreenNavigationProp = StackNavigationProp<GoalDetailStackParamList, 'GoalDetail'>;

export const GoalDetailScreen: React.FC = () => {
  const navigation = useNavigation<GoalDetailScreenNavigationProp>();
  const route = useRoute<GoalDetailScreenRouteProp>();
  const { goalId, planId, participantId, participantName, onGoalUpdated } = route.params;

  const [goal, setGoal] = useState<Goal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [progressNote, setProgressNote] = useState('');

  useEffect(() => {
    loadGoal();
  }, []);

  const loadGoal = async () => {
    try {
      setIsLoading(true);
      const plan = await getPlan(planId);
      const foundGoal = plan.goals.find((g) => g.goalId === goalId);
      if (foundGoal) {
        setGoal(foundGoal);
      } else {
        Alert.alert('Error', 'Goal not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading goal:', error);
      Alert.alert('Error', 'Failed to load goal');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: GoalStatus) => {
    if (!goal) return;

    if (!progressNote.trim()) {
      Alert.alert('Error', 'Please add a progress note explaining the status change');
      return;
    }

    setIsUpdating(true);

    try {
      // TODO: Get current user ID from auth context
      const userId = 'current-user-id';

      await updateGoalStatus(goalId, newStatus, progressNote.trim(), userId, participantId);

      Alert.alert('Success', 'Goal status updated', [
        {
          text: 'OK',
          onPress: () => {
            onGoalUpdated();
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      console.error('Error updating goal status:', error);
      Alert.alert('Error', 'Failed to update goal status');
    } finally {
      setIsUpdating(false);
    }
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
        <Text style={styles.loadingText}>Loading goal...</Text>
      </View>
    );
  }

  if (!goal) {
    return null;
  }

  const completedSteps = goal.actionSteps.filter((s) => s.completed).length;
  const totalSteps = goal.actionSteps.length;
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.statusBadge} style={{ backgroundColor: getStatusColor(goal.status) }}>
              <Text style={styles.statusIcon}>{getStatusIcon(goal.status)}</Text>
              <Text style={styles.statusText}>{goal.status}</Text>
            </View>
            <Text style={styles.category}>{goal.category}</Text>
          </View>
          <Text style={styles.description}>{goal.description}</Text>
          <Text style={styles.participantName}>{participantName}</Text>
        </View>

        {/* Goal Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goal Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Target Date:</Text>
            <Text style={styles.detailValue}>
              {goal.targetDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created:</Text>
            <Text style={styles.detailValue}>
              {goal.createdDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Last Updated:</Text>
            <Text style={styles.detailValue}>
              {goal.lastUpdated.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
        </View>

        {/* Action Steps */}
        {goal.actionSteps.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Action Steps ({completedSteps}/{totalSteps})
            </Text>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground}>
                <View
                  style={[styles.progressBarFill, { width: `${progressPercentage}%` }]}
                />
              </View>
              <Text style={styles.progressPercentage}>{Math.round(progressPercentage)}%</Text>
            </View>
            {goal.actionSteps.map((step, index) => (
              <View key={step.stepId} style={styles.actionStepItem}>
                <View style={styles.actionStepLeft}>
                  <Text style={styles.actionStepNumber}>{index + 1}.</Text>
                  <Text
                    style={[
                      styles.actionStepText,
                      step.completed && styles.actionStepTextCompleted,
                    ]}
                  >
                    {step.description}
                  </Text>
                </View>
                {step.completed && (
                  <Text style={styles.completedCheck}>✓</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Barriers */}
        {goal.barriersIdentified.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Barriers Identified</Text>
            {goal.barriersIdentified.map((barrier, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listBullet}>•</Text>
                <Text style={styles.listText}>{barrier}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Support Needed */}
        {goal.supportNeeded.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support Needed</Text>
            {goal.supportNeeded.map((support, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listBullet}>•</Text>
                <Text style={styles.listText}>{support}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Progress Notes */}
        {goal.progressNotes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Progress Notes</Text>
            {goal.progressNotes.map((note) => (
              <View key={note.noteId} style={styles.progressNoteItem}>
                <Text style={styles.progressNoteDate}>
                  {note.date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
                <Text style={styles.progressNoteText}>{note.note}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Update Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Update Status</Text>

          {/* Status Picker */}
          <TouchableOpacity
            style={styles.statusPicker}
            onPress={() => setShowStatusPicker(!showStatusPicker)}
          >
            <Text style={styles.statusPickerLabel}>New Status:</Text>
            <View style={styles.statusPickerValue}>
              <Text style={[styles.statusPickerText, { color: getStatusColor(goal.status) }]}>
                {goal.status}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </View>
          </TouchableOpacity>

          {showStatusPicker && (
            <View style={styles.statusOptions}>
              {Object.values(GoalStatus).map((status) => (
                <TouchableOpacity
                  key={status}
                  style={styles.statusOption}
                  onPress={() => {
                    setShowStatusPicker(false);
                    if (status !== goal.status) {
                      handleStatusUpdate(status);
                    }
                  }}
                >
                  <Text style={styles.statusOptionIcon}>{getStatusIcon(status)}</Text>
                  <Text
                    style={[
                      styles.statusOptionText,
                      { color: getStatusColor(status) },
                      status === goal.status && styles.statusOptionTextSelected,
                    ]}
                  >
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Progress Note Input */}
          <View style={styles.progressNoteInput}>
            <Text style={styles.label}>Progress Note *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={progressNote}
              onChangeText={setProgressNote}
              placeholder="Describe the progress or reason for status change..."
              multiline={true}
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Update Button */}
          <TouchableOpacity
            style={[styles.updateButton, isUpdating && styles.updateButtonDisabled]}
            onPress={() => {
              if (goal.status !== goal.status) {
                handleStatusUpdate(goal.status);
              } else {
                Alert.alert('Info', 'Please select a different status to update');
              }
            }}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.updateButtonText}>Update Status</Text>
            )}
          </TouchableOpacity>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  category: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  description: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    lineHeight: 28,
  },
  participantName: {
    fontSize: 14,
    color: '#999',
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLabel: {
    fontSize: 15,
    color: '#666',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    minWidth: 40,
  },
  actionStepItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  actionStepLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  actionStepNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 8,
    minWidth: 24,
  },
  actionStepText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  actionStepTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  completedCheck: {
    fontSize: 18,
    color: '#4CAF50',
    marginLeft: 8,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  listBullet: {
    fontSize: 16,
    color: '#666',
    marginRight: 8,
    marginTop: 2,
  },
  listText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  progressNoteItem: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  progressNoteDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  progressNoteText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  statusPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  statusPickerLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  statusPickerValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPickerText: {
    fontSize: 15,
    fontWeight: '600',
    marginRight: 8,
  },
  pickerArrow: {
    fontSize: 12,
    color: '#999',
  },
  statusOptions: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    marginBottom: 12,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statusOptionIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  statusOptionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusOptionTextSelected: {
    fontWeight: 'bold',
  },
  progressNoteInput: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#333',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  updateButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  updateButtonDisabled: {
    backgroundColor: '#999',
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
