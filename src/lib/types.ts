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
  created_at?: string;
  updated_at?: string;
};
