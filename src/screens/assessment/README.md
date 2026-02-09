# Assessment Screens

This directory contains all screens related to conducting and viewing assessments (BARC-10 and SUPRT-C).

## Screens

### AssessmentSelectionScreen
- Allows peer specialists to select which assessment to conduct (BARC-10 or SUPRT-C)
- Shows whether the assessment will be a baseline or follow-up
- Displays assessment descriptions and estimated completion times
- **Requirements**: 3.1, 4.1

### AssessmentConversationScreen
- Conversational UI for conducting assessments with Nova AI integration
- Supports both voice and text input (voice input placeholder for future implementation)
- Real-time progress tracking with question counter
- Auto-saves responses after each question
- Handles assessment completion and navigation to results
- **Requirements**: 3.1, 4.1

### AssessmentResultsScreen
- Displays assessment scores with interpretation (BARC-10)
- Shows baseline comparison with change metrics and trend visualization
- Displays individual item scores with visual bars
- Provides summary for SUPRT-C assessments
- Links to assessment history
- **Requirements**: 4.6, 4.8

### AssessmentHistoryScreen
- Lists all past assessments for a participant
- Separate tabs for BARC-10 and SUPRT-C
- Trend visualization chart for BARC-10 scores over time
- Tappable cards to view detailed results
- **Requirements**: 4.6, 4.8

## Data Flow

1. **Start Assessment**: User selects assessment type → `AssessmentSelectionScreen`
2. **Conduct Assessment**: Conversational interface → `AssessmentConversationScreen`
3. **View Results**: Score display and interpretation → `AssessmentResultsScreen`
4. **Review History**: Past assessments and trends → `AssessmentHistoryScreen`

## Integration Points

### Assessment Engine Module
- `startBARC10()` - Initialize BARC-10 assessment
- `startSUPRTC()` - Initialize SUPRT-C assessment
- `processResponse()` - Save assessment responses
- `calculateScore()` - Calculate BARC-10 total score
- `storeAssessment()` - Store completed assessment
- `getAssessmentHistory()` - Retrieve past assessments
- `compareToBaseline()` - Calculate progress metrics

### Nova AI Service (Future)
- Voice transcription via AWS Transcribe
- Natural language understanding for response interpretation
- Structured data extraction from conversational responses
- Contextual follow-up question generation

## UI Components

### Conversational Interface
- Message bubbles (assistant and user)
- Text input with send button
- Voice input button (placeholder)
- Progress indicator
- Auto-scrolling message list

### Results Display
- Large score display with interpretation
- Baseline comparison metrics
- Trend indicators (improving/stable/declining)
- Individual item score bars
- Action buttons

### History View
- Type selector tabs
- Trend chart visualization
- Assessment cards with scores
- Empty state handling

## Future Enhancements

1. **Voice Input**: Integrate AWS Transcribe for voice-to-text
2. **Nova AI Integration**: Use Amazon Nova for intelligent conversation flow
3. **Advanced Visualizations**: More detailed charts and graphs
4. **Export Functionality**: PDF reports of assessment results
5. **Reminders**: Notifications for scheduled follow-up assessments
6. **Offline Support**: Queue assessments when offline, sync when online
