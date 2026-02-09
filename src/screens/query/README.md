# Query Screens

This directory contains screens for the natural language query interface.

## Screens

### QueryInputScreen
Main screen for submitting queries with voice/text input, suggestions, and history.
- **Requirements**: 7.1, 7.5
- **Features**:
  - Voice and text input support
  - Predefined query suggestions organized by category
  - Query history with timestamps
  - Real-time query submission

### QueryResultsScreen
Displays query results with natural language responses and data visualizations.
- **Requirements**: 7.3
- **Features**:
  - Natural language response display
  - Data visualizations (charts, tables)
  - Export functionality
  - Related queries suggestions

## Usage

```typescript
import { QueryInputScreen, QueryResultsScreen } from './screens/query';

// Navigate to query input
navigation.navigate('QueryInput');

// Navigate to results with query result
navigation.navigate('QueryResults', { queryResult });
```

## Implementation Notes

- Voice input uses AWS Transcribe (placeholder for future implementation)
- Query processing uses Nova AI for intent interpretation
- Results support multiple visualization types
- Export supports CSV, PDF, and JSON formats
- All queries are logged for audit purposes per Requirements 7.8
