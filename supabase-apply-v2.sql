-- ============================================================================
-- GLOWBAL APPLY SYSTEM V2 - CLEAN SCHEMA
-- ============================================================================
-- This is a complete redesign of the Apply system database.
-- It consolidates fragmented tables and supports:
-- - Dynamic application journeys
-- - AI-generated stages and tasks
-- - Match scoring (current + max possible)
-- - Official source links
-- - Real-time progress tracking
-- - Cleaner UI data flow
-- ============================================================================

-- ============================================================================
-- 1. COURSES
-- ============================================================================
-- Dedicated course catalog table.
-- Separates course facts from user applications.
-- One course can be saved by many users.

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- University reference
  university_id BIGINT REFERENCES public.universities(id) ON DELETE SET NULL,
  
  -- Core course info
  university_name TEXT,
  course_name TEXT NOT NULL,
  course_url TEXT NOT NULL,
  
  -- Course details
  degree_level TEXT, -- "Bachelor's", "Master's", "PhD"
  subject TEXT,
  study_mode TEXT, -- "Full-time", "Part-time", "Online"
  duration TEXT, -- "3 years", "1 year"
  intake TEXT, -- "September 2027", "Fall 2027"
  country TEXT,
  city TEXT,
  
  -- Tuition
  tuition_fee_text TEXT, -- "£28,000 per year"
  tuition_fee_min NUMERIC,
  tuition_fee_max NUMERIC,
  tuition_currency TEXT, -- "GBP", "USD", "EUR"
  
  -- Requirements summary
  entry_requirements_summary TEXT,
  english_requirements_summary TEXT,
  application_method TEXT, -- "UCAS", "Direct Apply", "Common App"
  application_code TEXT, -- UCAS code or other reference
  
  -- Extraction metadata
  source_confidence NUMERIC DEFAULT 0.7,
  extraction_status TEXT DEFAULT 'pending' 
    CHECK (extraction_status IN ('pending', 'extracted', 'needs_review', 'failed')),
  
  last_extracted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(course_url)
);

CREATE INDEX idx_courses_university_id ON public.courses(university_id);
CREATE INDEX idx_courses_subject ON public.courses(subject);
CREATE INDEX idx_courses_country ON public.courses(country);

-- ============================================================================
-- 2. STUDENT PROFILES (Enhanced)
-- ============================================================================
-- Extend existing student_profiles with profile_version for match scoring.
-- This allows match analyses to know when they're stale.

DO $$ 
BEGIN
  -- Add profile_version if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_profiles' AND column_name = 'profile_version'
  ) THEN
    ALTER TABLE public.student_profiles ADD COLUMN profile_version INT DEFAULT 1;
  END IF;
  
  -- Add last_profile_analysis_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_profiles' AND column_name = 'last_profile_analysis_at'
  ) THEN
    ALTER TABLE public.student_profiles ADD COLUMN last_profile_analysis_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- 3. UPLOADED DOCUMENTS (Enhanced)
-- ============================================================================
-- Extend for better CV/SOP/transcript support.

DO $$ 
BEGIN
  -- Add extraction_status if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'uploaded_documents' AND column_name = 'extraction_status'
  ) THEN
    ALTER TABLE public.uploaded_documents ADD COLUMN extraction_status TEXT DEFAULT 'pending'
      CHECK (extraction_status IN ('pending', 'parsed', 'failed', 'needs_review'));
  END IF;
  
  -- Add extracted_data if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'uploaded_documents' AND column_name = 'extracted_data'
  ) THEN
    ALTER TABLE public.uploaded_documents ADD COLUMN extracted_data JSONB DEFAULT '{}'::JSONB;
  END IF;
  
  -- Add is_active if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'uploaded_documents' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.uploaded_documents ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- ============================================================================
-- 4. COURSE APPLICATIONS V2
-- ============================================================================
-- Main Apply workspace record.
-- Links user → course → university → status → progress → match score.

CREATE TABLE IF NOT EXISTS public.course_applications_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  university_id BIGINT REFERENCES public.universities(id) ON DELETE SET NULL,
  
  -- Core course info (denormalized for performance)
  university_name TEXT NOT NULL,
  course_name TEXT NOT NULL,
  course_url TEXT,
  
  -- Course details
  degree_level TEXT,
  subject TEXT,
  study_mode TEXT,
  intake TEXT,
  country TEXT,
  country_flag TEXT,
  
  -- Application status
  status TEXT DEFAULT 'researching'
    CHECK (status IN (
      'researching',
      'shortlisted',
      'preparing',
      'ready_to_apply',
      'submitted',
      'interview',
      'offer_received',
      'rejected',
      'withdrawn',
      'archived'
    )),
  
  -- Progress tracking
  current_stage_id UUID,
  progress_percentage INT DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  
  -- Deadline
  deadline DATE,
  deadline_source TEXT,
  deadline_confidence NUMERIC,
  
  -- Import metadata
  imported_from_url TEXT,
  import_status TEXT DEFAULT 'pending'
    CHECK (import_status IN ('pending', 'extracting', 'complete', 'failed', 'needs_review')),
  
  -- AI summary and user notes
  ai_summary TEXT,
  user_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_course_applications_v2_user_id ON public.course_applications_v2(user_id);
CREATE INDEX idx_course_applications_v2_course_id ON public.course_applications_v2(course_id);
CREATE INDEX idx_course_applications_v2_status ON public.course_applications_v2(status);
CREATE INDEX idx_course_applications_v2_deadline ON public.course_applications_v2(deadline);

-- ============================================================================
-- 5. APPLICATION STAGES
-- ============================================================================
-- Dynamic journey pipeline.
-- Supports 5-8 stages depending on course requirements.

CREATE TABLE IF NOT EXISTS public.application_stages_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  application_id UUID NOT NULL REFERENCES public.course_applications_v2(id) ON DELETE CASCADE,
  
  -- Stage info
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  order_num INT NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'not_started'
    CHECK (status IN (
      'not_started',
      'in_progress',
      'completed',
      'blocked',
      'not_applicable'
    )),
  
  is_required BOOLEAN DEFAULT TRUE,
  icon TEXT,
  
  -- Context
  why_this_matters TEXT,
  ai_generated BOOLEAN DEFAULT TRUE,
  confidence NUMERIC DEFAULT 0.7,
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(application_id, slug)
);

CREATE INDEX idx_application_stages_v2_application_id ON public.application_stages_v2(application_id);
CREATE INDEX idx_application_stages_v2_order ON public.application_stages_v2(application_id, order_num);

-- ============================================================================
-- 6. APPLICATION TASKS V2
-- ============================================================================
-- Unified task table with action buttons.

CREATE TABLE IF NOT EXISTS public.application_tasks_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  application_id UUID NOT NULL REFERENCES public.course_applications_v2(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.application_stages_v2(id) ON DELETE CASCADE,
  
  -- Task info
  title TEXT NOT NULL,
  description TEXT,
  
  -- Task type
  task_type TEXT DEFAULT 'general'
    CHECK (task_type IN (
      'research',
      'eligibility',
      'document',
      'profile',
      'scholarship',
      'mentor',
      'external_link',
      'deadline',
      'submission',
      'general'
    )),
  
  -- Status
  status TEXT DEFAULT 'not_started'
    CHECK (status IN (
      'not_started',
      'in_progress',
      'completed',
      'waiting_on_someone',
      'blocked',
      'not_applicable'
    )),
  
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  due_date DATE,
  
  -- Action button
  action_label TEXT, -- "Check requirements", "Upload CV", "Book mentor"
  action_type TEXT
    CHECK (action_type IN (
      'internal_route',
      'external_url',
      'upload_document',
      'open_modal',
      'book_mentor',
      'recalculate_match',
      'none'
    )),
  action_target TEXT, -- URL, route path, or identifier
  
  -- Source
  source_url TEXT,
  confidence NUMERIC DEFAULT 0.7,
  
  -- Ordering
  sort_order INT DEFAULT 0,
  
  -- Metadata
  completed_at TIMESTAMPTZ,
  created_by TEXT DEFAULT 'ai'
    CHECK (created_by IN ('ai', 'user', 'system', 'admin')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_application_tasks_v2_application_id ON public.application_tasks_v2(application_id);
CREATE INDEX idx_application_tasks_v2_stage_id ON public.application_tasks_v2(stage_id);
CREATE INDEX idx_application_tasks_v2_status ON public.application_tasks_v2(status);

-- ============================================================================
-- 7. APPLICATION REQUIREMENTS
-- ============================================================================
-- Extracted requirements with student status tracking.

CREATE TABLE IF NOT EXISTS public.application_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  application_id UUID NOT NULL REFERENCES public.course_applications_v2(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  
  -- Requirement type
  requirement_type TEXT NOT NULL
    CHECK (requirement_type IN (
      'academic',
      'english',
      'document',
      'portfolio',
      'test',
      'interview',
      'work_experience',
      'visa',
      'funding',
      'other'
    )),
  
  -- Requirement details
  title TEXT,
  requirement_text TEXT NOT NULL,
  is_mandatory BOOLEAN DEFAULT TRUE,
  
  -- Student status
  student_status TEXT DEFAULT 'unknown'
    CHECK (student_status IN (
      'unknown',
      'met',
      'partially_met',
      'not_met',
      'needs_review'
    )),
  
  -- Source
  source_url TEXT,
  source_id UUID,
  confidence NUMERIC DEFAULT 0.7,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_application_requirements_application_id ON public.application_requirements(application_id);
CREATE INDEX idx_application_requirements_type ON public.application_requirements(requirement_type);

-- ============================================================================
-- 8. APPLICATION SOURCES
-- ============================================================================
-- Official links with validation status.

CREATE TABLE IF NOT EXISTS public.application_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  application_id UUID REFERENCES public.course_applications_v2(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  university_id BIGINT REFERENCES public.universities(id) ON DELETE SET NULL,
  
  -- Source type
  source_type TEXT NOT NULL
    CHECK (source_type IN (
      'course_page',
      'entry_requirements',
      'how_to_apply',
      'tuition_fees',
      'scholarships',
      'visa',
      'department',
      'contact',
      'admissions_test',
      'accommodation',
      'student_support',
      'other'
    )),
  
  -- Source details
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  
  -- Display
  display_priority INT DEFAULT 100,
  is_official BOOLEAN DEFAULT TRUE,
  
  -- Confidence
  confidence NUMERIC DEFAULT 0.7,
  
  -- Validation
  validation_status TEXT DEFAULT 'unchecked'
    CHECK (validation_status IN (
      'unchecked',
      'valid',
      'broken',
      'redirected',
      'needs_review'
    )),
  
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_application_sources_application_id ON public.application_sources(application_id);
CREATE INDEX idx_application_sources_course_id ON public.application_sources(course_id);
CREATE INDEX idx_application_sources_type ON public.application_sources(source_type);

-- ============================================================================
-- 9. APPLICATION MATCH ANALYSES
-- ============================================================================
-- Match scoring with breakdown and recommendations.

CREATE TABLE IF NOT EXISTS public.application_match_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  application_id UUID NOT NULL REFERENCES public.course_applications_v2(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Profile version tracking
  profile_version INT NOT NULL,
  
  -- Match scores
  current_match_score INT NOT NULL CHECK (current_match_score BETWEEN 0 AND 100),
  max_possible_match_score INT CHECK (max_possible_match_score BETWEEN 0 AND 100),
  
  -- Score labels
  score_label TEXT, -- "Good match", "Fair match"
  max_score_label TEXT, -- "Excellent match possible"
  
  -- Score breakdown
  academic_score INT CHECK (academic_score BETWEEN 0 AND 100),
  english_score INT CHECK (english_score BETWEEN 0 AND 100),
  experience_score INT CHECK (experience_score BETWEEN 0 AND 100),
  document_score INT CHECK (document_score BETWEEN 0 AND 100),
  fit_score INT CHECK (fit_score BETWEEN 0 AND 100),
  
  -- Analysis
  strengths TEXT[],
  weaknesses TEXT[],
  improvement_actions JSONB DEFAULT '[]'::JSONB,
  
  -- Explanations
  explanation TEXT,
  max_possible_explanation TEXT,
  
  -- AI metadata
  model_name TEXT,
  prompt_version TEXT,
  analysis_status TEXT DEFAULT 'complete'
    CHECK (analysis_status IN ('pending', 'running', 'complete', 'failed', 'stale')),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_application_match_analyses_application_id ON public.application_match_analyses(application_id);
CREATE INDEX idx_application_match_analyses_user_id ON public.application_match_analyses(user_id);
CREATE INDEX idx_application_match_analyses_status ON public.application_match_analyses(analysis_status);

-- ============================================================================
-- 10. APPLICATION RECOMMENDATIONS
-- ============================================================================
-- Sidebar tips and AI recommendations.

CREATE TABLE IF NOT EXISTS public.application_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  application_id UUID NOT NULL REFERENCES public.course_applications_v2(id) ON DELETE CASCADE,
  
  -- Recommendation type
  recommendation_type TEXT NOT NULL
    CHECK (recommendation_type IN (
      'tip',
      'warning',
      'next_action',
      'mentor',
      'scholarship',
      'document',
      'profile_improvement'
    )),
  
  -- Content
  title TEXT NOT NULL,
  body TEXT,
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Action
  action_label TEXT,
  action_type TEXT,
  action_target TEXT,
  
  -- Metadata
  confidence NUMERIC DEFAULT 0.7,
  is_dismissed BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_application_recommendations_application_id ON public.application_recommendations(application_id);
CREATE INDEX idx_application_recommendations_type ON public.application_recommendations(recommendation_type);

-- ============================================================================
-- 11. APPLICATION EVENTS
-- ============================================================================
-- Audit trail and progress history.

CREATE TABLE IF NOT EXISTS public.application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  application_id UUID NOT NULL REFERENCES public.course_applications_v2(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Event details
  event_type TEXT NOT NULL,
  event_label TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_application_events_application_id ON public.application_events(application_id);
CREATE INDEX idx_application_events_type ON public.application_events(event_type);
CREATE INDEX idx_application_events_created_at ON public.application_events(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_applications_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_stages_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_tasks_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_match_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;

-- Courses: Public read, authenticated write
CREATE POLICY "Courses are viewable by everyone" ON public.courses
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert courses" ON public.courses
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Course Applications: Users can only see their own
CREATE POLICY "Users can view their own applications" ON public.course_applications_v2
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own applications" ON public.course_applications_v2
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own applications" ON public.course_applications_v2
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own applications" ON public.course_applications_v2
  FOR DELETE USING (auth.uid() = user_id);

-- Application Stages: Users can see stages for their applications
CREATE POLICY "Users can view stages for their applications" ON public.application_stages_v2
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.course_applications_v2
      WHERE id = application_stages_v2.application_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert stages for their applications" ON public.application_stages_v2
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_applications_v2
      WHERE id = application_stages_v2.application_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update stages for their applications" ON public.application_stages_v2
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.course_applications_v2
      WHERE id = application_stages_v2.application_id
      AND user_id = auth.uid()
    )
  );

-- Application Tasks: Users can see tasks for their applications
CREATE POLICY "Users can view tasks for their applications" ON public.application_tasks_v2
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.course_applications_v2
      WHERE id = application_tasks_v2.application_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert tasks for their applications" ON public.application_tasks_v2
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_applications_v2
      WHERE id = application_tasks_v2.application_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update tasks for their applications" ON public.application_tasks_v2
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.course_applications_v2
      WHERE id = application_tasks_v2.application_id
      AND user_id = auth.uid()
    )
  );

-- Application Requirements: Users can see requirements for their applications
CREATE POLICY "Users can view requirements for their applications" ON public.application_requirements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.course_applications_v2
      WHERE id = application_requirements.application_id
      AND user_id = auth.uid()
    )
  );

-- Application Sources: Users can see sources for their applications
CREATE POLICY "Users can view sources for their applications" ON public.application_sources
  FOR SELECT USING (
    application_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.course_applications_v2
      WHERE id = application_sources.application_id
      AND user_id = auth.uid()
    )
  );

-- Match Analyses: Users can only see their own
CREATE POLICY "Users can view their own match analyses" ON public.application_match_analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own match analyses" ON public.application_match_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Recommendations: Users can see recommendations for their applications
CREATE POLICY "Users can view recommendations for their applications" ON public.application_recommendations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.course_applications_v2
      WHERE id = application_recommendations.application_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update recommendations for their applications" ON public.application_recommendations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.course_applications_v2
      WHERE id = application_recommendations.application_id
      AND user_id = auth.uid()
    )
  );

-- Events: Users can see events for their applications
CREATE POLICY "Users can view events for their applications" ON public.application_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.course_applications_v2
      WHERE id = application_events.application_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert events for their applications" ON public.application_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_applications_v2
      WHERE id = application_events.application_id
      AND user_id = auth.uid()
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update application progress based on tasks
CREATE OR REPLACE FUNCTION update_application_progress()
RETURNS TRIGGER AS $$
DECLARE
  total_required_tasks INT;
  completed_required_tasks INT;
  new_progress INT;
BEGIN
  -- Count total required tasks
  SELECT COUNT(*) INTO total_required_tasks
  FROM application_tasks_v2 t
  JOIN application_stages_v2 s ON t.stage_id = s.id
  WHERE t.application_id = NEW.application_id
  AND s.is_required = TRUE
  AND t.status != 'not_applicable';
  
  -- Count completed required tasks
  SELECT COUNT(*) INTO completed_required_tasks
  FROM application_tasks_v2 t
  JOIN application_stages_v2 s ON t.stage_id = s.id
  WHERE t.application_id = NEW.application_id
  AND s.is_required = TRUE
  AND t.status = 'completed';
  
  -- Calculate progress
  IF total_required_tasks > 0 THEN
    new_progress := ROUND((completed_required_tasks::NUMERIC / total_required_tasks::NUMERIC) * 100);
  ELSE
    new_progress := 0;
  END IF;
  
  -- Update application
  UPDATE course_applications_v2
  SET progress_percentage = new_progress,
      updated_at = NOW()
  WHERE id = NEW.application_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update progress when tasks change
CREATE TRIGGER trigger_update_application_progress
AFTER INSERT OR UPDATE OF status ON application_tasks_v2
FOR EACH ROW
EXECUTE FUNCTION update_application_progress();

-- Function to update stage status based on tasks
CREATE OR REPLACE FUNCTION update_stage_status()
RETURNS TRIGGER AS $$
DECLARE
  total_tasks INT;
  completed_tasks INT;
  in_progress_tasks INT;
  new_status TEXT;
BEGIN
  -- Count tasks in this stage
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'in_progress')
  INTO total_tasks, completed_tasks, in_progress_tasks
  FROM application_tasks_v2
  WHERE stage_id = NEW.stage_id
  AND status != 'not_applicable';
  
  -- Determine new status
  IF total_tasks = 0 THEN
    new_status := 'not_started';
  ELSIF completed_tasks = total_tasks THEN
    new_status := 'completed';
  ELSIF in_progress_tasks > 0 OR completed_tasks > 0 THEN
    new_status := 'in_progress';
  ELSE
    new_status := 'not_started';
  END IF;
  
  -- Update stage
  UPDATE application_stages_v2
  SET status = new_status,
      updated_at = NOW(),
      started_at = CASE 
        WHEN started_at IS NULL AND new_status != 'not_started' THEN NOW()
        ELSE started_at
      END,
      completed_at = CASE 
        WHEN new_status = 'completed' THEN NOW()
        ELSE NULL
      END
  WHERE id = NEW.stage_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stage status when tasks change
CREATE TRIGGER trigger_update_stage_status
AFTER INSERT OR UPDATE OF status ON application_tasks_v2
FOR EACH ROW
EXECUTE FUNCTION update_stage_status();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.courses IS 'Course catalog - separates course facts from user applications';
COMMENT ON TABLE public.course_applications_v2 IS 'Main Apply workspace record - links user to course with status and progress';
COMMENT ON TABLE public.application_stages_v2 IS 'Dynamic journey pipeline stages';
COMMENT ON TABLE public.application_tasks_v2 IS 'Unified task table with action buttons';
COMMENT ON TABLE public.application_requirements IS 'Extracted requirements with student status tracking';
COMMENT ON TABLE public.application_sources IS 'Official links with validation status';
COMMENT ON TABLE public.application_match_analyses IS 'Match scoring with breakdown and recommendations';
COMMENT ON TABLE public.application_recommendations IS 'Sidebar tips and AI recommendations';
COMMENT ON TABLE public.application_events IS 'Audit trail and progress history';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
