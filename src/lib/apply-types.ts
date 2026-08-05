// ============================================================================
// APPLY SYSTEM V2 TYPES
// ============================================================================
// Updated types matching the new clean database schema

export type CourseApplicationStatus =
  | 'researching'
  | 'shortlisted'
  | 'preparing'
  | 'ready_to_apply'
  | 'submitted'
  | 'interview'
  | 'offer_received'
  | 'rejected'
  | 'withdrawn'
  | 'archived';

export type StageStatus = 
  | 'not_started' 
  | 'in_progress' 
  | 'completed' 
  | 'blocked' 
  | 'not_applicable';

export type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'waiting_on_someone'
  | 'blocked'
  | 'not_applicable';

export type TaskType =
  | 'research'
  | 'eligibility'
  | 'document'
  | 'profile'
  | 'scholarship'
  | 'mentor'
  | 'external_link'
  | 'deadline'
  | 'submission'
  | 'general'
  | 'improvement';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskActionType =
  | 'internal_route'
  | 'external_url'
  | 'upload_document'
  | 'open_modal'
  | 'book_mentor'
  | 'recalculate_match'
  | 'none';

export type RequirementType =
  | 'academic'
  | 'english'
  | 'document'
  | 'portfolio'
  | 'test'
  | 'interview'
  | 'work_experience'
  | 'visa'
  | 'funding'
  | 'other';

export type RequirementStatus =
  | 'unknown'
  | 'met'
  | 'partially_met'
  | 'not_met'
  | 'needs_review';

export type SourceType =
  | 'course_page'
  | 'entry_requirements'
  | 'how_to_apply'
  | 'tuition_fees'
  | 'scholarships'
  | 'visa'
  | 'department'
  | 'contact'
  | 'admissions_test'
  | 'accommodation'
  | 'student_support'
  | 'other';

export type ValidationStatus =
  | 'unchecked'
  | 'valid'
  | 'broken'
  | 'redirected'
  | 'needs_review';

export type RecommendationType =
  | 'tip'
  | 'warning'
  | 'next_action'
  | 'mentor'
  | 'scholarship'
  | 'document'
  | 'profile_improvement';

// ============================================================================
// CORE ENTITIES
// ============================================================================

export type Course = {
  id: string;
  universityId?: number;
  universityName?: string;
  courseName: string;
  courseUrl: string;
  degreeLevel?: string;
  subject?: string;
  studyMode?: string;
  duration?: string;
  intake?: string;
  country?: string;
  city?: string;
  tuitionFeeText?: string;
  tuitionFeeMin?: number;
  tuitionFeeMax?: number;
  tuitionCurrency?: string;
  entryRequirementsSummary?: string;
  englishRequirementsSummary?: string;
  applicationMethod?: string;
  applicationCode?: string;
  sourceConfidence: number;
  extractionStatus: string;
  lastExtractedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CourseApplication = {
  id: string;
  userId: string;
  courseId?: string;
  universityId?: number;
  universityName: string;
  logoUrl?: string | null;
  courseName: string;
  courseUrl?: string;
  degreeLevel?: string;
  subject?: string;
  studyMode?: string;
  intake?: string;
  country?: string;
  countryFlag?: string;
  applicationMethod?: string;
  applicationCode?: string;
  imageUrl?: string;
  nextAction?: string;
  status: CourseApplicationStatus;
  currentStageId?: string;
  progressPercentage: number;
  parseStatus?: 'pending' | 'processing' | 'complete' | 'timeout' | 'failed';
  /**
   * Student-facing reason the course page could not be read. Set only when
   * `parseStatus` is 'failed'; the worker writes it so the row can say what
   * went wrong instead of sitting on "Loading course details..." forever.
   */
  parseError?: string | null;
  deadline?: string;
  deadlineSource?: string;
  deadlineConfidence?: number;
  importedFromUrl?: string;
  importStatus: string;
  aiSummary?: string;
  userNotes?: string;
  /**
   * When the Strategy Introduction was opened — the last onboarding step.
   *
   * Read by My Portal to decide whether a row can link straight into the
   * planner or has to offer "build your strategy" instead: the planner route
   * redirects back into onboarding until this is set, and a link that bounces
   * is the confusion the navigation rework exists to remove.
   */
  strategyIntroSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationStage = {
  id: string;
  applicationId: string;
  name: string;
  slug: string;
  description?: string;
  orderNum: number;
  status: StageStatus;
  isRequired: boolean;
  icon?: string;
  whyThisMatters?: string;
  aiGenerated: boolean;
  confidence: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  tasks?: ApplicationTask[];
};

export type ApplicationTask = {
  id: string;
  applicationId: string;
  stageId?: string;
  title: string;
  description?: string;
  taskType: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  actionLabel?: string;
  actionType?: TaskActionType;
  actionTarget?: string;
  sourceUrl?: string;
  confidence: number;
  sortOrder: number;
  completedAt?: string;
  createdBy: string;
  /** Pillar this task improves (for 'improvement' tasks). */
  pillar?: string;
  /** Estimated match-score uplift when completed (for 'improvement' tasks). */
  estimatedUplift?: number;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationRequirement = {
  id: string;
  applicationId: string;
  courseId?: string;
  requirementType: RequirementType;
  title?: string;
  requirementText: string;
  isMandatory: boolean;
  studentStatus: RequirementStatus;
  sourceUrl?: string;
  sourceId?: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationSource = {
  id: string;
  applicationId?: string;
  courseId?: string;
  universityId?: number;
  sourceType: SourceType;
  title: string;
  url: string;
  description?: string;
  displayPriority: number;
  isOfficial: boolean;
  confidence: number;
  validationStatus: ValidationStatus;
  lastCheckedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationMatchAnalysis = {
  id: string;
  applicationId: string;
  userId: string;
  profileVersion: number;
  currentMatchScore: number;
  maxPossibleMatchScore?: number;
  scoreLabel?: string;
  maxScoreLabel?: string;
  academicScore?: number;
  englishScore?: number;
  experienceScore?: number;
  documentScore?: number;
  fitScore?: number;
  strengths?: string[];
  weaknesses?: string[];
  improvementActions?: { title?: string; description?: string; priority?: string }[];
  explanation?: string;
  maxPossibleExplanation?: string;
  modelName?: string;
  promptVersion?: string;
  analysisStatus: string;
  /** Five-pillar breakdown (PillarKey → PillarBreakdown). Untyped here to avoid
   *  a circular import; the panel narrows it via @/lib/match-insights. */
  pillars?: Record<string, unknown>;
  confidence?: number;
  inputsPresent?: { profile: boolean; cv: boolean; essay: boolean; activities: boolean };
  createdAt: string;
};

export type ApplicationRecommendation = {
  id: string;
  applicationId: string;
  recommendationType: RecommendationType;
  title: string;
  body?: string;
  priority: TaskPriority;
  actionLabel?: string;
  actionType?: string;
  actionTarget?: string;
  confidence: number;
  isDismissed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationEvent = {
  id: string;
  applicationId: string;
  userId?: string;
  eventType: string;
  eventLabel?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

// ============================================================================
// VIEW MODELS FOR UI
// ============================================================================

export type ApplicationWorkspaceView = {
  application: CourseApplication;
  course?: Course;
  stages: ApplicationStage[];
  activeStage?: ApplicationStage;
  requirements: ApplicationRequirement[];
  sources: ApplicationSource[];
  matchAnalysis?: ApplicationMatchAnalysis;
  recommendations: ApplicationRecommendation[];
  metrics: {
    deadline?: {
      date: string;
      daysLeft: number;
      label: string;
    };
    progress: number;
    currentMatch?: number;
    maxPossibleMatch?: number;
    requirementsMet: number;
    requirementsTotal: number;
  };
};

export type ApplicationOverview = {
  activeApplications: number;
  submitted: number;
  offersReceived: number;
  tasksCompleted: number;
  totalTasks: number;
};

export type UpcomingDeadline = {
  date: string;
  label: string;
  universityName: string;
  applicationId: string;
  daysLeft: number;
};

export type ShortlistedUniversity = {
  id: string;
  universityName: string;
  country?: string;
  countryFlag?: string;
  courseSearchUrl?: string;
};

// A scholarship the user saved (from the scholarships directory), trimmed to
// what the Apply page needs to nest it under an application / shortlisted uni.
export type SavedScholarshipLite = {
  id: number;            // user_scholarships.id
  scholarshipId: number;
  name: string;
  scope: string | null;
  amountLabel: string | null;
  deadlineLabel: string | null;
  sourceUrl: string | null;
  universityId: number | null;
};
