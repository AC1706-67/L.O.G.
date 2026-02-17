-- ============================================================================
-- FIX: Drop problematic policies and reset database
-- ============================================================================
-- Run this first to clean up the infinite recursion issue
-- ============================================================================

-- Drop all policies that are causing infinite recursion
DROP POLICY IF EXISTS organizations_access ON organizations;
DROP POLICY IF EXISTS users_access ON users;
DROP POLICY IF EXISTS participants_access ON participants;
DROP POLICY IF EXISTS participants_assigned_peer_access ON participants;
DROP POLICY IF EXISTS consents_access ON consents;
DROP POLICY IF EXISTS consents_assigned_access ON consents;
DROP POLICY IF EXISTS interactions_access ON interactions;
DROP POLICY IF EXISTS interactions_create_as_self ON interactions;
DROP POLICY IF EXISTS audit_logs_read ON audit_logs;
DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;
DROP POLICY IF EXISTS queries_access ON queries;
DROP POLICY IF EXISTS queries_supervisor_access ON queries;
DROP POLICY IF EXISTS intake_sessions_access ON intake_sessions;
DROP POLICY IF EXISTS assessments_access ON assessments;
DROP POLICY IF EXISTS intake_sessions_assigned_access ON intake_sessions;
DROP POLICY IF EXISTS assessments_assigned_access ON assessments;
DROP POLICY IF EXISTS recovery_plans_access ON recovery_plans;
DROP POLICY IF EXISTS recovery_plans_assigned_access ON recovery_plans;
DROP POLICY IF EXISTS goals_access ON goals;
DROP POLICY IF EXISTS progress_notes_access ON progress_notes;
DROP POLICY IF EXISTS progress_notes_create_as_self ON progress_notes;

-- Drop all tables if they exist (to start fresh)
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

-- Success message
SELECT 'Database cleaned successfully. Now run complete-setup.sql' AS message;
