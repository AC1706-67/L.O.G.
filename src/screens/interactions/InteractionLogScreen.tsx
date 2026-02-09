/**
 * Interaction Log Screen
 * Main screen for logging interactions with participants
 * Provides quick note and session note interfaces with interaction type selector
 * Requirements: 5.1, 5.2, 5.3
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
import { InteractionType, InteractionLog } from '../../modules/logging/types';
import { logInteraction } from '../../modules/logging/sessionLogger';

type InteractionStackParamList = {
  InteractionLog: {
    participantId: string;
    participantName: string;
    mode: 'quick' | 'session';
  };
};

type InteractionLogScreenRouteProp = RouteProp<InteractionStackParamList, 'InteractionLog'>;
type InteractionLogScreenNavigationProp = StackNavigationProp<
  InteractionStackParamList,
  'InteractionLog'
>;

export const InteractionLogScreen: React.FC = () => {
  const navigation = useNavigation<InteractionLogScreenNavigationProp>();
  const route = useRoute<InteractionLogScreenRouteProp>();
  const { participantId, participantName, mode } = route.params;

  // Form state
  const [interactionType, setInteractionType] = useState<InteractionType>(
    mode === 'quick' ? InteractionType.QUICK_NOTE : InteractionType.SESSION_NOTE
  );
  const [date, setDate] = useState<Date>(new Date());
  const [time, setTime] = useState<string>(
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  );
  const [duration, setDuration] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [followUpNeeded, setFollowUpNeeded] = useState<boolean>(false);
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>(undefined);
  const [linkedGoalId, setLinkedGoalId] = useState<string>('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFollowUpDatePicker, setShowFollowUpDatePicker] = useState(false);
  const [showInteractionTypePicker, setShowInteractionTypePicker] = useState(false);

  const interactionTypes = Object.values(InteractionType);

  const handleSubmit = async () => {
    // Validation
    if (!summary.trim()) {
      Alert.alert('Error', 'Please enter a summary of the interaction');
      return;
    }

    if (followUpNeeded && !followUpDate) {
      Alert.alert('Error', 'Please select a follow-up date');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user ID (in real app, this would come from auth context)
      const staffId = 'current-user-id'; // TODO: Get from auth context

      const interaction: InteractionLog = {
        participantId,
        staffId,
        interactionType,
        date,
        time,
        duration: duration ? parseInt(duration, 10) : undefined,
        location: location.trim() || undefined,
        summary: summary.trim(),
        followUpNeeded,
        followUpDate,
        linkedGoalId: linkedGoalId.trim() || undefined,
      };

      await logInteraction(interaction);

      Alert.alert('Success', 'Interaction logged successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error logging interaction:', error);
      Alert.alert('Error', 'Failed to log interaction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const handleFollowUpDateChange = (event: any, selectedDate?: Date) => {
    setShowFollowUpDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFollowUpDate(selectedDate);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {mode === 'quick' ? 'Quick Note' : 'Session Note'}
          </Text>
          <Text style={styles.participantName}>{participantName}</Text>
        </View>

        {/* Interaction Type Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Interaction Type *</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowInteractionTypePicker(!showInteractionTypePicker)}
          >
            <Text style={styles.pickerText}>{interactionType}</Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          {showInteractionTypePicker && (
            <View style={styles.pickerOptions}>
              {interactionTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={styles.pickerOption}
                  onPress={() => {
                    setInteractionType(type);
                    setShowInteractionTypePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      type === interactionType && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Date and Time */}
        <View style={styles.row}>
          <View style={[styles.section, styles.halfWidth]}>
            <Text style={styles.label}>Date *</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.dateButtonText}>
                {date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.section, styles.halfWidth]}>
            <Text style={styles.label}>Time *</Text>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              placeholder="HH:MM"
              keyboardType="default"
            />
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

        {/* Duration and Location */}
        <View style={styles.row}>
          <View style={[styles.section, styles.halfWidth]}>
            <Text style={styles.label}>Duration (minutes)</Text>
            <TextInput
              style={styles.input}
              value={duration}
              onChangeText={setDuration}
              placeholder="30"
              keyboardType="numeric"
            />
          </View>

          <View style={[styles.section, styles.halfWidth]}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Office, Home, etc."
            />
          </View>
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.label}>Summary *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={summary}
            onChangeText={setSummary}
            placeholder={
              mode === 'quick'
                ? 'Brief note about the interaction...'
                : 'Detailed session notes including topics discussed, progress made, concerns raised...'
            }
            multiline
            numberOfLines={mode === 'quick' ? 4 : 8}
            textAlignVertical="top"
          />
        </View>

        {/* Follow-up Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setFollowUpNeeded(!followUpNeeded)}
          >
            <View style={[styles.checkbox, followUpNeeded && styles.checkboxChecked]}>
              {followUpNeeded && <Text style={styles.checkboxCheck}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Follow-up needed</Text>
          </TouchableOpacity>

          {followUpNeeded && (
            <>
              <View style={styles.followUpSection}>
                <Text style={styles.label}>Follow-up Date *</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowFollowUpDatePicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    {followUpDate
                      ? followUpDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Select date'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Linked Goal ID (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={linkedGoalId}
                  onChangeText={setLinkedGoalId}
                  placeholder="Enter goal ID if applicable"
                />
              </View>
            </>
          )}
        </View>

        {showFollowUpDatePicker && (
          <DateTimePicker
            value={followUpDate || new Date()}
            mode="date"
            display="default"
            onChange={handleFollowUpDateChange}
            minimumDate={new Date()}
          />
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Log Interaction</Text>
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 16,
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
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 120,
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#DDD',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
  },
  followUpSection: {
    marginTop: 12,
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
