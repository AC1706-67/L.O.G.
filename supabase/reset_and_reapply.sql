-- ============================================================================
-- RESET DATABASE - Development Only
-- ============================================================================
-- WARNING: This will delete ALL data and tables
-- Only use this in development/testing environments
-- ============================================================================

-- Drop all tables in reverse order (respects foreign key constraints)
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

-- ============================================================================
-- Now apply migrations in order:
-- 1. Run: 20240101000000_create_core_tables.sql
-- 2. Run: 20240101000001_create_consent_tables.sql
-- 3. Run: 20240101000002_create_intake_assessment_tables.sql
-- 4. Run: 20240101000003_create_logging_tables.sql (FIXED VERSION)
-- 5. Run: 20240101000004_create_recovery_plan_tables.sql
-- ============================================================================
