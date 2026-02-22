-- Migration: Finalize RLS security with function permissions and performance indexes
-- Description: Secures get_user_org() function and adds indexes for RLS performance

-- ============================================================================
-- SECURE get_user_org() FUNCTION
-- ============================================================================

-- Revoke public execute permission (security hardening)
REVOKE EXECUTE ON FUNCTION get_user_org() FROM public;

-- Grant execute only to authenticated users
GRANT EXECUTE ON FUNCTION get_user_org() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_user_org() IS 
  'Returns the organization_id for the authenticated user. '
  'SECURITY: Only executable by authenticated role. '
  'Used by RLS policies to enforce organization isolation.';

-- ============================================================================
-- PERFORMANCE INDEXES FOR RLS POLICIES
-- ============================================================================

-- Participants table indexes (if not already exist)
CREATE INDEX IF NOT EXISTS idx_participants_organization_id 
  ON participants(organization_id);

CREATE INDEX IF NOT EXISTS idx_participants_assigned_peer_id 
  ON participants(assigned_peer_id)
  WHERE assigned_peer_id IS NOT NULL;

-- Assessments table indexes
CREATE INDEX IF NOT EXISTS idx_assessments_participant_id 
  ON assessments(participant_id);

-- Recovery plans table indexes
CREATE INDEX IF NOT EXISTS idx_recovery_plans_participant_id 
  ON recovery_plans(participant_id);

-- Interactions table indexes
CREATE INDEX IF NOT EXISTS idx_interactions_participant_id 
  ON interactions(participant_id);

CREATE INDEX IF NOT EXISTS idx_interactions_staff_id 
  ON interactions(staff_id)
  WHERE staff_id IS NOT NULL;

-- Consents table indexes
CREATE INDEX IF NOT EXISTS idx_consents_participant_id 
  ON consents(participant_id);

-- Goals table indexes (for recovery plans RLS)
CREATE INDEX IF NOT EXISTS idx_goals_plan_id 
  ON goals(plan_id);

-- Progress notes table indexes (for recovery plans RLS)
CREATE INDEX IF NOT EXISTS idx_progress_notes_goal_id 
  ON progress_notes(goal_id);

-- Intake sessions table indexes
CREATE INDEX IF NOT EXISTS idx_intake_sessions_participant_id 
  ON intake_sessions(participant_id);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify function permissions
DO $$
DECLARE
  public_can_execute BOOLEAN;
  authenticated_can_execute BOOLEAN;
BEGIN
  -- Check if public has execute permission
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_name = 'get_user_org'
      AND grantee = 'public'
      AND privilege_type = 'EXECUTE'
  ) INTO public_can_execute;

  -- Check if authenticated has execute permission
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_name = 'get_user_org'
      AND grantee = 'authenticated'
      AND privilege_type = 'EXECUTE'
  ) INTO authenticated_can_execute;

  IF public_can_execute THEN
    RAISE WARNING 'SECURITY ISSUE: public role can execute get_user_org()';
  ELSE
    RAISE NOTICE 'SECURE: public role cannot execute get_user_org()';
  END IF;

  IF authenticated_can_execute THEN
    RAISE NOTICE 'SECURE: authenticated role can execute get_user_org()';
  ELSE
    RAISE WARNING 'ISSUE: authenticated role cannot execute get_user_org()';
  END IF;
END $$;

-- Log success
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'RLS Security Finalized';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Function permissions secured (authenticated only)';
  RAISE NOTICE 'Performance indexes added for RLS policies';
  RAISE NOTICE 'All security hardening complete';
  RAISE NOTICE '=================================================================';
END $$;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON INDEX idx_participants_organization_id IS 
  'Speeds up RLS policy checks for organization_id = get_user_org()';

COMMENT ON INDEX idx_participants_assigned_peer_id IS 
  'Speeds up RLS policy checks for assigned_peer_id = auth.uid()';

COMMENT ON INDEX idx_assessments_participant_id IS 
  'Speeds up RLS policy joins to participants table';

COMMENT ON INDEX idx_recovery_plans_participant_id IS 
  'Speeds up RLS policy joins to participants table';

COMMENT ON INDEX idx_interactions_participant_id IS 
  'Speeds up RLS policy joins to participants table';

COMMENT ON INDEX idx_interactions_staff_id IS 
  'Speeds up RLS policy checks for staff_id = auth.uid()';

COMMENT ON INDEX idx_consents_participant_id IS 
  'Speeds up RLS policy joins to participants table';
