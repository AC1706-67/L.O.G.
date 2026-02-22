-- Migration: Fix RLS policies with secure split policies
-- Description: Replace FOR ALL policies with explicit SELECT/INSERT/UPDATE/DELETE policies
--              to prevent self-assignment bypass and ensure proper WITH CHECK clauses

-- ============================================================================
-- PARTICIPANTS TABLE - Secure Split Policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS participants_access ON participants;
DROP POLICY IF EXISTS participants_assigned_peer_access ON participants;
DROP POLICY IF EXISTS participants_org_or_assigned ON participants;

-- SELECT: Can see org participants OR assigned to them
CREATE POLICY participants_select ON participants
  FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org() 
    OR assigned_peer_id = auth.uid()
  );

-- INSERT: Can only insert into their own org (prevents self-assignment bypass)
CREATE POLICY participants_insert ON participants
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org());

-- UPDATE: Can update if they can see it, but can't change org (prevents org hopping)
CREATE POLICY participants_update ON participants
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org() 
    OR assigned_peer_id = auth.uid()
  )
  WITH CHECK (organization_id = get_user_org());

-- DELETE: Can only delete participants in their own org
CREATE POLICY participants_delete ON participants
  FOR DELETE
  TO authenticated
  USING (organization_id = get_user_org());

-- ============================================================================
-- ASSESSMENTS TABLE - Secure Split Policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS assessments_access ON assessments;
DROP POLICY IF EXISTS assessments_assigned_access ON assessments;

-- SELECT: Can see assessments for org participants OR assigned participants
CREATE POLICY assessments_select ON assessments
  FOR SELECT
  TO authenticated
  USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
    OR participant_id IN (
      SELECT id FROM participants 
      WHERE assigned_peer_id = auth.uid()
    )
  );

-- INSERT: Can only insert for org participants
CREATE POLICY assessments_insert ON assessments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
  );

-- UPDATE: Can update if they can see it, but can't change participant
CREATE POLICY assessments_update ON assessments
  FOR UPDATE
  TO authenticated
  USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
    OR participant_id IN (
      SELECT id FROM participants 
      WHERE assigned_peer_id = auth.uid()
    )
  )
  WITH CHECK (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
  );

-- DELETE: Can only delete assessments for org participants
CREATE POLICY assessments_delete ON assessments
  FOR DELETE
  TO authenticated
  USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
  );

-- ============================================================================
-- RECOVERY_PLANS TABLE - Secure Split Policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS recovery_plans_access ON recovery_plans;
DROP POLICY IF EXISTS recovery_plans_assigned_access ON recovery_plans;

-- SELECT: Can see plans for org participants OR assigned participants
CREATE POLICY recovery_plans_select ON recovery_plans
  FOR SELECT
  TO authenticated
  USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
    OR participant_id IN (
      SELECT id FROM participants 
      WHERE assigned_peer_id = auth.uid()
    )
  );

-- INSERT: Can only insert for org participants
CREATE POLICY recovery_plans_insert ON recovery_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
  );

-- UPDATE: Can update if they can see it, but can't change participant
CREATE POLICY recovery_plans_update ON recovery_plans
  FOR UPDATE
  TO authenticated
  USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
    OR participant_id IN (
      SELECT id FROM participants 
      WHERE assigned_peer_id = auth.uid()
    )
  )
  WITH CHECK (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
  );

-- DELETE: Can only delete plans for org participants
CREATE POLICY recovery_plans_delete ON recovery_plans
  FOR DELETE
  TO authenticated
  USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
  );

-- ============================================================================
-- INTERACTIONS TABLE - Secure Split Policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS interactions_org_or_staff ON interactions;

-- SELECT: Can see interactions for org participants OR created by them
CREATE POLICY interactions_select ON interactions
  FOR SELECT
  TO authenticated
  USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
    OR staff_id = auth.uid()
  );

-- INSERT: Can only insert for org participants
CREATE POLICY interactions_insert ON interactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
  );

-- UPDATE: Can update if they can see it, but can't change participant
CREATE POLICY interactions_update ON interactions
  FOR UPDATE
  TO authenticated
  USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
    OR staff_id = auth.uid()
  )
  WITH CHECK (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
  );

-- DELETE: Can only delete interactions for org participants
CREATE POLICY interactions_delete ON interactions
  FOR DELETE
  TO authenticated
  USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
  );

-- ============================================================================
-- CONSENTS TABLE - Secure Split Policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS consents_access ON consents;
DROP POLICY IF EXISTS consents_org_access ON consents;

-- SELECT: Can see consents for org participants
CREATE POLICY consents_select ON consents
  FOR SELECT
  TO authenticated
  USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
  );

-- INSERT: Can only insert for org participants
CREATE POLICY consents_insert ON consents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
  );

-- UPDATE: Can only update consents for org participants
CREATE POLICY consents_update ON consents
  FOR UPDATE
  TO authenticated
  USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
  )
  WITH CHECK (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
  );

-- DELETE: Can only delete consents for org participants
CREATE POLICY consents_delete ON consents
  FOR DELETE
  TO authenticated
  USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE organization_id = get_user_org()
    )
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Log success
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Secure RLS Policies Applied';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'All policies now use explicit SELECT/INSERT/UPDATE/DELETE';
  RAISE NOTICE 'INSERT policies prevent self-assignment bypass';
  RAISE NOTICE 'UPDATE policies prevent organization hopping';
  RAISE NOTICE 'All policies target authenticated role only';
  RAISE NOTICE '=================================================================';
END $$;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON POLICY participants_select ON participants IS 
  'Users can SELECT participants in their org OR assigned to them';

COMMENT ON POLICY participants_insert ON participants IS 
  'Users can only INSERT participants into their own org (prevents self-assignment bypass)';

COMMENT ON POLICY participants_update ON participants IS 
  'Users can UPDATE participants they can see, but cannot change organization_id (prevents org hopping)';

COMMENT ON POLICY participants_delete ON participants IS 
  'Users can only DELETE participants in their own org';
