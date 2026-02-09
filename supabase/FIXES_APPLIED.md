# Migration Fixes Applied

## Issue 1: Circular Dependency (Migration 3 → Goals Table)

**Problem**: Migration 3 (logging tables) referenced `goals` table before it was created in migration 5.

**Fix Applied**:
- ✅ Removed FK constraint from `interactions.linked_goal_id` in migration 3
- ✅ Added FK constraint in migration 5 after `goals` table is created
- ✅ Updated documentation

**Files Modified**:
- `20240101000003_create_logging_tables.sql`
- `20240101000004_create_recovery_plan_tables.sql`
- `README.md`
- `MIGRATION_SUMMARY.md`

---

## Issue 2: Non-Immutable Function in Index Predicate

**Problem**: Index used `CURRENT_DATE` in WHERE clause, which is not immutable.

```sql
-- FAILED:
CREATE INDEX idx_goals_overdue ON goals(target_date, status)
  WHERE status IN ('Not Started', 'In Progress') AND target_date < CURRENT_DATE;
```

**Error**: `functions in index predicate must be marked IMMUTABLE`

**Fix Applied**:
- ✅ Removed `CURRENT_DATE` from index predicate
- ✅ Index now filters only by status (still efficient)
- ✅ Date filtering happens in the `overdue_goals` view (correct place)

```sql
-- FIXED:
CREATE INDEX idx_goals_overdue ON goals(target_date, status)
  WHERE status IN ('Not Started', 'In Progress');
```

**Files Modified**:
- `20240101000004_create_recovery_plan_tables.sql`
- `TROUBLESHOOTING.md`

---

## How to Apply Migrations Now

All issues are fixed! You can now apply migrations successfully:

### Option A: Using Supabase CLI (Recommended)

```bash
cd log-peer-recovery
supabase db push
```

### Option B: Manual Application (SQL Editor)

If you need to start fresh:

1. **Reset database** (if needed):
   ```bash
   # Run the reset script in SQL Editor:
   # supabase/reset_and_reapply.sql
   ```

2. **Apply migrations in order**:
   - ✅ `20240101000000_create_core_tables.sql`
   - ✅ `20240101000001_create_consent_tables.sql`
   - ✅ `20240101000002_create_intake_assessment_tables.sql`
   - ✅ `20240101000003_create_logging_tables.sql` (FIXED - no goals dependency)
   - ✅ `20240101000004_create_recovery_plan_tables.sql` (FIXED - no CURRENT_DATE in index)

### Option C: Continue from Where You Left Off

If migrations 1-3 already succeeded:

1. Just run migration 4: `20240101000004_create_recovery_plan_tables.sql`
2. Done!

---

## Verification

After applying all migrations, verify success:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Should return:
-- assessments
-- audit_logs
-- consents
-- goals
-- intake_sessions
-- interactions
-- organizations
-- participants
-- progress_notes
-- queries
-- recovery_plans
-- users

-- Check the FK constraint was added
SELECT
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'interactions'
  AND kcu.column_name = 'linked_goal_id';

-- Should return:
-- table_name: interactions
-- column_name: linked_goal_id
-- foreign_table_name: goals
```

---

## Summary

✅ **Issue 1 Fixed**: Circular dependency resolved by deferring FK constraint  
✅ **Issue 2 Fixed**: Removed non-immutable function from index predicate  
✅ **All migrations ready**: Can now be applied without errors  
✅ **Documentation updated**: README, TROUBLESHOOTING, and MIGRATION_SUMMARY  

**Status**: Ready to apply! 🚀

---

## Next Steps After Successful Migration

1. ✅ Verify all tables and indexes created
2. ✅ Test RLS policies
3. ✅ Confirm audit log immutability
4. ✅ Sign BAA with Supabase
5. ✅ Configure encryption keys (AWS KMS)
6. ✅ Begin Task 4: Session Logger Component implementation

---

**Last Updated**: After fixing CURRENT_DATE index issue  
**Migration Files Version**: Final (all issues resolved)
