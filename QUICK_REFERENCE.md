# Quick Reference Guide

## 🚀 Common Tasks

### Apply Database Migrations
```bash
# Recommended: Use Supabase CLI
supabase db push

# Alternative: Use Dashboard SQL Editor
# Go to Supabase Dashboard > SQL Editor
# Copy/paste migration files in order
```

### Check Table Access (RLS)
```bash
node check-tables.js
```
⚠️ This checks RLS read access, not definitive table existence.

### Run Tests
```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
```

### Start Development
```bash
npm start               # Start Expo
npm run android        # Run on Android
npm run ios            # Run on iOS
```

## 🔒 Security Rules

### ✅ DO
- Use Supabase CLI for migrations
- Use anon key for RLS-protected client operations
- Store service role key in secure CI/CD only
- Enable RLS on all tables
- Sanitize all user inputs
- Use `__DEV__` guards for logs

### ❌ DON'T
- Use anon key for migrations
- Create exec_sql RPC functions
- Expose service role key in client code
- Commit secrets to git
- Log PHI in production
- Disable RLS on production tables

## 📁 Key Files

### Configuration
- `.env` - Environment variables (not in git)
- `app.json` - Expo configuration
- `supabase/config.toml` - Supabase CLI config

### Database
- `supabase/migrations/` - All migrations
- `supabase/MIGRATION_GUIDE.md` - Migration docs
- `check-tables.js` - RLS access check

### Documentation
- `MIGRATION_SECURITY_FIX.md` - Security fix summary
- `SECURITY_AUDIT.md` - Security audit report
- `HARDENING_SPRINT_SUMMARY.md` - Recent improvements
- `HARDENING_TEST_CHECKLIST.md` - Test procedures

### Application
- `src/screens/main/ParticipantsScreen.tsx` - Participant management
- `src/screens/main/AssessmentsScreen.tsx` - Assessments with crisis detection
- `src/screens/main/PlansScreen.tsx` - Recovery plans
- `src/modules/ai/novaService.ts` - Nova AI integration

## 🔑 Environment Variables

### Required (Public)
```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...  # For RLS-protected ops only
```

### Required (Private - AWS)
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
BEDROCK_MODEL_ID=us.amazon.nova-pro-v1:0
```

### Optional (CI/CD Only)
```bash
SUPABASE_SERVICE_ROLE_KEY=xxx  # NEVER in client code or git
```

## 📊 Database Schema

### Core Tables
- `organizations` - Multi-tenant orgs
- `users` - User accounts
- `participants` - Participant records (PHI)
- `consents` - Consent tracking

### Assessments
- `intake_sessions` - Multi-session intake
- `assessments` - BARC-10, SUPRT-C, SSM
- Crisis detection fields

### Recovery
- `recovery_plans` - Recovery plans
- `goals` - SMART goals
- `progress_notes` - Progress tracking

### Logging
- `interactions` - All interactions
- `audit_logs` - Audit trail
- `queries` - Query tracking

## 🧪 Testing Checklist

### Participants Screen
- [ ] Add with full data
- [ ] Add with minimal data
- [ ] Add without name (should fail)
- [ ] Search functionality
- [ ] Organization isolation

### Assessments Screen
- [ ] Start assessment
- [ ] Crisis detection (high risk)
- [ ] Crisis dialer (tel:988)
- [ ] Transcript minimization
- [ ] Complete assessment

### Recovery Plans Screen
- [ ] Create plan (no existing)
- [ ] Prevent duplicate active plan
- [ ] Double-tap prevention
- [ ] Create goal with description
- [ ] Create goal without description (should fail)
- [ ] Update goal status

## 🆘 Troubleshooting

### "Permission denied" errors
- Using anon key for migrations? Use Supabase CLI instead
- RLS blocking access? Check policies and auth

### "Relation already exists" errors
- Migration already applied (safe to ignore)
- Migrations are idempotent

### Tables not visible
- RLS may be blocking access
- Check authentication
- Verify organization_id
- Run `node check-tables.js`

### Crisis dialer not working
- Test on physical device (not emulator)
- Check `Linking.canOpenURL('tel:988')`
- Verify permissions in AndroidManifest.xml

## 📞 Support Resources

- [Supabase Docs](https://supabase.com/docs)
- [Expo Docs](https://docs.expo.dev)
- [React Native Docs](https://reactnative.dev)
- [AWS Bedrock Docs](https://docs.aws.amazon.com/bedrock)

## 🔄 Migration Order

1. `20240101000000_create_core_tables.sql`
2. `20240101000001_create_consent_tables.sql`
3. `20240101000002_create_intake_assessment_tables.sql`
4. `20240101000003_create_logging_tables.sql`
5. `20240101000004_create_recovery_plan_tables.sql`
6. `20240101000005_add_dashboard_indexes.sql` ⚠️ **FIXED** - See MIGRATION_FIX_20240101000005.md
7. `20240101000006_add_crisis_detection_fields.sql`
8. `20240101000007_improve_participants_schema.sql`
9. `20240101000008_verify_rls_security.sql`

⚠️ **Note:** Migration 20240101000005 was corrected to fix incorrect column references (status → is_complete, organization_id → participant_id)

## 🎯 Quick Commands

```bash
# Setup
npm install
supabase login
supabase link --project-ref YOUR_REF

# Development
npm start
npm run android

# Database
supabase db push
supabase db diff
node check-tables.js

# Testing
npm test
npm run test:coverage

# Verification
supabase migration list
supabase db remote commit
```

## 📝 Notes

- All migrations are idempotent (safe to re-run)
- RLS is enabled on all tables
- PHI is encrypted at application level
- Crisis detection runs on every AI response
- Transcript limited to last 20 turns
- Organization isolation enforced by RLS
