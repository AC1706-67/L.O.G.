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
