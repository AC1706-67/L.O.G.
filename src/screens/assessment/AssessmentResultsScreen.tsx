/**
 * Assessment Results Screen
 * Displays assessment scores with interpretation and baseline comparison
 * Requirements: 4.6, 4.8
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
  AssessmentType,
  AssessmentResult,
  ProgressComparison,
} from '../../modules/assessment/types';
import { compareToBaseline } from '../../modules/assessment/assessmentEngine';
import { supabase } from '../../config/supabase';

type AssessmentStackParamList = {
  AssessmentResults: {
    assessmentId: string;
    participantId: string;
    participantName: string;
  };
  AssessmentHistory: {
    participantId: string;
    participantName: string;
  };
};

type AssessmentResultsScreenRouteProp = RouteProp<
  AssessmentStackParamList,
  'AssessmentResults'
>;
type AssessmentResultsScreenNavigationProp = StackNavigationProp<
  AssessmentStackParamList,
  'AssessmentResults'
>;

export const AssessmentResultsScreen: React.FC = () => {
  const navigation = useNavigation<AssessmentResultsScreenNavigationProp>();
  const route = useRoute<AssessmentResultsScreenRouteProp>();
  const { assessmentId, participantId, participantName } = route.params;

  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [comparison, setComparison] = useState<ProgressComparison | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAssessmentResults();
  }, []);

  const loadAssessmentResults = async () => {
    try {
      setIsLoading(true);

      // Fetch assessment from database
      const { data, error } = await supabase
        .from('assessments')
        .select('*')
        .eq('id', assessmentId)
        .single();

      if (error || !data) {
        throw new Error('Failed to load assessment results');
      }

      const result: AssessmentResult = {
        assessmentId: data.id,
        participantId: data.participant_id,
        assessmentType: data.assessment_type as AssessmentType,
        completedAt: new Date(data.completed_at),
        totalScore: data.total_score,
        itemScores: data.item_scores,
        responses: data.responses || [],
        interpretation: data.interpretation,
        conversationTranscript: data.conversation_transcript || '',
      };

      setAssessment(result);

      // Load baseline comparison for BARC-10
      if (result.assessmentType === AssessmentType.BARC_10 && result.totalScore) {
        try {
          const progressComparison = await compareToBaseline(participantId, result.totalScore);
          setComparison(progressComparison);
        } catch (error) {
          // No baseline found or comparison failed - this is okay for first assessment
          console.log('No baseline comparison available:', error);
        }
      }
    } catch (error) {
      console.error('Error loading assessment results:', error);
      Alert.alert('Error', 'Failed to load assessment results');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewHistory = () => {
    navigation.navigate('AssessmentHistory', {
      participantId,
      participantName,
    });
  };

  const handleDone = () => {
    navigation.popToTop();
  };

  const getTrendIcon = (trend: 'improving' | 'stable' | 'declining'): string => {
    switch (trend) {
      case 'improving':
        return '📈';
      case 'declining':
        return '📉';
      case 'stable':
        return '➡️';
    }
  };

  const getTrendColor = (trend: 'improving' | 'stable' | 'declining'): string => {
    switch (trend) {
      case 'improving':
        return '#4CAF50';
      case 'declining':
        return '#FF3B30';
      case 'stable':
        return '#FF9500';
    }
  };

  const getTrendText = (trend: 'improving' | 'stable' | 'declining'): string => {
    switch (trend) {
      case 'improving':
        return 'Improving';
      case 'declining':
        return 'Declining';
      case 'stable':
        return 'Stable';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading results...</Text>
      </View>
    );
  }

  if (!assessment) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load assessment results</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadAssessmentResults}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isBARC10 = assessment.assessmentType === AssessmentType.BARC_10;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Assessment Results</Text>
        <Text style={styles.participantName}>{participantName}</Text>
        <Text style={styles.assessmentType}>
          {isBARC10 ? 'BARC-10' : 'SUPRT-C'}
        </Text>
        <Text style={styles.completedDate}>
          Completed {assessment.completedAt.toLocaleDateString()}
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Score Display (BARC-10 only) */}
        {isBARC10 && assessment.totalScore && (
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Total Score</Text>
            <Text style={styles.scoreValue}>{assessment.totalScore}</Text>
            <Text style={styles.scoreRange}>out of 60</Text>
            {assessment.interpretation && (
              <View style={styles.interpretationContainer}>
                <Text style={styles.interpretationText}>{assessment.interpretation}</Text>
              </View>
            )}
          </View>
        )}

        {/* Baseline Comparison (BARC-10 only) */}
        {isBARC10 && comparison && (
          <View style={styles.comparisonCard}>
            <Text style={styles.cardTitle}>Progress Comparison</Text>
            
            <View style={styles.comparisonRow}>
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>Baseline</Text>
                <Text style={styles.comparisonValue}>{comparison.baselineScore}</Text>
              </View>
              <View style={styles.comparisonArrow}>
                <Text style={styles.comparisonArrowText}>→</Text>
              </View>
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>Current</Text>
                <Text style={styles.comparisonValue}>{comparison.currentScore}</Text>
              </View>
            </View>

            <View style={styles.changeContainer}>
              <View style={styles.changeItem}>
                <Text style={styles.changeLabel}>Change</Text>
                <Text
                  style={[
                    styles.changeValue,
                    { color: comparison.change >= 0 ? '#4CAF50' : '#FF3B30' },
                  ]}
                >
                  {comparison.change >= 0 ? '+' : ''}
                  {comparison.change}
                </Text>
              </View>
              <View style={styles.changeItem}>
                <Text style={styles.changeLabel}>Percent Change</Text>
                <Text
                  style={[
                    styles.changeValue,
                    { color: comparison.percentChange >= 0 ? '#4CAF50' : '#FF3B30' },
                  ]}
                >
                  {comparison.percentChange >= 0 ? '+' : ''}
                  {comparison.percentChange}%
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.trendBadge,
                { backgroundColor: getTrendColor(comparison.trend) },
              ]}
            >
              <Text style={styles.trendIcon}>{getTrendIcon(comparison.trend)}</Text>
              <Text style={styles.trendText}>{getTrendText(comparison.trend)}</Text>
            </View>
          </View>
        )}

        {/* Item Scores (BARC-10 only) */}
        {isBARC10 && assessment.itemScores && (
          <View style={styles.itemScoresCard}>
            <Text style={styles.cardTitle}>Individual Item Scores</Text>
            {Object.entries(assessment.itemScores).map(([questionId, score]) => {
              const questionNumber = parseInt(questionId.replace('q', ''), 10);
              return (
                <View key={questionId} style={styles.itemScoreRow}>
                  <Text style={styles.itemScoreLabel}>Question {questionNumber}</Text>
                  <View style={styles.itemScoreBar}>
                    <View
                      style={[
                        styles.itemScoreBarFill,
                        { width: `${(score / 6) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.itemScoreValue}>{score}/6</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* SUPRT-C Summary */}
        {!isBARC10 && (
          <View style={styles.suprtcCard}>
            <Text style={styles.cardTitle}>Assessment Complete</Text>
            <Text style={styles.suprtcText}>
              The SUPRT-C baseline assessment has been completed and stored. This comprehensive
              assessment provides a foundation for tracking progress over time.
            </Text>
            <Text style={styles.suprtcText}>
              The assessment covers demographics, social drivers of health, and client-reported
              outcomes including the 12-item wellness scale.
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.historyButton} onPress={handleViewHistory}>
            <Text style={styles.historyButtonText}>View Assessment History</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>Done</Text>
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
    marginBottom: 5,
  },
  assessmentType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 5,
  },
  completedDate: {
    fontSize: 14,
    color: '#999',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  scoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  scoreRange: {
    fontSize: 18,
    color: '#999',
    marginBottom: 16,
  },
  interpretationContainer: {
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  interpretationText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    lineHeight: 22,
  },
  comparisonCard: {
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
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  comparisonItem: {
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  comparisonValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  comparisonArrow: {
    marginHorizontal: 16,
  },
  comparisonArrowText: {
    fontSize: 32,
    color: '#CCC',
  },
  changeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  changeItem: {
    alignItems: 'center',
  },
  changeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  changeValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  trendIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  trendText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  itemScoresCard: {
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
  itemScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemScoreLabel: {
    fontSize: 14,
    color: '#666',
    width: 100,
  },
  itemScoreBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 12,
  },
  itemScoreBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  itemScoreValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    width: 40,
    textAlign: 'right',
  },
  suprtcCard: {
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
  suprtcText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 12,
  },
  actionsContainer: {
    marginTop: 8,
  },
  historyButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  historyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  doneButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
