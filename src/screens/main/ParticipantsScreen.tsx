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
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';
import { extractStructuredData } from '../../modules/ai/novaService';
import { TrackedTextInput } from '../../components/TrackedTextInput';

interface Participant {
  id: string;
  client_id: string;
  alias_nickname: string | null;
  status: string;
  created_at: string;
}

// Allowlists for validation
const HOUSING_STABILITY_ALLOWLIST = ['stable', 'unstable', 'homeless', 'transitional', 'unknown'] as const;
const MAT_TYPE_ALLOWLIST = ['buprenorphine', 'methadone', 'naltrexone', 'none', 'unknown'] as const;

// Schema for Nova AI extraction
const PARTICIPANT_SCHEMA = {
  fields: {
    alias_nickname: {
      type: 'string',
      description: 'Participant nickname or alias',
      required: true,
    },
    age: {
      type: 'number',
      description: 'Participant age in years',
      required: false,
    },
    housing_stability: {
      type: 'string',
      description: 'Housing status: stable, unstable, homeless, transitional, or unknown',
      required: false,
    },
    substances_used: {
      type: 'array',
      description: 'List of substances used (comma-separated)',
      required: false,
    },
    mat_type: {
      type: 'string',
      description: 'Medication-assisted treatment type: buprenorphine, methadone, naltrexone, none, or unknown',
      required: false,
    },
  },
};

export const ParticipantsScreen: React.FC = () => {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [filteredParticipants, setFilteredParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadParticipants();
  }, []);

  useEffect(() => {
    filterParticipants();
  }, [searchQuery, participants]);

  const loadParticipants = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('participants')
        .select('id, client_id, alias_nickname, status, created_at')
        .eq('organization_id', user?.organizationId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setParticipants(data || []);
      setFilteredParticipants(data || []);
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading participants');
      }
      Alert.alert('Error', 'Failed to load participants');
    } finally {
      setIsLoading(false);
    }
  };

  const filterParticipants = () => {
    if (!searchQuery.trim()) {
      setFilteredParticipants(participants);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = participants.filter(
      (p) =>
        p.client_id.toLowerCase().includes(query) ||
        p.alias_nickname?.toLowerCase().includes(query) ||
        p.status.toLowerCase().includes(query)
    );

    setFilteredParticipants(filtered);
  };

  // Sanitization and validation helpers
  const sanitizeAge = (age: any): number | null => {
    const parsed = parseInt(age, 10);
    if (isNaN(parsed) || parsed < 0 || parsed > 120) return null;
    return parsed;
  };

  const sanitizeHousingStability = (value: any): string => {
    const normalized = String(value || '').toLowerCase().trim();
    return HOUSING_STABILITY_ALLOWLIST.includes(normalized as any) ? normalized : 'unknown';
  };

  const sanitizeSubstancesUsed = (value: any): string[] => {
    if (Array.isArray(value)) {
      return value
        .map((s) => String(s).trim().toLowerCase())
        .filter((s) => s.length > 0);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0);
    }
    return [];
  };

  const sanitizeMatType = (value: any): string | null => {
    const normalized = String(value || '').toLowerCase().trim();
    return MAT_TYPE_ALLOWLIST.includes(normalized as any) ? normalized : null;
  };

  const handleAddWithNaturalLanguage = async () => {
    if (!naturalLanguageInput.trim()) {
      Alert.alert('Error', 'Please enter participant information');
      return;
    }

    try {
      setIsProcessing(true);

      // Use Nova AI to extract structured data
      const extracted = await extractStructuredData(
        naturalLanguageInput,
        PARTICIPANT_SCHEMA
      );

      // Validate required fields
      if (!extracted.fields.alias_nickname || !extracted.fields.alias_nickname.trim()) {
        Alert.alert(
          'Missing Information',
          'Could not extract participant name. Please provide at least a nickname or alias.'
        );
        return;
      }

      // Sanitize and validate all fields
      const sanitizedAge = sanitizeAge(extracted.fields.age);
      const sanitizedHousing = sanitizeHousingStability(extracted.fields.housing_stability);
      const sanitizedSubstances = sanitizeSubstancesUsed(extracted.fields.substances_used);
      const sanitizedMatType = sanitizeMatType(extracted.fields.mat_type);

      // Generate client_id
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const client_id = `P${timestamp}${random}`;

      // Calculate approximate date of birth from age if provided
      let dob_encrypted: string | null = null;
      if (sanitizedAge !== null) {
        const birthYear = new Date().getFullYear() - sanitizedAge;
        dob_encrypted = `${birthYear}-01-01`; // Approximate DOB
      }

      // Insert participant - organization_id will be enforced by RLS
      // We still pass it for explicit clarity, but RLS prevents spoofing
      const { data, error } = await supabase
        .from('participants')
        .insert({
          organization_id: user?.organizationId,
          client_id,
          first_name_encrypted: 'UNKNOWN', // Required by NOT NULL constraint
          last_name_encrypted: 'UNKNOWN',   // Required by NOT NULL constraint
          date_of_birth_encrypted: dob_encrypted || 'UNKNOWN', // Required by NOT NULL constraint
          alias_nickname: extracted.fields.alias_nickname.trim(),
          housing_stability: sanitizedHousing,
          substances_used: sanitizedSubstances,
          mat_status: sanitizedMatType !== null && sanitizedMatType !== 'none' && sanitizedMatType !== 'unknown',
          mat_type: sanitizedMatType,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      Alert.alert('Success', `Participant ${client_id} added successfully`);
      setShowAddModal(false);
      setNaturalLanguageInput('');
      loadParticipants();
    } catch (error) {
      if (__DEV__) {
        console.error('Error adding participant');
      }
      Alert.alert('Error', 'Failed to add participant. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderParticipant = ({ item }: { item: Participant }) => (
    <TouchableOpacity style={styles.participantCard}>
      <View style={styles.participantHeader}>
        <Text style={styles.participantName}>
          {item.alias_nickname || item.client_id}
        </Text>
        <View
          style={[
            styles.statusBadge,
            item.status === 'active' ? styles.statusActive : styles.statusInactive,
          ]}
        >
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.participantId}>ID: {item.client_id}</Text>
      <Text style={styles.participantDate}>
        Added: {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No Participants Found</Text>
      <Text style={styles.emptyStateText}>
        {searchQuery
          ? 'Try adjusting your search criteria'
          : 'Add your first participant to get started'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Participants</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TrackedTextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name or ID..."
          editable={!isLoading}
        />
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading participants...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredParticipants}
          renderItem={renderParticipant}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {/* Add Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Participant</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>
            Describe the participant in natural language
          </Text>
          <Text style={styles.modalExample}>
            Example: "John D, 32, housing unstable, on bupe"
          </Text>

          <TrackedTextInput
            style={styles.modalInput}
            value={naturalLanguageInput}
            onChangeText={setNaturalLanguageInput}
            placeholder="Enter participant details..."
            multiline
            numberOfLines={6}
            editable={!isProcessing}
          />

          <TouchableOpacity
            style={[styles.submitButton, isProcessing && styles.submitButtonDisabled]}
            onPress={handleAddWithNaturalLanguage}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Add Participant</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.modalNote}>
            Nova AI will extract structured data from your description
          </Text>
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
  searchContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
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
  participantCard: {
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
  participantHeader: {
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
  },
  statusActive: {
    backgroundColor: '#e8f5e9',
  },
  statusInactive: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  participantId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  participantDate: {
    fontSize: 12,
    color: '#999',
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
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  modalExample: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
