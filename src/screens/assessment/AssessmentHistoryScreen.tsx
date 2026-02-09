/**
 * Assessment History Screen
 * Displays all past assessments for a participant with trend visualization
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
import { AssessmentType, AssessmentResult } from '../../modules/assessment/types';
import { getAssessmentHistory } from '../../modules/assessment/assessmentEngine';

type AssessmentStackParamList = {
  AssessmentHistory: {
    participantId: string;
    participantName: string;
  };
  AssessmentResults: {
    assessmentId: string;
    participantId: string;
    participantName: string;
  };
};

type AssessmentHistoryScreenRouteProp = RouteProp<
  AssessmentStackParamList,
  'AssessmentHistory'
>;
type AssessmentHistoryScreenNavigationProp = StackNavigationProp<
  AssessmentStackParamList,
  'AssessmentHistory'
>;

export const AssessmentHistoryScreen: React.FC = () => {
  const navigation = useNavigation<AssessmentHistoryScreenNavigationProp>();
  const route = useRoute<AssessmentHistoryScreenRouteProp>();
  const { participantId, participantName } = route.params;

  const [barc10History, setBarc10History] = useState<AssessmentResult[]>([]);
  const [suprtcHistory, setSuprtcHistory] = useState<AssessmentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<AssessmentType>(AssessmentType.BARC_10);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setIsLoading(true);

      const [barc10, suprtc] = await Promise.all([
        getAssessmentHistory(participantId, AssessmentType.BARC_10),
        getAssessmentHistory(participantId, AssessmentType.SUPRT_C),
      ]);

      setBarc10History(barc10);
      setSuprtcHistory(suprtc);
    } catch (error) {
      console.error('Error loading assessment history:', error);
      Alert.alert('Error', 'Failed to load assessment history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssessmentPress = (assessmentId: string) => {
    navigation.navigate('AssessmentResults', {
      assessmentId,
      participantId,
      participantName,
    });
  };

  const renderAssessmentCard = (assessment: AssessmentResult, index: number) => {
    const isBaseline = index === 0;
    const isBARC10 = assessment.assessmentType === AssessmentType.BARC_10;

    return (
      <TouchableOpacity
        key={assessment.assessmentId}
        style={styles.assessmentCard}
        onPress={() => handleAssessmentPress(assessment.assessmentId)}
      >
        <View style={styles.assessmentCardHeader}>
          <View>
            <Text style={styles.assessmentCardTitle}>
              {isBaseline ? 'Baseline' : `Follow-up ${index}`}
            </Text>
            <Text style={styles.assessmentCardDate}>
              {assessment.completedAt.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
          {isBARC10 && assessment.totalScore && (
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreValue}>{assessment.totalScore}</Text>
              <Text style={styles.scoreLabel}>/ 60</Text>
            </View>
          )}
        </View>

        {isBARC10 && assessment.interpretation && (
          <Text style={styles.interpretationText} numberOfLines={2}>
            {assessment.interpretation}
          </Text>
        )}

        <View style={styles.assessmentCardFooter}>
          <Text style={styles.viewDetailsText}>View Details →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTrendVisualization = () => {
    if (selectedType !== AssessmentType.BARC_10 || barc10History.length < 2) {
      return null;
    }

    const scores = barc10History.map((a) => a.totalScore || 0);
    const maxScore = 60;
    const minScore = 10;

    return (
      <View style={styles.trendCard}>
        <Text style={styles.trendTitle}>Score Trend</Text>
        <View style={styles.trendChart}>
          {scores.map((score, index) => {
            const height = ((score - minScore) / (maxScore - minScore)) * 100;
            const isFirst = index === 0;
            const isLast = index === scores.length - 1;

            return (
              <View key={index} style={styles.trendBarContainer}>
                <View style={styles.trendBarWrapper}>
                  <View style={[styles.trendBar, { height: `${height}%` }]}>
                    <Text style={styles.trendBarLabel}>{score}</Text>
                  </View>
                </View>
                <Text style={styles.trendBarDate}>
                  {isFirst ? 'Baseline' : isLast ? 'Current' : `F${index}`}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  const currentHistory = selectedType === AssessmentType.BARC_10 ? barc10History : suprtcHistory;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Assessment History</Text>
        <Text style={styles.participantName}>{participantName}</Text>

        {/* Type Selector */}
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[
              styles.typeSelectorButton,
              selectedType === AssessmentType.BARC_10 && styles.typeSelectorButtonActive,
            ]}
            onPress={() => setSelectedType(AssessmentType.BARC_10)}
          >
            <Text
              style={[
                styles.typeSelectorButtonText,
                selectedType === AssessmentType.BARC_10 && styles.typeSelectorButtonTextActive,
              ]}
            >
              BARC-10 ({barc10History.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.typeSelectorButton,
              selectedType === AssessmentType.SUPRT_C && styles.typeSelectorButtonActive,
            ]}
            onPress={() => setSelectedType(AssessmentType.SUPRT_C)}
          >
            <Text
              style={[
                styles.typeSelectorButtonText,
                selectedType === AssessmentType.SUPRT_C && styles.typeSelectorButtonTextActive,
              ]}
            >
              SUPRT-C ({suprtcHistory.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Trend Visualization */}
        {renderTrendVisualization()}

        {/* Assessment List */}
        {currentHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No {selectedType === AssessmentType.BARC_10 ? 'BARC-10' : 'SUPRT-C'} assessments
              found
            </Text>
          </View>
        ) : (
          currentHistory.map((assessment, index) => renderAssessmentCard(assessment, index))
        )}
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
    marginBottom: 15,
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 4,
  },
  typeSelectorButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  typeSelectorButtonActive: {
    backgroundColor: '#007AFF',
  },
  typeSelectorButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  typeSelectorButtonTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  trendCard: {
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
  trendTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  trendChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 200,
    paddingTop: 20,
  },
  trendBarContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  trendBarWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  trendBar: {
    width: '80%',
    backgroundColor: '#007AFF',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 30,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 4,
  },
  trendBarLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  trendBarDate: {
    fontSize: 11,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  assessmentCard: {
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
  assessmentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  assessmentCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  assessmentCardDate: {
    fontSize: 14,
    color: '#666',
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#999',
  },
  interpretationText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  assessmentCardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 8,
    marginTop: 8,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});
