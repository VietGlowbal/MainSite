import type { StudentProfile } from '@/lib/types';

export const ONBOARDING_FLOW_ID = 'study-planning';
export const ONBOARDING_FLOW_VERSION = 3;

export type OnboardingStepId =
  | 'preferred_countries'
  | 'current_education'
  | 'target_majors'
  | 'intended_level'
  | 'nationality'
  | 'academic_grades'
  | 'test_scores'
  | 'academic_awards'
  | 'budget';

export type AwardAnswer = {
  id: string;
  level: string;
  role: string;
  name: string;
  organization: string;
  description: string;
  date: string;
};

export type TestScoreAnswer = {
  id: string;
  type: string;
  score: string;
};

export type OnboardingAnswers = {
  preferred_countries: string[];
  current_education_level: string;
  average_grade: string;
  target_majors: string[];
  other_major: string;
  intended_level: string;
  nationality: string;
  grading_system: string;
  grade_value: string;
  budget_range: string;
  test_scores: TestScoreAnswer[];
  has_academic_awards: '' | 'yes' | 'no';
  academic_awards: AwardAnswer[];
};

export type OnboardingFlowStep = {
  id: OnboardingStepId;
  number: number;
  title: string;
  body: string;
};

export type StoredOnboardingResponse = {
  flow_id?: string | null;
  flow_version?: number | null;
  answers?: unknown;
  completed_steps?: number | null;
  status?: string | null;
} | null;

export type OnboardingControllerOptions = {
  initialProfile?: StudentProfile | null;
  initialResponse?: StoredOnboardingResponse;
  isSignedIn: boolean;
  fromSearch?: boolean;
};

export type OnboardingViewModel = {
  answers: OnboardingAnswers;
  completedSteps: number;
  currentStepIndex: number;
  activeStep: OnboardingFlowStep;
  canGoBack: boolean;
  canGoNext: boolean;
  isSignedIn: boolean;
  isSubmitting: boolean;
  message: string | null;
  fromSearch: boolean;
  steps: readonly OnboardingFlowStep[];
  updateAnswer: <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  submit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
};
