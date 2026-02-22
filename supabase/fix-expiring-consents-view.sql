-- Fix security_definer warning for expiring_consents view
-- This script recreates the view with security_invoker option

-- Drop the existing view
DROP VIEW IF EXISTS expiring_consents;

-- Recreate with security_invoker to use caller's permissions
CREATE VIEW expiring_consents 
WITH (security_invoker = true) AS
SELECT 
  c.*,
  p.assigned_peer_id,
  (c.expiration_date - CURRENT_DATE) AS days_until_expiration
FROM consents c
INNER JOIN participants p ON c.participant_id = p.id
WHERE c.status = 'active'
  AND c.expiration_date IS NOT NULL
  AND c.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
ORDER BY c.expiration_date ASC;

-- Add comment back
COMMENT ON VIEW expiring_consents IS 'Active consents expiring within 30 days (Requirement 1.10)';

-- Verify the fix
SELECT 
  v.viewname,
  CASE 
    WHEN position('security_invoker' in pg_catalog.array_to_string(c.reloptions,',')) > 0 
    THEN '✓ FIXED - security_invoker'
    ELSE '✗ Still has issue'
  END AS status
FROM pg_views v
JOIN pg_class c ON c.relname = v.viewname 
WHERE v.viewname = 'expiring_consents' AND v.schemaname = 'public';
