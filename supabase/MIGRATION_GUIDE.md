# Supabase Migration Guide

## ⚠️ SECURITY WARNING

**NEVER use `EXPO_PUBLIC_SUPABASE_ANON_KEY` to run migrations!**

The anon key is:
- Exposed in client-side code
- Intended for read-only or RLS-protected operations
- NOT suitable for DDL operations (CREATE TABLE, ALTER TABLE, etc.)

## Proper Migration Workflow

### Option 1: Supabase CLI (Recommended)

1. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase:**
   ```bash
   supabase login
   ```

3. **Link your project:**
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. **Apply all pending migrations:**
   ```bash
   supabase db push
   ```

   OR apply migrations one by one:
   ```bash
   supabase migration up
   ```

5. **Verify migrations:**
   ```bash
   supabase db diff
   ```

### Option 2: Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of each migration file from `supabase/migrations/`
4. Paste and run in order (by filename timestamp)

### Option 3: Direct psql (Advanced)

If you have direct database access:

```bash
# Get connection string from Supabase Dashboard > Project Settings > Database
export DATABASE_URL="postgresql://..."

# Apply migrations in order
psql $DATABASE_URL -f supabase/migrations/20240101000000_create_core_tables.sql
psql $DATABASE_URL -f supabase/migrations/20240101000001_create_consent_tables.sql
# ... etc
```

## Migration Files

All migrations are in `supabase/migrations/` and follow the naming convention:
```
YYYYMMDDHHMMSS_description.sql
```

### Current Migrations (in order):

1. `20240101000000_create_core_tables.sql` - Organizations, users, participants
2. `20240101000001_create_consent_tables.sql` - Consent tracking
3. `20240101000002_create_intake_assessment_tables.sql` - Intake and assessments
4. `20240101000003_create_logging_tables.sql` - Interactions and audit logs
5. `20240101000004_create_recovery_plan_tables.sql` - Recovery plans and goals
6. `20240101000005_add_dashboard_indexes.sql` - Performance indexes
7. `20240101000006_add_crisis_detection_fields.sql` - Crisis tracking
8. `20240101000007_improve_participants_schema.sql` - Schema constraints
9. `20240101000008_verify_rls_security.sql` - RLS verification

## Creating New Migrations

1. **Using Supabase CLI:**
   ```bash
   supabase migration new your_migration_name
   ```

2. **Manually:**
   - Create file in `supabase/migrations/`
   - Use timestamp format: `YYYYMMDDHHMMSS_description.sql`
   - Write idempotent SQL (use `IF NOT EXISTS`, `IF EXISTS`, etc.)

## Checking Table Access

To verify RLS read access (not definitive table existence):

```bash
node check-tables.js
```

**Note:** This only checks if the anon key can read from tables under RLS policies. It does NOT definitively prove tables exist.

For definitive table existence check:
- Use Supabase Dashboard > Table Editor
- Use Supabase CLI: `supabase db diff`
- Use psql: `\dt` to list tables

## Service Role Key (Private Use Only)

If you need to script migrations in a CI/CD pipeline:

1. **NEVER commit service role key to git**
2. Store in secure environment variables
3. Use only in trusted environments (CI/CD, not client apps)

Example (CI/CD only):
```javascript
// ONLY in secure CI/CD environment, NEVER in client code
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // NOT EXPO_PUBLIC_*
);

// Run migrations via service role
```

## Rollback Strategy

Supabase CLI doesn't support automatic rollbacks. For rollback:

1. Create a new migration that reverses changes
2. Or restore from database backup
3. Or manually revert via SQL Editor

Example rollback migration:
```sql
-- Rollback: Remove crisis detection fields
ALTER TABLE assessments
  DROP COLUMN IF EXISTS crisis_detected,
  DROP COLUMN IF EXISTS crisis_risk_level,
  DROP COLUMN IF EXISTS crisis_indicators,
  DROP COLUMN IF EXISTS crisis_actions_shown_at,
  DROP COLUMN IF EXISTS crisis_acknowledged_at;
```

## Best Practices

1. ✅ Always use Supabase CLI or Dashboard for migrations
2. ✅ Write idempotent migrations (safe to run multiple times)
3. ✅ Test migrations on staging environment first
4. ✅ Keep migrations in version control
5. ✅ Use descriptive migration names
6. ❌ NEVER use anon key for DDL operations
7. ❌ NEVER expose service role key in client code
8. ❌ NEVER create exec_sql RPC functions accessible to anon role

## Troubleshooting

### "Permission denied" errors
- You're likely using anon key instead of service role
- Use Supabase CLI or Dashboard instead

### "Relation already exists" errors
- Migration already applied
- Use `IF NOT EXISTS` in CREATE statements
- Check migration history: `supabase migration list`

### RLS blocking access
- This is expected for security
- Use service role key for admin operations (in secure environment only)
- Or grant specific permissions via RLS policies

## Security Checklist

- [ ] No `EXPO_PUBLIC_SUPABASE_ANON_KEY` used for migrations
- [ ] No `exec_sql` RPC function exposed to anon role
- [ ] Service role key (if used) is in secure environment only
- [ ] Service role key is NOT in git or client code
- [ ] All migrations use Supabase CLI or Dashboard
- [ ] RLS policies are enabled on all tables
- [ ] Migration scripts are idempotent
