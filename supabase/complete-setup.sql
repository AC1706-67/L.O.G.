-- ============================================================================
-- LOG Peer Recovery System - Complete Database Setup
-- ============================================================================
-- Run this entire file in Supabase SQL Editor to create all tables
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Migration: Create core tables (organizations, users, participants)
-- Requirements: 9.3, 11.4
-- Description: Creates the foundational tables for the LOG Peer Recovery System
--              with Row Level Security policies and performance indexes

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ORGANIZATIONS TABLE
-- ============================================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  region TEXT,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for organization lookups
CREATE INDEX idx_organizations_name ON organizations(name);

-- ============================================================================
-- USERS TABLE (Staff)
-- ============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('peer_specialist', 'supervisor', 'admin')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  mfa_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for user lookups
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- PARTICIPANTS TABLE
-- ============================================================================
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  client_id TEXT UNIQUE NOT NULL,
  
  -- Identifiers (encrypted)
  first_name_encrypted TEXT NOT NULL,
  middle_name_encrypted TEXT,
  last_name_encrypted TEXT NOT NULL,
  alias_nickname TEXT,
  ssn_encrypted TEXT,
  date_of_birth_encrypted TEXT NOT NULL,
  
  -- Contact (encrypted)
  email_encrypted TEXT,
  phone_encrypted TEXT,
  address_encrypted TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  county TEXT,
  
  -- Demographics
  race_ethnicity TEXT[],
  sex TEXT,
  gender TEXT,
  pronouns TEXT,
  primary_languages TEXT[],
  veteran_status BOOLEAN,
  
  -- Health
  physical_health_rating INTEGER CHECK (physical_health_rating BETWEEN 1 AND 5),
  hearing_difficulty TEXT,
  vision_difficulty TEXT,
  cognitive_difficulty TEXT,
  mobility_difficulty TEXT,
  self_care_difficulty TEXT,
  independent_living_difficulty TEXT,
  seizure_history BOOLEAN,
  
  -- Substance Use
  recovery_path TEXT,
  substances_used TEXT[],
  challenging_substances TEXT[],
  age_of_first_use INTEGER,
  age_started_regular_use INTEGER,
  last_use_date DATE,
  recovery_date DATE,
  sud_primary_dx TEXT,
  sud_secondary_dx TEXT,
  treatment_history TEXT,
  treatment_services_used TEXT[],
  mat_status BOOLEAN,
  mat_type TEXT,
  narcan_times_received INTEGER,
  emergency_room_visits INTEGER,
  
  -- Behavioral Health
  bh_primary_dx TEXT,
  bh_secondary_dx TEXT,
  ideations_active BOOLEAN,
  mental_health_rating INTEGER CHECK (mental_health_rating BETWEEN 1 AND 5),
  gambling_consequences BOOLEAN,
  
  -- Social Drivers
  financial_hardship BOOLEAN,
  living_situation TEXT,
  living_situation_type TEXT,
  housing_stability TEXT,
  employment_status TEXT,
  education_level TEXT,
  school_enrollment BOOLEAN,
  transportation_barriers TEXT[],
  
  -- Family
  dcfs_involved BOOLEAN,
  custody_status TEXT,
  number_of_children INTEGER,
  pregnancy_status BOOLEAN,
  due_date DATE,
  marital_status TEXT,
  
  -- Insurance
  has_insurance BOOLEAN,
  insurance_type TEXT,
  insurance_provider TEXT,
  insurance_member_id_encrypted TEXT,
  insurance_group_id TEXT,
  insurance_start DATE,
  insurance_end DATE,
  medications_covered BOOLEAN,
  
  -- Engagement
  program TEXT,
  assigned_peer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discharged')),
  receives_calls BOOLEAN,
  receives_coaching BOOLEAN,
  coaching_frequency TEXT,
  best_days_to_call TEXT[],
  best_times_to_call TEXT[],
  
  -- Emergency Contact (encrypted)
  emergency_contact_name_encrypted TEXT,
  emergency_contact_relationship TEXT,
  emergency_contact_phone_encrypted TEXT,
  release_of_info_status BOOLEAN,
  release_of_info_date DATE,
  
  -- Metadata
  intake_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Indexes for participant lookups and queries
CREATE INDEX idx_participants_organization ON participants(organization_id);
CREATE INDEX idx_participants_client_id ON participants(client_id);
CREATE INDEX idx_participants_assigned_peer ON participants(assigned_peer_id);
CREATE INDEX idx_participants_status ON participants(status);
CREATE INDEX idx_participants_mat_status ON participants(mat_status);
CREATE INDEX idx_participants_recovery_date ON participants(recovery_date);
CREATE INDEX idx_participants_created_at ON participants(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

-- Organizations: Users can only see their own organization
CREATE POLICY organizations_access ON organizations
  FOR ALL
  USING (
    id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Users: Users can see other users in their organization
CREATE POLICY users_access ON users
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Participants: Users can only access participants in their organization
-- This implements the minimum necessary access principle (Requirement 11.2)
CREATE POLICY participants_access ON participants
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Additional policy for assigned peer specialists (more restrictive access)
CREATE POLICY participants_assigned_peer_access ON participants
  FOR SELECT
  USING (
    assigned_peer_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('supervisor', 'admin')
      AND organization_id = participants.organization_id
    )
  );

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for organizations
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for participants
CREATE TRIGGER update_participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE organizations IS 'Organizations managing peer recovery programs';
COMMENT ON TABLE users IS 'Staff users (peer specialists, supervisors, admins) with role-based access';
COMMENT ON TABLE participants IS 'Participants enrolled in recovery programs with encrypted PHI fields';

COMMENT ON COLUMN participants.first_name_encrypted IS 'AES-256 encrypted first name';
COMMENT ON COLUMN participants.last_name_encrypted IS 'AES-256 encrypted last name';
COMMENT ON COLUMN participants.ssn_encrypted IS 'AES-256 encrypted SSN with organization-specific key';
COMMENT ON COLUMN participants.date_of_birth_encrypted IS 'AES-256 encrypted date of birth';
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
-- Migration: Create logging tables
-- Requirements: 5.1, 5.4, 5.5, 7.8
-- Description: Creates tables for interaction logging, audit trails, and query history
--              with immutable audit log rules and comprehensive indexing

-- ============================================================================
-- INTERACTIONS TABLE
-- ============================================================================
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  staff_id UUID REFERENCES users(id) NOT NULL,
  
  -- Interaction details (Requirements 5.1, 5.2, 5.3)
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'Session Note', 'Quick Note', 'Phone Call', 'Text/Message',
    'Outreach Attempt', 'Crisis Intervention', 'Home Visit',
    'Office Visit', 'Field Encounter'
  )),
  interaction_date DATE NOT NULL,
  interaction_time TIME NOT NULL,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  location TEXT,
  summary TEXT NOT NULL,
  
  -- Follow-up tracking (Requirement 5.9)
  follow_up_needed BOOLEAN DEFAULT FALSE,
  follow_up_date DATE,
  linked_goal_id UUID,  -- FK constraint added in migration 20240101000004_create_recovery_plan_tables.sql
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT follow_up_date_required CHECK (
    follow_up_needed = FALSE OR follow_up_date IS NOT NULL
  )
);

-- ============================================================================
-- AUDIT_LOGS TABLE
-- ============================================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  log_type TEXT NOT NULL CHECK (log_type IN ('PHI_ACCESS', 'DATA_CHANGE', 'SESSION', 'SECURITY_EVENT', 'CONSENT_EVENT', 'QUERY')),
  user_id UUID REFERENCES users(id),
  participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  
  -- PHI Access specific (Requirement 5.4)
  access_type TEXT CHECK (access_type IN ('read', 'write', 'delete', 'export')),
  data_type TEXT,
  access_purpose TEXT,
  
  -- Data Change specific (Requirement 5.5)
  table_name TEXT,
  record_id UUID,
  field_name TEXT,
  old_value_encrypted TEXT,
  new_value_encrypted TEXT,
  change_reason TEXT,
  
  -- Session specific (Requirements 5.7, 5.8)
  session_id UUID,
  session_type TEXT,
  session_start TIMESTAMP WITH TIME ZONE,
  session_end TIMESTAMP WITH TIME ZONE,
  session_summary TEXT,
  
  -- Security Event specific
  event_type TEXT,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  event_description TEXT,
  
  -- Common fields
  ip_address INET,
  device_id TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Metadata for additional context
  metadata JSONB
);

-- ============================================================================
-- QUERIES TABLE
-- ============================================================================
CREATE TABLE queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  
  -- Query details (Requirement 7.8)
  original_query TEXT NOT NULL,
  interpreted_intent JSONB,
  response TEXT NOT NULL,
  data JSONB,
  
  -- Query metadata
  successful BOOLEAN DEFAULT TRUE,
  processing_time_ms INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- PHI access tracking
  accessed_phi BOOLEAN DEFAULT FALSE,
  accessed_participant_ids UUID[]
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Interactions indexes
CREATE INDEX idx_interactions_participant ON interactions(participant_id);
CREATE INDEX idx_interactions_staff ON interactions(staff_id);
CREATE INDEX idx_interactions_date ON interactions(interaction_date DESC);
CREATE INDEX idx_interactions_type ON interactions(interaction_type);
CREATE INDEX idx_interactions_follow_up ON interactions(follow_up_date) 
  WHERE follow_up_needed = TRUE;
CREATE INDEX idx_interactions_created_at ON interactions(created_at DESC);

-- Composite index for staff's recent interactions with a participant
CREATE INDEX idx_interactions_staff_participant_date ON interactions(staff_id, participant_id, interaction_date DESC);

-- Audit logs indexes (Requirements 5.4, 5.5)
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_participant ON audit_logs(participant_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_type ON audit_logs(log_type);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity) 
  WHERE log_type = 'SECURITY_EVENT';

-- Composite indexes for common audit queries
CREATE INDEX idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_participant_timestamp ON audit_logs(participant_id, timestamp DESC);
CREATE INDEX idx_audit_logs_type_timestamp ON audit_logs(log_type, timestamp DESC);

-- Index for PHI access audits
CREATE INDEX idx_audit_logs_phi_access ON audit_logs(participant_id, access_type, timestamp DESC)
  WHERE log_type = 'PHI_ACCESS';

-- Index for data change audits
CREATE INDEX idx_audit_logs_data_changes ON audit_logs(table_name, record_id, timestamp DESC)
  WHERE log_type = 'DATA_CHANGE';

-- Queries indexes
CREATE INDEX idx_queries_user ON queries(user_id);
CREATE INDEX idx_queries_timestamp ON queries(timestamp DESC);
CREATE INDEX idx_queries_successful ON queries(successful);

-- Index for PHI access via queries
CREATE INDEX idx_queries_phi_access ON queries(user_id, timestamp DESC)
  WHERE accessed_phi = TRUE;

-- GIN index for JSONB fields (for efficient JSON queries)
CREATE INDEX idx_queries_interpreted_intent ON queries USING GIN (interpreted_intent);
CREATE INDEX idx_audit_logs_metadata ON audit_logs USING GIN (metadata);

-- ============================================================================
-- IMMUTABLE AUDIT LOG RULES (Requirement 5.10)
-- ============================================================================

-- Prevent updates to audit logs (immutable)
CREATE RULE audit_logs_no_update AS 
  ON UPDATE TO audit_logs 
  DO INSTEAD NOTHING;

-- Prevent deletes from audit logs (immutable)
CREATE RULE audit_logs_no_delete AS 
  ON DELETE TO audit_logs 
  DO INSTEAD NOTHING;

-- Note: These rules make audit logs append-only, ensuring data integrity
-- Only INSERT operations are allowed

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries ENABLE ROW LEVEL SECURITY;

-- Interactions: Users can access interactions for participants in their organization
CREATE POLICY interactions_access ON interactions
  FOR ALL
  USING (
    participant_id IN (
      SELECT p.id FROM participants p
      INNER JOIN users u ON u.organization_id = p.organization_id
      WHERE u.id = auth.uid()
    )
  );

-- Interactions: Users can only create interactions as themselves
CREATE POLICY interactions_create_as_self ON interactions
  FOR INSERT
  WITH CHECK (staff_id = auth.uid());

-- Audit logs: Users can only read audit logs for their organization
-- Admins and supervisors can see all logs, peer specialists can see their own
CREATE POLICY audit_logs_read ON audit_logs
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('supervisor', 'admin')
      AND (
        audit_logs.user_id IN (
          SELECT id FROM users WHERE organization_id = u.organization_id
        )
        OR
        audit_logs.participant_id IN (
          SELECT id FROM participants WHERE organization_id = u.organization_id
        )
      )
    )
  );

-- Audit logs: Only system can insert (enforced at application level)
-- This policy allows inserts but will be controlled by application logic
CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT
  WITH CHECK (TRUE);

-- Queries: Users can only see their own queries
CREATE POLICY queries_access ON queries
  FOR ALL
  USING (user_id = auth.uid());

-- Queries: Supervisors and admins can see all queries in their organization
CREATE POLICY queries_supervisor_access ON queries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('supervisor', 'admin')
      AND queries.user_id IN (
        SELECT id FROM users WHERE organization_id = u.organization_id
      )
    )
  );

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Function to automatically log PHI access when participants table is queried
-- This would be implemented at the application level, but we create the structure here

-- Function to create audit log entry for data changes
CREATE OR REPLACE FUNCTION log_data_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if this is an UPDATE operation
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      log_type,
      user_id,
      participant_id,
      table_name,
      record_id,
      field_name,
      old_value_encrypted,
      new_value_encrypted,
      timestamp
    ) VALUES (
      'DATA_CHANGE',
      auth.uid(),
      CASE 
        WHEN TG_TABLE_NAME = 'participants' THEN NEW.id
        ELSE NULL
      END,
      TG_TABLE_NAME,
      NEW.id,
      'multiple_fields',
      'encrypted_old_values',
      'encrypted_new_values',
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Specific triggers for data change logging would be added per table
-- Example: CREATE TRIGGER log_participant_changes AFTER UPDATE ON participants...

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View for recent interactions by staff
CREATE VIEW recent_interactions AS
SELECT 
  i.*,
  p.first_name_encrypted,
  p.last_name_encrypted,
  u.first_name AS staff_first_name,
  u.last_name AS staff_last_name
FROM interactions i
INNER JOIN participants p ON i.participant_id = p.id
INNER JOIN users u ON i.staff_id = u.id
ORDER BY i.interaction_date DESC, i.interaction_time DESC
LIMIT 100;

-- View for pending follow-ups
CREATE VIEW pending_follow_ups AS
SELECT 
  i.*,
  p.first_name_encrypted,
  p.last_name_encrypted,
  p.assigned_peer_id,
  u.first_name AS staff_first_name,
  u.last_name AS staff_last_name
FROM interactions i
INNER JOIN participants p ON i.participant_id = p.id
INNER JOIN users u ON i.staff_id = u.id
WHERE i.follow_up_needed = TRUE
  AND i.follow_up_date >= CURRENT_DATE
ORDER BY i.follow_up_date ASC;

-- View for PHI access audit trail
CREATE VIEW phi_access_log AS
SELECT 
  al.id,
  al.timestamp,
  al.user_id,
  u.first_name AS user_first_name,
  u.last_name AS user_last_name,
  u.role AS user_role,
  al.participant_id,
  al.access_type,
  al.data_type,
  al.access_purpose,
  al.ip_address
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
WHERE al.log_type = 'PHI_ACCESS'
ORDER BY al.timestamp DESC;

-- View for security events
CREATE VIEW security_events AS
SELECT 
  al.id,
  al.timestamp,
  al.severity,
  al.event_type,
  al.event_description,
  al.user_id,
  u.first_name AS user_first_name,
  u.last_name AS user_last_name,
  al.ip_address,
  al.device_id
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
WHERE al.log_type = 'SECURITY_EVENT'
ORDER BY al.timestamp DESC, al.severity DESC;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE interactions IS 'Interaction logs for all participant encounters with follow-up tracking';
COMMENT ON TABLE audit_logs IS 'Immutable audit trail for PHI access, data changes, sessions, and security events';
COMMENT ON TABLE queries IS 'Natural language query history with PHI access tracking';

COMMENT ON COLUMN interactions.follow_up_needed IS 'Flag indicating if follow-up action is required';
COMMENT ON COLUMN interactions.linked_goal_id IS 'Optional link to recovery plan goal';

COMMENT ON COLUMN audit_logs.old_value_encrypted IS 'AES-256 encrypted previous value for data changes';
COMMENT ON COLUMN audit_logs.new_value_encrypted IS 'AES-256 encrypted new value for data changes';

COMMENT ON RULE audit_logs_no_update ON audit_logs IS 'Prevents updates to audit logs (immutable)';
COMMENT ON RULE audit_logs_no_delete ON audit_logs IS 'Prevents deletes from audit logs (immutable)';

COMMENT ON VIEW phi_access_log IS 'Filtered view of PHI access events for compliance audits';
COMMENT ON VIEW security_events IS 'Filtered view of security events ordered by severity';
COMMENT ON VIEW pending_follow_ups IS 'Interactions requiring follow-up action';
-- Migration: Create intake and assessment tables
-- Requirements: 2.1, 3.1, 4.1
-- Description: Creates tables for multi-session intake and conversational assessments
--              with JSONB fields for flexible data storage and RLS policies

-- ============================================================================
-- INTAKE_SESSIONS TABLE
-- ============================================================================
CREATE TABLE intake_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  
  -- Session tracking (Requirements 2.1, 2.2, 2.3)
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  is_complete BOOLEAN DEFAULT FALSE,
  
  -- Section tracking (Requirements 2.6, 2.7)
  completed_sections TEXT[] DEFAULT '{}',
  current_section TEXT,
  
  -- Flexible data storage for intake sections
  -- Each section can have different fields, stored as JSONB
  identifiers_data JSONB,
  contact_data JSONB,
  additional_contacts_data JSONB,
  demographics_data JSONB,
  health_data JSONB,
  substance_use_data JSONB,
  mat_provider_data JSONB,
  behavioral_health_data JSONB,
  social_drivers_data JSONB,
  family_data JSONB,
  insurance_data JSONB,
  engagement_data JSONB,
  emergency_contact_data JSONB,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_section CHECK (
    current_section IS NULL OR current_section IN (
      'identifiers', 'contact', 'additional_contacts', 'demographics', 
      'health', 'substance_use', 'mat_provider', 'behavioral_health',
      'social_drivers', 'family', 'insurance', 'engagement', 'emergency_contact'
    )
  )
);

-- ============================================================================
-- ASSESSMENTS TABLE
-- ============================================================================
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('SUPRT_C', 'BARC_10', 'SSM')),
  
  -- Session tracking (Requirements 3.1, 4.1)
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  is_complete BOOLEAN DEFAULT FALSE,
  
  -- BARC-10 specific fields (Requirement 4.5)
  total_score INTEGER CHECK (total_score IS NULL OR total_score BETWEEN 10 AND 60),
  item_scores JSONB,
  
  -- SUPRT-C specific fields (Requirement 3.1)
  demographics_data JSONB,
  social_drivers_data JSONB,
  client_outcomes_data JSONB,
  wellness_scale_scores JSONB,
  quality_of_life_score INTEGER CHECK (quality_of_life_score IS NULL OR quality_of_life_score BETWEEN 0 AND 100),
  
  -- SSM specific fields (Requirement 4A.1)
  ssm_domain_scores JSONB,
  ssm_milestone TEXT CHECK (ssm_milestone IS NULL OR ssm_milestone IN ('Initial', '3-month', '6-month', '1-year', 'Final')),
  
  -- Common fields (Requirements 3.8, 3.10, 4.7)
  responses JSONB,
  conversation_transcript TEXT,
  interpretation TEXT,
  
  -- Metadata
  conducted_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints for assessment-specific fields
  CONSTRAINT barc10_score_required CHECK (
    assessment_type != 'BARC_10' OR (is_complete = FALSE OR total_score IS NOT NULL)
  ),
  CONSTRAINT suprt_c_data_required CHECK (
    assessment_type != 'SUPRT_C' OR (is_complete = FALSE OR (
      demographics_data IS NOT NULL AND
      social_drivers_data IS NOT NULL AND
      client_outcomes_data IS NOT NULL
    ))
  ),
  CONSTRAINT ssm_data_required CHECK (
    assessment_type != 'SSM' OR (is_complete = FALSE OR (
      ssm_domain_scores IS NOT NULL AND
      ssm_milestone IS NOT NULL
    ))
  )
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Intake sessions indexes
CREATE INDEX idx_intake_sessions_participant ON intake_sessions(participant_id);
CREATE INDEX idx_intake_sessions_complete ON intake_sessions(is_complete);
CREATE INDEX idx_intake_sessions_started_at ON intake_sessions(started_at);
CREATE INDEX idx_intake_sessions_created_by ON intake_sessions(created_by);

-- Assessments indexes
CREATE INDEX idx_assessments_participant ON assessments(participant_id);
CREATE INDEX idx_assessments_type ON assessments(assessment_type);
CREATE INDEX idx_assessments_complete ON assessments(is_complete);
CREATE INDEX idx_assessments_started_at ON assessments(started_at);
CREATE INDEX idx_assessments_conducted_by ON assessments(conducted_by);

-- Composite index for finding latest assessment by type
CREATE INDEX idx_assessments_participant_type_date ON assessments(participant_id, assessment_type, started_at DESC);

-- Index for SSM milestone tracking
CREATE INDEX idx_assessments_ssm_milestone ON assessments(ssm_milestone) 
  WHERE assessment_type = 'SSM';

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE intake_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

-- Intake sessions: Users can only access sessions for participants in their organization
CREATE POLICY intake_sessions_access ON intake_sessions
  FOR ALL
  USING (
    participant_id IN (
      SELECT p.id FROM participants p
      INNER JOIN users u ON u.organization_id = p.organization_id
      WHERE u.id = auth.uid()
    )
  );

-- Assessments: Users can only access assessments for participants in their organization
CREATE POLICY assessments_access ON assessments
  FOR ALL
  USING (
    participant_id IN (
      SELECT p.id FROM participants p
      INNER JOIN users u ON u.organization_id = p.organization_id
      WHERE u.id = auth.uid()
    )
  );

-- More restrictive policy: Only assigned peer or supervisors/admins
CREATE POLICY intake_sessions_assigned_access ON intake_sessions
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

CREATE POLICY assessments_assigned_access ON assessments
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

-- Function to update last_updated_at on intake sessions
CREATE OR REPLACE FUNCTION update_intake_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for intake sessions
CREATE TRIGGER update_intake_session_updated_at
  BEFORE UPDATE ON intake_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_intake_session_timestamp();

-- Function to auto-complete intake when all sections are done
CREATE OR REPLACE FUNCTION check_intake_completion()
RETURNS TRIGGER AS $$
DECLARE
  required_sections TEXT[] := ARRAY[
    'identifiers', 'contact', 'demographics', 'health', 
    'substance_use', 'behavioral_health', 'social_drivers',
    'family', 'insurance', 'engagement', 'emergency_contact'
  ];
  section TEXT;
  all_complete BOOLEAN := TRUE;
BEGIN
  -- Check if all required sections are in completed_sections
  FOREACH section IN ARRAY required_sections
  LOOP
    IF NOT (section = ANY(NEW.completed_sections)) THEN
      all_complete := FALSE;
      EXIT;
    END IF;
  END LOOP;
  
  -- If all sections complete and not already marked complete
  IF all_complete AND NOT NEW.is_complete THEN
    NEW.is_complete := TRUE;
    NEW.completed_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check intake completion
CREATE TRIGGER check_intake_complete
  BEFORE INSERT OR UPDATE ON intake_sessions
  FOR EACH ROW
  EXECUTE FUNCTION check_intake_completion();

-- Function to prevent modification of completed assessments
CREATE OR REPLACE FUNCTION prevent_completed_assessment_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_complete = TRUE AND NEW.is_complete = TRUE THEN
    -- Allow updates to interpretation field only
    IF OLD.responses IS DISTINCT FROM NEW.responses OR
       OLD.total_score IS DISTINCT FROM NEW.total_score OR
       OLD.item_scores IS DISTINCT FROM NEW.item_scores THEN
      RAISE EXCEPTION 'Cannot modify completed assessment data';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent modification of completed assessments
CREATE TRIGGER prevent_completed_assessment_changes
  BEFORE UPDATE ON assessments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_completed_assessment_modification();

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View for incomplete intake sessions
CREATE VIEW incomplete_intakes AS
SELECT 
  i.*,
  p.first_name_encrypted,
  p.last_name_encrypted,
  p.assigned_peer_id,
  ARRAY_LENGTH(i.completed_sections, 1) AS sections_completed,
  11 - COALESCE(ARRAY_LENGTH(i.completed_sections, 1), 0) AS sections_remaining
FROM intake_sessions i
INNER JOIN participants p ON i.participant_id = p.id
WHERE i.is_complete = FALSE
ORDER BY i.last_updated_at DESC;

-- View for baseline assessments (first assessment of each type per participant)
CREATE VIEW baseline_assessments AS
SELECT DISTINCT ON (participant_id, assessment_type)
  *
FROM assessments
WHERE is_complete = TRUE
ORDER BY participant_id, assessment_type, started_at ASC;

-- View for latest assessments (most recent assessment of each type per participant)
CREATE VIEW latest_assessments AS
SELECT DISTINCT ON (participant_id, assessment_type)
  *
FROM assessments
WHERE is_complete = TRUE
ORDER BY participant_id, assessment_type, started_at DESC;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE intake_sessions IS 'Multi-session participant intake with flexible section ordering and auto-save';
COMMENT ON TABLE assessments IS 'Conversational assessments (SUPRT-C, BARC-10, SSM) with automatic scoring';

COMMENT ON COLUMN intake_sessions.completed_sections IS 'Array of section names that have been completed';
COMMENT ON COLUMN intake_sessions.current_section IS 'Currently active section in the intake process';
COMMENT ON COLUMN intake_sessions.is_complete IS 'Auto-set to true when all required sections are completed';

COMMENT ON COLUMN assessments.total_score IS 'Total BARC-10 score (10-60 range)';
COMMENT ON COLUMN assessments.item_scores IS 'Individual item scores as JSON object';
COMMENT ON COLUMN assessments.responses IS 'Array of question-response pairs with extracted values';
COMMENT ON COLUMN assessments.conversation_transcript IS 'Full conversation transcript for audit purposes';

COMMENT ON VIEW incomplete_intakes IS 'Active intake sessions that are not yet complete';
COMMENT ON VIEW baseline_assessments IS 'First assessment of each type for each participant';
COMMENT ON VIEW latest_assessments IS 'Most recent assessment of each type for each participant';
-- Migration: Create recovery plan tables (IDEMPOTENT VERSION)
-- Requirements: 6.1, 6.6
-- Description: Creates tables for recovery action plans, goals, and progress tracking
--              with status indexes and RLS policies
--              This version is idempotent and can be safely re-run

-- ============================================================================
-- RECOVERY_PLANS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS recovery_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  
  -- Plan details (Requirement 6.1)
  created_date DATE DEFAULT CURRENT_DATE NOT NULL,
  review_dates DATE[] DEFAULT '{}',
  overall_status TEXT DEFAULT 'active' CHECK (overall_status IN ('active', 'completed', 'on_hold')),
  
  -- Metadata
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Partial unique index: only one active plan per participant
CREATE UNIQUE INDEX IF NOT EXISTS idx_recovery_plans_one_active_per_participant 
  ON recovery_plans(participant_id) 
  WHERE overall_status = 'active';

-- ============================================================================
-- GOALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES recovery_plans(id) ON DELETE CASCADE NOT NULL,
  
  -- Goal details (Requirement 6.6)
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'Housing', 'Employment', 'Health', 'Family',
    'Recovery', 'Education', 'Legal', 'Other'
  )),
  target_date DATE,
  status TEXT DEFAULT 'Not Started' CHECK (status IN (
    'Not Started', 'In Progress', 'Completed', 'On Hold'
  )),
  
  -- Supporting information
  barriers_identified TEXT[] DEFAULT '{}',
  support_needed TEXT[] DEFAULT '{}',
  action_steps JSONB DEFAULT '[]',
  
  -- Metadata (Requirement 6.6)
  created_date DATE DEFAULT CURRENT_DATE NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id) NOT NULL,
  
  -- Constraints
  CONSTRAINT action_steps_is_array CHECK (jsonb_typeof(action_steps) = 'array')
);

-- ============================================================================
-- PROGRESS_NOTES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS progress_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  
  -- Note details (Requirement 6.9)
  note_date DATE DEFAULT CURRENT_DATE NOT NULL,
  staff_id UUID REFERENCES users(id) NOT NULL,
  note TEXT NOT NULL,
  
  -- Optional link to interaction
  linked_interaction_id UUID REFERENCES interactions(id) ON DELETE SET NULL,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ADD FOREIGN KEY CONSTRAINT FROM INTERACTIONS TABLE
-- ============================================================================

-- Now that goals table exists, add the foreign key constraint
-- that was deferred from migration 20240101000003_create_logging_tables.sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'interactions'
      AND n.nspname = 'public'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE c.conname = 'fk_interactions_linked_goal'
        AND t.relname = 'interactions'
    ) THEN
      ALTER TABLE public.interactions 
        ADD CONSTRAINT fk_interactions_linked_goal 
        FOREIGN KEY (linked_goal_id) 
        REFERENCES public.goals(id) 
        ON DELETE SET NULL;
    END IF;
  END IF;
END$$;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Recovery plans indexes
CREATE INDEX IF NOT EXISTS idx_recovery_plans_participant ON recovery_plans(participant_id);
CREATE INDEX IF NOT EXISTS idx_recovery_plans_status ON recovery_plans(overall_status);
CREATE INDEX IF NOT EXISTS idx_recovery_plans_created_by ON recovery_plans(created_by);
CREATE INDEX IF NOT EXISTS idx_recovery_plans_created_date ON recovery_plans(created_date DESC);

-- Goals indexes (Requirement 6.6)
CREATE INDEX IF NOT EXISTS idx_goals_plan ON goals(plan_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_category ON goals(category);
CREATE INDEX IF NOT EXISTS idx_goals_target_date ON goals(target_date);
CREATE INDEX IF NOT EXISTS idx_goals_created_by ON goals(created_by);

-- Composite index for finding goals by status within a plan
CREATE INDEX IF NOT EXISTS idx_goals_plan_status ON goals(plan_id, status);

-- Composite index for finding goals by category and status
CREATE INDEX IF NOT EXISTS idx_goals_category_status ON goals(category, status);

-- Index for overdue goals
-- Note: target_date first for efficient range queries, status filtered in WHERE clause
-- Cannot use CURRENT_DATE in predicate (not immutable), so we filter only by status
CREATE INDEX IF NOT EXISTS idx_goals_overdue ON goals(target_date, status)
  WHERE status IN ('Not Started', 'In Progress');

-- Progress notes indexes
CREATE INDEX IF NOT EXISTS idx_progress_notes_goal ON progress_notes(goal_id);
CREATE INDEX IF NOT EXISTS idx_progress_notes_staff ON progress_notes(staff_id);
CREATE INDEX IF NOT EXISTS idx_progress_notes_date ON progress_notes(note_date DESC);
CREATE INDEX IF NOT EXISTS idx_progress_notes_interaction ON progress_notes(linked_interaction_id)
  WHERE linked_interaction_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE recovery_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_notes ENABLE ROW LEVEL SECURITY;

-- Create policies only if they don't exist
DO $$
BEGIN
  -- Recovery plans: Users can access plans for participants in their organization
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    WHERE p.polname = 'recovery_plans_access' AND c.relname = 'recovery_plans'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY recovery_plans_access ON recovery_plans
        FOR ALL
        USING (
          participant_id IN (
            SELECT p.id FROM participants p
            INNER JOIN users u ON u.organization_id = p.organization_id
            WHERE u.id = auth.uid()
          )
        );
    $pol$;
  END IF;

  -- Recovery plans: More restrictive - only assigned peer or supervisors/admins
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    WHERE p.polname = 'recovery_plans_assigned_access' AND c.relname = 'recovery_plans'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY recovery_plans_assigned_access ON recovery_plans
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
    $pol$;
  END IF;

  -- Goals: Users can access goals for plans they can access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    WHERE p.polname = 'goals_access' AND c.relname = 'goals'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY goals_access ON goals
        FOR ALL
        USING (
          plan_id IN (
            SELECT rp.id FROM recovery_plans rp
            INNER JOIN participants p ON rp.participant_id = p.id
            INNER JOIN users u ON u.organization_id = p.organization_id
            WHERE u.id = auth.uid()
          )
        );
    $pol$;
  END IF;

  -- Progress notes: Users can access notes for goals they can access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    WHERE p.polname = 'progress_notes_access' AND c.relname = 'progress_notes'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY progress_notes_access ON progress_notes
        FOR ALL
        USING (
          goal_id IN (
            SELECT g.id FROM goals g
            INNER JOIN recovery_plans rp ON g.plan_id = rp.id
            INNER JOIN participants p ON rp.participant_id = p.id
            INNER JOIN users u ON u.organization_id = p.organization_id
            WHERE u.id = auth.uid()
          )
        );
    $pol$;
  END IF;

  -- Progress notes: Users can only create notes as themselves
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    WHERE p.polname = 'progress_notes_create_as_self' AND c.relname = 'progress_notes'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY progress_notes_create_as_self ON progress_notes
        FOR INSERT
        WITH CHECK (staff_id = auth.uid());
    $pol$;
  END IF;
END$$;

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp on recovery plans
CREATE OR REPLACE FUNCTION update_recovery_plan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for recovery plans
DROP TRIGGER IF EXISTS update_recovery_plan_updated_at ON recovery_plans;
CREATE TRIGGER update_recovery_plan_updated_at
  BEFORE UPDATE ON recovery_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_recovery_plan_timestamp();

-- Function to update last_updated timestamp on goals
CREATE OR REPLACE FUNCTION update_goal_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for goals
DROP TRIGGER IF EXISTS update_goal_last_updated ON goals;
CREATE TRIGGER update_goal_last_updated
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION update_goal_timestamp();

-- Function to auto-complete plan when all goals are completed
CREATE OR REPLACE FUNCTION check_plan_completion()
RETURNS TRIGGER AS $$
DECLARE
  incomplete_goals INTEGER;
  plan_status TEXT;
BEGIN
  -- Get the plan status
  SELECT overall_status INTO plan_status
  FROM recovery_plans
  WHERE id = NEW.plan_id;
  
  -- Only check if plan is active
  IF plan_status = 'active' THEN
    -- Count incomplete goals in the plan
    SELECT COUNT(*) INTO incomplete_goals
    FROM goals
    WHERE plan_id = NEW.plan_id
      AND status NOT IN ('Completed', 'On Hold');
    
    -- If no incomplete goals and at least one goal exists, mark plan as completed
    IF incomplete_goals = 0 THEN
      UPDATE recovery_plans
      SET overall_status = 'completed',
          updated_at = NOW()
      WHERE id = NEW.plan_id
        AND overall_status = 'active';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check plan completion when goal status changes
DROP TRIGGER IF EXISTS check_recovery_plan_completion ON goals;
CREATE TRIGGER check_recovery_plan_completion
  AFTER UPDATE OF status ON goals
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION check_plan_completion();

-- Function to add progress note when goal status changes
CREATE OR REPLACE FUNCTION log_goal_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO progress_notes (
      goal_id,
      staff_id,
      note,
      note_date
    ) VALUES (
      NEW.id,
      auth.uid(),
      'Goal status changed from "' || OLD.status || '" to "' || NEW.status || '"',
      CURRENT_DATE
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log goal status changes
DROP TRIGGER IF EXISTS log_goal_status_changes ON goals;
CREATE TRIGGER log_goal_status_changes
  AFTER UPDATE OF status ON goals
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_goal_status_change();

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View for active recovery plans with goal summary
CREATE OR REPLACE VIEW active_recovery_plans AS
SELECT 
  rp.*,
  p.first_name_encrypted,
  p.last_name_encrypted,
  p.assigned_peer_id,
  COUNT(g.id) AS total_goals,
  COUNT(g.id) FILTER (WHERE g.status = 'Completed') AS completed_goals,
  COUNT(g.id) FILTER (WHERE g.status = 'In Progress') AS in_progress_goals,
  COUNT(g.id) FILTER (WHERE g.status = 'Not Started') AS not_started_goals,
  COUNT(g.id) FILTER (WHERE g.status = 'On Hold') AS on_hold_goals
FROM recovery_plans rp
INNER JOIN participants p ON rp.participant_id = p.id
LEFT JOIN goals g ON rp.id = g.plan_id
WHERE rp.overall_status = 'active'
GROUP BY rp.id, p.first_name_encrypted, p.last_name_encrypted, p.assigned_peer_id;

-- View for overdue goals
CREATE OR REPLACE VIEW overdue_goals AS
SELECT 
  g.*,
  rp.participant_id,
  p.first_name_encrypted,
  p.last_name_encrypted,
  p.assigned_peer_id,
  CURRENT_DATE - g.target_date AS days_overdue
FROM goals g
INNER JOIN recovery_plans rp ON g.plan_id = rp.id
INNER JOIN participants p ON rp.participant_id = p.id
WHERE g.status IN ('Not Started', 'In Progress')
  AND g.target_date < CURRENT_DATE
  AND rp.overall_status = 'active'
ORDER BY g.target_date ASC;

-- View for goals by category with counts
CREATE OR REPLACE VIEW goals_by_category AS
SELECT 
  category,
  COUNT(*) AS total_goals,
  COUNT(*) FILTER (WHERE status = 'Completed') AS completed,
  COUNT(*) FILTER (WHERE status = 'In Progress') AS in_progress,
  COUNT(*) FILTER (WHERE status = 'Not Started') AS not_started,
  COUNT(*) FILTER (WHERE status = 'On Hold') AS on_hold
FROM goals g
INNER JOIN recovery_plans rp ON g.plan_id = rp.id
WHERE rp.overall_status = 'active'
GROUP BY category
ORDER BY category;

-- View for recent progress notes
CREATE OR REPLACE VIEW recent_progress_notes AS
SELECT 
  pn.*,
  g.description AS goal_description,
  g.category AS goal_category,
  g.status AS goal_status,
  rp.participant_id,
  u.first_name AS staff_first_name,
  u.last_name AS staff_last_name
FROM progress_notes pn
INNER JOIN goals g ON pn.goal_id = g.id
INNER JOIN recovery_plans rp ON g.plan_id = rp.id
INNER JOIN users u ON pn.staff_id = u.id
ORDER BY pn.note_date DESC, pn.created_at DESC
LIMIT 100;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE recovery_plans IS 'Recovery action plans created collaboratively with participants';
COMMENT ON TABLE goals IS 'Individual goals within recovery plans with status tracking';
COMMENT ON TABLE progress_notes IS 'Progress notes documenting goal modifications and updates';

COMMENT ON COLUMN recovery_plans.review_dates IS 'Array of scheduled review dates for periodic reassessment';
COMMENT ON COLUMN recovery_plans.overall_status IS 'Plan status: active, completed, or on_hold';

COMMENT ON COLUMN goals.action_steps IS 'JSONB array of action steps with completion status';
COMMENT ON COLUMN goals.barriers_identified IS 'Array of identified barriers to goal achievement';
COMMENT ON COLUMN goals.support_needed IS 'Array of support resources needed';

COMMENT ON COLUMN progress_notes.linked_interaction_id IS 'Optional link to interaction where progress was discussed';

COMMENT ON VIEW active_recovery_plans IS 'Active recovery plans with goal completion statistics';
COMMENT ON VIEW overdue_goals IS 'Goals past their target date that are not yet completed';
COMMENT ON VIEW goals_by_category IS 'Goal statistics grouped by category';
COMMENT ON VIEW recent_progress_notes IS 'Most recent progress notes across all goals';
