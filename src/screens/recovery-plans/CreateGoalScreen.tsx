/**
 * Create Goal Screen
 * Interface for adding new goals to a recovery plan
 * Requirements: 6.1, 6.6
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { GoalCategory, GoalData, ActionStep } from '../../modules/recovery-plan/types';
import { addGoal } from '../../modules/recovery-plan/recoveryPlanManager';

type CreateGoalStackParamList = {
  CreateGoal: {
    planId: string;
    participantId: string;
    participantName: string;
    onGoalCreated: () => void;
  };
};

type CreateGoalScreenRouteProp = RouteProp<CreateGoalStackParamList, 'CreateGoal'>;
type CreateGoalScreenNavigationProp = StackNavigationProp<CreateGoalStackParamList, 'CreateGoal'>;

export const CreateGoalScreen: React.FC = () => {
  const navigation = useNavigation<CreateGoalScreenNavigationProp>();
  const route = useRoute<CreateGoalScreenRouteProp>();
  const { planId, participantId, participantName, onGoalCreated } = route.params;

  // Form state
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GoalCategory>(GoalCategory.RECOVERY);
  const [targetDate, setTargetDate] = useState<Date>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
  );
  const [barriers, setBarriers] = useState<string>('');
  const [support, setSupport] = useState<string>('');
  const [actionSteps, setActionSteps] = useState<ActionStep[]>([]);
  const [newStepDescription, setNewStepDescription] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const categories = Object.values(GoalCategory);

  const handleAddActionStep = () => {
    if (!newStepDescription.trim()) {
      Alert.alert('Error', 'Please enter a step description');
      return;
    }

    const newStep: ActionStep = {
      stepId: `step-${Date.now()}`,
      description: newStepDescription.trim(),
      completed: false,
    };

    setActionSteps([...actionSteps, newStep]);
    setNewStepDescription('');
  };

  const handleRemoveActionStep = (stepId: string) => {
    setActionSteps(actionSteps.filter((step) => step.stepId !== stepId));
  };

  const handleSubmit = async () => {
    // Validation
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a goal description');
      return;
    }

    if (targetDate < new Date()) {
      Alert.alert('Error', 'Target date must be in the future');
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Get current user ID from auth context
      const createdBy = 'current-user-id';

      const goalData: GoalData = {
        description: description.trim(),
        category,
        targetDate,
        barriersIdentified: barriers
          .split('\n')
          .map((b) => b.trim())
          .filter((b) => b.length > 0),
        supportNeeded: support
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
        actionSteps,
      };

      await addGoal(planId, goalData, createdBy);

      Alert.alert('Success', 'Goal added successfully', [
        {
          text: 'OK',
          onPress: () => {
            onGoalCreated();
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      console.error('Error adding goal:', error);
      Alert.alert('Error', 'Failed to add goal. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setTargetDate(selectedDate);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Add Goal</Text>
          <Text style={styles.participantName}>{participantName}</Text>
        </View>

        {/* Goal Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Goal Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What does the participant want to achieve?"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.label}>Category *</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
          >
            <Text style={styles.pickerText}>{category}</Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          {showCategoryPicker && (
            <View style={styles.pickerOptions}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={styles.pickerOption}
                  onPress={() => {
                    setCategory(cat);
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      cat === category && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Target Date */}
        <View style={styles.section}>
          <Text style={styles.label}>Target Date *</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateButtonText}>
              {targetDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={targetDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}

        {/* Barriers Identified */}
        <View style={styles.section}>
          <Text style={styles.label}>Barriers Identified</Text>
          <Text style={styles.hint}>Enter each barrier on a new line</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={barriers}
            onChangeText={setBarriers}
            placeholder="What obstacles might prevent achieving this goal?"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Support Needed */}
        <View style={styles.section}>
          <Text style={styles.label}>Support Needed</Text>
          <Text style={styles.hint}>Enter each type of support on a new line</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={support}
            onChangeText={setSupport}
            placeholder="What support or resources are needed?"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Action Steps */}
        <View style={styles.section}>
          <Text style={styles.label}>Action Steps</Text>
          <Text style={styles.hint}>Break down the goal into specific steps</Text>

          {actionSteps.map((step, index) => (
            <View key={step.stepId} style={styles.actionStepItem}>
              <Text style={styles.actionStepNumber}>{index + 1}.</Text>
              <Text style={styles.actionStepText}>{step.description}</Text>
              <TouchableOpacity
                style={styles.removeStepButton}
                onPress={() => handleRemoveActionStep(step.stepId)}
              >
                <Text style={styles.removeStepButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.addStepContainer}>
            <TextInput
              style={[styles.input, styles.addStepInput]}
              value={newStepDescription}
              onChangeText={setNewStepDescription}
              placeholder="Enter action step..."
              onSubmitEditing={handleAddActionStep}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addStepButton} onPress={handleAddActionStep}>
              <Text style={styles.addStepButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Add Goal</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
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
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: '#999',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  picker: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 16,
    color: '#333',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#999',
  },
  pickerOptions: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 300,
  },
  pickerOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#333',
  },
  pickerOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  dateButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  actionStepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  actionStepNumber: {
    fontSize: 16,
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
  removeStepButton: {
    padding: 4,
    marginLeft: 8,
  },
  removeStepButtonText: {
    fontSize: 18,
    color: '#FF3B30',
  },
  addStepContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  addStepInput: {
    flex: 1,
  },
  addStepButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addStepButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#999',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
