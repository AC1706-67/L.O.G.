/**
 * Assessment Conversation Screen
 * Conversational UI for conducting assessments with Nova AI
 * Requirements: 3.1, 4.1
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import {
  AssessmentType,
  AssessmentSession,
  AssessmentResponse,
} from '../../modules/assessment/types';
import {
  startBARC10,
  startSUPRTC,
  processResponse,
  getBARC10Question,
  calculateScore,
  storeAssessment,
} from '../../modules/assessment/assessmentEngine';

type AssessmentStackParamList = {
  AssessmentConversation: {
    participantId: string;
    participantName: string;
    assessmentType: AssessmentType;
  };
  AssessmentResults: {
    assessmentId: string;
    participantId: string;
    participantName: string;
  };
};

type AssessmentConversationScreenRouteProp = RouteProp<
  AssessmentStackParamList,
  'AssessmentConversation'
>;
type AssessmentConversationScreenNavigationProp = StackNavigationProp<
  AssessmentStackParamList,
  'AssessmentConversation'
>;

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

export const AssessmentConversationScreen: React.FC = () => {
  const navigation = useNavigation<AssessmentConversationScreenNavigationProp>();
  const route = useRoute<AssessmentConversationScreenRouteProp>();
  const { participantId, participantName, assessmentType } = route.params;

  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    initializeAssessment();
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const initializeAssessment = async () => {
    try {
      setIsLoading(true);
      const userId = 'current-user-id'; // TODO: Get from auth context

      let assessmentSession: AssessmentSession;

      if (assessmentType === AssessmentType.BARC_10) {
        assessmentSession = await startBARC10(participantId, userId);
      } else {
        assessmentSession = await startSUPRTC(participantId, userId);
      }

      setSession(assessmentSession);

      // Add welcome message
      const welcomeMessage = getWelcomeMessage(assessmentType, participantName);
      addMessage('assistant', welcomeMessage);

      // Add first question
      const firstQuestion = getCurrentQuestion(assessmentSession);
      if (firstQuestion) {
        addMessage('assistant', firstQuestion);
      }
    } catch (error) {
      console.error('Error initializing assessment:', error);
      Alert.alert('Error', 'Failed to start assessment');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const getWelcomeMessage = (type: AssessmentType, name: string): string => {
    if (type === AssessmentType.BARC_10) {
      return `Hi ${name}! I'm going to ask you 10 questions about your recovery journey. There are no right or wrong answers - just share how you're feeling. For each question, let me know how much you agree or disagree on a scale from 1 (Strongly Disagree) to 6 (Strongly Agree).`;
    } else {
      return `Hi ${name}! Today we'll go through a comprehensive assessment to understand where you are in your recovery journey. This will help us provide the best support for you. We'll cover your background, current situation, and how you're feeling. Take your time with each question.`;
    }
  };

  const getCurrentQuestion = (currentSession: AssessmentSession): string | null => {
    if (currentSession.assessmentType === AssessmentType.BARC_10) {
      const question = getBARC10Question(currentSession.currentQuestionIndex);
      return question ? question.text : null;
    } else {
      // For SUPRT-C, questions would be dynamically generated based on section
      // This is a simplified version - in production, Nova AI would guide this
      return 'Let\'s start with some basic information. Can you tell me about your race or ethnicity?';
    }
  };

  const addMessage = (role: 'assistant' | 'user', content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !session || isSending) return;

    const userMessage = inputText.trim();
    setInputText('');
    setIsSending(true);

    // Add user message to chat
    addMessage('user', userMessage);

    try {
      // Process the response
      // In production, this would use Nova AI to extract structured data
      // For now, we'll use a simplified approach for BARC-10
      let score: number | undefined;
      if (session.assessmentType === AssessmentType.BARC_10) {
        score = extractScoreFromResponse(userMessage);
      }

      const response: AssessmentResponse = {
        questionId: `q${session.currentQuestionIndex + 1}`,
        questionText: getCurrentQuestion(session) || '',
        rawResponse: userMessage,
        extractedValue: score || userMessage,
        score,
        timestamp: new Date(),
      };

      const updatedSession = await processResponse(session.sessionId, response);
      setSession(updatedSession);

      // Check if assessment is complete
      if (updatedSession.currentQuestionIndex >= updatedSession.totalQuestions) {
        await completeAssessment(updatedSession);
      } else {
        // Ask next question
        const nextQuestion = getCurrentQuestion(updatedSession);
        if (nextQuestion) {
          setTimeout(() => {
            addMessage('assistant', nextQuestion);
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error processing response:', error);
      Alert.alert('Error', 'Failed to process response. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const extractScoreFromResponse = (response: string): number => {
    // Simple extraction - in production, Nova AI would do this
    const numbers = response.match(/\d+/);
    if (numbers) {
      const score = parseInt(numbers[0], 10);
      if (score >= 1 && score <= 6) {
        return score;
      }
    }
    // Default to middle value if unclear
    return 3;
  };

  const completeAssessment = async (completedSession: AssessmentSession) => {
    setIsCompleting(true);

    try {
      // Build conversation transcript
      const transcript = messages
        .map((msg) => `${msg.role === 'assistant' ? 'Assistant' : 'Participant'}: ${msg.content}`)
        .join('\n\n');

      const userId = 'current-user-id'; // TODO: Get from auth context

      // Store assessment
      await storeAssessment(completedSession.sessionId, transcript, userId);

      // Calculate score for BARC-10
      if (completedSession.assessmentType === AssessmentType.BARC_10) {
        await calculateScore(completedSession.sessionId);
      }

      // Show completion message
      addMessage(
        'assistant',
        'Great job! We\'ve completed the assessment. Let me calculate your results...'
      );

      // Navigate to results screen
      setTimeout(() => {
        navigation.replace('AssessmentResults', {
          assessmentId: completedSession.sessionId,
          participantId,
          participantName,
        });
      }, 2000);
    } catch (error) {
      console.error('Error completing assessment:', error);
      Alert.alert('Error', 'Failed to complete assessment');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleVoiceInput = () => {
    // TODO: Implement voice input with AWS Transcribe
    Alert.alert('Voice Input', 'Voice input will be available in a future update');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Starting assessment...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {assessmentType === AssessmentType.BARC_10 ? 'BARC-10' : 'SUPRT-C'} Assessment
        </Text>
        <Text style={styles.participantName}>{participantName}</Text>
        {session && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              Question {session.currentQuestionIndex + 1} of {session.totalQuestions}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${
                      ((session.currentQuestionIndex + 1) / session.totalQuestions) * 100
                    }%`,
                  },
                ]}
              />
            </View>
          </View>
        )}
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.role === 'user' ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                message.role === 'user' ? styles.userText : styles.assistantText,
              ]}
            >
              {message.content}
            </Text>
            <Text
              style={[
                styles.messageTime,
                message.role === 'user' ? styles.userTime : styles.assistantTime,
              ]}
            >
              {message.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        ))}
        {isSending && (
          <View style={[styles.messageBubble, styles.assistantBubble]}>
            <ActivityIndicator size="small" color="#007AFF" />
          </View>
        )}
      </ScrollView>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.voiceButton} onPress={handleVoiceInput}>
          <Text style={styles.voiceButtonText}>🎤</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type your response..."
          multiline
          maxLength={500}
          editable={!isSending && !isCompleting}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!inputText.trim() || isSending || isCompleting}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  participantName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  progressContainer: {
    marginTop: 10,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8E8E8',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  assistantText: {
    color: '#333',
  },
  userText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  assistantTime: {
    color: '#999',
  },
  userTime: {
    color: '#FFFFFF',
    opacity: 0.8,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'flex-end',
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
  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCC',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
