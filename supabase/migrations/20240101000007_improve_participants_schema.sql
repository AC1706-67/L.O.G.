-- Migration: Improve participants table schema
-- Description: Adds constraints for housing_stability and improves encrypted field handling

-- Add check constraint for housing_stability
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valid_housing_stability'
  ) THEN
    ALTER TABLE participants
      ADD CONSTRAINT valid_housing_stability CHECK (
        housing_stability IS NULL OR 
        housing_stability IN ('stable', 'unstable', 'homeless', 'transitional', 'unknown')
      );
  END IF;
END$;

-- Add check constraint for mat_type
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valid_mat_type'
  ) THEN
    ALTER TABLE participants
      ADD CONSTRAINT valid_mat_type CHECK (
        mat_type IS NULL OR 
        mat_type IN ('buprenorphine', 'methadone', 'naltrexone', 'none', 'unknown')
      );
  END IF;
END$;

-- Add comments for documentation
COMMENT ON COLUMN participants.housing_stability IS 'Housing status: stable, unstable, homeless, transitional, or unknown';
COMMENT ON COLUMN participants.mat_type IS 'Medication-assisted treatment type: buprenorphine, methadone, naltrexone, none, or unknown';
COMMENT ON COLUMN participants.first_name_encrypted IS 'Encrypted first name or UNKNOWN if not collected';
COMMENT ON COLUMN participants.last_name_encrypted IS 'Encrypted last name or UNKNOWN if not collected';
COMMENT ON COLUMN participants.date_of_birth_encrypted IS 'Encrypted date of birth or UNKNOWN if not collected';

-- Note: We keep NOT NULL constraints on encrypted fields but allow 'UNKNOWN' as a valid value
-- This maintains data integrity while allowing for incomplete information during intake
