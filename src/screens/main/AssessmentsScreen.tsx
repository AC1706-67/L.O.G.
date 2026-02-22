import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';
import {
  processConversation,
  detectCrisis,
  Message,
  CrisisAssessment,
} from '../../modules/ai/novaService';
import { TrackedTextInput } from '../../components/TrackedTextInput';

interface Assessment {
  id: string;
  participant_id: string;
  assessment_type: 'SUPRT_C' | 'BARC_10' | 'SSM';
  started_at: string;
  completed_at: string | null;
  is_complete: boolean;
  total_score: number | null;
  participant?: {
    client_id: string;
    alias_nickname: string | null;
  };
}

interface Participant {
  id: string;
  client_id: string;
  alias_nickname: string | null;
}

const ASSESSMENT_TYPES = [
  { value: 'BARC_10', label: 'BARC-10 (Brief Assessment of Recovery Capital)' },
  { value: 'SUPRT_C', label: 'SUPRT-C (Substance Use Recovery Tracker)' },
  { value: 'SSM', label: 'SSM (Stages of Substance Use Recovery)' },
];

export const AssessmentsScreen: React.FC = () => {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showConversationModal, setShowConversationModal] = useState(false);
  
  // New assessment state
  const [selectedParticipant, setSelectedParticipant] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('BARC_10');
  
  // Conversation state
  const [currentAssessmentId, setCurrentAssessmentId] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [crisisDetected, setCrisisDetected] = useState<CrisisAssessment | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load assessments
      const { data: assessmentsData, error: assessmentsError } = await supabase
        .from('assessments')
        .select(`
          id,
          participant_id,
          assessment_type,
          started_at,
          completed_at,
          is_complete,
          total_score,
          participants!inner(client_id, alias_nickname, organization_id)
        `)
        .eq('participants.organization_id', user?.organizationId)
        .order('started_at', { ascending: false })
        .limit(50);

      if (assessmentsError) throw assessmentsError;

      // Transform data
      const transformed = (assessmentsData || []).map((a: any) => ({
        id: a.id,
        participant_id: a.participant_id,
        assessment_type: a.assessment_type,
        started_at: a.started_at,
        completed_at: a.completed_at,
        is_complete: a.is_complete,
        total_score: a.total_score,
        participant: {
          client_id: a.participants.client_id,
          alias_nickname: a.participants.alias_nickname,
        },
      }));

      setAssessments(transformed);

      // Load participants for new assessment
      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select('id, client_id, alias_nickname')
        .eq('organization_id', user?.organizationId)
        .eq('status', 'active')
        .order('alias_nickname');

      if (participantsError) throw participantsError;

      setParticipants(participantsData || []);
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading assessments');
      }
      Alert.alert('Error', 'Failed to load assessments');
    } finally {
      setIsLoading(false);
    }
  };

  const startNewAssessment = async () => {
    if (!selectedParticipant) {
      Alert.alert('Error', 'Please select a participant');
      return;
    }

    try {
      setIsProcessing(true);

      // Create assessment record
      const { data, error } = await supabase
        .from('assessments')
        .insert({
          participant_id: selectedParticipant,
          assessment_type: selectedType,
          conducted_by: user?.id,
          responses: {},
          conversation_transcript: '',
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentAssessmentId(data.id);
      
      // Initialize conversation with system message
      const systemMessage: Message = {
        role: 'assistant',
        content: getAssessmentIntroduction(selectedType as any),
        timestamp: new Date(),
      };

      setConversationHistory([systemMessage]);
      setShowNewModal(false);
      setShowConversationModal(true);
    } catch (error) {
      if (__DEV__) {
        console.error('Error starting assessment');
      }
      Alert.alert('Error', 'Failed to start assessment');
    } finally {
      setIsProcessing(false);
    }
  };

  const getAssessmentIntroduction = (type: 'BARC_10' | 'SUPRT_C' | 'SSM'): string => {
    switch (type) {
      case 'BARC_10':
        return "Hi! I'll be conducting a BARC-10 assessment with you today. This helps us understand your recovery capital - the resources and support you have. I'll ask you 10 questions, and you can answer in your own words. Ready to begin?";
      case 'SUPRT_C':
        return "Hello! Today we'll complete the SUPRT-C assessment together. This helps track your recovery journey and identify areas where you might need support. Feel free to answer naturally - I'll guide you through the questions.";
      case 'SSM':
        return "Hi there! We'll be doing an SSM assessment to understand what stage of recovery you're in. This helps us tailor support to where you are in your journey. Let's have a conversation about how things are going.";
    }
  };

  const sendMessage = async () => {
    if (!userInput.trim() || !currentAssessmentId) return;

    try {
      setIsProcessing(true);

      // Add user message to history
      const userMessage: Message = {
        role: 'user',
        content: userInput.trim(),
        timestamp: new Date(),
      };

      const updatedHistory = [...conversationHistory, userMessage];
      setConversationHistory(updatedHistory);
      setUserInput('');

      // Process conversation with Nova
      const response = await processConversation({
        text: userInput.trim(),
        mode: 'text',
        context: {
          currentModule: 'assessments',
          currentSection: selectedType,
          conversationHistory: updatedHistory,
          capabilities: ['conversational-assessment'],
        },
      });

      // Add AI response to history
      const aiMessage: Message = {
        role: 'assistant',
        content: response.text,
        timestamp: new Date(),
      };

      const finalHistory = [...updatedHistory, aiMessage];
      setConversationHistory(finalHistory);

      // CRITICAL: Detect crisis on EVERY AI response
      const crisis = await detectCrisis(finalHistory);
      
      if (crisis.isCrisis && (crisis.riskLevel === 'immediate' || crisis.riskLevel === 'high')) {
        setCrisisDetected(crisis);
        
        // Persist crisis detection immediately
        await supabase
          .from('assessments')
          .update({
            crisis_detected: true,
            crisis_risk_level: crisis.riskLevel,
            crisis_indicators: crisis.indicators,
            crisis_actions_shown_at: new Date().toISOString(),
          })
          .eq('id', currentAssessmentId);
        
        // Show crisis UI immediately
        showCrisisAlert(crisis);
      }

      // Minimize transcript: save only last 20 turns, exclude system prompts
      const minimizedTranscript = finalHistory
        .filter((msg) => msg.role !== 'system')
        .slice(-20);

      // Save conversation to database
      await supabase
        .from('assessments')
        .update({
          conversation_transcript: JSON.stringify(minimizedTranscript),
          responses: response.extractedData || {},
        })
        .eq('id', currentAssessmentId);

    } catch (error) {
      if (__DEV__) {
        console.error('Error processing message');
      }
      Alert.alert('Error', 'Failed to process message. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const showCrisisAlert = (crisis: CrisisAssessment) => {
    Alert.alert(
      '⚠️ Crisis Detected',
      `Risk Level: ${crisis.riskLevel.toUpperCase()}\n\nIndicators:\n${crisis.indicators.join('\n')}\n\nRecommended Actions:\n${crisis.recommendedActions.join('\n')}`,
      [
        {
          text: 'Call 988 Crisis Line',
          onPress: async () => {
            try {
              const canOpen = await Linking.canOpenURL('tel:988');
              if (canOpen) {
                await Linking.openURL('tel:988');
                // Record that crisis line was called
                await recordCrisisAcknowledgment();
              } else {
                Alert.alert('Crisis Line', '988 - Suicide & Crisis Lifeline\n\nPlease dial manually if automatic dialing is not available.');
              }
            } catch (error) {
              if (__DEV__) {
                console.error('Error opening dialer');
              }
              Alert.alert('Crisis Line', '988 - Suicide & Crisis Lifeline');
            }
          },
        },
        {
          text: 'Continue Assessment',
          style: 'cancel',
          onPress: async () => {
            await recordCrisisAcknowledgment();
          },
        },
      ]
    );
  };

  const recordCrisisAcknowledgment = async () => {
    if (!currentAssessmentId || !crisisDetected) return;

    try {
      await supabase
        .from('assessments')
        .update({
          crisis_detected: true,
          crisis_risk_level: crisisDetected.riskLevel,
          crisis_indicators: crisisDetected.indicators,
          crisis_acknowledged_at: new Date().toISOString(),
        })
        .eq('id', currentAssessmentId);
    } catch (error) {
      if (__DEV__) {
        console.error('Error recording crisis acknowledgment');
      }
    }
  };

  const completeAssessment = async () => {
    if (!currentAssessmentId) return;

    Alert.alert(
      'Complete Assessment',
      'Are you sure you want to complete this assessment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              setIsProcessing(true);

              await supabase
                .from('assessments')
                .update({
                  is_complete: true,
                  completed_at: new Date().toISOString(),
                })
                .eq('id', currentAssessmentId);

              Alert.alert('Success', 'Assessment completed successfully');
              setShowConversationModal(false);
              setCurrentAssessmentId(null);
              setConversationHistory([]);
              setCrisisDetected(null);
              loadData();
            } catch (error) {
              if (__DEV__) {
                console.error('Error completing assessment');
              }
              Alert.alert('Error', 'Failed to complete assessment');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const renderAssessment = ({ item }: { item: Assessment }) => (
    <TouchableOpacity style={styles.assessmentCard}>
      <View style={styles.assessmentHeader}>
        <Text style={styles.assessmentType}>{item.assessment_type}</Text>
        <View
          style={[
            styles.statusBadge,
            item.is_complete ? styles.statusComplete : styles.statusInProgress,
          ]}
        >
          <Text style={styles.statusText}>
            {item.is_complete ? 'Complete' : 'In Progress'}
          </Text>
        </View>
      </View>
      <Text style={styles.participantName}>
        {item.participant?.alias_nickname || item.participant?.client_id}
      </Text>
      <Text style={styles.assessmentDate}>
        Started: {new Date(item.started_at).toLocaleDateString()}
      </Text>
      {item.is_complete && item.completed_at && (
        <Text style={styles.assessmentDate}>
          Completed: {new Date(item.completed_at).toLocaleDateString()}
        </Text>
      )}
      {item.total_score !== null && (
        <Text style={styles.score}>Score: {item.total_score}</Text>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No Assessments Yet</Text>
      <Text style={styles.emptyStateText}>
        Start your first assessment to track participant progress
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Assessments</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowNewModal(true)}
        >
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading assessments...</Text>
        </View>
      ) : (
        <FlatList
          data={assessments}
          renderItem={renderAssessment}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {/* New Assessment Modal */}
      <Modal
        visible={showNewModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowNewModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Assessment</Text>
            <TouchableOpacity onPress={() => setShowNewModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Select Participant</Text>
            {participants.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.optionButton,
                  selectedParticipant === p.id && styles.optionButtonSelected,
                ]}
                onPress={() => setSelectedParticipant(p.id)}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedParticipant === p.id && styles.optionTextSelected,
                  ]}
                >
                  {p.alias_nickname || p.client_id}
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={[styles.label, styles.labelSpaced]}>Assessment Type</Text>
            {ASSESSMENT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.optionButton,
                  selectedType === type.value && styles.optionButtonSelected,
                ]}
                onPress={() => setSelectedType(type.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedType === type.value && styles.optionTextSelected,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.submitButton, isProcessing && styles.submitButtonDisabled]}
            onPress={startNewAssessment}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Start Assessment</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Conversation Modal */}
      <Modal
        visible={showConversationModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowConversationModal(false)}
      >
        <View style={styles.conversationContainer}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationTitle}>Assessment in Progress</Text>
            <View style={styles.conversationActions}>
              <TouchableOpacity
                style={styles.completeButton}
                onPress={completeAssessment}
                disabled={isProcessing}
              >
                <Text style={styles.completeButtonText}>Complete</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowConversationModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Crisis Banner */}
          {crisisDetected && (
            <View style={styles.crisisBanner}>
              <Text style={styles.crisisText}>
                ⚠️ Crisis Detected - Risk Level: {crisisDetected.riskLevel.toUpperCase()}
              </Text>
            </View>
          )}

          {/* Messages */}
          <ScrollView style={styles.messagesContainer}>
            {conversationHistory.map((msg, index) => (
              <View
                key={index}
                style={[
                  styles.messageBubble,
                  msg.role === 'user' ? styles.userBubble : styles.aiBubble,
                ]}
              >
                <Text style={styles.messageText}>{msg.content}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Input */}
          <View style={styles.inputContainer}>
            <TrackedTextInput
              style={styles.messageInput}
              value={userInput}
              onChangeText={setUserInput}
              placeholder="Type your response..."
              multiline
              editable={!isProcessing}
            />
            <TouchableOpacity
              style={[styles.sendButton, isProcessing && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={isProcessing || !userInput.trim()}
            >
              <Text style={styles.sendButtonText}>
                {isProcessing ? '...' : 'Send'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    padding: 16,
  },
  assessmentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  assessmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  assessmentType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusComplete: {
    backgroundColor: '#e8f5e9',
  },
  statusInProgress: {
    backgroundColor: '#fff3e0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  participantName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  assessmentDate: {
    fontSize: 14,
    color: '#999',
    marginBottom: 2,
  },
  score: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 8,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 28,
    color: '#666',
  },
  modalContent: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  labelSpaced: {
    marginTop: 24,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  optionButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#e3f2fd',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  optionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  conversationContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  conversationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  conversationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  completeButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  crisisBanner: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ef5350',
  },
  crisisText: {
    color: '#c62828',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'flex-end',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
