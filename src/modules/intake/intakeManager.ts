/**
 * Intake Manager Component
 * Orchestrates multi-session participant intake with flexible section ordering and automatic progress saving
 * Requirements: 2.1, 2.2, 2.3, 2.7
 */

import { supabase } from '../../config/supabase';
import { encrypt } from '../security/encryption';
import { DataType } from '../security/types';
import { logPHIAccess, logDataChange } from '../logging/sessionLogger';
import {
  IntakeSession,
  IntakeSectionData,
  IntakeCompletionStatus,
  IntakeSection,
  REQUIRED_FIELDS,
  isSectionComplete,
  getMissingFields,
} from './types';

/**
 * Starts a new intake session for a participant
 * Requirement 2.1: Create a new intake record with unique client identifier
 * @param participantId - ID of the participant
 * @param userId - ID of the user starting the intake
 * @returns Created intake session
 */
export async function startIntake(participantId: string, userId: string): Promise<IntakeSession> {
  if (!participantId) {
    throw new Error('Participant ID is required');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Create new intake session record
    const now = new Date();
    const intakeRecord = {
      participant_id: participantId,
      started_at: now.toISOString(),
      last_updated_at: now.toISOString(),
      is_complete: false,
      completed_sections: [],
      current_section: null,
      created_by: userId,
    };

    const { data, error } = await supabase
      .from('intake_sessions')
      .insert(intakeRecord)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to start intake: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to start intake: No data returned');
    }

    // Log PHI access for audit trail
    await logPHIAccess({
      userId,
      participantId,
      accessType: 'write',
      dataType: 'intake',
      purpose: 'Started new intake session',
      timestamp: now,
      ipAddress: '0.0.0.0',
      deviceId: 'mobile-app',
    });

    // Calculate incomplete sections (all sections initially)
    const allSections = Object.values(IntakeSection);
    const incompleteSections = allSections;

    // Transform to IntakeSession
    const session: IntakeSession = {
      intakeId: data.id,
      participantId: data.participant_id,
      startedAt: new Date(data.started_at),
      lastUpdatedAt: new Date(data.last_updated_at),
      completedSections: data.completed_sections || [],
      incompleteSections,
      currentSection: data.current_section,
      isComplete: data.is_complete,
    };

    return session;
  } catch (error) {
    console.error('Error starting intake:', error);
    throw error;
  }
}

/**
 * Resumes an incomplete intake session
 * Requirement 2.3: Retrieve incomplete intake record and continue from last saved point
 * @param intakeId - ID of the intake session to resume
 * @param userId - ID of the user resuming the intake
 * @returns Resumed intake session
 */
export async function resumeIntake(intakeId: string, userId: string): Promise<IntakeSession> {
  if (!intakeId) {
    throw new Error('Intake ID is required');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Retrieve intake session
    const { data, error } = await supabase
      .from('intake_sessions')
      .select('*')
      .eq('id', intakeId)
      .single();

    if (error) {
      throw new Error(`Failed to resume intake: ${error.message}`);
    }

    if (!data) {
      throw new Error('Intake session not found');
    }

    // Check if already complete
    if (data.is_complete) {
      throw new Error('Intake session is already complete');
    }

    // Log PHI access for audit trail
    await logPHIAccess({
      userId,
      participantId: data.participant_id,
      accessType: 'read',
      dataType: 'intake',
      purpose: 'Resumed intake session',
      timestamp: new Date(),
      ipAddress: '0.0.0.0',
      deviceId: 'mobile-app',
    });

    // Calculate incomplete sections
    const allSections = Object.values(IntakeSection);
    const completedSections = data.completed_sections || [];
    const incompleteSections = allSections.filter((s) => !completedSections.includes(s));

    // Transform to IntakeSession
    const session: IntakeSession = {
      intakeId: data.id,
      participantId: data.participant_id,
      startedAt: new Date(data.started_at),
      lastUpdatedAt: new Date(data.last_updated_at),
      completedSections,
      incompleteSections,
      currentSection: data.current_section,
      isComplete: data.is_complete,
    };

    return session;
  } catch (error) {
    console.error('Error resuming intake:', error);
    throw error;
  }
}

/**
 * Saves progress for an intake session
 * Requirement 2.2: Save progress automatically after each response
 * @param intakeId - ID of the intake session
 * @param sectionData - Section data to save
 * @param userId - ID of the user saving progress
 */
export async function saveProgress(
  intakeId: string,
  sectionData: IntakeSectionData,
  userId: string
): Promise<void> {
  if (!intakeId) {
    throw new Error('Intake ID is required');
  }

  if (!sectionData) {
    throw new Error('Section data is required');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Get current intake session
    const { data: intakeSession, error: fetchError } = await supabase
      .from('intake_sessions')
      .select('*')
      .eq('id', intakeId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch intake session: ${fetchError.message}`);
    }

    if (!intakeSession) {
      throw new Error('Intake session not found');
    }

    // Get participant record to update fields
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('*')
      .eq('id', intakeSession.participant_id)
      .single();

    if (participantError) {
      throw new Error(`Failed to fetch participant: ${participantError.message}`);
    }

    if (!participant) {
      throw new Error('Participant not found');
    }

    // Prepare update data based on section
    const updateData: Record<string, any> = {};
    const fields = sectionData.fields;

    // Map section fields to participant table columns
    switch (sectionData.section) {
      case IntakeSection.IDENTIFIERS:
        if (fields.firstName) updateData.first_name_encrypted = await encrypt(fields.firstName, DataType.PHI);
        if (fields.middleName) updateData.middle_name_encrypted = await encrypt(fields.middleName, DataType.PHI);
        if (fields.lastName) updateData.last_name_encrypted = await encrypt(fields.lastName, DataType.PHI);
        if (fields.aliasNickname) updateData.alias_nickname = fields.aliasNickname;
        if (fields.dateOfBirth) updateData.date_of_birth_encrypted = await encrypt(fields.dateOfBirth.toISOString(), DataType.PHI);
        if (fields.ssn) updateData.ssn_encrypted = await encrypt(fields.ssn, DataType.PHI);
        break;

      case IntakeSection.CONTACT:
        if (fields.email) updateData.email_encrypted = await encrypt(fields.email, DataType.PHI);
        if (fields.phone) updateData.phone_encrypted = await encrypt(fields.phone, DataType.PHI);
        if (fields.address) updateData.address_encrypted = await encrypt(fields.address, DataType.PHI);
        if (fields.city) updateData.city = fields.city;
        if (fields.state) updateData.state = fields.state;
        if (fields.zip) updateData.zip = fields.zip;
        if (fields.county) updateData.county = fields.county;
        break;

      case IntakeSection.DEMOGRAPHICS:
        if (fields.raceEthnicity) updateData.race_ethnicity = fields.raceEthnicity;
        if (fields.sex) updateData.sex = fields.sex;
        if (fields.gender) updateData.gender = fields.gender;
        if (fields.pronouns) updateData.pronouns = fields.pronouns;
        if (fields.primaryLanguages) updateData.primary_languages = fields.primaryLanguages;
        if (fields.veteranStatus !== undefined) updateData.veteran_status = fields.veteranStatus;
        break;

      case IntakeSection.HEALTH:
        if (fields.physicalHealthRating) updateData.physical_health_rating = fields.physicalHealthRating;
        if (fields.hearingDifficulty) updateData.hearing_difficulty = fields.hearingDifficulty;
        if (fields.visionDifficulty) updateData.vision_difficulty = fields.visionDifficulty;
        if (fields.cognitiveDifficulty) updateData.cognitive_difficulty = fields.cognitiveDifficulty;
        if (fields.mobilityDifficulty) updateData.mobility_difficulty = fields.mobilityDifficulty;
        if (fields.selfCareDifficulty) updateData.self_care_difficulty = fields.selfCareDifficulty;
        if (fields.independentLivingDifficulty) updateData.independent_living_difficulty = fields.independentLivingDifficulty;
        if (fields.seizureHistory !== undefined) updateData.seizure_history = fields.seizureHistory;
        break;

      case IntakeSection.SUBSTANCE_USE:
        if (fields.recoveryPath) updateData.recovery_path = fields.recoveryPath;
        if (fields.substancesUsed) updateData.substances_used = fields.substancesUsed;
        if (fields.challengingSubstances) updateData.challenging_substances = fields.challengingSubstances;
        if (fields.ageOfFirstUse) updateData.age_of_first_use = fields.ageOfFirstUse;
        if (fields.ageStartedRegularUse) updateData.age_started_regular_use = fields.ageStartedRegularUse;
        if (fields.lastUseDate) updateData.last_use_date = fields.lastUseDate.toISOString().split('T')[0];
        if (fields.recoveryDate) updateData.recovery_date = fields.recoveryDate.toISOString().split('T')[0];
        if (fields.sudPrimaryDx) updateData.sud_primary_dx = fields.sudPrimaryDx;
        if (fields.sudSecondaryDx) updateData.sud_secondary_dx = fields.sudSecondaryDx;
        if (fields.treatmentHistory) updateData.treatment_history = fields.treatmentHistory;
        if (fields.treatmentServicesUsed) updateData.treatment_services_used = fields.treatmentServicesUsed;
        if (fields.matStatus !== undefined) updateData.mat_status = fields.matStatus;
        if (fields.matType) updateData.mat_type = fields.matType;
        if (fields.narcanTimesReceived) updateData.narcan_times_received = fields.narcanTimesReceived;
        if (fields.emergencyRoomVisits) updateData.emergency_room_visits = fields.emergencyRoomVisits;
        break;

      case IntakeSection.BEHAVIORAL_HEALTH:
        if (fields.bhPrimaryDx) updateData.bh_primary_dx = fields.bhPrimaryDx;
        if (fields.bhSecondaryDx) updateData.bh_secondary_dx = fields.bhSecondaryDx;
        if (fields.ideationsActive !== undefined) updateData.ideations_active = fields.ideationsActive;
        if (fields.mentalHealthRating) updateData.mental_health_rating = fields.mentalHealthRating;
        if (fields.gamblingConsequences !== undefined) updateData.gambling_consequences = fields.gamblingConsequences;
        break;

      case IntakeSection.SOCIAL_DRIVERS:
        if (fields.financialHardship !== undefined) updateData.financial_hardship = fields.financialHardship;
        if (fields.livingSituation) updateData.living_situation = fields.livingSituation;
        if (fields.livingSituationType) updateData.living_situation_type = fields.livingSituationType;
        if (fields.housingStability) updateData.housing_stability = fields.housingStability;
        if (fields.employmentStatus) updateData.employment_status = fields.employmentStatus;
        if (fields.educationLevel) updateData.education_level = fields.educationLevel;
        if (fields.schoolEnrollment !== undefined) updateData.school_enrollment = fields.schoolEnrollment;
        if (fields.transportationBarriers) updateData.transportation_barriers = fields.transportationBarriers;
        break;

      case IntakeSection.FAMILY:
        if (fields.dcfsInvolved !== undefined) updateData.dcfs_involved = fields.dcfsInvolved;
        if (fields.custodyStatus) updateData.custody_status = fields.custodyStatus;
        if (fields.numberOfChildren) updateData.number_of_children = fields.numberOfChildren;
        if (fields.pregnancyStatus !== undefined) updateData.pregnancy_status = fields.pregnancyStatus;
        if (fields.dueDate) updateData.due_date = fields.dueDate.toISOString().split('T')[0];
        if (fields.maritalStatus) updateData.marital_status = fields.maritalStatus;
        break;

      case IntakeSection.INSURANCE:
        if (fields.hasInsurance !== undefined) updateData.has_insurance = fields.hasInsurance;
        if (fields.insuranceType) updateData.insurance_type = fields.insuranceType;
        if (fields.insuranceProvider) updateData.insurance_provider = fields.insuranceProvider;
        if (fields.insuranceMemberId) updateData.insurance_member_id_encrypted = await encrypt(fields.insuranceMemberId, DataType.PHI);
        if (fields.insuranceGroupId) updateData.insurance_group_id = fields.insuranceGroupId;
        if (fields.insuranceStart) updateData.insurance_start = fields.insuranceStart.toISOString().split('T')[0];
        if (fields.insuranceEnd) updateData.insurance_end = fields.insuranceEnd.toISOString().split('T')[0];
        if (fields.medicationsCovered !== undefined) updateData.medications_covered = fields.medicationsCovered;
        break;

      case IntakeSection.ENGAGEMENT:
        if (fields.program) updateData.program = fields.program;
        if (fields.assignedPeerId) updateData.assigned_peer_id = fields.assignedPeerId;
        if (fields.receivesCall !== undefined) updateData.receives_calls = fields.receivesCall;
        if (fields.receivesCoaching !== undefined) updateData.receives_coaching = fields.receivesCoaching;
        if (fields.coachingFrequency) updateData.coaching_frequency = fields.coachingFrequency;
        if (fields.bestDaysToCall) updateData.best_days_to_call = fields.bestDaysToCall;
        if (fields.bestTimesToCall) updateData.best_times_to_call = fields.bestTimesToCall;
        break;

      case IntakeSection.EMERGENCY_CONTACT:
        if (fields.name) updateData.emergency_contact_name_encrypted = await encrypt(fields.name, DataType.PHI);
        if (fields.relationship) updateData.emergency_contact_relationship = fields.relationship;
        if (fields.phone) updateData.emergency_contact_phone_encrypted = await encrypt(fields.phone, DataType.PHI);
        if (fields.releaseOfInfoStatus !== undefined) updateData.release_of_info_status = fields.releaseOfInfoStatus;
        if (fields.releaseOfInfoDate) updateData.release_of_info_date = fields.releaseOfInfoDate.toISOString().split('T')[0];
        break;
    }

    // Update participant record with new data
    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('participants')
        .update(updateData)
        .eq('id', intakeSession.participant_id);

      if (updateError) {
        throw new Error(`Failed to update participant: ${updateError.message}`);
      }

      // Log data changes for audit trail
      for (const [fieldName, newValue] of Object.entries(updateData)) {
        if (fieldName !== 'updated_at') {
          await logDataChange({
            userId,
            participantId: intakeSession.participant_id,
            tableName: 'participants',
            recordId: intakeSession.participant_id,
            fieldName,
            oldValue: participant[fieldName] || '',
            newValue: String(newValue),
            changeReason: `Intake section ${sectionData.section} updated`,
            timestamp: new Date(),
          });
        }
      }
    }

    // Check if section is now complete
    const sectionComplete = isSectionComplete(sectionData.section, fields);
    const completedSections = intakeSession.completed_sections || [];

    // Update completed sections if this section is now complete
    if (sectionComplete && !completedSections.includes(sectionData.section)) {
      completedSections.push(sectionData.section);
    }

    // Update intake session
    const { error: sessionUpdateError } = await supabase
      .from('intake_sessions')
      .update({
        last_updated_at: new Date().toISOString(),
        current_section: sectionData.section,
        completed_sections: completedSections,
      })
      .eq('id', intakeId);

    if (sessionUpdateError) {
      throw new Error(`Failed to update intake session: ${sessionUpdateError.message}`);
    }

    // Log PHI access for audit trail
    await logPHIAccess({
      userId,
      participantId: intakeSession.participant_id,
      accessType: 'write',
      dataType: 'intake',
      purpose: `Saved progress for section ${sectionData.section}`,
      timestamp: new Date(),
      ipAddress: '0.0.0.0',
      deviceId: 'mobile-app',
    });
  } catch (error) {
    console.error('Error saving intake progress:', error);
    throw error;
  }
}

/**
 * Gets completion status for an intake session
 * Requirement 2.7: Mark intake as complete when all required fields are filled
 * @param intakeId - ID of the intake session
 * @param userId - ID of the user requesting status
 * @returns Intake completion status
 */
export async function getCompletionStatus(
  intakeId: string,
  userId: string
): Promise<IntakeCompletionStatus> {
  if (!intakeId) {
    throw new Error('Intake ID is required');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Get intake session
    const { data: intakeSession, error: fetchError } = await supabase
      .from('intake_sessions')
      .select('*')
      .eq('id', intakeId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch intake session: ${fetchError.message}`);
    }

    if (!intakeSession) {
      throw new Error('Intake session not found');
    }

    // Get participant data to check field completion
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('*')
      .eq('id', intakeSession.participant_id)
      .single();

    if (participantError) {
      throw new Error(`Failed to fetch participant: ${participantError.message}`);
    }

    if (!participant) {
      throw new Error('Participant not found');
    }

    // Calculate completion status
    const allSections = Object.values(IntakeSection);
    const completedSections = intakeSession.completed_sections || [];
    const totalSections = allSections.length;
    const completedCount = completedSections.length;
    const percentComplete = Math.round((completedCount / totalSections) * 100);

    // Find missing sections
    const missingSections = allSections.filter((s) => !completedSections.includes(s));

    // Find missing required fields across all sections
    const requiredFieldsMissing: string[] = [];

    for (const section of allSections) {
      const requiredFields = REQUIRED_FIELDS[section];
      for (const field of requiredFields) {
        // Map field names to database columns and check if they exist
        let fieldValue = null;

        switch (section) {
          case IntakeSection.IDENTIFIERS:
            if (field === 'firstName') fieldValue = participant.first_name_encrypted;
            if (field === 'lastName') fieldValue = participant.last_name_encrypted;
            if (field === 'dateOfBirth') fieldValue = participant.date_of_birth_encrypted;
            break;
          case IntakeSection.CONTACT:
            if (field === 'phone') fieldValue = participant.phone_encrypted;
            break;
        }

        if (!fieldValue) {
          requiredFieldsMissing.push(`${section}.${field}`);
        }
      }
    }

    // Check if intake should be marked complete
    const isComplete = requiredFieldsMissing.length === 0 && missingSections.length === 0;

    // Update intake session if now complete
    if (isComplete && !intakeSession.is_complete) {
      const { error: updateError } = await supabase
        .from('intake_sessions')
        .update({
          is_complete: true,
          completed_at: new Date().toISOString(),
        })
        .eq('id', intakeId);

      if (updateError) {
        console.error('Failed to mark intake as complete:', updateError);
      }

      // Update participant intake_complete flag
      await supabase
        .from('participants')
        .update({ intake_complete: true })
        .eq('id', intakeSession.participant_id);

      // Log completion
      await logPHIAccess({
        userId,
        participantId: intakeSession.participant_id,
        accessType: 'write',
        dataType: 'intake',
        purpose: 'Marked intake as complete',
        timestamp: new Date(),
        ipAddress: '0.0.0.0',
        deviceId: 'mobile-app',
      });
    }

    const status: IntakeCompletionStatus = {
      totalSections,
      completedSections: completedCount,
      percentComplete,
      missingSections,
      requiredFieldsMissing,
    };

    return status;
  } catch (error) {
    console.error('Error getting completion status:', error);
    throw error;
  }
}
