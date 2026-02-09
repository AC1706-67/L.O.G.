/**
 * Consent Workflow Screen
 * Manages the flow through multiple consent forms
 * Requirements: 1.1 - Present CFR Part 2 consent before AI consent
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import {
  CFR_PART_2_FORM_SCHEMA,
  AI_CONSENT_FORM_SCHEMA,
} from '../../modules/consent/types';
import { getConsentStatus } from '../../modules/consent/consentManager';

type ConsentStackParamList = {
  ConsentWorkflow: {
    participantId: string;
    participantName: string;
    dateOfBirth: Date;
    onComplete: () => void;
  };
  ConsentForm: {
    participantId: string;
    participantName: string;
    dateOfBirth: Date;
    consentForm: any;
    onComplete: () => void;
  };
};

type ConsentWorkflowScreenRouteProp = RouteProp<ConsentStackParamList, 'ConsentWorkflow'>;
type ConsentWorkflowScreenNavigationProp = StackNavigationProp<
  ConsentStackParamList,
  'ConsentWorkflow'
>;

export const ConsentWorkflowScreen: React.FC = () => {
  const navigation = useNavigation<ConsentWorkflowScreenNavigationProp>();
  const route = useRoute<ConsentWorkflowScreenRouteProp>();
  const { participantId, participantName, dateOfBirth, onComplete } = route.params;

  const [cfrConsentComplete, setCfrConsentComplete] = useState(false);
  const [aiConsentComplete, setAiConsentComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkExistingConsents();
  }, []);

  const checkExistingConsents = async () => {
    try {
      const userId = 'current-user-id'; // TODO: Get from auth context
      const status = await getConsentStatus(participantId, userId);

      setCfrConsentComplete(status.hasCFRConsent);
      setAiConsentComplete(status.hasAIConsent);
    } catch (error) {
      console.error('Error checking consent status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartCFRConsent = () => {
    navigation.navigate('ConsentForm', {
      participantId,
      participantName,
      dateOfBirth,
      consentForm: CFR_PART_2_FORM_SCHEMA,
      onComplete: () => {
        setCfrConsentComplete(true);
      },
    });
  };

  const handleStartAIConsent = () => {
    if (!cfrConsentComplete) {
      Alert.alert(
        'CFR Part 2 Consent Required',
        'You must complete the CFR Part 2 consent form before proceeding to AI consent.'
      );
      return;
    }

    navigation.navigate('ConsentForm', {
      participantId,
      participantName,
      dateOfBirth,
      consentForm: AI_CONSENT_FORM_SCHEMA,
      onComplete: () => {
        setAiConsentComplete(true);
      },
    });
  };

  const handleComplete = () => {
    if (!cfrConsentComplete) {
      Alert.alert('Error', 'CFR Part 2 consent is required to proceed');
      return;
    }

    Alert.alert('Success', 'Consent process completed successfully', [
      {
        text: 'OK',
        onPress: () => {
          onComplete();
          navigation.goBack();
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading consent status...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Consent Forms</Text>
        <Text style={styles.subtitle}>
          Complete the required consent forms to begin enrollment
        </Text>
      </View>

      <View style={styles.content}>
        {/* CFR Part 2 Consent */}
        <View style={styles.consentCard}>
          <View style={styles.consentHeader}>
            <Text style={styles.consentTitle}>42 CFR Part 2 Consent</Text>
            {cfrConsentComplete && (
              <View style={styles.completeBadge}>
                <Text style={styles.completeBadgeText}>✓ Complete</Text>
              </View>
            )}
          </View>
          <Text style={styles.consentDescription}>
            Required federal consent for substance use disorder treatment records
          </Text>
          <Text style={styles.requiredLabel}>REQUIRED</Text>
          <TouchableOpacity
            style={[
              styles.consentButton,
              cfrConsentComplete && styles.consentButtonComplete,
            ]}
            onPress={handleStartCFRConsent}
          >
            <Text style={styles.consentButtonText}>
              {cfrConsentComplete ? 'Review Form' : 'Start Form'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* AI Consent */}
        <View style={styles.consentCard}>
          <View style={styles.consentHeader}>
            <Text style={styles.consentTitle}>AI Processing Consent</Text>
            {aiConsentComplete && (
              <View style={styles.completeBadge}>
                <Text style={styles.completeBadgeText}>✓ Complete</Text>
              </View>
            )}
          </View>
          <Text style={styles.consentDescription}>
            Consent for AI-assisted data processing and conversational interfaces
          </Text>
          <Text style={styles.optionalLabel}>OPTIONAL</Text>
          <TouchableOpacity
            style={[
              styles.consentButton,
              !cfrConsentComplete && styles.consentButtonDisabled,
              aiConsentComplete && styles.consentButtonComplete,
            ]}
            onPress={handleStartAIConsent}
            disabled={!cfrConsentComplete}
          >
            <Text style={styles.consentButtonText}>
              {aiConsentComplete ? 'Review Form' : 'Start Form'}
            </Text>
          </TouchableOpacity>
          {!cfrConsentComplete && (
            <Text style={styles.disabledNote}>
              Complete CFR Part 2 consent first
            </Text>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.completeButton,
            !cfrConsentComplete && styles.completeButtonDisabled,
          ]}
          onPress={handleComplete}
          disabled={!cfrConsentComplete}
        >
          <Text style={styles.completeButtonText}>Complete Enrollment</Text>
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
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  consentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  consentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  consentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  completeBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  completeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  consentDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    lineHeight: 20,
  },
  requiredLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 15,
  },
  optionalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 15,
  },
  consentButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  consentButtonComplete: {
    backgroundColor: '#4CAF50',
  },
  consentButtonDisabled: {
    backgroundColor: '#CCC',
  },
  consentButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledNote: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  completeButton: {
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
