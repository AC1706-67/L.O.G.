/**
 * Consent Form Screen
 * Displays and captures consent forms (CFR Part 2 and AI Processing)
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ConsentForm, ConsentType, ConsentData } from '../../modules/consent/types';
import { captureConsent } from '../../modules/consent/consentManager';
import { SignatureCapture } from '../../components/SignatureCapture';

type ConsentStackParamList = {
  ConsentForm: {
    participantId: string;
    participantName: string;
    dateOfBirth: Date;
    consentForm: ConsentForm;
    onComplete: () => void;
  };
};

type ConsentFormScreenRouteProp = RouteProp<ConsentStackParamList, 'ConsentForm'>;
type ConsentFormScreenNavigationProp = StackNavigationProp<ConsentStackParamList, 'ConsentForm'>;

export const ConsentFormScreen: React.FC = () => {
  const navigation = useNavigation<ConsentFormScreenNavigationProp>();
  const route = useRoute<ConsentFormScreenRouteProp>();
  const { participantId, participantName, dateOfBirth, consentForm, onComplete } = route.params;

  const [signature, setSignature] = useState<string>('');
  const [witnessName, setWitnessName] = useState<string>('');
  const [witnessSignature, setWitnessSignature] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSignatureCapture, setShowSignatureCapture] = useState(false);
  const [showWitnessSignature, setShowWitnessSignature] = useState(false);

  // CFR Part 2 specific fields
  const [purposeOfDisclosure, setPurposeOfDisclosure] = useState<string>(
    'Peer recovery support services and care coordination'
  );
  const [authorizedRecipients, setAuthorizedRecipients] = useState<string>(
    'Authorized peer specialists, supervisors, and healthcare providers'
  );
  const [informationToDisclose, setInformationToDisclose] = useState<string>(
    'Substance use disorder treatment records, assessments, recovery plans, and interaction notes'
  );

  const handleSubmit = async () => {
    // Validate required fields
    if (!signature) {
      Alert.alert('Error', 'Participant signature is required');
      return;
    }

    // For CFR Part 2, witness is required
    if (consentForm.type === 'CFR_PART_2' && (!witnessName || !witnessSignature)) {
      Alert.alert('Error', 'Witness name and signature are required for CFR Part 2 consent');
      return;
    }

    setIsSubmitting(true);

    try {
      // Calculate expiration date (1 year from now for CFR Part 2)
      const expirationDate = consentForm.type === 'CFR_PART_2' 
        ? new Date(new Date().setFullYear(new Date().getFullYear() + 1))
        : undefined;

      const consentData: ConsentData = {
        participantId,
        consentType: consentForm.type,
        participantName,
        dateOfBirth,
        purposeOfDisclosure: consentForm.type === 'CFR_PART_2' ? purposeOfDisclosure : undefined,
        authorizedRecipients: consentForm.type === 'CFR_PART_2' ? [authorizedRecipients] : undefined,
        informationToDisclose: consentForm.type === 'CFR_PART_2' ? informationToDisclose : undefined,
        expirationDate,
        signature,
        dateSigned: new Date(),
        witnessName: consentForm.type === 'CFR_PART_2' ? witnessName : undefined,
        witnessSignature: consentForm.type === 'CFR_PART_2' ? witnessSignature : undefined,
      };

      // Get current user ID (in real app, this would come from auth context)
      const userId = 'current-user-id'; // TODO: Get from auth context

      await captureConsent(consentData, userId);

      Alert.alert('Success', 'Consent captured successfully', [
        {
          text: 'OK',
          onPress: () => {
            onComplete();
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      console.error('Error capturing consent:', error);
      Alert.alert('Error', 'Failed to capture consent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{consentForm.title}</Text>

        {/* Render consent form sections */}
        {consentForm.sections.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        {/* CFR Part 2 specific fields */}
        {consentForm.type === 'CFR_PART_2' && (
          <>
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Purpose of Disclosure</Text>
              <TextInput
                style={styles.textInput}
                value={purposeOfDisclosure}
                onChangeText={setPurposeOfDisclosure}
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Authorized Recipients</Text>
              <TextInput
                style={styles.textInput}
                value={authorizedRecipients}
                onChangeText={setAuthorizedRecipients}
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Information to be Disclosed</Text>
              <TextInput
                style={styles.textInput}
                value={informationToDisclose}
                onChangeText={setInformationToDisclose}
                multiline
                numberOfLines={3}
              />
            </View>
          </>
        )}

        {/* Participant Information */}
        <View style={styles.infoSection}>
          <Text style={styles.infoLabel}>Participant Name:</Text>
          <Text style={styles.infoValue}>{participantName}</Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoLabel}>Date of Birth:</Text>
          <Text style={styles.infoValue}>{dateOfBirth.toLocaleDateString()}</Text>
        </View>

        {/* Participant Signature */}
        <View style={styles.signatureSection}>
          <Text style={styles.signatureLabel}>Participant Signature *</Text>
          {signature ? (
            <View>
              <View style={styles.signaturePreview}>
                <Text style={styles.signatureText}>Signature Captured</Text>
              </View>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setSignature('')}
              >
                <Text style={styles.clearButtonText}>Clear Signature</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.signatureButton}
              onPress={() => setShowSignatureCapture(true)}
            >
              <Text style={styles.signatureButtonText}>Tap to Sign</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Witness fields for CFR Part 2 */}
        {consentForm.type === 'CFR_PART_2' && (
          <>
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Witness Name *</Text>
              <TextInput
                style={styles.textInput}
                value={witnessName}
                onChangeText={setWitnessName}
                placeholder="Enter witness name"
              />
            </View>

            <View style={styles.signatureSection}>
              <Text style={styles.signatureLabel}>Witness Signature *</Text>
              {witnessSignature ? (
                <View>
                  <View style={styles.signaturePreview}>
                    <Text style={styles.signatureText}>Witness Signature Captured</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setWitnessSignature('')}
                  >
                    <Text style={styles.clearButtonText}>Clear Signature</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.signatureButton}
                  onPress={() => setShowWitnessSignature(true)}
                >
                  <Text style={styles.signatureButtonText}>Tap to Sign</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Consent</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Signature Capture Modal */}
      {showSignatureCapture && (
        <SignatureCapture
          onSave={(signatureData) => {
            setSignature(signatureData);
            setShowSignatureCapture(false);
          }}
          onCancel={() => setShowSignatureCapture(false)}
        />
      )}

      {/* Witness Signature Capture Modal */}
      {showWitnessSignature && (
        <SignatureCapture
          onSave={(signatureData) => {
            setWitnessSignature(signatureData);
            setShowWitnessSignature(false);
          }}
          onCancel={() => setShowWitnessSignature(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 10,
  },
  sectionContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  inputSection: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
  },
  infoSection: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  infoValue: {
    fontSize: 14,
    color: '#666',
  },
  signatureSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  signatureLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  signatureButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  signaturePreview: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
  },
  signatureText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  clearButton: {
    marginTop: 10,
    padding: 10,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    color: '#FF3B30',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonDisabled: {
    backgroundColor: '#999',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
