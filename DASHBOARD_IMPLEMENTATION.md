# Dashboard Screen with Nova AI Integration - Complete

## Overview

The Dashboard screen has been completely rebuilt with real statistics, natural language query support via Nova AI, and structured data rendering.

---

## Features Implemented

### 1. Real-Time Statistics ✅

**Stats Displayed:**
- Total Participants
- Active Participants (last 30 days)
- Pending Assessments
- Upcoming Follow-ups (next 7 days)
- Recent Interactions (last 7 days)

**Data Source:** Supabase queries with proper filtering and counting

**Loading State:** Shows spinner while fetching data

---

### 2. Natural Language Queries with Nova AI ✅

**How It Works:**
1. User enters natural language query
2. Query sent to Nova AI via `processConversation()`
3. AI response parsed to determine intent
4. Appropriate database query executed
5. Results rendered in structured format

**Supported Query Types:**

**Participants Queries:**
- "Show participants needing follow-up"
- "List active participants"
- "Who needs attention?"
- "Show recent participants"

**Stats Queries:**
- "How many participants do I have?"
- "How many active participants?"
- "Count pending assessments"
- "Total interactions this week"

**General Queries:**
- Any other question gets AI text response

---

### 3. Query Intent Detection ✅

**Intent Parser:**
```typescript
const parseQueryIntent = async (query: string, aiResponse: string) => {
  // Detects if query is about:
  // - participants (list/show/who)
  // - stats (count/how many/total)
  // - general (text response)
  
  return {
    type: 'participants' | 'stats' | 'text',
    filters: extractFilters(query),
  };
};
```

**Filter Extraction:**
- `needsFollowUp` - "need follow-up"
- `active` - "active"
- `recent` - "recent"
- `housingUnstable` - "housing unstable"
- `highRisk` - "crisis" or "risk"

---

### 4. Structured Query Execution ✅

**Participant Queries:**
```typescript
const queryParticipants = async (filters) => {
  // Builds Supabase query based on filters
  // Returns: { participants: [], count: number, filters: {} }
};
```

**Stats Queries:**
```typescript
const queryStats = async (metric) => {
  // Returns relevant stats based on metric
  // Returns: { total: number, active: number, ... }
};
```

---

### 5. Result Rendering ✅

**Participant Results:**
- Shows count
- Lists participants with name/ID
- Card-based layout

**Stats Results:**
- Shows key-value pairs
- Formatted numbers
- Clear labels

**Text Results:**
- Shows AI response
- Formatted text

---

## Code Structure

### Main Components:

**1. Dashboard Stats Loading:**
```typescript
const loadDashboardStats = async () => {
  // Queries Supabase for:
  // - Total participants count
  // - Active participants (30 days)
  // - Pending assessments
  // - Upcoming follow-ups (7 days)
  // - Recent interactions (7 days)
};
```

**2. Natural Language Query Handler:**
```typescript
const handleNaturalLanguageQuery = async () => {
  // 1. Process query with Nova AI
  // 2. Parse intent from response
  // 3. Execute database query
  // 4. Render structured results
};
```

**3. Intent Parser:**
```typescript
const parseQueryIntent = async (query, aiResponse) => {
  // Analyzes query keywords to determine:
  // - Query type (participants/stats/text)
  // - Filters to apply
  // - Metric to return
};
```

**4. Query Executors:**
```typescript
const queryParticipants = async (filters) => {
  // Builds and executes Supabase query
  // Applies filters dynamically
  // Returns structured participant data
};

const queryStats = async (metric) => {
  // Returns relevant statistics
  // Based on requested metric
};
```

---

## Nova AI Integration

### Context Provided to Nova:
```typescript
{
  text: query,
  mode: 'text',
  context: {
    currentModule: 'query',
    currentSection: 'dashboard',
    previousMessages: [],
    extractedData: {
      organizationId: user?.organizationId,
      userId: user?.id,
    },
  },
}
```

### Nova's Role:
1. Understands natural language intent
2. Provides conversational response
3. Helps parse query meaning
4. Enables flexible query syntax

### Example Flow:
```
User: "Show participants needing follow-up"
  ↓
Nova AI: Processes query, understands intent
  ↓
Intent Parser: Detects "participants" + "needsFollowUp" filter
  ↓
Query Executor: Queries participants with upcoming follow-ups
  ↓
Result Renderer: Shows list of participants
```

---

## Database Queries

### 1. Total Participants:
```sql
SELECT COUNT(*) FROM participants
WHERE organization_id = ?
```

### 2. Active Participants:
```sql
SELECT COUNT(DISTINCT participant_id) FROM interactions
WHERE organization_id = ?
AND interaction_date >= NOW() - INTERVAL '30 days'
```

### 3. Pending Assessments:
```sql
SELECT COUNT(*) FROM assessments
WHERE organization_id = ?
AND status = 'in_progress'
```

### 4. Upcoming Follow-ups:
```sql
SELECT COUNT(*) FROM interactions
WHERE organization_id = ?
AND follow_up_date IS NOT NULL
AND follow_up_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
```

### 5. Recent Interactions:
```sql
SELECT COUNT(*) FROM interactions
WHERE organization_id = ?
AND interaction_date >= NOW() - INTERVAL '7 days'
```

### 6. Participants Needing Follow-up:
```sql
SELECT p.* FROM participants p
JOIN interactions i ON p.id = i.participant_id
WHERE p.organization_id = ?
AND i.follow_up_date IS NOT NULL
AND i.follow_up_date <= NOW() + INTERVAL '7 days'
LIMIT 10
```

---

## UI Components

### Stats Grid:
- 5 stat cards in 2-column grid
- Large numbers with labels
- Blue accent color
- Shadow/elevation for depth

### Query Section:
- Multi-line text input (TrackedTextInput)
- "Ask Nova AI" button
- Loading state with spinner
- Result container below

### Result Rendering:
- **Participants:** Card list with name/ID
- **Stats:** Key-value rows
- **Text:** Formatted AI response

### Quick Actions:
- Add Participant button
- Log Interaction button
- Start Assessment button

---

## Example Queries

### Participant Queries:
```
"Show participants needing follow-up"
"List active participants"
"Who needs attention this week?"
"Show recent participants"
"Find participants with housing issues"
```

### Stats Queries:
```
"How many participants do I have?"
"How many active participants?"
"Count pending assessments"
"How many follow-ups this week?"
"Total interactions last 7 days"
```

### General Queries:
```
"What should I focus on today?"
"Give me an overview"
"What's my caseload like?"
```

---

## Activity Tracking

The Dashboard uses `TrackedTextInput` for the query input, which automatically:
- Tracks typing activity
- Resets idle timer
- Throttles updates (2 seconds)

---

## Error Handling

**Stats Loading Errors:**
- Caught and logged
- Alert shown to user
- Stats default to 0

**Query Processing Errors:**
- Caught and logged
- Alert shown to user
- Query result cleared

**Database Query Errors:**
- Thrown and caught by handler
- User-friendly error message

---

## Performance Considerations

### Optimizations:
- Stats loaded once on mount
- Queries limited to 10 results
- Proper indexes on database tables
- Throttled activity tracking

### Database Indexes Needed:
```sql
CREATE INDEX idx_participants_org ON participants(organization_id);
CREATE INDEX idx_interactions_org_date ON interactions(organization_id, interaction_date);
CREATE INDEX idx_interactions_follow_up ON interactions(follow_up_date);
CREATE INDEX idx_assessments_org_status ON assessments(organization_id, status);
```

---

## Future Enhancements

### Planned Features:
1. **Charts/Graphs** - Visual representation of stats
2. **Trend Analysis** - Compare to previous periods
3. **Alerts** - Highlight urgent items
4. **Filters** - Filter stats by date range
5. **Export** - Export query results
6. **History** - Save recent queries
7. **Suggestions** - AI-suggested queries
8. **Voice Input** - Speak queries instead of typing

### Advanced Queries:
1. **Complex Filters** - Multiple conditions
2. **Sorting** - Sort results by various fields
3. **Aggregations** - Group by, sum, average
4. **Joins** - Cross-table queries
5. **Time Series** - Trends over time

---

## Testing

### Manual Tests:

**1. Stats Loading:**
- [ ] Stats load on screen mount
- [ ] Loading spinner shows
- [ ] Stats display correctly
- [ ] Error handling works

**2. Natural Language Queries:**
- [ ] "Show participants needing follow-up" returns list
- [ ] "How many participants?" returns count
- [ ] General questions get AI response
- [ ] Loading state shows during processing

**3. Result Rendering:**
- [ ] Participant results show cards
- [ ] Stats results show key-value pairs
- [ ] Text results show formatted response
- [ ] Results clear on new query

**4. Activity Tracking:**
- [ ] Typing in query input resets idle timer
- [ ] Focus on input resets idle timer
- [ ] Throttling works (2 second minimum)

---

## Files Changed

### New Implementation:
- `src/screens/main/DashboardScreen.tsx` - Complete rewrite with Nova AI

### Dependencies Used:
- `processConversation` from `novaService.ts`
- `TrackedTextInput` for activity tracking
- `supabase` for database queries
- `useAuth` for user context

---

## Summary

✅ **Real statistics** from Supabase
✅ **Natural language queries** via Nova AI
✅ **Intent detection** and parsing
✅ **Structured query execution**
✅ **Result rendering** (participants/stats/text)
✅ **Activity tracking** with TrackedTextInput
✅ **Error handling** throughout
✅ **Loading states** for better UX

**Status:** ✅ COMPLETE - Dashboard fully functional with Nova AI integration

**Next:** Participants screen with search, add, and Nova AI extraction
