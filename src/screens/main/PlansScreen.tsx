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
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';
import { processConversation, Message } from '../../modules/ai/novaService';
import { TrackedTextInput } from '../../components/TrackedTextInput';

interface RecoveryPlan {
  id: string;
  participant_id: string;
  created_date: string;
  overall_status: string;
  total_goals: number;
  completed_goals: number;
  in_progress_goals: number;
  participant?: {
    client_id: string;
    alias_nickname: string | null;
  };
}

interface Goal {
  id: string;
  plan_id: string;
  description: string;
  category: string;
  target_date: string | null;
  status: string;
  action_steps: any[];
  barriers_identified: string[];
  support_needed: string[];
}

interface Participant {
  id: string;
  client_id: string;
  alias_nickname: string | null;
}

const GOAL_CATEGORIES = [
  'Housing',
  'Employment',
  'Health',
  'Family',
  'Recovery',
  'Education',
  'Legal',
  'Other',
];

export const PlansScreen: React.FC = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<RecoveryPlan[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showGoalsListModal, setShowGoalsListModal] = useState(false);
  
  // New plan state
  const [selectedParticipant, setSelectedParticipant] = useState<string>('');
  
  // Goal conversation state
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedGoalData, setExtractedGoalData] = useState<any>(null);
  
  // Goals list state
  const [selectedPlanGoals, setSelectedPlanGoals] = useState<Goal[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load plans with goal counts
      const { data: plansData, error: plansError } = await supabase
        .from('active_recovery_plans')
        .select('*')
        .order('created_date', { ascending: false });

      if (plansError) throw plansError;

      // Filter by organization through participants
      const { data: orgParticipants, error: orgError } = await supabase
        .from('participants')
        .select('id')
        .eq('organization_id', user?.organizationId);

      if (orgError) throw orgError;

      const orgParticipantIds = orgParticipants.map((p) => p.id);
      const filteredPlans = (plansData || []).filter((p) =>
        orgParticipantIds.includes(p.participant_id)
      );

      // Get participant details
      const participantIds = filteredPlans.map((p) => p.participant_id);
      const { data: participantData, error: participantError } = await supabase
        .from('participants')
        .select('id, client_id, alias_nickname')
        .in('id', participantIds);

      if (participantError) throw participantError;

      // Merge participant data
      const plansWithParticipants = filteredPlans.map((plan) => ({
        ...plan,
        participant: participantData?.find((p) => p.id === plan.participant_id),
      }));

      setPlans(plansWithParticipants);

      // Load participants for new plan
      const { data: allParticipants, error: allParticipantsError } = await supabase
        .from('participants')
        .select('id, client_id, alias_nickname')
        .eq('organization_id', user?.organizationId)
        .eq('status', 'active')
        .order('alias_nickname');

      if (allParticipantsError) throw allParticipantsError;

      setParticipants(allParticipants || []);
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading plans');
      }
      Alert.alert('Error', 'Failed to load recovery plans');
    } finally {
      setIsLoading(false);
    }
  };

  const createNewPlan = async () => {
    if (!selectedParticipant) {
      Alert.alert('Error', 'Please select a participant');
      return;
    }

    try {
      setIsProcessing(true);

      // Check if participant already has an active plan
      const { data: existingPlan, error: checkError } = await supabase
        .from('recovery_plans')
        .select('id')
        .eq('participant_id', selectedParticipant)
        .eq('overall_status', 'active')
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingPlan) {
        Alert.alert(
          'Active Plan Exists',
          'This participant already has an active recovery plan. Would you like to add goals to it?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Add Goals',
              onPress: () => {
                setCurrentPlanId(existingPlan.id);
                setShowNewPlanModal(false);
                startGoalConversation();
              },
            },
          ]
        );
        return;
      }

      // Create new plan
      const { data, error } = await supabase
        .from('recovery_plans')
        .insert({
          participant_id: selectedParticipant,
          created_by: user?.id,
          overall_status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentPlanId(data.id);
      setShowNewPlanModal(false);
      Alert.alert('Success', 'Recovery plan created! Now let\'s add some goals.');
      startGoalConversation();
    } catch (error) {
      if (__DEV__) {
        console.error('Error creating plan');
      }
      Alert.alert('Error', 'Failed to create recovery plan');
    } finally {
      setIsProcessing(false);
    }
  };

  const startGoalConversation = () => {
    const systemMessage: Message = {
      role: 'assistant',
      content:
        "Hi! Let's create a SMART goal for this recovery plan. Tell me about a goal you'd like to work on. I'll help you make it Specific, Measurable, Achievable, Relevant, and Time-bound. What area would you like to focus on? (Housing, Employment, Health, Family, Recovery, Education, Legal, or Other)",
      timestamp: new Date(),
    };

    setConversationHistory([systemMessage]);
    setShowGoalModal(true);
  };

  const sendMessage = async () => {
    if (!userInput.trim() || !currentPlanId) return;

    try {
      setIsProcessing(true);

      // Add user message
      const userMessage: Message = {
        role: 'user',
        content: userInput.trim(),
        timestamp: new Date(),
      };

      const updatedHistory = [...conversationHistory, userMessage];
      setConversationHistory(updatedHistory);
      setUserInput('');

      // Process with Nova
      const response = await processConversation({
        text: userInput.trim(),
        mode: 'text',
        context: {
          currentModule: 'recovery_plans',
          currentSection: 'goal_setting',
          conversationHistory: updatedHistory,
          capabilities: ['goal-extraction', 'smart-goal-refinement'],
        },
      });

      // Add AI response
      const aiMessage: Message = {
        role: 'assistant',
        content: response.text,
        timestamp: new Date(),
      };

      const finalHistory = [...updatedHistory, aiMessage];
      setConversationHistory(finalHistory);

      // Extract goal data if available
      if (response.extractedData) {
        setExtractedGoalData(response.extractedData);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error processing message');
      }
      Alert.alert('Error', 'Failed to process message. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const saveGoal = async () => {
    if (!currentPlanId || !extractedGoalData) {
      Alert.alert('Error', 'Please complete the goal conversation first');
      return;
    }

    // Validate required fields
    if (!extractedGoalData.description || !extractedGoalData.description.trim()) {
      Alert.alert(
        'Missing Description',
        'Please provide a clear goal description before saving. Continue the conversation to refine your goal.'
      );
      return;
    }

    // Validate and sanitize fields
    const sanitizedCategory = GOAL_CATEGORIES.includes(extractedGoalData.category)
      ? extractedGoalData.category
      : 'Other';

    const sanitizedActionSteps = Array.isArray(extractedGoalData.action_steps)
      ? extractedGoalData.action_steps.filter((s: any) => typeof s === 'string' && s.trim())
      : [];

    const sanitizedBarriers = Array.isArray(extractedGoalData.barriers)
      ? extractedGoalData.barriers.filter((s: any) => typeof s === 'string' && s.trim())
      : [];

    const sanitizedSupport = Array.isArray(extractedGoalData.support)
      ? extractedGoalData.support.filter((s: any) => typeof s === 'string' && s.trim())
      : [];

    // Validate target_date
    let sanitizedTargetDate: string | null = null;
    if (extractedGoalData.target_date) {
      const date = new Date(extractedGoalData.target_date);
      if (!isNaN(date.getTime())) {
        sanitizedTargetDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
      }
    }

    try {
      setIsProcessing(true);

      const { error } = await supabase.from('goals').insert({
        plan_id: currentPlanId,
        description: extractedGoalData.description.trim(),
        category: sanitizedCategory,
        target_date: sanitizedTargetDate,
        status: 'Not Started',
        action_steps: sanitizedActionSteps,
        barriers_identified: sanitizedBarriers,
        support_needed: sanitizedSupport,
        created_by: user?.id,
      });

      if (error) throw error;

      Alert.alert('Success', 'Goal saved successfully!', [
        {
          text: 'Add Another Goal',
          onPress: () => {
            setConversationHistory([]);
            setExtractedGoalData(null);
            startGoalConversation();
          },
        },
        {
          text: 'Done',
          onPress: () => {
            setShowGoalModal(false);
            setCurrentPlanId(null);
            setConversationHistory([]);
            setExtractedGoalData(null);
            loadData();
          },
        },
      ]);
    } catch (error) {
      if (__DEV__) {
        console.error('Error saving goal');
      }
      Alert.alert('Error', 'Failed to save goal');
    } finally {
      setIsProcessing(false);
    }
  };

  const viewPlanGoals = async (planId: string) => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('plan_id', planId)
        .order('created_date', { ascending: false });

      if (error) throw error;

      setSelectedPlanGoals(data || []);
      setShowGoalsListModal(true);
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading goals');
      }
      Alert.alert('Error', 'Failed to load goals');
    } finally {
      setIsLoading(false);
    }
  };

  const updateGoalStatus = async (goalId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('goals')
        .update({ status: newStatus })
        .eq('id', goalId);

      if (error) throw error;

      // Refresh goals list
      if (currentPlanId) {
        viewPlanGoals(currentPlanId);
      }
      loadData();
    } catch (error) {
      if (__DEV__) {
        console.error('Error updating goal status');
      }
      Alert.alert('Error', 'Failed to update goal status');
    }
  };

  const renderPlan = ({ item }: { item: RecoveryPlan }) => (
    <TouchableOpacity
      style={styles.planCard}
      onPress={() => {
        setCurrentPlanId(item.id);
        viewPlanGoals(item.id);
      }}
    >
      <View style={styles.planHeader}>
        <Text style={styles.participantName}>
          {item.participant?.alias_nickname || item.participant?.client_id}
        </Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{item.overall_status}</Text>
        </View>
      </View>
      <Text style={styles.planDate}>
        Created: {new Date(item.created_date).toLocaleDateString()}
      </Text>
      <View style={styles.goalStats}>
        <Text style={styles.statText}>
          Total Goals: {item.total_goals || 0}
        </Text>
        <Text style={styles.statText}>
          Completed: {item.completed_goals || 0}
        </Text>
        <Text style={styles.statText}>
          In Progress: {item.in_progress_goals || 0}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.addGoalButton}
        onPress={(e) => {
          e.stopPropagation();
          setCurrentPlanId(item.id);
          startGoalConversation();
        }}
      >
        <Text style={styles.addGoalButtonText}>+ Add Goal</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderGoal = ({ item }: { item: Goal }) => (
    <View style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <Text style={styles.goalCategory}>{item.category}</Text>
        <View
          style={[
            styles.goalStatusBadge,
            item.status === 'Completed' && styles.goalStatusCompleted,
            item.status === 'In Progress' && styles.goalStatusInProgress,
            item.status === 'Not Started' && styles.goalStatusNotStarted,
          ]}
        >
          <Text style={styles.goalStatusText}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.goalDescription}>{item.description}</Text>
      {item.target_date && (
        <Text style={styles.goalDate}>
          Target: {new Date(item.target_date).toLocaleDateString()}
        </Text>
      )}
      <View style={styles.goalActions}>
        <TouchableOpacity
          style={styles.statusButton}
          onPress={() => {
            Alert.alert('Update Status', 'Select new status:', [
              {
                text: 'Not Started',
                onPress: () => updateGoalStatus(item.id, 'Not Started'),
              },
              {
                text: 'In Progress',
                onPress: () => updateGoalStatus(item.id, 'In Progress'),
              },
              {
                text: 'Completed',
                onPress: () => updateGoalStatus(item.id, 'Completed'),
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
        >
          <Text style={styles.statusButtonText}>Update Status</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No Recovery Plans Yet</Text>
      <Text style={styles.emptyStateText}>
        Create your first recovery plan to start tracking goals
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Recovery Plans</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowNewPlanModal(true)}
        >
          <Text style={styles.addButtonText}>+ New Plan</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading plans...</Text>
        </View>
      ) : (
        <FlatList
          data={plans}
          renderItem={renderPlan}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {/* New Plan Modal */}
      <Modal
        visible={showNewPlanModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowNewPlanModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Recovery Plan</Text>
            <TouchableOpacity onPress={() => setShowNewPlanModal(false)}>
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
          </ScrollView>

          <TouchableOpacity
            style={[styles.submitButton, isProcessing && styles.submitButtonDisabled]}
            onPress={createNewPlan}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Create Plan</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Goal Conversation Modal */}
      <Modal
        visible={showGoalModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowGoalModal(false)}
      >
        <View style={styles.conversationContainer}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationTitle}>Create SMART Goal</Text>
            <View style={styles.conversationActions}>
              {extractedGoalData && (
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={saveGoal}
                  disabled={isProcessing}
                >
                  <Text style={styles.saveButtonText}>Save Goal</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setShowGoalModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

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

      {/* Goals List Modal */}
      <Modal
        visible={showGoalsListModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowGoalsListModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Goals</Text>
            <TouchableOpacity onPress={() => setShowGoalsListModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={selectedPlanGoals}
            renderItem={renderGoal}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No goals yet</Text>
              </View>
            }
          />
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
  planCard: {
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
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  participantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#e8f5e9',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  planDate: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
  },
  goalStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statText: {
    fontSize: 14,
    color: '#666',
  },
  addGoalButton: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  addGoalButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
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
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  goalCard: {
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
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  goalStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  goalStatusCompleted: {
    backgroundColor: '#e8f5e9',
  },
  goalStatusInProgress: {
    backgroundColor: '#fff3e0',
  },
  goalStatusNotStarted: {
    backgroundColor: '#f5f5f5',
  },
  goalStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  goalDescription: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  goalDate: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
  },
  goalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  statusButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
