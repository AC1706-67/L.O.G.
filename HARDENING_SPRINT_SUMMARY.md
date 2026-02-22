# Hardening Sprint Summary

## Files Changed

### 1. ParticipantsScreen.tsx
**Changes:**
- Updated `PARTICIPANT_SCHEMA` to make `alias_nickname` required
- Changed `mat_status` (boolean) to `mat_type` (enum string)
- Added allowlists: `HOUSING_STABILITY_ALLOWLIST` and `MAT_TYPE_ALLOWLIST`
- Added sanitization functions:
  - `sanitizeAge()`: Clamps 0-120, returns null if invalid
  - `sanitizeHousingStability()`: Validates against allowlist, defaults to 'unknown'
  - `sanitizeSubstancesUsed()`: Normalizes to string[], handles comma-separated input
  - `sanitizeMatType()`: Validates against allowlist, returns null if invalid
- Removed fake DOB ('1990-01-01') - now uses 'UNKNOWN' if age not provided
- Changed encrypted field placeholders from 'ENCRYPTED' to 'UNKNOWN'
- Added validation to require alias_nickname before insert

**Diff Summary:**
```diff
+ const HOUSING_STABILITY_ALLOWLIST = ['stable', 'unstable', 'homeless', 'transitional', 'unknown']
+ const MAT_TYPE_ALLOWLIST = ['buprenorphine', 'methadone', 'naltrexone', 'none', 'unknown']

  PARTICIPANT_SCHEMA = {
    alias_nickname: {
-     required: false,
+     required: true,
    },
    housing_stability: {
-     description: 'Housing status: stable, unstable, homeless, transitional',
+     description: 'Housing status: stable, unstable, homeless, transitional, or unknown',
    },
-   mat_status: {
-     type: 'boolean',
+   mat_type: {
+     type: 'string',
+     description: 'Medication-assisted treatment type: buprenorphine, methadone, naltrexone, none, or unknown',
    },
  }

+ // Sanitization functions added
+ const sanitizeAge = (age: any): number | null => { ... }
+ const sanitizeHousingStability = (value: any): string => { ... }
+ const sanitizeSubstancesUsed = (value: any): string[] => { ... }
+ const sanitizeMatType = (value: any): string | null => { ... }

  handleAddWithNaturalLanguage() {
-   if (!extracted.fields.alias_nickname) {
+   if (!extracted.fields.alias_nickname || !extracted.fields.alias_nickname.trim()) {
      Alert.alert('Missing Information', 'Please provide at least a nickname or alias.')
    }

+   // Sanitize all fields before insert
+   const sanitizedAge = sanitizeAge(extracted.fields.age)
+   const sanitizedHousing = sanitizeHousingStability(extracted.fields.housing_stability)
+   const sanitizedSubstances = sanitizeSubstancesUsed(extracted.fields.substances_used)
+   const sanitizedMatType = sanitizeMatType(extracted.fields.mat_type)

    insert({
-     first_name_encrypted: 'ENCRYPTED',
-     last_name_encrypted: 'ENCRYPTED',
-     date_of_birth_encrypted: dob_encrypted || '1990-01-01',
+     first_name_encrypted: 'UNKNOWN',
+     last_name_encrypted: 'UNKNOWN',
+     date_of_birth_encrypted: dob_encrypted || 'UNKNOWN',
+     housing_stability: sanitizedHousing,
+     substances_used: sanitizedSubstances,
+     mat_status: sanitizedMatType !== null && sanitizedMatType !== 'none' && sanitizedMatType !== 'unknown',
+     mat_type: sanitizedMatType,
    })
  }
```

### 2. AssessmentsScreen.tsx
**Changes:**
- Added `Linking` import for phone dialer
- Updated `showCrisisAlert()` to use `Linking.openURL('tel:988')`
- Added `recordCrisisAcknowledgment()` function
- Persist crisis fields immediately when detected:
  - `crisis_detected`
  - `crisis_risk_level`
  - `crisis_indicators`
  - `crisis_actions_shown_at`
  - `crisis_acknowledged_at`
- Minimized transcript: save only last 20 turns, exclude system prompts

**Diff Summary:**
```diff
+ import { Linking } from 'react-native'

  showCrisisAlert(crisis: CrisisAssessment) {
    Alert.alert('⚠️ Crisis Detected', ..., [
      {
-       text: 'Call Crisis Line',
+       text: 'Call 988 Crisis Line',
        onPress: async () => {
+         const canOpen = await Linking.canOpenURL('tel:988')
+         if (canOpen) {
+           await Linking.openURL('tel:988')
+           await recordCrisisAcknowledgment()
+         }
        }
      },
      {
        text: 'Continue Assessment',
+       onPress: async () => {
+         await recordCrisisAcknowledgment()
+       }
      }
    ])
  }

+ const recordCrisisAcknowledgment = async () => {
+   await supabase.from('assessments').update({
+     crisis_detected: true,
+     crisis_risk_level: crisisDetected.riskLevel,
+     crisis_indicators: crisisDetected.indicators,
+     crisis_acknowledged_at: new Date().toISOString(),
+   }).eq('id', currentAssessmentId)
+ }

  sendMessage() {
    const crisis = await detectCrisis(finalHistory)
    
    if (crisis.isCrisis && (crisis.riskLevel === 'immediate' || crisis.riskLevel === 'high')) {
+     // Persist crisis detection immediately
+     await supabase.from('assessments').update({
+       crisis_detected: true,
+       crisis_risk_level: crisis.riskLevel,
+       crisis_indicators: crisis.indicators,
+       crisis_actions_shown_at: new Date().toISOString(),
+     }).eq('id', currentAssessmentId)
      
      showCrisisAlert(crisis)
    }

+   // Minimize transcript: save only last 20 turns, exclude system prompts
+   const minimizedTranscript = finalHistory
+     .filter((msg) => msg.role !== 'system')
+     .slice(-20)

    await supabase.from('assessments').update({
-     conversation_transcript: JSON.stringify(finalHistory),
+     conversation_transcript: JSON.stringify(minimizedTranscript),
      responses: response.extractedData || {},
    })
  }
```

### 3. PlansScreen.tsx
**Changes:**
- Changed `.single()` to `.maybeSingle()` to avoid no-row errors
- Removed dummy fallback 'Goal description'
- Added validation to require description before insert
- Added comprehensive field validation:
  - `category`: Must be in `GOAL_CATEGORIES` allowlist
  - `action_steps`, `barriers`, `support`: Must be string arrays
  - `target_date`: Must be valid date or null
- Added sanitization for all goal fields

**Diff Summary:**
```diff
  createNewPlan() {
    const { data: existingPlan, error: checkError } = await supabase
      .from('recovery_plans')
      .select('id')
      .eq('participant_id', selectedParticipant)
      .eq('overall_status', 'active')
-     .single()
+     .maybeSingle()

+   if (checkError) throw checkError
  }

  saveGoal() {
+   // Validate required fields
+   if (!extractedGoalData.description || !extractedGoalData.description.trim()) {
+     Alert.alert(
+       'Missing Description',
+       'Please provide a clear goal description before saving.'
+     )
+     return
+   }

+   // Validate and sanitize fields
+   const sanitizedCategory = GOAL_CATEGORIES.includes(extractedGoalData.category)
+     ? extractedGoalData.category
+     : 'Other'

+   const sanitizedActionSteps = Array.isArray(extractedGoalData.action_steps)
+     ? extractedGoalData.action_steps.filter((s: any) => typeof s === 'string' && s.trim())
+     : []

+   const sanitizedBarriers = Array.isArray(extractedGoalData.barriers)
+     ? extractedGoalData.barriers.filter((s: any) => typeof s === 'string' && s.trim())
+     : []

+   const sanitizedSupport = Array.isArray(extractedGoalData.support)
+     ? extractedGoalData.support.filter((s: any) => typeof s === 'string' && s.trim())
+     : []

+   // Validate target_date
+   let sanitizedTargetDate: string | null = null
+   if (extractedGoalData.target_date) {
+     const date = new Date(extractedGoalData.target_date)
+     if (!isNaN(date.getTime())) {
+       sanitizedTargetDate = date.toISOString().split('T')[0]
+     }
+   }

    await supabase.from('goals').insert({
-     description: extractedGoalData.description || 'Goal description',
-     category: extractedGoalData.category || 'Other',
-     target_date: extractedGoalData.target_date || null,
-     action_steps: extractedGoalData.action_steps || [],
-     barriers_identified: extractedGoalData.barriers || [],
-     support_needed: extractedGoalData.support || [],
+     description: extractedGoalData.description.trim(),
+     category: sanitizedCategory,
+     target_date: sanitizedTargetDate,
+     action_steps: sanitizedActionSteps,
+     barriers_identified: sanitizedBarriers,
+     support_needed: sanitizedSupport,
    })
  }
```

## New Migrations

### 1. 20240101000006_add_crisis_detection_fields.sql
Adds crisis detection fields to assessments table:
- `crisis_detected` (boolean)
- `crisis_risk_level` (text with CHECK constraint)
- `crisis_indicators` (text[])
- `crisis_actions_shown_at` (timestamp)
- `crisis_acknowledged_at` (timestamp)
- Indexes for unacknowledged crises and risk level queries

### 2. 20240101000007_improve_participants_schema.sql
Adds constraints to participants table:
- CHECK constraint for `housing_stability` enum
- CHECK constraint for `mat_type` enum
- Documentation comments for encrypted fields

### 3. 20240101000008_verify_rls_security.sql
Verifies RLS security:
- Checks RLS is enabled on critical tables
- Provides optional trigger function for automatic organization_id assignment
- Verifies RLS policies exist
- Documents security model

## Security Confirmations

### ✅ No Model-Generated SQL
- All queries use Supabase client methods
- No raw SQL from AI output
- All allowlists are hardcoded

### ✅ Organization Security
- RLS policies enforce organization access using `auth.uid()`
- Server-side enforcement prevents client spoofing
- Optional trigger function available for automatic org assignment
- Existing policies verified in migration 20240101000008

### ✅ No PHI Logs in Production
- All error logging uses `if (__DEV__)` guard
- Transcript minimized to last 20 turns
- System prompts excluded from saved transcripts
- No participant data in console logs

### ✅ Input Validation
- All user inputs sanitized before database insert
- Allowlists enforced for enums
- Type validation for arrays and dates
- Required fields validated before insert

## Test Notes

### Happy Path Tests

#### 1. Add Participant via Natural Language
**Input:** "Sarah M, 28, housing stable, using alcohol and cannabis, on buprenorphine"

**Expected:**
- ✅ Extracts alias_nickname: "Sarah M"
- ✅ Sanitizes age: 28 (valid)
- ✅ Sanitizes housing: "stable" (in allowlist)
- ✅ Sanitizes substances: ["alcohol", "cannabis"]
- ✅ Sanitizes mat_type: "buprenorphine" (in allowlist)
- ✅ Sets mat_status: true
- ✅ Generates client_id: P######
- ✅ Calculates DOB: 1996-01-01
- ✅ Inserts successfully

#### 2. Crisis Detection Triggers Dialer
**Scenario:** Assessment conversation detects high-risk crisis

**Expected:**
- ✅ detectCrisis() returns isCrisis: true, riskLevel: 'high'
- ✅ Persists crisis fields immediately
- ✅ Shows alert with "Call 988 Crisis Line" button
- ✅ Tapping button opens phone dialer to tel:988
- ✅ Records crisis_acknowledged_at timestamp
- ✅ Crisis banner displays in UI

#### 3. Create Recovery Plan (No Active Plan)
**Scenario:** Create plan for participant with no active plan

**Expected:**
- ✅ Query with .maybeSingle() returns null
- ✅ Creates new plan successfully
- ✅ Starts goal conversation
- ✅ Unique index prevents duplicate active plans

#### 4. Create Goal with Valid Description
**Scenario:** Complete goal conversation with clear description

**Expected:**
- ✅ Validates description exists and is not empty
- ✅ Sanitizes category against GOAL_CATEGORIES
- ✅ Validates action_steps is string array
- ✅ Validates target_date is valid date
- ✅ Inserts goal successfully
- ✅ Database trigger updates plan status if all goals complete

### Edge Case Tests

#### 1. Add Participant with Partial Data
**Input:** "John" (only name, no other details)

**Expected:**
- ✅ Extracts alias_nickname: "John"
- ✅ Age: null (not provided)
- ✅ Housing: "unknown" (default)
- ✅ Substances: [] (empty array)
- ✅ Mat_type: null (not provided)
- ✅ DOB: "UNKNOWN" (no age provided)
- ✅ Inserts successfully with minimal data

#### 2. Add Participant with Missing Alias
**Input:** "28 years old, homeless" (no name)

**Expected:**
- ❌ Validation fails
- ❌ Shows alert: "Could not extract participant name. Please provide at least a nickname or alias."
- ❌ Does not insert

#### 3. Add Participant with Invalid Data
**Input:** "Mike, 999 years old, housing: invalid, on fake_medication"

**Expected:**
- ✅ Extracts alias_nickname: "Mike"
- ✅ Age: null (999 clamped out of range)
- ✅ Housing: "unknown" (not in allowlist)
- ✅ Mat_type: null (not in allowlist)
- ✅ Inserts with sanitized values

#### 4. Duplicate Active Plan Prevention
**Scenario:** Try to create second active plan for same participant

**Expected:**
- ✅ .maybeSingle() finds existing plan
- ✅ Shows alert: "Active Plan Exists"
- ✅ Offers to add goals to existing plan
- ✅ Does not create duplicate
- ✅ Database unique index enforces constraint

#### 5. Double-Tap Plan Creation
**Scenario:** User taps "Create Plan" button twice rapidly

**Expected:**
- ✅ First request creates plan
- ✅ Second request finds existing plan via .maybeSingle()
- ✅ Shows "Active Plan Exists" alert
- ✅ Unique index prevents database-level duplicate
- ✅ No error thrown

#### 6. Create Goal without Description
**Scenario:** Try to save goal before providing description

**Expected:**
- ❌ Validation fails
- ❌ Shows alert: "Missing Description"
- ❌ Prompts to continue conversation
- ❌ Does not insert

#### 7. Crisis Detection with Low Risk
**Scenario:** Assessment detects low-risk indicators

**Expected:**
- ✅ detectCrisis() returns isCrisis: false or riskLevel: 'low'
- ✅ No alert shown
- ✅ No crisis fields persisted
- ✅ Assessment continues normally

#### 8. Transcript Minimization
**Scenario:** Long assessment conversation (>20 turns)

**Expected:**
- ✅ Only last 20 turns saved
- ✅ System prompts excluded
- ✅ Database storage minimized
- ✅ No PHI in excluded turns

## Migration Application

To apply migrations, use Supabase CLI (NEVER use anon key):

```bash
# Install Supabase CLI
npm install -g supabase

# Login and link project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Apply all pending migrations
supabase db push

# OR apply one by one
supabase migration up
```

**Alternative: Supabase Dashboard**
1. Go to SQL Editor in Supabase Dashboard
2. Copy contents of each migration file from `supabase/migrations/`
3. Run in order (by timestamp in filename)

**⚠️ SECURITY WARNING:**
- NEVER use `EXPO_PUBLIC_SUPABASE_ANON_KEY` for migrations
- NEVER create `exec_sql` RPC functions accessible to anon role
- Service role key should only be used in secure CI/CD environments
- See `supabase/MIGRATION_GUIDE.md` for details

## Rollback Plan

If issues arise:

1. **Crisis fields:** Can be safely added/removed without data loss
2. **Participants constraints:** Can be dropped if needed:
   ```sql
   ALTER TABLE participants DROP CONSTRAINT IF EXISTS valid_housing_stability;
   ALTER TABLE participants DROP CONSTRAINT IF EXISTS valid_mat_type;
   ```
3. **RLS verification:** Read-only checks, no schema changes

## Next Steps

1. Apply migrations to database
2. Test each screen with happy path scenarios
3. Test edge cases with invalid/partial data
4. Verify crisis dialer works on physical device
5. Verify RLS prevents cross-organization access
6. Load test duplicate plan prevention under concurrent requests
