-- Migration: Harden get_user_org() function with safe search_path
-- Description: Prevents search_path attacks and ensures STABLE + SECURITY DEFINER are set correctly

-- ============================================================================
-- UPDATE get_user_org() WITH SECURITY HARDENING
-- ============================================================================

-- Update function in-place (preserves dependent RLS policies)
CREATE OR REPLACE FUNCTION public.get_user_org()
RETURNS uuid
LANGUAGE sql
STABLE                    -- Function result doesn't change within a transaction
SECURITY DEFINER          -- Runs with privileges of function owner
SET search_path = public  -- Prevents search_path injection attacks
AS $$
  SELECT organization_id
  FROM public.users
  WHERE id = auth.uid();
$$;

-- ============================================================================
-- SECURE FUNCTION PERMISSIONS
-- ============================================================================

-- Revoke from anon (anonymous users shouldn't call this)
REVOKE EXECUTE ON FUNCTION public.get_user_org() FROM anon;

-- Revoke from public (belt and suspenders)
REVOKE EXECUTE ON FUNCTION public.get_user_org() FROM public;

-- Grant only to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_org() TO authenticated;

-- ============================================================================
-- UPDATE FUNCTION DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.get_user_org() IS 
  'Returns the organization_id for the authenticated user. '
  'SECURITY: STABLE + SECURITY DEFINER + search_path=public. '
  'Only executable by authenticated role. '
  'Used by RLS policies to enforce organization isolation. '
  'Prevents search_path injection attacks.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify function properties
DO $$
DECLARE
  func_volatility TEXT;
  func_security TEXT;
  func_config TEXT[];
BEGIN
  -- Get function properties
  SELECT 
    p.provolatile,
    p.prosecdef,
    p.proconfig
  INTO 
    func_volatility,
    func_security,
    func_config
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'get_user_org';

  -- Check volatility (should be 's' for STABLE)
  IF func_volatility = 's' THEN
    RAISE NOTICE 'SECURE: get_user_org() is STABLE';
  ELSE
    RAISE WARNING 'ISSUE: get_user_org() volatility is % (should be STABLE)', func_volatility;
  END IF;

  -- Check security definer
  IF func_security THEN
    RAISE NOTICE 'SECURE: get_user_org() is SECURITY DEFINER';
  ELSE
    RAISE WARNING 'ISSUE: get_user_org() is not SECURITY DEFINER';
  END IF;

  -- Check search_path
  IF func_config IS NOT NULL AND 'search_path=public' = ANY(func_config) THEN
    RAISE NOTICE 'SECURE: get_user_org() has search_path=public';
  ELSE
    RAISE WARNING 'ISSUE: get_user_org() does not have search_path=public set';
  END IF;
END $$;

-- Verify permissions
DO $$
DECLARE
  anon_can_execute BOOLEAN;
  public_can_execute BOOLEAN;
  authenticated_can_execute BOOLEAN;
BEGIN
  -- Check anon
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'get_user_org'
      AND grantee = 'anon'
      AND privilege_type = 'EXECUTE'
  ) INTO anon_can_execute;

  -- Check public
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'get_user_org'
      AND grantee = 'public'
      AND privilege_type = 'EXECUTE'
  ) INTO public_can_execute;

  -- Check authenticated
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'get_user_org'
      AND grantee = 'authenticated'
      AND privilege_type = 'EXECUTE'
  ) INTO authenticated_can_execute;

  -- Report results
  IF anon_can_execute THEN
    RAISE WARNING 'SECURITY ISSUE: anon role can execute get_user_org()';
  ELSE
    RAISE NOTICE 'SECURE: anon role cannot execute get_user_org()';
  END IF;

  IF public_can_execute THEN
    RAISE WARNING 'SECURITY ISSUE: public role can execute get_user_org()';
  ELSE
    RAISE NOTICE 'SECURE: public role cannot execute get_user_org()';
  END IF;

  IF authenticated_can_execute THEN
    RAISE NOTICE 'SECURE: authenticated role can execute get_user_org()';
  ELSE
    RAISE WARNING 'ISSUE: authenticated role cannot execute get_user_org() (RLS will fail)';
  END IF;
END $$;

-- Log success
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'get_user_org() Function Hardened';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Properties: STABLE + SECURITY DEFINER + search_path=public';
  RAISE NOTICE 'Permissions: authenticated only (anon and public revoked)';
  RAISE NOTICE 'Protection: Prevents search_path injection attacks';
  RAISE NOTICE '=================================================================';
END $$;
