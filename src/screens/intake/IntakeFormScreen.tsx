/**
 * Intake Form Screen
 * Dynamic form for collecting intake data with field validation and voice/text input
 * Requirements: 2.9-2.19, 8.1, 8.2, 8.5
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import {
  IntakeSection,
  IntakeSectionData,
  validateField,
  REQUIRED_FIELDS,
} from '../../modules/intake/types';
import { saveProgress } from '../../modules/intake/intakeManager';

type IntakeStackParamList = {
  IntakeForm: {
    intakeId: string;
    participantId: string;
    section: IntakeSection;
    onSectionComplete: () => void;
  };
};

type IntakeFormScreenRouteProp = RouteProp<IntakeStackParamList, 'IntakeForm'>;
type IntakeFormScreenNavigationProp = StackNavigationProp<IntakeStackParamList, 'IntakeForm'>;

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

// Define form fields for each section
const SECTION_FIELDS: Record<IntakeSection, FormField[]> = {
  [IntakeSection.IDENTIFIERS]: [
    { name: 'firstName', label: 'First Name', type: 'text', required: true, placeholder: 'Enter first name' },
    { name: 'middleName', label: 'Middle Name', type: 'text', placeholder: 'Enter middle name (optional)' },
    { name: 'lastName', label: 'Last Name', type: 'text', required: true, placeholder: 'Enter last name' },
    { name: 'aliasNickname', label: 'Alias/Nickname', type: 'text', placeholder: 'Enter alias or nickname (optional)' },
    { name: 'dateOfBirth', label: 'Date of Birth', type: 'date', required: true, placeholder: 'MM/DD/YYYY' },
    { name: 'ssn', label: 'Social Security Number', type: 'text', placeholder: 'XXX-XX-XXXX (optional)' },
  ],
  [IntakeSection.CONTACT]: [
    { name: 'email', label: 'Email', type: 'text', placeholder: 'email@example.com' },
    { name: 'phone', label: 'Phone Number', type: 'text', required: true, placeholder: '(555) 555-5555' },
    { name: 'address', label: 'Street Address', type: 'text', placeholder: 'Enter street address' },
    { name: 'city', label: 'City', type: 'text', placeholder: 'Enter city' },
    { name: 'state', label: 'State', type: 'text', placeholder: 'Enter state' },
    { name: 'zip', label: 'ZIP Code', type: 'text', placeholder: 'Enter ZIP code' },
    { name: 'county', label: 'County', type: 'text', placeholder: 'Enter county' },
  ],
  [IntakeSection.DEMOGRAPHICS]: [
    { name: 'raceEthnicity', label: 'Race/Ethnicity', type: 'multiselect', options: ['White', 'Black/African American', 'Hispanic/Latino', 'Asian', 'Native American', 'Pacific Islander', 'Other'] },
    { name: 'sex', label: 'Sex', type: 'select', options: ['Male', 'Female', 'Intersex', 'Prefer not to say'] },
    { name: 'gender', label: 'Gender Identity', type: 'text', placeholder: 'Enter gender identity' },
    { name: 'pronouns', label: 'Pronouns', type: 'text', placeholder: 'e.g., he/him, she/her, they/them' },
    { name: 'primaryLanguages', label: 'Primary Languages', type: 'multiselect', options: ['English', 'Spanish', 'French', 'German', 'Chinese', 'Other'] },
    { name: 'veteranStatus', label: 'Veteran Status', type: 'boolean' },
  ],
  [IntakeSection.HEALTH]: [
    { name: 'physicalHealthRating', label: 'Physical Health Rating (1-5)', type: 'number', placeholder: '1 = Poor, 5 = Excellent' },
    { name: 'hearingDifficulty', label: 'Hearing Difficulty', type: 'select', options: ['None', 'Some', 'A lot', 'Cannot do at all'] },
    { name: 'visionDifficulty', label: 'Vision Difficulty', type: 'select', options: ['None', 'Some', 'A lot', 'Cannot do at all'] },
    { name: 'cognitiveDifficulty', label: 'Cognitive Difficulty', type: 'select', options: ['None', 'Some', 'A lot', 'Cannot do at all'] },
    { name: 'mobilityDifficulty', label: 'Mobility Difficulty', type: 'select', options: ['None', 'Some', 'A lot', 'Cannot do at all'] },
    { name: 'selfCareDifficulty', label: 'Self-Care Difficulty', type: 'select', options: ['None', 'Some', 'A lot', 'Cannot do at all'] },
    { name: 'independentLivingDifficulty', label: 'Independent Living Difficulty', type: 'select', options: ['None', 'Some', 'A lot', 'Cannot do at all'] },
    { name: 'seizureHistory', label: 'History of Seizures', type: 'boolean' },
  ],
  [IntakeSection.SUBSTANCE_USE]: [
    { name: 'recoveryPath', label: 'Recovery Path', type: 'text', placeholder: 'Describe recovery path' },
    { name: 'substancesUsed', label: 'Substances Used', type: 'multiselect', options: ['Alcohol', 'Opioids', 'Stimulants', 'Cannabis', 'Benzodiazepines', 'Other'] },
    { name: 'challengingSubstances', label: 'Most Challenging Substances', type: 'multiselect', options: ['Alcohol', 'Opioids', 'Stimulants', 'Cannabis', 'Benzodiazepines', 'Other'] },
    { name: 'ageOfFirstUse', label: 'Age of First Use', type: 'number', placeholder: 'Enter age' },
    { name: 'ageStartedRegularUse', label: 'Age Started Regular Use', type: 'number', placeholder: 'Enter age' },
    { name: 'lastUseDate', label: 'Last Use Date', type: 'date', placeholder: 'MM/DD/YYYY' },
    { name: 'recoveryDate', label: 'Recovery Start Date', type: 'date', placeholder: 'MM/DD/YYYY' },
    { name: 'matStatus', label: 'Currently on MAT', type: 'boolean' },
    { name: 'matType', label: 'MAT Type', type: 'text', placeholder: 'e.g., Methadone, Buprenorphine' },
  ],
  [IntakeSection.BEHAVIORAL_HEALTH]: [
    { name: 'bhPrimaryDx', label: 'Primary Mental Health Diagnosis', type: 'text', placeholder: 'Enter diagnosis' },
    { name: 'bhSecondaryDx', label: 'Secondary Mental Health Diagnosis', type: 'text', placeholder: 'Enter diagnosis' },
    { name: 'ideationsActive', label: 'Active Suicidal/Homicidal Ideations', type: 'boolean' },
    { name: 'mentalHealthRating', label: 'Mental Health Rating (1-5)', type: 'number', placeholder: '1 = Poor, 5 = Excellent' },
    { name: 'gamblingConsequences', label: 'Gambling Consequences', type: 'boolean' },
  ],
  [IntakeSection.SOCIAL_DRIVERS]: [
    { name: 'financialHardship', label: 'Financial Hardship', type: 'boolean' },
    { name: 'livingSituation', label: 'Living Situation', type: 'select', options: ['Stable', 'Unstable', 'Homeless', 'Transitional'] },
    { name: 'livingSituationType', label: 'Living Situation Type', type: 'select', options: ['Own', 'Rent', 'Family', 'Shelter', 'Other'] },
    { name: 'employmentStatus', label: 'Employment Status', type: 'select', options: ['Employed Full-Time', 'Employed Part-Time', 'Unemployed', 'Disabled', 'Retired', 'Student'] },
    { name: 'educationLevel', label: 'Education Level', type: 'select', options: ['Less than High School', 'High School/GED', 'Some College', 'Associate Degree', 'Bachelor Degree', 'Graduate Degree'] },
    { name: 'schoolEnrollment', label: 'Currently Enrolled in School', type: 'boolean' },
    { name: 'transportationBarriers', label: 'Transportation Barriers', type: 'multiselect', options: ['No vehicle', 'No license', 'No public transit', 'Cost', 'None'] },
  ],
  [IntakeSection.FAMILY]: [
    { name: 'dcfsInvolved', label: 'DCFS Involvement', type: 'boolean' },
    { name: 'custodyStatus', label: 'Custody Status', type: 'select', options: ['Full custody', 'Shared custody', 'No custody', 'N/A'] },
    { name: 'numberOfChildren', label: 'Number of Children', type: 'number', placeholder: 'Enter number' },
    { name: 'pregnancyStatus', label: 'Currently Pregnant', type: 'boolean' },
    { name: 'dueDate', label: 'Due Date', type: 'date', placeholder: 'MM/DD/YYYY' },
    { name: 'maritalStatus', label: 'Marital Status', type: 'select', options: ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'] },
  ],
  [IntakeSection.INSURANCE]: [
    { name: 'hasInsurance', label: 'Has Insurance', type: 'boolean' },
    { name: 'insuranceType', label: 'Insurance Type', type: 'select', options: ['Medicaid', 'Medicare', 'Private', 'None'] },
    { name: 'insuranceProvider', label: 'Insurance Provider', type: 'text', placeholder: 'Enter provider name' },
    { name: 'insuranceMemberId', label: 'Member ID', type: 'text', placeholder: 'Enter member ID' },
    { name: 'insuranceGroupId', label: 'Group ID', type: 'text', placeholder: 'Enter group ID' },
    { name: 'insuranceStart', label: 'Coverage Start Date', type: 'date', placeholder: 'MM/DD/YYYY' },
    { name: 'insuranceEnd', label: 'Coverage End Date', type: 'date', placeholder: 'MM/DD/YYYY' },
    { name: 'medicationsCovered', label: 'Medications Covered', type: 'boolean' },
  ],
  [IntakeSection.ENGAGEMENT]: [
    { name: 'program', label: 'Program', type: 'text', placeholder: 'Enter program name' },
    { name: 'receivesCall', label: 'Receives Calls', type: 'boolean' },
    { name: 'receivesCoaching', label: 'Receives Coaching', type: 'boolean' },
    { name: 'coachingFrequency', label: 'Coaching Frequency', type: 'select', options: ['Weekly', 'Bi-weekly', 'Monthly', 'As needed'] },
    { name: 'bestDaysToCall', label: 'Best Days to Call', type: 'multiselect', options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    { name: 'bestTimesToCall', label: 'Best Times to Call', type: 'multiselect', options: ['Morning', 'Afternoon', 'Evening'] },
  ],
  [IntakeSection.EMERGENCY_CONTACT]: [
    { name: 'name', label: 'Contact Name', type: 'text', placeholder: 'Enter name' },
    { name: 'relationship', label: 'Relationship', type: 'text', placeholder: 'e.g., Spouse, Parent, Friend' },
    { name: 'phone', label: 'Contact Phone', type: 'text', placeholder: '(555) 555-5555' },
    { name: 'releaseOfInfoStatus', label: 'Release of Information Signed', type: 'boolean' },
    { name: 'releaseOfInfoDate', label: 'Release Date', type: 'date', placeholder: 'MM/DD/YYYY' },
  ],
};

export const IntakeFormScreen: React.FC = () => {
  const navigation = useNavigation<IntakeFormScreenNavigationProp>();
  const route = useRoute<IntakeFormScreenRouteProp>();
  const { intakeId, participantId, section, onSectionComplete } = route.params;

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [useVoiceInput, setUseVoiceInput] = useState(false);
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<Record<string, string[]>>({});

  const fields = SECTION_FIELDS[section] || [];
  const requiredFields = REQUIRED_FIELDS[section] || [];

  useEffect(() => {
    // Initialize multi-select fields
    const multiFields = fields.filter(f => f.type === 'multiselect');
    const initial: Record<string, string[]> = {};
    multiFields.forEach(f => {
      initial[f.name] = formData[f.name] || [];
    });
    setSelectedMultiOptions(initial);
  }, []);

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    
    // Clear error for this field
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }

    // Auto-save after field change (debounced in production)
    autoSave(fieldName, value);
  };

  const handleMultiSelectToggle = (fieldName: string, option: string) => {
    setSelectedMultiOptions(prev => {
      const current = prev[fieldName] || [];
      const updated = current.includes(option)
        ? current.filter(o => o !== option)
        : [...current, option];
      
      handleFieldChange(fieldName, updated);
      return { ...prev, [fieldName]: updated };
    });
  };

  const autoSave = async (fieldName: string, value: any) => {
    try {
      const userId = 'current-user-id'; // TODO: Get from auth context
      
      const sectionData: IntakeSectionData = {
        section,
        fields: { ...formData, [fieldName]: value },
        completedAt: new Date(),
      };

      await saveProgress(intakeId, sectionData, userId);
    } catch (error) {
      console.error('Auto-save error:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Check required fields
    requiredFields.forEach(fieldName => {
      const value = formData[fieldName];
      if (!value || (Array.isArray(value) && value.length === 0)) {
        newErrors[fieldName] = 'This field is required';
      }
    });

    // Validate field formats
    Object.entries(formData).forEach(([fieldName, value]) => {
      if (value) {
        const validation = validateField(section, fieldName, value);
        if (!validation.valid && validation.error) {
          newErrors[fieldName] = validation.error;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before saving');
      return;
    }

    try {
      setIsSaving(true);
      const userId = 'current-user-id'; // TODO: Get from auth context

      const sectionData: IntakeSectionData = {
        section,
        fields: formData,
        completedAt: new Date(),
      };

      await saveProgress(intakeId, sectionData, userId);

      Alert.alert('Success', 'Section saved successfully', [
        {
          text: 'OK',
          onPress: () => {
            onSectionComplete();
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save section data');
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (field: FormField) => {
    const value = formData[field.name];
    const error = errors[field.name];
    const isRequired = field.required || requiredFields.includes(field.name);

    switch (field.type) {
      case 'text':
      case 'number':
        return (
          <View key={field.name} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label}
              {isRequired && <Text style={styles.required}> *</Text>}
            </Text>
            <TextInput
              style={[styles.textInput, error && styles.textInputError]}
              value={value || ''}
              onChangeText={(text) => handleFieldChange(field.name, text)}
              placeholder={field.placeholder}
              keyboardType={field.type === 'number' ? 'numeric' : 'default'}
              editable={!useVoiceInput}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      case 'date':
        return (
          <View key={field.name} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label}
              {isRequired && <Text style={styles.required}> *</Text>}
            </Text>
            <TextInput
              style={[styles.textInput, error && styles.textInputError]}
              value={value || ''}
              onChangeText={(text) => handleFieldChange(field.name, text)}
              placeholder={field.placeholder}
              editable={!useVoiceInput}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      case 'boolean':
        return (
          <View key={field.name} style={styles.fieldContainer}>
            <View style={styles.booleanRow}>
              <Text style={styles.fieldLabel}>
                {field.label}
                {isRequired && <Text style={styles.required}> *</Text>}
              </Text>
              <Switch
                value={value || false}
                onValueChange={(val) => handleFieldChange(field.name, val)}
                disabled={useVoiceInput}
              />
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      case 'select':
        return (
          <View key={field.name} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label}
              {isRequired && <Text style={styles.required}> *</Text>}
            </Text>
            <View style={styles.selectContainer}>
              {field.options?.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.selectOption,
                    value === option && styles.selectOptionSelected,
                  ]}
                  onPress={() => handleFieldChange(field.name, option)}
                  disabled={useVoiceInput}
                >
                  <Text
                    style={[
                      styles.selectOptionText,
                      value === option && styles.selectOptionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      case 'multiselect':
        const selected = selectedMultiOptions[field.name] || [];
        return (
          <View key={field.name} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label}
              {isRequired && <Text style={styles.required}> *</Text>}
            </Text>
            <View style={styles.selectContainer}>
              {field.options?.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.selectOption,
                    selected.includes(option) && styles.selectOptionSelected,
                  ]}
                  onPress={() => handleMultiSelectToggle(field.name, option)}
                  disabled={useVoiceInput}
                >
                  <Text
                    style={[
                      styles.selectOptionText,
                      selected.includes(option) && styles.selectOptionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{section}</Text>
        
        {/* Voice/Text Toggle */}
        <View style={styles.inputModeToggle}>
          <Text style={styles.inputModeLabel}>Voice Input</Text>
          <Switch
            value={useVoiceInput}
            onValueChange={setUseVoiceInput}
          />
        </View>
        
        {useVoiceInput && (
          <View style={styles.voiceNotice}>
            <Text style={styles.voiceNoticeText}>
              🎤 Voice input mode active. Speak your responses.
            </Text>
          </View>
        )}
      </View>

      {/* Form Fields */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {fields.map(renderField)}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Section</Text>
          )}
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
    marginBottom: 15,
  },
  inputModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  inputModeLabel: {
    fontSize: 16,
    color: '#333',
  },
  voiceNotice: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  voiceNoticeText: {
    fontSize: 14,
    color: '#1976D2',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#FF3B30',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textInputError: {
    borderColor: '#FF3B30',
  },
  booleanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectOption: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  selectOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  selectOptionText: {
    fontSize: 14,
    color: '#333',
  },
  selectOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#CCC',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#CCC',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
