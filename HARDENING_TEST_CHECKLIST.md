# Hardening Test Checklist

## Pre-Test Setup

- [ ] Apply all migrations (20240101000006, 20240101000007, 20240101000008)
- [ ] Rebuild app: `npx react-native run-android`
- [ ] Clear app data to ensure fresh state
- [ ] Have test user logged in with valid organization

## A) Participants Screen Tests

### Test 1: Add Participant with Full Data ✅
**Input:** "Sarah M, 28, housing stable, using alcohol and cannabis, on buprenorphine"

- [ ] Opens add modal
- [ ] Enters natural language input
- [ ] Taps "Add Participant"
- [ ] Success alert shows with client_id
- [ ] Participant appears in list
- [ ] Verify in database: housing_stability='stable', mat_type='buprenorphine', mat_status=true

### Test 2: Add Participant with Minimal Data ✅
**Input:** "John"

- [ ] Opens add modal
- [ ] Enters only name
- [ ] Taps "Add Participant"
- [ ] Success alert shows
- [ ] Verify in database: housing_stability='unknown', mat_type=null, dob='UNKNOWN'

### Test 3: Add Participant with Missing Name ❌
**Input:** "28 years old, homeless"

- [ ] Opens add modal
- [ ] Enters data without name
- [ ] Taps "Add Participant"
- [ ] Error alert: "Could not extract participant name"
- [ ] Modal stays open
- [ ] No participant created

### Test 4: Add Participant with Invalid Data ✅
**Input:** "Mike, 999 years old, housing: invalid, on fake_medication"

- [ ] Opens add modal
- [ ] Enters invalid data
- [ ] Taps "Add Participant"
- [ ] Success alert shows (sanitization works)
- [ ] Verify in database: age=null, housing_stability='unknown', mat_type=null

### Test 5: Search Participants
- [ ] Add multiple participants
- [ ] Search by client_id
- [ ] Search by alias_nickname
- [ ] Search by status
- [ ] Verify filtered results correct

### Test 6: Organization Isolation
- [ ] Login as User A (Org 1)
- [ ] Add participant
- [ ] Logout, login as User B (Org 2)
- [ ] Verify User B cannot see User A's participant
- [ ] Try to manually query with User A's org_id (should fail via RLS)

## B) Assessments Screen Tests

### Test 7: Start Assessment ✅
- [ ] Select participant
- [ ] Select assessment type (BARC-10)
- [ ] Tap "Start Assessment"
- [ ] Conversation modal opens
- [ ] System message displays

### Test 8: Crisis Detection - High Risk ⚠️
**Scenario:** Mention suicidal ideation in conversation

- [ ] Start assessment
- [ ] Enter message indicating crisis (e.g., "I've been thinking about ending it all")
- [ ] AI response triggers crisis detection
- [ ] Alert shows: "⚠️ Crisis Detected"
- [ ] Alert shows risk level: HIGH or IMMEDIATE
- [ ] Alert shows indicators
- [ ] Tap "Call 988 Crisis Line"
- [ ] Phone dialer opens to tel:988
- [ ] Verify in database: crisis_detected=true, crisis_risk_level='high', crisis_acknowledged_at set

### Test 9: Crisis Detection - Low Risk ✅
**Scenario:** Normal conversation without crisis indicators

- [ ] Start assessment
- [ ] Have normal conversation
- [ ] No crisis alert shown
- [ ] Verify in database: crisis_detected=false or null

### Test 10: Transcript Minimization
- [ ] Start assessment
- [ ] Have conversation with >20 turns
- [ ] Complete assessment
- [ ] Verify in database: conversation_transcript has max 20 turns
- [ ] Verify system prompts excluded

### Test 11: Complete Assessment
- [ ] Start assessment
- [ ] Have conversation
- [ ] Tap "Complete"
- [ ] Confirm completion
- [ ] Assessment marked complete
- [ ] Appears in list with "Complete" badge

## C) Recovery Plans Screen Tests

### Test 12: Create Plan (No Existing Plan) ✅
- [ ] Select participant with no active plan
- [ ] Tap "Create Plan"
- [ ] Plan created successfully
- [ ] Goal conversation starts
- [ ] Verify in database: overall_status='active'

### Test 13: Prevent Duplicate Active Plan ❌
- [ ] Select participant with existing active plan
- [ ] Tap "Create Plan"
- [ ] Alert: "Active Plan Exists"
- [ ] Option to add goals to existing plan
- [ ] No duplicate plan created
- [ ] Verify in database: only one active plan per participant

### Test 14: Double-Tap Prevention
- [ ] Select participant with no active plan
- [ ] Rapidly tap "Create Plan" twice
- [ ] First tap creates plan
- [ ] Second tap shows "Active Plan Exists" alert
- [ ] No error thrown
- [ ] Verify in database: only one plan created

### Test 15: Create Goal with Valid Description ✅
- [ ] Start goal conversation
- [ ] Provide clear goal: "Find stable housing within 3 months"
- [ ] AI extracts description, category, target_date
- [ ] Tap "Save Goal"
- [ ] Success alert shows
- [ ] Goal appears in plan

### Test 16: Create Goal without Description ❌
- [ ] Start goal conversation
- [ ] Provide vague input: "I want to do better"
- [ ] AI doesn't extract clear description
- [ ] Tap "Save Goal"
- [ ] Alert: "Missing Description"
- [ ] Prompted to continue conversation
- [ ] Goal not saved

### Test 17: Goal Field Validation
- [ ] Create goal with invalid category
- [ ] Verify sanitized to "Other"
- [ ] Create goal with invalid date
- [ ] Verify target_date set to null
- [ ] Create goal with non-array action_steps
- [ ] Verify sanitized to empty array

### Test 18: Update Goal Status
- [ ] View plan goals
- [ ] Tap "Update Status" on a goal
- [ ] Select new status
- [ ] Verify status updated
- [ ] Verify database trigger logs status change

### Test 19: Auto-Complete Plan
- [ ] Create plan with 2 goals
- [ ] Mark first goal "Completed"
- [ ] Mark second goal "Completed"
- [ ] Verify plan overall_status changes to "completed"
- [ ] Verify database trigger worked

## D) Security Tests

### Test 20: RLS Enforcement
- [ ] Login as User A (Org 1)
- [ ] Note participant_id from Org 1
- [ ] Logout, login as User B (Org 2)
- [ ] Try to access Org 1 participant via direct query
- [ ] Verify RLS blocks access
- [ ] Verify no data leakage

### Test 21: No PHI in Logs (Production Build)
- [ ] Build production APK
- [ ] Install on device
- [ ] Perform all operations
- [ ] Check logcat: `adb logcat | grep -i "participant\|crisis\|assessment"`
- [ ] Verify no PHI in logs
- [ ] Only generic error messages

### Test 22: Organization Spoofing Prevention
- [ ] Intercept network request (e.g., with proxy)
- [ ] Try to modify organization_id in request body
- [ ] Verify RLS rejects unauthorized access
- [ ] Verify server-side enforcement works

## E) Edge Cases

### Test 23: Network Failure
- [ ] Disable network
- [ ] Try to add participant
- [ ] Verify graceful error handling
- [ ] Enable network
- [ ] Retry operation
- [ ] Verify success

### Test 24: Concurrent Operations
- [ ] Open app on two devices with same user
- [ ] Device A: Start creating plan
- [ ] Device B: Start creating plan for same participant
- [ ] Verify unique index prevents duplicate
- [ ] Verify one succeeds, one shows "Active Plan Exists"

### Test 25: Large Data Sets
- [ ] Add 100+ participants
- [ ] Verify list loads with pagination
- [ ] Verify search still works
- [ ] Verify no performance issues

## Test Results Template

```
Date: ___________
Tester: ___________
Build: ___________

Participants Screen:
- Test 1: [ ] Pass [ ] Fail - Notes: ___________
- Test 2: [ ] Pass [ ] Fail - Notes: ___________
- Test 3: [ ] Pass [ ] Fail - Notes: ___________
- Test 4: [ ] Pass [ ] Fail - Notes: ___________
- Test 5: [ ] Pass [ ] Fail - Notes: ___________
- Test 6: [ ] Pass [ ] Fail - Notes: ___________

Assessments Screen:
- Test 7: [ ] Pass [ ] Fail - Notes: ___________
- Test 8: [ ] Pass [ ] Fail - Notes: ___________
- Test 9: [ ] Pass [ ] Fail - Notes: ___________
- Test 10: [ ] Pass [ ] Fail - Notes: ___________
- Test 11: [ ] Pass [ ] Fail - Notes: ___________

Recovery Plans Screen:
- Test 12: [ ] Pass [ ] Fail - Notes: ___________
- Test 13: [ ] Pass [ ] Fail - Notes: ___________
- Test 14: [ ] Pass [ ] Fail - Notes: ___________
- Test 15: [ ] Pass [ ] Fail - Notes: ___________
- Test 16: [ ] Pass [ ] Fail - Notes: ___________
- Test 17: [ ] Pass [ ] Fail - Notes: ___________
- Test 18: [ ] Pass [ ] Fail - Notes: ___________
- Test 19: [ ] Pass [ ] Fail - Notes: ___________

Security Tests:
- Test 20: [ ] Pass [ ] Fail - Notes: ___________
- Test 21: [ ] Pass [ ] Fail - Notes: ___________
- Test 22: [ ] Pass [ ] Fail - Notes: ___________

Edge Cases:
- Test 23: [ ] Pass [ ] Fail - Notes: ___________
- Test 24: [ ] Pass [ ] Fail - Notes: ___________
- Test 25: [ ] Pass [ ] Fail - Notes: ___________

Overall Status: [ ] All Pass [ ] Some Failures
Critical Issues: ___________
```
