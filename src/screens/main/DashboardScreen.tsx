import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';
import { processConversation } from '../../modules/ai/novaService';
import { TrackedTextInput } from '../../components/TrackedTextInput';

interface DashboardStats {
  totalParticipants: number;
  activeParticipants: number;
  pendingAssessments: number;
  upcomingFollowUps: number;
  recentInteractions: number;
}

interface QueryResult {
  type: 'participants' | 'stats' | 'text';
  data: any;
  message: string;
}

export const DashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalParticipants: 0,
    activeParticipants: 0,
    pendingAssessments: 0,
    upcomingFollowUps: 0,
    recentInteractions: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [query, setQuery] = useState('');
  const [isProcessingQuery, setIsProcessingQuery] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setIsLoadingStats(true);

      // Get total participants
      const { count: totalCount } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', user?.organizationId);

      // Get active participants (had interaction in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Join through participants to filter by organization
      const { data: activeInteractions } = await supabase
        .from('interactions')
        .select('participant_id, participants!inner(organization_id)')
        .gte('interaction_date', thirtyDaysAgo.toISOString().split('T')[0])
        .eq('participants.organization_id', user?.organizationId);

      // Count unique participants
      const uniqueParticipants = new Set(activeInteractions?.map(i => i.participant_id) || []);
      const activeCount = uniqueParticipants.size;

      // Get pending assessments
      const { count: pendingAssessments } = await supabase
        .from('assessments')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', user?.organizationId)
        .eq('status', 'in_progress');

      // Get upcoming follow-ups (next 7 days)
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const today = new Date().toISOString().split('T')[0];
      const futureDate = sevenDaysFromNow.toISOString().split('T')[0];
      
      const { data: followUps } = await supabase
        .from('interactions')
        .select('id, participants!inner(organization_id)')
        .eq('participants.organization_id', user?.organizationId)
        .eq('follow_up_needed', true)
        .not('follow_up_date', 'is', null)
        .gte('follow_up_date', today)
        .lte('follow_up_date', futureDate);

      const followUpsCount = followUps?.length || 0;

      // Get recent interactions (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: recentInteractions } = await supabase
        .from('interactions')
        .select('id, participants!inner(organization_id)')
        .eq('participants.organization_id', user?.organizationId)
        .gte('interaction_date', sevenDaysAgo.toISOString().split('T')[0]);

      const recentCount = recentInteractions?.length || 0;

      setStats({
        totalParticipants: totalCount || 0,
        activeParticipants: activeCount || 0,
        pendingAssessments: pendingAssessments || 0,
        upcomingFollowUps: followUpsCount || 0,
        recentInteractions: recentCount || 0,
      });
    } catch (error) {
      // Don't log error details - may contain PHI
      if (__DEV__) {
        console.error('Error loading dashboard stats:', error);
      }
      Alert.alert('Error', 'Failed to load dashboard statistics');
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleNaturalLanguageQuery = async () => {
    if (!query.trim()) {
      Alert.alert('Error', 'Please enter a query');
      return;
    }

    try {
      setIsProcessingQuery(true);
      setQueryResult(null);

      // Use Nova AI to process the natural language query
      // IMPORTANT: Nova is READ-ONLY - it cannot modify data
      const result = await processConversation({
        text: query,
        mode: 'text',
        context: {
          currentModule: 'query',
          currentSection: 'dashboard',
          previousMessages: [],
          extractedData: {
            organizationId: user?.organizationId,
            userId: user?.id,
            // Explicitly tell AI it's read-only
            capabilities: 'read-only-query',
            allowedActions: ['view', 'count', 'list', 'show'],
            prohibitedActions: ['update', 'delete', 'modify', 'change', 'create'],
          },
        },
      });

      // Parse the AI response to determine query intent
      const intent = await parseQueryIntent(query, result.response);

      // Execute the appropriate database query based on intent
      const queryData = await executeQuery(intent);

      setQueryResult({
        type: intent.type,
        data: queryData,
        message: result.response,
      });
    } catch (error) {
      // Don't log query or error details - may contain PHI
      if (__DEV__) {
        console.error('Error processing query');
      }
      Alert.alert('Error', 'Failed to process your query. Please try again.');
    } finally {
      setIsProcessingQuery(false);
    }
  };

  // Allowlist of safe query intents - prevents SQL injection and unauthorized queries
  const ALLOWED_QUERY_TYPES = ['participants', 'stats', 'text'] as const;
  const ALLOWED_FILTERS = ['needsFollowUp', 'active', 'recent', 'housingUnstable', 'highRisk'] as const;
  const ALLOWED_METRICS = ['participants', 'assessments', 'interactions', 'general'] as const;

  const parseQueryIntent = async (query: string, aiResponse: string): Promise<any> => {
    const lowerQuery = query.toLowerCase();

    // Detect query type based on keywords - NEVER let AI generate SQL
    let queryType: typeof ALLOWED_QUERY_TYPES[number] = 'text';
    
    if (
      lowerQuery.includes('participant') ||
      lowerQuery.includes('client') ||
      lowerQuery.includes('who') ||
      lowerQuery.includes('list') ||
      lowerQuery.includes('show me')
    ) {
      queryType = 'participants';
    } else if (
      lowerQuery.includes('how many') ||
      lowerQuery.includes('count') ||
      lowerQuery.includes('total') ||
      lowerQuery.includes('number')
    ) {
      queryType = 'stats';
    }

    // Validate query type is in allowlist
    if (!ALLOWED_QUERY_TYPES.includes(queryType)) {
      queryType = 'text';
    }

    return {
      type: queryType,
      filters: queryType === 'participants' ? extractFilters(lowerQuery) : undefined,
      metric: queryType === 'stats' ? extractMetric(lowerQuery) : undefined,
    };
  };

  const extractFilters = (query: string): any => {
    const filters: any = {};

    // Only allow predefined filters - NEVER dynamic filter generation
    if (query.includes('need') && query.includes('follow')) {
      filters.needsFollowUp = true;
    }

    if (query.includes('active')) {
      filters.active = true;
    }

    if (query.includes('recent')) {
      filters.recent = true;
    }

    if (query.includes('housing') || query.includes('unstable')) {
      filters.housingUnstable = true;
    }

    if (query.includes('crisis') || query.includes('risk')) {
      filters.highRisk = true;
    }

    // Validate all filters are in allowlist
    const validFilters: any = {};
    for (const [key, value] of Object.entries(filters)) {
      if (ALLOWED_FILTERS.includes(key as any)) {
        validFilters[key] = value;
      }
    }

    return validFilters;
  };

  const extractMetric = (query: string): string => {
    let metric = 'general';
    
    if (query.includes('participant') || query.includes('client')) {
      metric = 'participants';
    } else if (query.includes('assessment')) {
      metric = 'assessments';
    } else if (query.includes('interaction')) {
      metric = 'interactions';
    }

    // Validate metric is in allowlist
    if (!ALLOWED_METRICS.includes(metric as any)) {
      metric = 'general';
    }

    return metric;
  };

  const executeQuery = async (intent: any): Promise<any> => {
    if (intent.type === 'participants') {
      return await queryParticipants(intent.filters);
    }

    if (intent.type === 'stats') {
      return await queryStats(intent.metric);
    }

    return { text: intent.response };
  };

  const queryParticipants = async (filters: any): Promise<any> => {
    let query = supabase
      .from('participants')
      .select('id, client_id, alias_nickname, created_at')
      .eq('organization_id', user?.organizationId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (filters.needsFollowUp) {
      // Get participants with upcoming follow-ups
      const { data: followUps } = await supabase
        .from('interactions')
        .select('participant_id')
        .eq('organization_id', user?.organizationId)
        .not('follow_up_date', 'is', null)
        .lte('follow_up_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

      const participantIds = followUps?.map(f => f.participant_id) || [];
      query = query.in('id', participantIds);
    }

    if (filters.active) {
      // Get participants with recent interactions
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentInteractions } = await supabase
        .from('interactions')
        .select('participant_id')
        .eq('organization_id', user?.organizationId)
        .gte('interaction_date', thirtyDaysAgo.toISOString());

      const participantIds = recentInteractions?.map(i => i.participant_id) || [];
      query = query.in('id', participantIds);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      participants: data || [],
      count: data?.length || 0,
      filters: filters,
    };
  };

  const queryStats = async (metric: string): Promise<any> => {
    // Return current stats based on metric
    switch (metric) {
      case 'participants':
        return {
          total: stats.totalParticipants,
          active: stats.activeParticipants,
        };
      case 'assessments':
        return {
          pending: stats.pendingAssessments,
        };
      case 'interactions':
        return {
          recent: stats.recentInteractions,
        };
      default:
        return stats;
    }
  };

  const renderQueryResult = () => {
    if (!queryResult) return null;

    if (queryResult.type === 'participants') {
      const { participants, count } = queryResult.data;
      
      if (count === 0) {
        return (
          <View style={styles.resultContainer}>
            <Text style={styles.emptyStateTitle}>No Results Found</Text>
            <Text style={styles.emptyStateText}>
              No participants match your query. Try adjusting your search criteria.
            </Text>
          </View>
        );
      }
      
      return (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Found {count} participants</Text>
          {participants.map((p: any) => (
            <View key={p.id} style={styles.participantCard}>
              <Text style={styles.participantName}>
                {p.alias_nickname || p.client_id}
              </Text>
              <Text style={styles.participantId}>ID: {p.client_id}</Text>
            </View>
          ))}
        </View>
      );
    }

    if (queryResult.type === 'stats') {
      return (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Statistics</Text>
          {Object.entries(queryResult.data).map(([key, value]) => (
            <View key={key} style={styles.statRow}>
              <Text style={styles.statLabel}>{key}:</Text>
              <Text style={styles.statValue}>{String(value)}</Text>
            </View>
          ))}
        </View>
      );
    }

    return (
      <View style={styles.resultContainer}>
        <Text style={styles.resultText}>{queryResult.message}</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>
          Welcome back, {user?.firstName} {user?.lastName}
        </Text>
      </View>

      {/* Stats Cards */}
      {isLoadingStats ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading statistics...</Text>
        </View>
      ) : stats.totalParticipants === 0 ? (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyStateTitle}>No Data Yet</Text>
          <Text style={styles.emptyStateText}>
            Start by adding participants to see your dashboard statistics.
          </Text>
          <TouchableOpacity style={styles.emptyStateButton}>
            <Text style={styles.emptyStateButtonText}>Add First Participant</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalParticipants}</Text>
            <Text style={styles.statLabel}>Total Participants</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.activeParticipants}</Text>
            <Text style={styles.statLabel}>Active (30 days)</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.pendingAssessments}</Text>
            <Text style={styles.statLabel}>Pending Assessments</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.upcomingFollowUps}</Text>
            <Text style={styles.statLabel}>Follow-ups (7 days)</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.recentInteractions}</Text>
            <Text style={styles.statLabel}>Recent Interactions</Text>
          </View>
        </View>
      )}

      {/* Natural Language Query */}
      <View style={styles.querySection}>
        <Text style={styles.sectionTitle}>Ask a Question</Text>
        <Text style={styles.sectionSubtitle}>
          Try: "Show participants needing follow-up" or "How many active participants?"
        </Text>

        <TrackedTextInput
          style={styles.queryInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Ask about your participants, assessments, or stats..."
          multiline
          numberOfLines={3}
          editable={!isProcessingQuery}
        />

        <TouchableOpacity
          style={[styles.queryButton, isProcessingQuery && styles.queryButtonDisabled]}
          onPress={handleNaturalLanguageQuery}
          disabled={isProcessingQuery}
        >
          {isProcessingQuery ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.queryButtonText}>Ask Nova AI</Text>
          )}
        </TouchableOpacity>

        {renderQueryResult()}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Add Participant</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Log Interaction</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Start Assessment</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '47%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  querySection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  queryInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  queryButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  queryButtonDisabled: {
    backgroundColor: '#ccc',
  },
  queryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  resultText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  participantCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  participantId: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  quickActions: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButton: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'center',
  },
  emptyStateContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  emptyStateButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
