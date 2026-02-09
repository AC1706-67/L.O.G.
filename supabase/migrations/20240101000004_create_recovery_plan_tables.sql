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
