# Supabase Database Migrations

This directory contains SQL migration files for the LOG Peer Recovery System database schema.

## Overview

The migrations create a complete HIPAA-compliant database schema with:
- Row Level Security (RLS) policies
- Field-level encryption for PHI
- Comprehensive audit logging
- Performance indexes
- Immutable audit trails

## Migration Files

The migrations should be applied in order:

1. **20240101000000_create_core_tables.sql**
   - Creates organizations, users, and participants tables
   - Implements RLS policies for access control
   - Requirements: 9.3, 11.4

2. **20240101000001_create_consent_tables.sql**
   - Creates consents table for 42 CFR Part 2 and AI consent
   - Adds expiration tracking and status management
   - Requirements: 1.1, 1.2, 1.3, 1.4

3. **20240101000002_create_intake_assessment_tables.sql**
   - Creates intake_sessions and assessments tables
   - Supports multi-session intake with flexible section ordering
   - Includes SUPRT-C, BARC-10, and SSM assessments
   - Requirements: 2.1, 3.1, 4.1

4. **20240101000003_create_logging_tables.sql**
   - Creates interactions, audit_logs, and queries tables
   - Implements immutable audit log rules
   - Comprehensive PHI access tracking
   - Note: interactions.linked_goal_id FK constraint added in migration 5
   - Requirements: 5.1, 5.4, 5.5, 7.8

5. **20240101000004_create_recovery_plan_tables.sql**
   - Creates recovery_plans, goals, and progress_notes tables
   - Automatic goal completion tracking
   - Adds FK constraint from interactions.linked_goal_id to goals.id
   - Requirements: 6.1, 6.6

## Applying Migrations

### Using Supabase CLI

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Link to your Supabase project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. Apply migrations:
   ```bash
   supabase db push
   ```

### Using Supabase Dashboard

1. Navigate to your Supabase project dashboard
2. Go to the SQL Editor
3. Copy and paste each migration file in order
4. Execute each migration

### Manual Application

You can also apply migrations directly using `psql`:

```bash
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/20240101000000_create_core_tables.sql
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/20240101000001_create_consent_tables.sql
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/20240101000002_create_intake_assessment_tables.sql
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/20240101000003_create_logging_tables.sql
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/20240101000004_create_recovery_plan_tables.sql
```

## Key Features

### Row Level Security (RLS)

All tables have RLS enabled with policies that:
- Restrict access to organization-level data
- Implement minimum necessary access principle
- Enforce role-based permissions (peer_specialist, supervisor, admin)
- Ensure assigned peer specialists can only access their participants

### Encryption

The following fields are encrypted at the application level before storage:
- Participant names (first, middle, last)
- SSN
- Date of birth
- Contact information (email, phone, address)
- Emergency contact information
- Insurance member IDs
- Consent signatures

### Audit Logging

The `audit_logs` table is immutable (append-only) and tracks:
- PHI access (who, when, what, why)
- Data changes (old value, new value, who changed it)
- Session lifecycle (start, end, summary)
- Security events (unauthorized access, threats)
- Consent events (capture, revocation)
- Query execution (natural language queries)

### Indexes

Comprehensive indexes are created for:
- Common query patterns
- Foreign key relationships
- Date-based queries
- Status filtering
- Full-text search (where applicable)

### Helper Views

Several views are created for common queries:
- `expiring_consents` - Consents expiring within 30 days
- `active_consents_by_participant` - Quick consent status lookup
- `incomplete_intakes` - In-progress intake sessions
- `baseline_assessments` - First assessment of each type
- `latest_assessments` - Most recent assessment of each type
- `active_recovery_plans` - Active plans with goal statistics
- `overdue_goals` - Goals past their target date
- `pending_follow_ups` - Interactions requiring follow-up
- `phi_access_log` - PHI access audit trail
- `security_events` - Security event log

## HIPAA Compliance Checklist

Before using this database in production:

- [ ] Sign Business Associate Agreement (BAA) with Supabase
- [ ] Enable database encryption at rest
- [ ] Configure TLS 1.2+ for all connections
- [ ] Set up automatic backups with encryption
- [ ] Configure audit log retention (minimum 7 years)
- [ ] Implement application-level field encryption for PHI
- [ ] Set up AWS KMS for encryption key management
- [ ] Configure session timeout (15 minutes)
- [ ] Enable MFA for all database access
- [ ] Set up monitoring and alerting for security events
- [ ] Document data retention and deletion policies
- [ ] Implement secure data deletion procedures

## Testing

After applying migrations, verify:

1. All tables are created:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```

2. RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   ```

3. Indexes are created:
   ```sql
   SELECT tablename, indexname 
   FROM pg_indexes 
   WHERE schemaname = 'public' 
   ORDER BY tablename, indexname;
   ```

4. Audit log immutability:
   ```sql
   -- This should fail:
   UPDATE audit_logs SET timestamp = NOW() WHERE id = 'some-id';
   
   -- This should also fail:
   DELETE FROM audit_logs WHERE id = 'some-id';
   ```

## Rollback

To rollback migrations, you'll need to drop tables in reverse order:

```sql
-- Drop in reverse order to respect foreign key constraints
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

**Warning**: This will delete all data. Only use in development/testing environments.

## Support

For issues or questions:
1. Check the design document: `.kiro/specs/log-peer-recovery-system/design.md`
2. Review requirements: `.kiro/specs/log-peer-recovery-system/requirements.md`
3. Consult Supabase documentation: https://supabase.com/docs
