/**
 * Intake Session Screen
 * Main screen for managing intake sessions with section selection and progress tracking
 * Requirements: 2.1, 2.2, 2.3, 2.6
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
import {
  IntakeSection,
  IntakeSession,
  IntakeCompletionStatus,
} from '../../modules/intake/types';
import {
  startIntake,
  resumeIntake,
  getCompletionStatus,
} from '../../modules/intake/intakeManager';

type IntakeStackParamList = {
  IntakeSession: {
    participantId: string;
    participantName: string;
    intakeId?: string;
    onComplete?: () => void;
  };
  IntakeForm: {
    intakeId: string;
    participantId: string;
    section: IntakeSection;
    onSectionComplete: () => void;
  };
};

type IntakeSessionScreenRouteProp = RouteProp<IntakeStackParamList, 'IntakeSession'>;
type IntakeSessionScreenNavigationProp = StackNavigationProp<
  IntakeStackParamList,
  'IntakeSession'
>;

const SECTION_LABELS: Record<IntakeSection, string> = {
  [IntakeSection.IDENTIFIERS]: 'Identifiers',
  [IntakeSection.CONTACT]: 'Contact Information',
  [IntakeSection.DEMOGRAPHICS]: 'Demographics',
  [IntakeSection.HEALTH]: 'Health Information',
  [IntakeSection.SUBSTANCE_USE]: 'Substance Use History',
  [IntakeSection.BEHAVIORAL_HEALTH]: 'Behavioral Health',
  [IntakeSection.SOCIAL_DRIVERS]: 'Social Drivers',
  [IntakeSection.FAMILY]: 'Family Information',
  [IntakeSection.INSURANCE]: 'Insurance',
  [IntakeSection.ENGAGEMENT]: 'Engagement Preferences',
  [IntakeSection.EMERGENCY_CONTACT]: 'Emergency Contact',
};

const SECTION_DESCRIPTIONS: Record<IntakeSection, string> = {
  [IntakeSection.IDENTIFIERS]: 'Basic identification information',
  [IntakeSection.CONTACT]: 'Phone, email, and address',
  [IntakeSection.DEMOGRAPHICS]: 'Race, ethnicity, gender, and languages',
  [IntakeSection.HEALTH]: 'Physical health and disabilities',
  [IntakeSection.SUBSTANCE_USE]: 'Recovery path and treatment history',
  [IntakeSection.BEHAVIORAL_HEALTH]: 'Mental health and diagnoses',
  [IntakeSection.SOCIAL_DRIVERS]: 'Housing, employment, and education',
  [IntakeSection.FAMILY]: 'Family status and children',
  [IntakeSection.INSURANCE]: 'Insurance coverage details',
  [IntakeSection.ENGAGEMENT]: 'Contact preferences and assigned peer',
  [IntakeSection.EMERGENCY_CONTACT]: 'Emergency contact person',
};

export const IntakeSessionScreen: React.FC = () => {
  const navigation = useNavigation<IntakeSessionScreenNavigationProp>();
  const route = useRoute<IntakeSessionScreenRouteProp>();
  const { participantId, participantName, intakeId: existingIntakeId, onComplete } = route.params;

  const [session, setSession] = useState<IntakeSession | null>(null);
  const [completionStatus, setCompletionStatus] = useState<IntakeCompletionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    try {
      setIsLoading(true);
      const userId = 'current-user-id'; // TODO: Get from auth context

      let intakeSession: IntakeSession;

      if (existingIntakeId) {
        // Resume existing intake
        intakeSession = await resumeIntake(existingIntakeId, userId);
      } else {
        // Start new intake
        intakeSession = await startIntake(participantId, userId);
      }

      setSession(intakeSession);

      // Get completion status
      const status = await getCompletionStatus(intakeSession.intakeId, userId);
      setCompletionStatus(status);
    } catch (error) {
      console.error('Error initializing intake session:', error);
      Alert.alert('Error', 'Failed to initialize intake session');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshStatus = async () => {
    if (!session) return;

    try {
      const userId = 'current-user-id'; // TODO: Get from auth context
      const status = await getCompletionStatus(session.intakeId, userId);
      setCompletionStatus(status);

      // Update session with latest data
      const updatedSession = await resumeIntake(session.intakeId, userId);
      setSession(updatedSession);
    } catch (error) {
      console.error('Error refreshing status:', error);
    }
  };

  const handleSectionPress = (section: IntakeSection) => {
    if (!session) return;

    navigation.navigate('IntakeForm', {
      intakeId: session.intakeId,
      participantId,
      section,
      onSectionComplete: refreshStatus,
    });
  };

  const handleSaveAndExit = () => {
    Alert.alert(
      'Save and Exit',
      'Your progress has been automatically saved. You can resume this intake later.',
      [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const handleCompleteIntake = () => {
    if (!completionStatus || completionStatus.percentComplete < 100) {
      Alert.alert(
        'Incomplete Intake',
        `This intake is ${completionStatus?.percentComplete}% complete. Please complete all required sections before finishing.`
      );
      return;
    }

    Alert.alert(
      'Complete Intake',
      'Are you sure you want to mark this intake as complete?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: () => {
            if (onComplete) {
              onComplete();
            }
            navigation.goBack();
          },
        },
      ]
    );
  };

  const isSectionComplete = (section: IntakeSection): boolean => {
    return session?.completedSections.includes(section) || false;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading intake session...</Text>
      </View>
    );
  }

  if (!session || !completionStatus) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load intake session</Text>
        <TouchableOpacity style={styles.retryButton} onPress={initializeSession}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Participant Intake</Text>
        <Text style={styles.participantName}>{participantName}</Text>
        
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${completionStatus.percentComplete}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {completionStatus.percentComplete}% Complete
          </Text>
        </View>
        
        <Text style={styles.progressDetail}>
          {completionStatus.completedSections} of {completionStatus.totalSections} sections completed
        </Text>
      </View>

      {/* Section List */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.sectionListTitle}>Select a section to complete:</Text>
        
        {Object.values(IntakeSection).map((section) => {
          const isComplete = isSectionComplete(section);
          
          return (
            <TouchableOpacity
              key={section}
              style={[styles.sectionCard, isComplete && styles.sectionCardComplete]}
              onPress={() => handleSectionPress(section)}
            >
              <View style={styles.sectionCardContent}>
                <View style={styles.sectionCardHeader}>
                  <Text style={styles.sectionCardTitle}>
                    {SECTION_LABELS[section]}
                  </Text>
                  {isComplete && (
                    <View style={styles.completeBadge}>
                      <Text style={styles.completeBadgeText}>✓</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.sectionCardDescription}>
                  {SECTION_DESCRIPTIONS[section]}
                </Text>
              </View>
              <Text style={styles.sectionCardArrow}>›</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveAndExit}
        >
          <Text style={styles.saveButtonText}>Save & Exit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.completeButton,
            completionStatus.percentComplete < 100 && styles.completeButtonDisabled,
          ]}
          onPress={handleCompleteIntake}
          disabled={completionStatus.percentComplete < 100}
        >
          <Text style={styles.completeButtonText}>Complete Intake</Text>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
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
    marginBottom: 5,
  },
  participantName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  progressContainer: {
    marginBottom: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  progressDetail: {
    fontSize: 12,
    color: '#999',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  sectionListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionCardComplete: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  sectionCardContent: {
    flex: 1,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  completeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  completeBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  sectionCardDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  sectionCardArrow: {
    fontSize: 28,
    color: '#CCC',
    marginLeft: 12,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  completeButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  completeButtonDisabled: {
    backgroundColor: '#CCC',
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
