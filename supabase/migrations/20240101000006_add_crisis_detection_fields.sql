-- Migration: Add crisis detection fields to assessments table
-- Description: Adds fields to track crisis detection, risk level, indicators, and acknowledgment

-- Add crisis detection fields to assessments table
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS crisis_detected BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS crisis_risk_level TEXT CHECK (
    crisis_risk_level IS NULL OR 
    crisis_risk_level IN ('low', 'moderate', 'high', 'immediate')
  ),
  ADD COLUMN IF NOT EXISTS crisis_indicators TEXT[],
  ADD COLUMN IF NOT EXISTS crisis_actions_shown_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS crisis_acknowledged_at TIMESTAMP WITH TIME ZONE;

-- Create index for finding assessments with unacknowledged crises
CREATE INDEX IF NOT EXISTS idx_assessments_crisis_unacknowledged 
  ON assessments(crisis_detected, crisis_acknowledged_at)
  WHERE crisis_detected = TRUE AND crisis_acknowledged_at IS NULL;

-- Create index for crisis risk level queries
CREATE INDEX IF NOT EXISTS idx_assessments_crisis_risk_level 
  ON assessments(crisis_risk_level)
  WHERE crisis_detected = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN assessments.crisis_detected IS 'Whether a crisis was detected during the assessment';
COMMENT ON COLUMN assessments.crisis_risk_level IS 'Risk level: low, moderate, high, or immediate';
COMMENT ON COLUMN assessments.crisis_indicators IS 'Array of crisis indicators identified';
COMMENT ON COLUMN assessments.crisis_actions_shown_at IS 'Timestamp when crisis alert was shown to user';
COMMENT ON COLUMN assessments.crisis_acknowledged_at IS 'Timestamp when user acknowledged the crisis alert';
