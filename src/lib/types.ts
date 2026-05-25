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
