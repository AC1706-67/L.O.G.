/**
 * Intake Module Types
 * Handles multi-session participant intake data collection
 * Requirements: 2.1-2.19
 */

export enum IntakeSection {
  IDENTIFIERS = 'identifiers',
  CONTACT = 'contact',
  DEMOGRAPHICS = 'demographics',
  HEALTH = 'health',
  SUBSTANCE_USE = 'substanceUse',
  BEHAVIORAL_HEALTH = 'behavioralHealth',
  SOCIAL_DRIVERS = 'socialDrivers',
  FAMILY = 'family',
  INSURANCE = 'insurance',
  ENGAGEMENT = 'engagement',
  EMERGENCY_CONTACT = 'emergencyContact',
}

export interface IntakeSession {
  intakeId: string;
  participantId: string;
  startedAt: Date;
  lastUpdatedAt: Date;
  completedSections: string[];
  incompleteSections: string[];
  currentSection?: string;
  isComplete: boolean;
}

export interface IntakeSectionData {
  section: IntakeSection;
  fields: Record<string, any>;
  completedAt: Date;
}

export interface IntakeCompletionStatus {
  totalSections: number;
  completedSections: number;
  percentComplete: number;
  missingSections: IntakeSection[];
  requiredFieldsMissing: string[];
}

// ============================================================================
// Section-Specific Data Models (Requirements 2.9-2.19)
// ============================================================================

/**
 * Identifiers Section
 * Requirement 2.9: Collect identifiers including firstName, lastName, dateOfBirth, and encrypted SSN
 */
export interface IdentifiersData {
  firstName: string;
  middleName?: string;
  lastName: string;
  aliasNickname?: string;
  dateOfBirth: Date;
  ssn?: string; // Will be encrypted before storage
}

/**
 * Contact Information Section
 * Requirement 2.10: Collect contact information including email, phone, address, city, state, zip, and county
 * Requirement 2.11: Collect additional contact information including parole officer, probation officer, and case worker
 */
export interface ContactData {
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  paroleOfficer?: {
    name?: string;
    phone?: string;
  };
  probationOfficer?: {
    name?: string;
    phone?: string;
  };
  caseWorker?: {
    name?: string;
    phone?: string;
  };
}

/**
 * Demographics Section
 * Requirement 2.12: Collect demographics including race/ethnicity, sex, gender, pronouns, primary languages, and veteran status
 */
export interface DemographicsData {
  raceEthnicity?: string[];
  sex?: string;
  gender?: string;
  pronouns?: string;
  primaryLanguages?: string[];
  veteranStatus?: boolean;
}

/**
 * Health Information Section
 * Requirement 2.13: Collect health information including physical health rating and six disability difficulty categories
 */
export interface HealthData {
  physicalHealthRating?: number; // 1-5 scale
  hearingDifficulty?: string;
  visionDifficulty?: string;
  cognitiveDifficulty?: string;
  mobilityDifficulty?: string;
  selfCareDifficulty?: string;
  independentLivingDifficulty?: string;
  seizureHistory?: boolean;
}

/**
 * Substance Use History Section
 * Requirement 2.14: Collect substance use history including recovery path, substances used, MAT status, and treatment history
 * Requirement 2.15: Collect MAT provider information including provider name, provider phone, and MAT education group date attended
 */
export interface SubstanceUseData {
  recoveryPath?: string;
  substancesUsed?: string[];
  challengingSubstances?: string[];
  ageOfFirstUse?: number;
  ageStartedRegularUse?: number;
  lastUseDate?: Date;
  recoveryDate?: Date;
  sudPrimaryDx?: string;
  sudSecondaryDx?: string;
  treatmentHistory?: string;
  treatmentServicesUsed?: string[];
  matStatus?: boolean;
  matType?: string;
  matProvider?: {
    name?: string;
    phone?: string;
    educationGroupDate?: Date;
  };
  narcanTimesReceived?: number;
  emergencyRoomVisits?: number;
}

/**
 * Behavioral Health Section
 * Requirement 2.16: Collect behavioral health information including diagnoses and mental health rating
 */
export interface BehavioralHealthData {
  bhPrimaryDx?: string;
  bhSecondaryDx?: string;
  ideationsActive?: boolean;
  mentalHealthRating?: number; // 1-5 scale
  gamblingConsequences?: boolean;
}

/**
 * Social Drivers Section
 * Requirement 2.17: Collect social drivers including financial hardship, living situation, employment, education, and transportation barriers
 */
export interface SocialDriversData {
  financialHardship?: boolean;
  livingSituation?: string;
  livingSituationType?: string;
  housingStability?: string;
  employmentStatus?: string;
  educationLevel?: string;
  schoolEnrollment?: boolean;
  transportationBarriers?: string[];
}

/**
 * Family Information Section
 * Requirement 2.18: Collect family information including DCFS involvement, custody status, and pregnancy status
 */
export interface FamilyData {
  dcfsInvolved?: boolean;
  custodyStatus?: string;
  numberOfChildren?: number;
  pregnancyStatus?: boolean;
  dueDate?: Date;
  maritalStatus?: string;
}

/**
 * Insurance Information Section
 * Requirement 2.19: Collect insurance information including type, provider, member ID, and coverage dates
 */
export interface InsuranceData {
  hasInsurance?: boolean;
  insuranceType?: string;
  insuranceProvider?: string;
  insuranceMemberId?: string; // Will be encrypted before storage
  insuranceGroupId?: string;
  insuranceStart?: Date;
  insuranceEnd?: Date;
  medicationsCovered?: boolean;
}

/**
 * Engagement Preferences Section
 * Requirement 2.20: Collect engagement preferences including assigned peer, contact preferences, and best times to call
 */
export interface EngagementData {
  program?: string;
  assignedPeerId?: string;
  receivesCall?: boolean;
  receivesCoaching?: boolean;
  coachingFrequency?: string;
  bestDaysToCall?: string[];
  bestTimesToCall?: string[];
}

/**
 * Emergency Contact Section
 * Requirement 2.21: Collect emergency contact information with release of information status
 */
export interface EmergencyContactData {
  name?: string;
  relationship?: string;
  phone?: string;
  releaseOfInfoStatus?: boolean;
  releaseOfInfoDate?: Date;
}

// ============================================================================
// Field Validation and Completion Helpers
// ============================================================================

/**
 * Required fields for each section
 * Used for validation and completion checking
 */
export const REQUIRED_FIELDS: Record<IntakeSection, string[]> = {
  [IntakeSection.IDENTIFIERS]: ['firstName', 'lastName', 'dateOfBirth'],
  [IntakeSection.CONTACT]: ['phone'],
  [IntakeSection.DEMOGRAPHICS]: [],
  [IntakeSection.HEALTH]: [],
  [IntakeSection.SUBSTANCE_USE]: [],
  [IntakeSection.BEHAVIORAL_HEALTH]: [],
  [IntakeSection.SOCIAL_DRIVERS]: [],
  [IntakeSection.FAMILY]: [],
  [IntakeSection.INSURANCE]: [],
  [IntakeSection.ENGAGEMENT]: [],
  [IntakeSection.EMERGENCY_CONTACT]: [],
};

/**
 * Type guard to check if a section is complete
 * @param section - The intake section
 * @param data - The section data
 * @returns True if all required fields are present
 */
export function isSectionComplete(section: IntakeSection, data: Record<string, any>): boolean {
  const requiredFields = REQUIRED_FIELDS[section];
  return requiredFields.every((field) => {
    const value = data[field];
    return value !== undefined && value !== null && value !== '';
  });
}

/**
 * Get missing required fields for a section
 * @param section - The intake section
 * @param data - The section data
 * @returns Array of missing field names
 */
export function getMissingFields(section: IntakeSection, data: Record<string, any>): string[] {
  const requiredFields = REQUIRED_FIELDS[section];
  return requiredFields.filter((field) => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });
}

/**
 * Validate field value based on field name and section
 * @param section - The intake section
 * @param fieldName - The field name
 * @param value - The field value
 * @returns Validation result with error message if invalid
 */
export function validateField(
  section: IntakeSection,
  fieldName: string,
  value: any
): { valid: boolean; error?: string } {
  // Email validation
  if (fieldName === 'email' && value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return { valid: false, error: 'Invalid email format' };
    }
  }

  // Phone validation (basic)
  if ((fieldName === 'phone' || fieldName.includes('Phone')) && value) {
    const phoneRegex = /^\d{10,}$/;
    const cleanPhone = value.replace(/\D/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      return { valid: false, error: 'Phone number must be at least 10 digits' };
    }
  }

  // Date of birth validation
  if (fieldName === 'dateOfBirth' && value) {
    const dob = new Date(value);
    const now = new Date();
    if (dob > now) {
      return { valid: false, error: 'Date of birth cannot be in the future' };
    }
    const age = (now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (age > 120) {
      return { valid: false, error: 'Date of birth seems invalid' };
    }
  }

  // Health rating validation (1-5 scale)
  if ((fieldName === 'physicalHealthRating' || fieldName === 'mentalHealthRating') && value) {
    if (value < 1 || value > 5) {
      return { valid: false, error: 'Rating must be between 1 and 5' };
    }
  }

  // Age validation
  if ((fieldName === 'ageOfFirstUse' || fieldName === 'ageStartedRegularUse') && value) {
    if (value < 0 || value > 120) {
      return { valid: false, error: 'Age must be between 0 and 120' };
    }
  }

  // Zip code validation
  if (fieldName === 'zip' && value) {
    const zipRegex = /^\d{5}(-\d{4})?$/;
    if (!zipRegex.test(value)) {
      return { valid: false, error: 'Invalid zip code format' };
    }
  }

  return { valid: true };
}
