# Migration Troubleshooting Guide

## Common Issues and Solutions

### Issue: "relation 'goals' does not exist" when running migration 3

**Problem**: Migration 3 (logging tables) originally had a foreign key reference to the `goals` table, but `goals` isn't created until migration 5.

**Solution**: This has been fixed. The foreign key constraint is now deferred:
- Migration 3 creates `interactions.linked_goal_id` as a plain UUID column (no FK)
- Migration 5 creates the `goals` table, then adds the FK constraint

**Action Required**: Apply migrations in order (1 → 2 → 3 → 4 → 5)

---

### Issue: Migrations applied out of order

**Problem**: If you applied migration 5 before migration 3, you may have dependency issues.

**Solution**: 
1. Drop all tables and start fresh:
   ```sql
   DROP TABLE IF EXISTS progress_notes CASCADE;
   DROP TABLE IF EXISTS goals CASCADE;
   DROP TABLE IF EXISTS recovery_plans CASCADE;
   DROP TABLE IF EXISTS queries CASCADE;
   DROP TABLE IF EXISTS audit_logs CASCADE;
   DROP TABLE IF EXISTS interactions CASCADE;
   DROP TABLE IF EXISTS assessments CASCADE;
   DROP TABLE IF EXISTS intake_sessions CASCADE;
   DROP TABLE IF EXISTS consents CASCADE;
   DROP TABLE IF EXISTS participants CASCADE;
   DROP TABLE IF EXISTS users CASCADE;
   DROP TABLE IF EXISTS organizations CASCADE;
   ```

2. Apply migrations in correct order (1 → 2 → 3 → 4 → 5)

---

### Issue: "duplicate key value violates unique constraint"

**Problem**: Trying to apply migrations that have already been applied.

**Solution**: Check which migrations have been applied:
```sql
SELECT * FROM _migrations ORDER BY version;
```

If using Supabase CLI, it tracks migrations automatically. If applying manually, skip already-applied migrations.

---

### Issue: RLS policies preventing data access

**Problem**: After applying migrations, you can't query tables even as admin.

**Solution**: RLS policies require authentication context. Either:

1. Disable RLS temporarily for testing:
   ```sql
   ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
   ```

2. Use service role key (bypasses RLS) in your application

3. Ensure `auth.uid()` is set correctly in your session

---

### Issue: "permission denied for table"

**Problem**: User doesn't have permissions to create tables or modify schema.

**Solution**: Ensure you're connected as a superuser or database owner:
```sql
-- Check current user
SELECT current_user;

-- Grant necessary permissions
GRANT ALL ON SCHEMA public TO your_user;
```

---

### Issue: Audit logs can't be updated or deleted

**Problem**: This is intentional! Audit logs are immutable.

**Solution**: This is by design for compliance. Audit logs are append-only:
- Updates are blocked by `audit_logs_no_update` rule
- Deletes are blocked by `audit_logs_no_delete` rule

If you need to remove test data, you must drop and recreate the table.

---

### Issue: Foreign key constraint violations

**Problem**: Trying to insert data that references non-existent records.

**Solution**: Ensure parent records exist before inserting child records:

Correct order:
1. organizations
2. users
3. participants
4. consents, intake_sessions, assessments, recovery_plans
5. interactions, goals
6. progress_notes

---

### Issue: JSONB validation errors

**Problem**: Invalid JSON in JSONB fields.

**Solution**: Ensure JSON is valid before inserting:
```sql
-- Test JSON validity
SELECT '{"key": "value"}'::jsonb;

-- For action_steps in goals table
INSERT INTO goals (plan_id, description, category, action_steps)
VALUES (
  'plan-uuid',
  'Find housing',
  'Housing',
  '[{"stepId": "1", "description": "Contact housing agency", "completed": false}]'::jsonb
);
```

---

### Issue: Timestamp timezone issues

**Problem**: Timestamps showing wrong timezone.

**Solution**: All timestamps use `TIMESTAMP WITH TIME ZONE`. Ensure your client handles timezones correctly:
```sql
-- Set timezone for session
SET timezone = 'America/New_York';

-- Or use UTC (recommended)
SET timezone = 'UTC';
```

---

### Issue: Array fields not working as expected

**Problem**: Can't query or update array fields properly.

**Solution**: Use PostgreSQL array syntax:
```sql
-- Insert array
INSERT INTO participants (client_id, race_ethnicity)
VALUES ('P001', ARRAY['Hispanic', 'White']);

-- Query array
SELECT * FROM participants 
WHERE 'Hispanic' = ANY(race_ethnicity);

-- Update array (append)
UPDATE participants 
SET race_ethnicity = array_append(race_ethnicity, 'Asian')
WHERE id = 'participant-uuid';
```

---

### Issue: "functions in index predicate must be marked IMMUTABLE"

**Problem**: Trying to use `CURRENT_DATE`, `NOW()`, or other non-immutable functions in an index WHERE clause.

**Solution**: This has been fixed in the migrations. PostgreSQL doesn't allow non-immutable functions in index predicates because they change over time. Instead:

- Use the function in the view's WHERE clause (allowed)
- Create a simpler index without the date comparison
- Filter by date at query time

Example of the fix:
```sql
-- WRONG (causes error):
CREATE INDEX idx_goals_overdue ON goals(target_date, status)
  WHERE status IN ('Not Started', 'In Progress') AND target_date < CURRENT_DATE;

-- CORRECT:
CREATE INDEX idx_goals_overdue ON goals(target_date, status)
  WHERE status IN ('Not Started', 'In Progress');

-- Then filter in the view or query:
SELECT * FROM goals 
WHERE status IN ('Not Started', 'In Progress') 
  AND target_date < CURRENT_DATE;
```

---

### Issue: Views not updating with new data

**Problem**: Views show stale data.

**Solution**: Views are not materialized, they query live data. If data seems stale:
1. Check RLS policies aren't filtering data
2. Verify your authentication context
3. Refresh your database connection

---

### Issue: Migration fails with "syntax error"

**Problem**: SQL syntax error in migration file.

**Solution**: 
1. Check PostgreSQL version compatibility (Supabase uses PostgreSQL 15+)
2. Verify all statements end with semicolons
3. Check for unmatched parentheses or quotes
4. Review the specific line number in the error message

---

## Verification Commands

After applying all migrations, verify everything is correct:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check foreign keys
SELECT
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- Check indexes
SELECT 
  tablename, 
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- Test audit log immutability
INSERT INTO audit_logs (log_type, timestamp) 
VALUES ('SECURITY_EVENT', NOW());

-- This should fail:
UPDATE audit_logs SET timestamp = NOW() WHERE log_type = 'SECURITY_EVENT';

-- This should also fail:
DELETE FROM audit_logs WHERE log_type = 'SECURITY_EVENT';
```

---

## Getting Help

If you encounter issues not covered here:

1. Check the migration file comments for requirements and constraints
2. Review the design document: `.kiro/specs/log-peer-recovery-system/design.md`
3. Check Supabase logs in the dashboard
4. Verify PostgreSQL version compatibility
5. Test with a fresh database to rule out state issues

---

## Clean Slate (Development Only)

To completely reset and start over:

```sql
-- Drop all tables (WARNING: deletes all data)
DROP TABLE IF EXISTS progress_notes CASCADE;
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS recovery_plans CASCADE;
DROP TABLE IF EXISTS queries CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS interactions CASCADE;
DROP TABLE IF EXISTS assessments CASCADE;
DROP TABLE IF EXISTS intake_sessions CASCADE;
DROP TABLE IF EXISTS consents CASCADE;
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Drop all views
DROP VIEW IF EXISTS recent_progress_notes CASCADE;
DROP VIEW IF EXISTS goals_by_category CASCADE;
DROP VIEW IF EXISTS overdue_goals CASCADE;
DROP VIEW IF EXISTS active_recovery_plans CASCADE;
DROP VIEW IF EXISTS security_events CASCADE;
DROP VIEW IF EXISTS phi_access_log CASCADE;
DROP VIEW IF EXISTS pending_follow_ups CASCADE;
DROP VIEW IF EXISTS recent_interactions CASCADE;
DROP VIEW IF EXISTS latest_assessments CASCADE;
DROP VIEW IF EXISTS baseline_assessments CASCADE;
DROP VIEW IF EXISTS incomplete_intakes CASCADE;
DROP VIEW IF EXISTS active_consents_by_participant CASCADE;
DROP VIEW IF EXISTS expiring_consents CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS log_goal_status_change CASCADE;
DROP FUNCTION IF EXISTS check_plan_completion CASCADE;
DROP FUNCTION IF EXISTS update_goal_timestamp CASCADE;
DROP FUNCTION IF EXISTS update_recovery_plan_timestamp CASCADE;
DROP FUNCTION IF EXISTS log_data_change CASCADE;
DROP FUNCTION IF EXISTS prevent_completed_assessment_modification CASCADE;
DROP FUNCTION IF EXISTS check_intake_completion CASCADE;
DROP FUNCTION IF EXISTS update_intake_session_timestamp CASCADE;
DROP FUNCTION IF EXISTS prevent_revoked_consent_modification CASCADE;
DROP FUNCTION IF EXISTS expire_consents CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- Now reapply migrations 1 → 2 → 3 → 4 → 5
```

**⚠️ WARNING**: Only use this in development. Never run this in production!
