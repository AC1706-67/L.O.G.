# Interaction Logging Screens

This directory contains the UI screens for logging and viewing participant interactions.

## Screens

### InteractionLogScreen
Main screen for logging new interactions with participants. Supports both quick notes and detailed session notes.

**Features:**
- Interaction type selector (Session Note, Quick Note, Phone Call, etc.)
- Date and time selection
- Duration and location tracking
- Summary text input
- Follow-up tracking with date selection
- Goal linking capability

**Requirements:** 5.1, 5.2, 5.3

**Usage:**
```typescript
navigation.navigate('InteractionLog', {
  participantId: 'participant-uuid',
  participantName: 'John Doe',
  mode: 'quick' | 'session'
});
```

### InteractionHistoryScreen
Displays all interactions for a participant with filtering and follow-up reminders.

**Features:**
- List of all interactions sorted by date
- Filter by: All, Follow-ups, Recent (30 days)
- Follow-up reminders section showing upcoming follow-ups
- Visual indicators for overdue, due today, and upcoming follow-ups
- Quick access to add new interactions

**Requirements:** 5.9

**Usage:**
```typescript
navigation.navigate('InteractionHistory', {
  participantId: 'participant-uuid',
  participantName: 'John Doe'
});
```

### InteractionDetailScreen
Shows detailed view of a single interaction.

**Features:**
- Complete interaction details
- Date, time, duration, and location
- Full summary text
- Follow-up information
- Metadata (staff ID, recorded timestamp)

**Requirements:** 5.9

**Usage:**
```typescript
navigation.navigate('InteractionDetail', {
  interactionId: 'interaction-uuid',
  participantId: 'participant-uuid',
  participantName: 'John Doe'
});
```

## Data Flow

1. **Logging Interaction:**
   - User fills out form in `InteractionLogScreen`
   - Data validated and submitted
   - `logInteraction()` from `sessionLogger` module called
   - Interaction stored in `interactions` table
   - User redirected back to history

2. **Viewing History:**
   - `InteractionHistoryScreen` loads all interactions from database
   - Filters applied based on user selection
   - Follow-up reminders calculated and displayed
   - User can tap to view details or add new interaction

3. **Viewing Details:**
   - `InteractionDetailScreen` loads single interaction
   - All fields displayed in organized sections
   - User can navigate back to history

## Integration Points

### Database Tables
- `interactions` - Main table for storing interaction records

### Modules
- `logging/sessionLogger` - Core logging functionality
- `logging/types` - Type definitions for interactions

### Navigation
Add these routes to your navigation configuration:
```typescript
InteractionLog: {
  participantId: string;
  participantName: string;
  mode: 'quick' | 'session';
};
InteractionHistory: {
  participantId: string;
  participantName: string;
};
InteractionDetail: {
  interactionId: string;
  participantId: string;
  participantName: string;
};
```

## Compliance Notes

All interactions are logged for HIPAA and 42 CFR Part 2 compliance:
- Timestamp recorded for all interactions
- Staff ID captured automatically
- PHI access logged via audit trail
- Follow-up tracking ensures continuity of care
- All data encrypted at rest in database

## Future Enhancements

- Voice input for summary field
- Attachment support (photos, documents)
- Bulk export for reporting
- Advanced search and filtering
- Integration with calendar for follow-up reminders
- Push notifications for upcoming follow-ups
