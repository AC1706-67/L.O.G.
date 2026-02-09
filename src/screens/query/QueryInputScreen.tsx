/**
 * Query Input Screen
 * Main screen for submitting natural language queries
 * Provides voice/text input, query suggestions, and query history
 * Requirements: 7.1, 7.5
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { QueryResult } from '../../modules/query/types';
import { processQuery } from '../../modules/query/queryService';

type QueryStackParamList = {
  QueryInput: undefined;
  QueryResults: {
    queryResult: QueryResult;
  };
};

type QueryInputScreenNavigationProp = StackNavigationProp<QueryStackParamList, 'QueryInput'>;

interface QuerySuggestion {
  id: string;
  text: string;
  category: string;
}

interface QueryHistoryItem {
  id: string;
  query: string;
  timestamp: Date;
  successful: boolean;
}

export const QueryInputScreen: React.FC = () => {
  const navigation = useNavigation<QueryInputScreenNavigationProp>();

  // State
  const [queryText, setQueryText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<QuerySuggestion[]>([]);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Predefined query suggestions
  const predefinedSuggestions: QuerySuggestion[] = [
    {
      id: '1',
      text: 'How many participants are currently on MAT?',
      category: 'Statistics',
    },
    {
      id: '2',
      text: "Who's been in recovery more than 6 months?",
      category: 'Participants',
    },
    {
      id: '3',
      text: 'Show me everyone due for 3-month follow-up',
      category: 'Follow-ups',
    },
    {
      id: '4',
      text: "What's [name]'s BARC-10 progress?",
      category: 'Assessments',
    },
    {
      id: '5',
      text: 'Pull up [name]\'s record',
      category: 'Records',
    },
    {
      id: '6',
      text: "When's the last time I met with [name]?",
      category: 'Interactions',
    },
    {
      id: '7',
      text: 'Show participants with active recovery plans',
      category: 'Recovery Plans',
    },
    {
      id: '8',
      text: 'List participants who need consent renewal',
      category: 'Compliance',
    },
    {
      id: '9',
      text: 'Show crisis interventions this month',
      category: 'Interactions',
    },
    {
      id: '10',
      text: 'What are the average BARC-10 scores?',
      category: 'Statistics',
    },
  ];

  useEffect(() => {
    setSuggestions(predefinedSuggestions);
  }, []);

  useEffect(() => {
    if (showHistory && queryHistory.length === 0) {
      loadQueryHistory();
    }
  }, [showHistory]);

  const loadQueryHistory = async () => {
    setIsLoadingHistory(true);
    try {
      // TODO: Implement actual query history loading from database
      // For now, using mock data
      const mockHistory: QueryHistoryItem[] = [
        {
          id: '1',
          query: 'How many participants are currently on MAT?',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          successful: true,
        },
        {
          id: '2',
          query: "Show me John Doe's BARC-10 progress",
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
          successful: true,
        },
        {
          id: '3',
          query: 'List participants due for follow-up',
          timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
          successful: true,
        },
      ];
      setQueryHistory(mockHistory);
    } catch (error) {
      console.error('Error loading query history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSubmitQuery = async (query: string) => {
    if (!query.trim()) {
      Alert.alert('Error', 'Please enter a query');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user ID (in real app, this would come from auth context)
      const userId = 'current-user-id'; // TODO: Get from auth context

      // Process query using the query service
      const result = await processQuery(query, userId);

      // Navigate to results screen
      navigation.navigate('QueryResults', { queryResult: result });

      // Clear input
      setQueryText('');
    } catch (error) {
      console.error('Error submitting query:', error);
      Alert.alert('Error', 'Failed to process query. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuggestionPress = (suggestion: QuerySuggestion) => {
    setQueryText(suggestion.text);
    setShowSuggestions(false);
  };

  const handleHistoryItemPress = (historyItem: QueryHistoryItem) => {
    setQueryText(historyItem.query);
    setShowHistory(false);
  };

  const handleVoiceInput = () => {
    // TODO: Implement voice input with AWS Transcribe
    Alert.alert('Voice Input', 'Voice input will be available in a future update');
  };

  const toggleSuggestions = () => {
    setShowSuggestions(!showSuggestions);
    if (!showSuggestions) {
      setShowHistory(false);
    }
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
    if (!showHistory) {
      setShowSuggestions(false);
    }
  };

  const groupSuggestionsByCategory = () => {
    const grouped: Record<string, QuerySuggestion[]> = {};
    suggestions.forEach((suggestion) => {
      if (!grouped[suggestion.category]) {
        grouped[suggestion.category] = [];
      }
      grouped[suggestion.category].push(suggestion);
    });
    return grouped;
  };

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Query Data</Text>
        <Text style={styles.subtitle}>Ask questions about your participants and program</Text>
      </View>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TouchableOpacity style={styles.voiceButton} onPress={handleVoiceInput}>
            <Text style={styles.voiceButtonText}>🎤</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={queryText}
            onChangeText={setQueryText}
            placeholder="Ask a question..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
            editable={!isSubmitting}
          />
        </View>
        <TouchableOpacity
          style={[styles.submitButton, (!queryText.trim() || isSubmitting) && styles.submitButtonDisabled]}
          onPress={() => handleSubmitQuery(queryText)}
          disabled={!queryText.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Ask</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Toggle Buttons */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, showSuggestions && styles.toggleButtonActive]}
          onPress={toggleSuggestions}
        >
          <Text style={[styles.toggleButtonText, showSuggestions && styles.toggleButtonTextActive]}>
            💡 Suggestions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, showHistory && styles.toggleButtonActive]}
          onPress={toggleHistory}
        >
          <Text style={[styles.toggleButtonText, showHistory && styles.toggleButtonTextActive]}>
            🕐 History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <ScrollView style={styles.contentContainer} contentContainerStyle={styles.contentScroll}>
        {/* Suggestions */}
        {showSuggestions && (
          <View style={styles.suggestionsContainer}>
            {Object.entries(groupSuggestionsByCategory()).map(([category, items]) => (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>{category}</Text>
                {items.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion.id}
                    style={styles.suggestionCard}
                    onPress={() => handleSuggestionPress(suggestion)}
                  >
                    <Text style={styles.suggestionText}>{suggestion.text}</Text>
                    <Text style={styles.suggestionArrow}>→</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* History */}
        {showHistory && (
          <View style={styles.historyContainer}>
            {isLoadingHistory ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading history...</Text>
              </View>
            ) : queryHistory.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No query history yet</Text>
                <Text style={styles.emptySubtext}>Your previous queries will appear here</Text>
              </View>
            ) : (
              queryHistory.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.historyCard}
                  onPress={() => handleHistoryItemPress(item)}
                >
                  <View style={styles.historyContent}>
                    <Text style={styles.historyQuery}>{item.query}</Text>
                    <Text style={styles.historyTimestamp}>{formatTimestamp(item.timestamp)}</Text>
                  </View>
                  <View style={[styles.historyStatus, item.successful && styles.historyStatusSuccess]}>
                    <Text style={styles.historyStatusText}>{item.successful ? '✓' : '✗'}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Default State */}
        {!showSuggestions && !showHistory && (
          <View style={styles.defaultContainer}>
            <Text style={styles.defaultEmoji}>🔍</Text>
            <Text style={styles.defaultTitle}>Ask anything about your program</Text>
            <Text style={styles.defaultText}>
              Get insights about participants, assessments, recovery plans, and more using natural language
            </Text>
            <View style={styles.exampleContainer}>
              <Text style={styles.exampleTitle}>Example queries:</Text>
              <Text style={styles.exampleItem}>• "How many participants are on MAT?"</Text>
              <Text style={styles.exampleItem}>• "Show me recent crisis interventions"</Text>
              <Text style={styles.exampleItem}>• "Who needs a follow-up this week?"</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  voiceButtonText: {
    fontSize: 24,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: '#F0F0F0',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCC',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
  },
  contentScroll: {
    padding: 16,
  },
  suggestionsContainer: {
    gap: 20,
  },
  categorySection: {
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  suggestionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  suggestionText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  suggestionArrow: {
    fontSize: 18,
    color: '#007AFF',
    marginLeft: 12,
  },
  historyContainer: {
    gap: 8,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  historyContent: {
    flex: 1,
    marginRight: 12,
  },
  historyQuery: {
    fontSize: 15,
    color: '#333',
    marginBottom: 4,
  },
  historyTimestamp: {
    fontSize: 12,
    color: '#999',
  },
  historyStatus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyStatusSuccess: {
    backgroundColor: '#E8F5E9',
  },
  historyStatusText: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  defaultContainer: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  defaultEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  defaultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  defaultText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  exampleContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    width: '100%',
  },
  exampleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  exampleItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
});
