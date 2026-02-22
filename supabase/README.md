# Supabase Database Setup

This directory contains all database migrations and setup scripts for the LOG Peer Recovery application.

## 🔒 Security Notice

**CRITICAL:** Never use `EXPO_PUBLIC_SUPABASE_ANON_KEY` for database migrations or DDL operations. This key is exposed in client code and should only be used for RLS-protected read/write operations.

## Directory Structure

```
supabase/
├── migrations/           # All database migrations (apply in order)
│   ├── 20240101000000_create_core_tables.sql
│   ├── 20240101000001_create_consent_tables.sql
│   ├── 20240101000002_create_intake_assessment_tables.sql
│   ├── 20240101000003_create_logging_tables.sql
│   ├── 20240101000004_create_recovery_plan_tables.sql
│   ├── 20240101000005_add_dashboard_indexes.sql
│   ├── 20240101000006_add_crisis_detection_fields.sql
│   ├── 20240101000007_improve_participants_schema.sql
│   └── 20240101000008_verify_rls_security.sql
├── complete-setup.sql    # Complete schema (for reference/fresh setup)
├── MIGRATION_GUIDE.md    # Detailed migration instructions
└── README.md            # This file
```

## Quick Start

### Prerequisites

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   cd log-peer-recovery
   supabase link --project-ref YOUR_PROJECT_REF
   ```

### Apply Migrations

**Option 1: Push all pending migrations (Recommended)**
```bash
supabase db push
```

**Option 2: Apply migrations one by one**
```bash
supabase migration up
```

**Option 3: Use Supabase Dashboard**
1. Go to SQL Editor in your Supabase Dashboard
2. Copy contents of each migration file
3. Run in order (by timestamp in filename)

### Verify Setup

Check RLS read access (not definitive table existence):
```bash
cd log-peer-recovery
node check-tables.js
```

For definitive verification, use Supabase Dashboard or CLI:
```bash
supabase db diff
```

## Migration Files

### Core Schema (Required)

1. **20240101000000_create_core_tables.sql**
   - Organizations, users, participants tables
   - RLS policies for organization isolation
   - Audit triggers

2. **20240101000001_create_consent_tables.sql**
   - Consent tracking and management
   - Expiration views

3. **20240101000002_create_intake_assessment_tables.sql**
   - Intake sessions (multi-session support)
   - Assessments (BARC-10, SUPRT-C, SSM)
   - Conversational assessment support

4. **20240101000003_create_logging_tables.sql**
   - Interactions logging
   - Audit logs
   - Query tracking

5. **20240101000004_create_recovery_plan_tables.sql**
   - Recovery plans
   - Goals with SMART criteria
   - Progress notes
   - Auto-completion triggers

### Performance & Features

6. **20240101000005_add_dashboard_indexes.sql**
   - Partial indexes for dashboard queries
   - Performance optimization

7. **20240101000006_add_crisis_detection_fields.sql**
   - Crisis detection tracking
   - Risk level and indicators
   - Acknowledgment timestamps

8. **20240101000007_improve_participants_schema.sql**
   - Enum constraints for housing_stability
   - Enum constraints for mat_type
   - Documentation updates

9. **20240101000008_verify_rls_security.sql**
   - RLS verification checks
   - Security documentation
   - Optional auto-org-assignment trigger

## Database Schema Overview

### Core Tables
- `organizations` - Multi-tenant organization management
- `users` - User accounts with role-based access
- `participants` - Participant records (PHI encrypted)
- `consents` - Consent tracking with expiration

### Assessment & Intake
- `intake_sessions` - Multi-session intake process
- `assessments` - BARC-10, SUPRT-C, SSM assessments
- Crisis detection fields for safety

### Recovery Planning
- `recovery_plans` - Recovery action plans
- `goals` - SMART goals with progress tracking
- `progress_notes` - Goal updates and modifications

### Logging & Audit
- `interactions` - All participant interactions
- `audit_logs` - System audit trail
- `queries` - Query tracking for analytics

## Security Features

### Row Level Security (RLS)
All tables have RLS enabled with policies that:
- Enforce organization-level isolation
- Use `auth.uid()` for server-side enforcement
- Prevent cross-organization data access
- Support role-based access (peer, supervisor, admin)

### Encryption
- PHI fields use application-level encryption
- Encrypted fields stored as TEXT
- Encryption keys managed via AWS KMS

### Audit Trail
- All modifications logged to `audit_logs`
- Triggers capture user, timestamp, and changes
- Immutable audit records

## Common Tasks

### Check Migration Status
```bash
supabase migration list
```

### Create New Migration
```bash
supabase migration new your_migration_name
```

### Reset Database (Development Only)
```bash
supabase db reset
```

### Generate TypeScript Types
```bash
supabase gen types typescript --local > src/types/database.types.ts
```

## Troubleshooting

### "Permission denied" errors
- Using anon key instead of proper authentication
- Use Supabase CLI or Dashboard for migrations
- Check RLS policies are correct

### "Relation already exists" errors
- Migration already applied
- Migrations use `IF NOT EXISTS` for idempotency
- Safe to re-run

### Tables not visible in client
- RLS policies may be blocking access
- Check user authentication
- Verify organization_id matches
- Use `check-tables.js` to test read access

### Migration conflicts
- Ensure migrations applied in order
- Check `supabase migration list` for status
- Use `supabase db diff` to see pending changes

## Best Practices

1. ✅ Always use Supabase CLI or Dashboard for migrations
2. ✅ Test migrations on staging environment first
3. ✅ Write idempotent migrations (safe to re-run)
4. ✅ Keep migrations in version control
5. ✅ Document breaking changes
6. ❌ Never use anon key for DDL operations
7. ❌ Never expose service role key in client code
8. ❌ Never disable RLS on production tables

## Support

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## Related Documentation

- `MIGRATION_GUIDE.md` - Detailed migration instructions
- `../HARDENING_SPRINT_SUMMARY.md` - Recent security improvements
- `../HARDENING_TEST_CHECKLIST.md` - Testing procedures
