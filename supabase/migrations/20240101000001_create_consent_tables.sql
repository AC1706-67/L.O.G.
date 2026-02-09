-- Migration: Create consent tables
-- Requirements: 1.1, 1.2, 1.3, 1.4
-- Description: Creates tables for managing 42 CFR Part 2 and AI consent records
--              with encryption, expiration tracking, and audit capabilities

-- ============================================================================
-- CONSENTS TABLE
-- ============================================================================
CREATE TABLE consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('CFR_PART_2', 'AI_PROCESSING', 'COACHING_AGREEMENT', 'ACKNOWLEDGEMENT_OF_RECEIPT')),
  
  -- CFR Part 2 specific fields (Requirements 1.2)
  purpose_of_disclosure TEXT,
  authorized_recipients TEXT[],
  information_to_disclose TEXT,
  expiration_date DATE,
  right_to_revoke_acknowledged BOOLEAN,
  
  -- AI consent specific fields (Requirements 1.4)
  ai_explanation TEXT,
  data_protection_assurance TEXT,
  opt_out_option_presented BOOLEAN,
  
  -- Common fields (Requirements 1.3, 1.5)
  participant_name TEXT NOT NULL,
  participant_dob DATE NOT NULL,
  signature_encrypted TEXT NOT NULL,
  date_signed DATE NOT NULL,
  witness_name TEXT,
  witness_signature_encrypted TEXT,
  
  -- Status tracking (Requirements 1.9, 1.10, 1.11)
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  revoked_date DATE,
  revoked_reason TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  -- Constraints
  CONSTRAINT cfr_part_2_required_fields CHECK (
    consent_type != 'CFR_PART_2' OR (
      purpose_of_disclosure IS NOT NULL AND
      authorized_recipients IS NOT NULL AND
      information_to_disclose IS NOT NULL AND
      expiration_date IS NOT NULL AND
      right_to_revoke_acknowledged IS NOT NULL
    )
  ),
  CONSTRAINT ai_consent_required_fields CHECK (
    consent_type != 'AI_PROCESSING' OR (
      ai_explanation IS NOT NULL AND
      data_protection_assurance IS NOT NULL AND
      opt_out_option_presented IS NOT NULL
    )
  ),
  CONSTRAINT revoked_requires_reason CHECK (
    status != 'revoked' OR (revoked_date IS NOT NULL AND revoked_reason IS NOT NULL)
  )
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for participant consent lookups (Requirement 1.9)
CREATE INDEX idx_consents_participant ON consents(participant_id);

-- Index for consent type queries
CREATE INDEX idx_consents_type ON consents(consent_type);

-- Index for active consents
CREATE INDEX idx_consents_status ON consents(status) WHERE status = 'active';

-- Index for expiration date queries (Requirement 1.10)
-- This enables efficient queries for consents expiring within 30 days
CREATE INDEX idx_consents_expiration ON consents(expiration_date) 
  WHERE status = 'active' AND expiration_date IS NOT NULL;

-- Composite index for participant + type + status (common query pattern)
CREATE INDEX idx_consents_participant_type_status ON consents(participant_id, consent_type, status);

-- Index for created_at for audit queries
CREATE INDEX idx_consents_created_at ON consents(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on consents table
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access consents for participants in their organization
CREATE POLICY consents_access ON consents
  FOR ALL
  USING (
    participant_id IN (
      SELECT p.id FROM participants p
      INNER JOIN users u ON u.organization_id = p.organization_id
      WHERE u.id = auth.uid()
    )
  );

-- Policy: More restrictive access - only assigned peer or supervisors/admins
CREATE POLICY consents_assigned_access ON consents
  FOR SELECT
  USING (
    participant_id IN (
      SELECT p.id FROM participants p
      WHERE p.assigned_peer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
        AND u.role IN ('supervisor', 'admin')
        AND u.organization_id = p.organization_id
      )
    )
  );

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Function to automatically expire consents
CREATE OR REPLACE FUNCTION expire_consents()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if expiration_date has passed and status is still active
  IF NEW.expiration_date IS NOT NULL 
     AND NEW.expiration_date < CURRENT_DATE 
     AND NEW.status = 'active' THEN
    NEW.status = 'expired';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check expiration on insert and update
CREATE TRIGGER check_consent_expiration
  BEFORE INSERT OR UPDATE ON consents
  FOR EACH ROW
  EXECUTE FUNCTION expire_consents();

-- Function to prevent modification of revoked consents
CREATE OR REPLACE FUNCTION prevent_revoked_consent_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'revoked' AND NEW.status != 'revoked' THEN
    RAISE EXCEPTION 'Cannot modify a revoked consent';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent modification of revoked consents
CREATE TRIGGER prevent_revoked_modification
  BEFORE UPDATE ON consents
  FOR EACH ROW
  EXECUTE FUNCTION prevent_revoked_consent_modification();

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View for expiring consents (within 30 days)
CREATE VIEW expiring_consents AS
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

-- View for active consents by participant
CREATE VIEW active_consents_by_participant AS
SELECT 
  participant_id,
  BOOL_OR(consent_type = 'CFR_PART_2' AND status = 'active') AS has_cfr_consent,
  BOOL_OR(consent_type = 'AI_PROCESSING' AND status = 'active') AS has_ai_consent,
  BOOL_OR(consent_type = 'COACHING_AGREEMENT' AND status = 'active') AS has_coaching_consent,
  BOOL_OR(consent_type = 'ACKNOWLEDGEMENT_OF_RECEIPT' AND status = 'active') AS has_acknowledgement,
  MAX(CASE WHEN consent_type = 'CFR_PART_2' AND status = 'active' THEN expiration_date END) AS cfr_expiration_date,
  MAX(CASE WHEN consent_type = 'AI_PROCESSING' AND status = 'active' THEN date_signed END) AS ai_consent_date
FROM consents
GROUP BY participant_id;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE consents IS 'Consent records for 42 CFR Part 2 compliance and AI processing authorization';
COMMENT ON COLUMN consents.signature_encrypted IS 'AES-256 encrypted base64 signature image';
COMMENT ON COLUMN consents.witness_signature_encrypted IS 'AES-256 encrypted base64 witness signature image';
COMMENT ON COLUMN consents.consent_type IS 'Type of consent: CFR_PART_2, AI_PROCESSING, COACHING_AGREEMENT, or ACKNOWLEDGEMENT_OF_RECEIPT';
COMMENT ON COLUMN consents.status IS 'Consent status: active, expired, or revoked';
COMMENT ON COLUMN consents.expiration_date IS 'Date when consent expires (required for CFR Part 2)';

COMMENT ON VIEW expiring_consents IS 'Active consents expiring within 30 days (Requirement 1.10)';
COMMENT ON VIEW active_consents_by_participant IS 'Summary of active consents by participant for quick status checks (Requirement 1.9)';
