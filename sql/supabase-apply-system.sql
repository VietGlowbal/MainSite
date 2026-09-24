-- ============================================================================
-- Apply System: Course Applications & Task Management
-- ============================================================================
-- This schema supports the Apply feature where users can:
-- 1. Import course URLs and create applications
-- 2. Track application stages (Research, Eligibility, Documents, etc.)
-- 3. Manage tasks within each stage
-- 4. Store extracted requirements and support resources
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. course_applications
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_applications (
  id TEXT PRIMARY KEY DEFAULT ('app_' || gen_random_uuid()::text),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  university_id TEXT,
  
  -- Core course info
  university_name TEXT NOT NULL,
  course_name TEXT NOT NULL,
  course_url TEXT NOT NULL,
  
  -- Course details
  degree_level TEXT,
  subject TEXT,
  study_mode TEXT,
  intake TEXT,
  country TEXT,
  country_flag TEXT,
  
  -- Application details
  application_method TEXT,
  application_code TEXT,
  deadline TEXT,
  tuition_fee TEXT,
  entry_requirements_summary TEXT,
  english_requirements_summary TEXT,
  
  -- Status & progress
  status TEXT NOT NULL DEFAULT 'course_imported',
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  match_score INTEGER,
  
  -- Media
  image_url TEXT,
  logo_url TEXT,
  
  -- AI metadata
  next_action TEXT,
  source_confidence TEXT NOT NULL DEFAULT 'medium',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (status IN (
    'course_imported',
    'plan_generated',
    'preparing',
    'ready_to_submit',
    'submitted',
    'interview',
    'offer_received',
    'accepted',
    'rejected',
    'withdrawn'
  )),
  CONSTRAINT valid_confidence CHECK (source_confidence IN ('high', 'medium', 'low')),
  CONSTRAINT valid_progress CHECK (progress_percentage >= 0 AND progress_percentage <= 100)
);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_course_applications_user_id ON course_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_course_applications_status ON course_applications(status);
CREATE INDEX IF NOT EXISTS idx_course_applications_created_at ON course_applications(created_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. application_stages
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS application_stages (
  id TEXT PRIMARY KEY DEFAULT ('stage_' || gen_random_uuid()::text),
  application_id TEXT NOT NULL REFERENCES course_applications(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  order_num INTEGER NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'not_started',
  is_required BOOLEAN NOT NULL DEFAULT true,
  icon TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_stage_status CHECK (status IN (
    'not_started',
    'in_progress',
    'completed',
    'blocked',
    'not_applicable'
  ))
);

-- Index for application queries
CREATE INDEX IF NOT EXISTS idx_application_stages_application_id ON application_stages(application_id);
CREATE INDEX IF NOT EXISTS idx_application_stages_order ON application_stages(application_id, order_num);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. application_tasks
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS application_tasks (
  id TEXT PRIMARY KEY DEFAULT ('task_' || gen_random_uuid()::text),
  application_id TEXT NOT NULL REFERENCES course_applications(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL REFERENCES application_stages(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  
  priority TEXT NOT NULL DEFAULT 'medium',
  type TEXT NOT NULL DEFAULT 'recommended',
  status TEXT NOT NULL DEFAULT 'not_started',
  
  source_url TEXT,
  support_tool_type TEXT,
  confidence TEXT NOT NULL DEFAULT 'medium',
  
  notes TEXT,
  created_by TEXT NOT NULL DEFAULT 'ai',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_task_priority CHECK (priority IN ('high', 'medium', 'low')),
  CONSTRAINT valid_task_type CHECK (type IN ('required', 'recommended', 'optional', 'risk')),
  CONSTRAINT valid_task_status CHECK (status IN (
    'not_started',
    'in_progress',
    'completed',
    'waiting_on_someone',
    'blocked',
    'not_applicable'
  )),
  CONSTRAINT valid_task_confidence CHECK (confidence IN ('high', 'medium', 'low')),
  CONSTRAINT valid_created_by CHECK (created_by IN ('ai', 'user'))
);

-- Index for stage queries
CREATE INDEX IF NOT EXISTS idx_application_tasks_stage_id ON application_tasks(stage_id);
CREATE INDEX IF NOT EXISTS idx_application_tasks_application_id ON application_tasks(application_id);
CREATE INDEX IF NOT EXISTS idx_application_tasks_status ON application_tasks(status);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. extracted_requirements (for future AI extraction)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS extracted_requirements (
  id TEXT PRIMARY KEY DEFAULT ('req_' || gen_random_uuid()::text),
  application_id TEXT NOT NULL REFERENCES course_applications(id) ON DELETE CASCADE,
  
  requirement_type TEXT NOT NULL,
  requirement_text TEXT NOT NULL,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  confidence TEXT NOT NULL DEFAULT 'medium',
  source_url TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_req_confidence CHECK (confidence IN ('high', 'medium', 'low'))
);

CREATE INDEX IF NOT EXISTS idx_extracted_requirements_application_id ON extracted_requirements(application_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. support_resources (for future AI extraction)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_resources (
  id TEXT PRIMARY KEY DEFAULT ('res_' || gen_random_uuid()::text),
  application_id TEXT NOT NULL REFERENCES course_applications(id) ON DELETE CASCADE,
  
  resource_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  confidence TEXT NOT NULL DEFAULT 'medium',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_res_confidence CHECK (confidence IN ('high', 'medium', 'low'))
);

CREATE INDEX IF NOT EXISTS idx_support_resources_application_id ON support_resources(application_id);

-- ────────────────────────────────────────────────────────────────────────────
-- Row Level Security (RLS)
-- ────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE course_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_resources ENABLE ROW LEVEL SECURITY;

-- course_applications policies
CREATE POLICY "Users can view their own applications"
  ON course_applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own applications"
  ON course_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own applications"
  ON course_applications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own applications"
  ON course_applications FOR DELETE
  USING (auth.uid() = user_id);

-- application_stages policies
CREATE POLICY "Users can view stages for their applications"
  ON application_stages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM course_applications
      WHERE course_applications.id = application_stages.application_id
      AND course_applications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert stages for their applications"
  ON application_stages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM course_applications
      WHERE course_applications.id = application_stages.application_id
      AND course_applications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update stages for their applications"
  ON application_stages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM course_applications
      WHERE course_applications.id = application_stages.application_id
      AND course_applications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete stages for their applications"
  ON application_stages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM course_applications
      WHERE course_applications.id = application_stages.application_id
      AND course_applications.user_id = auth.uid()
    )
  );

-- application_tasks policies
CREATE POLICY "Users can view tasks for their applications"
  ON application_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM course_applications
      WHERE course_applications.id = application_tasks.application_id
      AND course_applications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert tasks for their applications"
  ON application_tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM course_applications
      WHERE course_applications.id = application_tasks.application_id
      AND course_applications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update tasks for their applications"
  ON application_tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM course_applications
      WHERE course_applications.id = application_tasks.application_id
      AND course_applications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete tasks for their applications"
  ON application_tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM course_applications
      WHERE course_applications.id = application_tasks.application_id
      AND course_applications.user_id = auth.uid()
    )
  );

-- extracted_requirements policies
CREATE POLICY "Users can view requirements for their applications"
  ON extracted_requirements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM course_applications
      WHERE course_applications.id = extracted_requirements.application_id
      AND course_applications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert requirements for their applications"
  ON extracted_requirements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM course_applications
      WHERE course_applications.id = extracted_requirements.application_id
      AND course_applications.user_id = auth.uid()
    )
  );

-- support_resources policies
CREATE POLICY "Users can view resources for their applications"
  ON support_resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM course_applications
      WHERE course_applications.id = support_resources.application_id
      AND course_applications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert resources for their applications"
  ON support_resources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM course_applications
      WHERE course_applications.id = support_resources.application_id
      AND course_applications.user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- Triggers for updated_at
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_course_applications_updated_at
  BEFORE UPDATE ON course_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_application_stages_updated_at
  BEFORE UPDATE ON application_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_application_tasks_updated_at
  BEFORE UPDATE ON application_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
