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
