/**
 * Assessment Selection Screen
 * Allows peer specialists to select which assessment to conduct
 * Requirements: 3.1, 4.1
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
import { AssessmentType } from '../../modules/assessment/types';
import { getAssessmentHistory, getBaselineAssessment } from '../../modules/assessment/assessmentEngine';

type AssessmentStackParamList = {
  AssessmentSelection: {
    participantId: string;
    participantName: string;
  };
  AssessmentConversation: {
    participantId: string;
    participantName: string;
    assessmentType: AssessmentType;
  };
};

type AssessmentSelectionScreenRouteProp = RouteProp<
  AssessmentStackParamList,
  'AssessmentSelection'
>;
type AssessmentSelectionScreenNavigationProp = StackNavigationProp<
  AssessmentStackParamList,
  'AssessmentSelection'
>;

export const AssessmentSelectionScreen: React.FC = () => {
  const navigation = useNavigation<AssessmentSelectionScreenNavigationProp>();
  const route = useRoute<AssessmentSelectionScreenRouteProp>();
  const { participantId, participantName } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [hasBARC10Baseline, setHasBARC10Baseline] = useState(false);
  const [hasSUPRTCBaseline, setHasSUPRTCBaseline] = useState(false);

  useEffect(() => {
    checkBaselines();
  }, []);

  const checkBaselines = async () => {
    try {
      setIsLoading(true);

      // Check for existing baselines
      const barc10Baseline = await getBaselineAssessment(participantId, AssessmentType.BARC_10);
      const suprtcBaseline = await getBaselineAssessment(participantId, AssessmentType.SUPRT_C);

      setHasBARC10Baseline(!!barc10Baseline);
      setHasSUPRTCBaseline(!!suprtcBaseline);
    } catch (error) {
      console.error('Error checking baselines:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssessmentSelect = (assessmentType: AssessmentType) => {
    const isBaseline =
      (assessmentType === AssessmentType.BARC_10 && !hasBARC10Baseline) ||
      (assessmentType === AssessmentType.SUPRT_C && !hasSUPRTCBaseline);

    const assessmentName = assessmentType === AssessmentType.BARC_10 ? 'BARC-10' : 'SUPRT-C';
    const message = isBaseline
      ? `This will be the baseline ${assessmentName} assessment for ${participantName}.`
      : `This will be a follow-up ${assessmentName} assessment for ${participantName}.`;

    Alert.alert('Start Assessment', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start',
        onPress: () => {
          navigation.navigate('AssessmentConversation', {
            participantId,
            participantName,
            assessmentType,
          });
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading assessment history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Assessment</Text>
        <Text style={styles.participantName}>{participantName}</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* BARC-10 Assessment Card */}
        <TouchableOpacity
          style={styles.assessmentCard}
          onPress={() => handleAssessmentSelect(AssessmentType.BARC_10)}
        >
          <View style={styles.assessmentCardHeader}>
            <Text style={styles.assessmentCardTitle}>BARC-10</Text>
            {hasBARC10Baseline ? (
              <View style={styles.followUpBadge}>
                <Text style={styles.followUpBadgeText}>Follow-up</Text>
              </View>
            ) : (
              <View style={styles.baselineBadge}>
                <Text style={styles.baselineBadgeText}>Baseline</Text>
              </View>
            )}
          </View>
          <Text style={styles.assessmentCardSubtitle}>
            Brief Assessment of Recovery Capital
          </Text>
          <Text style={styles.assessmentCardDescription}>
            10 questions measuring recovery capital across key life domains. Takes approximately
            5-10 minutes.
          </Text>
          <View style={styles.assessmentCardDetails}>
            <Text style={styles.assessmentCardDetail}>• 10 questions</Text>
            <Text style={styles.assessmentCardDetail}>• 1-6 scale responses</Text>
            <Text style={styles.assessmentCardDetail}>• Automatic scoring</Text>
            <Text style={styles.assessmentCardDetail}>• Progress tracking</Text>
          </View>
        </TouchableOpacity>

        {/* SUPRT-C Assessment Card */}
        <TouchableOpacity
          style={styles.assessmentCard}
          onPress={() => handleAssessmentSelect(AssessmentType.SUPRT_C)}
        >
          <View style={styles.assessmentCardHeader}>
            <Text style={styles.assessmentCardTitle}>SUPRT-C</Text>
            {hasSUPRTCBaseline ? (
              <View style={styles.followUpBadge}>
                <Text style={styles.followUpBadgeText}>Follow-up</Text>
              </View>
            ) : (
              <View style={styles.baselineBadge}>
                <Text style={styles.baselineBadgeText}>Baseline</Text>
              </View>
            )}
          </View>
          <Text style={styles.assessmentCardSubtitle}>
            Standardized Baseline Assessment
          </Text>
          <Text style={styles.assessmentCardDescription}>
            Comprehensive assessment covering demographics, social drivers of health, and
            client-reported outcomes. Takes approximately 15-20 minutes.
          </Text>
          <View style={styles.assessmentCardDetails}>
            <Text style={styles.assessmentCardDetail}>• Demographics</Text>
            <Text style={styles.assessmentCardDetail}>• Social drivers of health</Text>
            <Text style={styles.assessmentCardDetail}>• 12-item wellness scale</Text>
            <Text style={styles.assessmentCardDetail}>• Quality of life rating</Text>
          </View>
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
  participantName: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  assessmentCard: {
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
  assessmentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  assessmentCardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  baselineBadge: {
    backgroundColor: '#FF9500',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  baselineBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  followUpBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  followUpBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  assessmentCardSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  assessmentCardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  assessmentCardDetails: {
    marginTop: 8,
  },
  assessmentCardDetail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
});
