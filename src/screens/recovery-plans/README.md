# Recovery Plans Screens

This directory contains the UI screens for managing participant recovery plans and goals.

## Screens

### RecoveryPlanScreen
Main screen for viewing and managing a participant's recovery plan. Displays all goals with filtering by status.

**Features:**
- View all goals in a recovery plan
- Filter goals by status (All, Not Started, In Progress, Completed, On Hold)
- Create new recovery plan if none exists
- Navigate to goal creation and detail screens
- Display goal progress indicators

**Requirements:** 6.1, 6.6, 6.7

### CreateGoalScreen
Interface for adding new goals to a recovery plan.

**Features:**
- Goal description input
- Category selection (Housing, Employment, Health, Family, Recovery, Education, Legal, Other)
- Target date picker
- Barriers identification
- Support needed specification
- Action steps management

**Requirements:** 6.1, 6.6

### GoalDetailScreen
Detailed view and status update interface for a specific goal.

**Features:**
- View complete goal details
- Display action steps with progress tracking
- View barriers and support needed
- View progress notes history
- Update goal status with progress notes
- Visual progress indicators

**Requirements:** 6.6, 6.7

### GoalTrackingScreen
Advanced goal tracking interface with filters and progress visualization.

**Features:**
- Filter goals by status and category
- Progress visualization charts
- Action step tracking
- Bulk status updates
- Export goal reports

**Requirements:** 6.7, 6.9

## Navigation

These screens are part of the recovery plan navigation flow:

```
RecoveryPlanScreen
  ├─> CreateGoalScreen
  └─> GoalDetailScreen
      └─> GoalTrackingScreen
```

## Data Flow

1. **Plan Creation**: RecoveryPlanScreen → createPlan() → Supabase
2. **Goal Addition**: CreateGoalScreen → addGoal() → Supabase
3. **Status Update**: GoalDetailScreen → updateGoalStatus() → Supabase + Audit Log
4. **Progress Tracking**: GoalTrackingScreen → getGoalsByStatus() → Supabase

## Integration Points

- **Recovery Plan Manager**: All screens use the recovery plan manager module for data operations
- **Session Logger**: Goal modifications are logged for audit trail
- **Navigation**: Screens use React Navigation for routing and parameter passing
- **Auth Context**: User ID is retrieved from auth context for audit logging

## Styling

All screens follow the consistent design system:
- Primary color: #007AFF (iOS blue)
- Success color: #4CAF50 (green)
- Warning color: #FF9500 (orange)
- Error color: #FF3B30 (red)
- Background: #F5F5F5 (light gray)
- Card background: #FFFFFF (white)

## Accessibility

- All interactive elements have appropriate touch targets (minimum 44x44 points)
- Text inputs have clear labels
- Status indicators use both color and icons for accessibility
- Screen readers supported through semantic markup
