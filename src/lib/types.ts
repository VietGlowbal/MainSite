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
  created_at?: string;
  updated_at?: string;
};
