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
