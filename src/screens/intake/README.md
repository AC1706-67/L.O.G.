# Intake Module Screens

This directory contains the mobile UI screens for the participant intake workflow.

## Components

### IntakeSessionScreen
Main screen for managing intake sessions with section selection and progress tracking.

**Features:**
- Section selection interface with visual progress indicators
- Progress bar showing completion percentage
- Save and resume functionality
- Automatic progress tracking
- Complete intake workflow

**Requirements Addressed:**
- 2.1: Create new intake record with unique client identifier
- 2.2: Save progress automatically after each response
- 2.3: Resume incomplete intake and continue from last saved point
- 2.6: Support flexible section order

### IntakeFormScreen
Dynamic form screen for collecting intake data across all 11 sections.

**Features:**
- All 11 section forms (Identifiers, Contact, Demographics, Health, Substance Use, Behavioral Health, Social Drivers, Family, Insurance, Engagement, Emergency Contact)
- Field validation with error messages
- Voice/Text input toggle
- Auto-save functionality
- Multi-select and single-select options
- Boolean switches
- Date and number inputs

**Requirements Addressed:**
- 2.9: Collect identifiers (firstName, lastName, dateOfBirth, SSN)
- 2.10: Collect contact information
- 2.11: Collect additional contact information (parole officer, probation officer, case worker)
- 2.12: Collect demographics
- 2.13: Collect health information
- 2.14: Collect substance use history
- 2.15: Collect MAT provider information
- 2.16: Collect behavioral health information
- 2.17: Collect social drivers
- 2.18: Collect family information
- 2.19: Collect insurance information
- 2.20: Collect engagement preferences
- 2.21: Collect emergency contact information
- 8.1: Provide voice input capability
- 8.2: Provide text input capability
- 8.5: Allow users to switch between voice and text input

## Usage

### Starting a New Intake
```typescript
navigation.navigate('IntakeSession', {
  participantId: 'participant-uuid',
  participantName: 'John Doe',
  onComplete: () => {
    // Handle completion
  },
});
```

### Resuming an Existing Intake
```typescript
navigation.navigate('IntakeSession', {
  participantId: 'participant-uuid',
  participantName: 'John Doe',
  intakeId: 'intake-uuid',
  onComplete: () => {
    // Handle completion
  },
});
```

## Data Flow

1. **IntakeSessionScreen** displays all sections and progress
2. User selects a section to complete
3. **IntakeFormScreen** displays fields for that section
4. User fills in fields (voice or text input)
5. Auto-save triggers after each field change
6. User saves section and returns to IntakeSessionScreen
7. Progress updates automatically
8. Process repeats until all sections complete

## Field Validation

The form implements validation for:
- Required fields (marked with *)
- Email format
- Phone number format (minimum 10 digits)
- Date of birth (cannot be in future, reasonable age range)
- Health ratings (1-5 scale)
- Age values (0-120 range)
- ZIP code format

## Voice Input

When voice input is enabled:
- A microphone indicator appears
- Text fields become read-only
- Voice transcription populates fields automatically
- Users can switch back to text input at any time

## Auto-Save

The intake form automatically saves progress:
- After each field change
- When navigating between sections
- When the app is backgrounded
- Ensures no data loss during multi-session intake

## Styling

The screens follow the app's design system:
- Clean, modern interface
- Clear visual hierarchy
- Accessible touch targets
- Consistent color scheme
- Responsive layouts
