export type WaitlistState = {
  status: 'idle' | 'ok' | 'error';
  message: string;
};

export type WaitlistAction = (
  state: WaitlistState,
  formData: FormData,
) => Promise<WaitlistState>;

export type UploadedDocument = {
  id: string;
  user_id: string;
  type: string;
  storage_key: string;
  file_name: string;
  mime_type?: string | null;
  parsed_summary?: string | null;
  created_at: string;
};

export type StudentProfile = {
  id?: string;
  user_id?: string;
  study_level?: string | null;
  target_subjects?: string[] | null;
  preferred_countries?: string[] | null;
  budget_range?: string | null;
  academic_background?: string | null;
  grades_summary?: Record<string, unknown> | null;
  goals?: string | null;
  career_interests?: string[] | null;
  campus_preferences?: string | null;
  support_needs?: string | null;
  profile_summary?: string | null;
  bio?: string | null;
  location?: string | null;
  nationality?: string | null;
  achievements?: { id: string; title: string; description: string; year: string }[] | null;
  skills?: string[] | null;
  onboarding_completed?: boolean;
  onboarding_completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  // Extended profile fields
  phone?: string | null;
  date_of_birth?: string | null;
  current_institution?: string | null;
  current_qualification?: string | null;
  predicted_grades?: string | null;
  graduation_year?: number | null;
  preferred_cities?: string[] | null;
  study_mode_preference?: string | null;
  target_intake?: string | null;
  application_cycle_year?: number | null;
};

export type WorkExperience = {
  id: string;
  user_id: string;
  company: string;
  role: string;
  employment_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
};

export type EnglishTestScore = {
  id: string;
  user_id: string;
  test_type: string;
  overall_score?: number | null;
  listening_score?: number | null;
  reading_score?: number | null;
  writing_score?: number | null;
  speaking_score?: number | null;
  test_date?: string | null;
  expiry_date?: string | null;
  created_at: string;
  updated_at: string;
};

export type University = {
  id: number;
  country: string;
  name: string;
  local_name?: string | null;
  type?: string | null;
  qs_rank?: number | null;
  the_rank?: number | null;
  arwu_rank?: number | null;
  national_rank?: string | null;
  strengths?: string | null;
  specific_insight?: string | null;
  teaching_style?: string | null;
  international_environment?: string | null;
  gpa_range?: string | null;
  english_requirement?: string | null;
  standardized_test?: string | null;
  special_test?: string | null;
  admission_difficulty?: string | null;
  accept_rate?: string | null;
  application_deadline?: string | null;
  scholarship?: string | null;
  tuition_usd?: string | null;
  living_cost_usd?: string | null;
  housing?: string | null;
  industry_connections?: string | null;
  internship_coop?: string | null;
  employability?: string | null;
  best_for?: string | null;
  weaknesses?: string | null;
  notes?: string | null;
  image_url?: string | null;
  logo_url?: string | null;
  images_resolved_at?: string | null;
};

// ── Scholarships ────────────────────────────────────────────────────────────
// Backed by public.scholarships + public.scholarship_universities
// (see supabase-scholarships.sql). Scholarships are NOT 1:1 with a university:
// `scope` distinguishes school-specific awards from country / consortium /
// provider programmes. The Zod schema + FUNDING_TYPES live in ./scholarships.
export type ScholarshipScope = 'university' | 'country' | 'consortium' | 'provider';
export type ScholarshipStatus = 'draft' | 'published' | 'archived';
export type ScholarshipFundingType =
  | 'merit'
  | 'need'
  | 'leadership'
  | 'research'
  | 'sport'
  | 'diversity'
  | 'regional'
  | 'field-specific'
  | 'full-ride'
  | 'partial'
  | 'travel'
  | 'other';

export type Scholarship = {
  id: number;
  name: string;
  slug?: string | null;
  scope: ScholarshipScope;
  country?: string | null;
  provider?: string | null;
  funding_type: ScholarshipFundingType[];
  coverage?: string | null;
  amount_min?: number | null;
  amount_max?: number | null;
  amount_currency?: string | null;
  slots?: number | null;
  slots_text?: string | null;
  eligibility?: string | null;
  applies_to_text?: string | null;
  conditions?: string | null;
  insight?: string | null;
  deadline_date?: string | null; // ISO date (yyyy-mm-dd)
  deadline_text?: string | null;
  source_url?: string | null;
  source_lang?: 'en' | 'vi' | 'mixed' | null;
  ranking_note?: string | null;
  raw?: Record<string, unknown> | null;
  status: ScholarshipStatus;
  source_key?: string | null;
  created_at?: string;
  updated_at?: string;
  // Hydrated via the join table when fetched with universities.
  universities?: University[];
};

export type ScholarshipUniversity = {
  scholarship_id: number;
  university_id: number;
  match_score?: number | null;
  match_method?: 'exact' | 'alias' | 'ilike' | 'manual' | null;
  confirmed: boolean;
  created_at?: string;
};

export type UserUniversity = {
  id: number;
  user_id: string;
  university_id: number;
  status: 'interested' | 'applying' | 'applied' | 'offer' | 'rejected' | 'enrolled';
  match_score?: number | null;
  notes?: string | null;
  added_at: string;
  updated_at: string;
  university?: University;
};

export type ApplicationTask = {
  id: number;
  user_university_id: number;
  title: string;
  description?: string | null;
  category: 'research' | 'documents' | 'tests' | 'deadlines' | 'visits' | 'general';
  deadline?: string | null;
  is_completed: boolean;
  completed_at?: string | null;
  sort_order: number;
  tips?: { content: string } | null;
  created_at: string;
};

export type PersonalStatement = {
  id: number;
  user_id: string;
  user_university_id?: number | null;
  title: string;
  content: string;
  doc_type: 'personal_statement' | 'statement_of_purpose';
  ai_analysis?: AIAnalysis | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type AISuggestion = {
  id: string;
  type: 'weak' | 'missing' | 'impact';
  category: string;
  originalText: string;
  replacement: string;
  explanation: string;
};

export type AIChecklistItem = {
  id: number;
  text: string;
  met: boolean;
};

export type AIAnalysis = {
  score: number;
  summary: string;
  suggestions: AISuggestion[];
  checklist: AIChecklistItem[];
};

// ── Coordinator role + ambassador (đại sứ) link tracking ────────────────────
// One coordinator owns a share link (/c/<code>) per media ambassador. Backed by
// public.ambassador_links + public.ambassador_visits and the
// public.ambassador_link_stats view (see supabase-coordinator.sql).
export type AmbassadorLink = {
  id: string;
  coordinator_id: string;
  ambassador_name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AmbassadorVisit = {
  id: string;
  link_id: string;
  coordinator_id: string;
  visitor_id: string;
  is_unique: boolean;
  visited_at: string;
  landing_path?: string | null;
  referrer?: string | null;
  user_agent?: string | null;
  ip_hash?: string | null;
  utm: Record<string, string>;
};

export type AmbassadorLinkStats = {
  link_id: string;
  coordinator_id: string;
  code: string;
  ambassador_name: string;
  is_active: boolean;
  total_visits: number;
  unique_visitors: number;
  last_visit_at: string | null;
  // Distinct users attributed to this link (signed up / authenticated via it).
  referred_users: number;
};

export type AmbassadorReferral = {
  user_id: string;
  link_id: string;
  coordinator_id: string;
  referred_at: string;
  updated_at: string;
};

export type LoginEvent = {
  id: string;
  user_id: string;
  occurred_at: string;
  source?: string | null;
};
