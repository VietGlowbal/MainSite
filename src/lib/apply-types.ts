export type CourseApplicationStatus =
  | 'course_imported'
  | 'plan_generated'
  | 'preparing'
  | 'ready_to_submit'
  | 'submitted'
  | 'interview'
  | 'offer_received'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

export type ApplicationMethod =
  | 'UCAS'
  | 'Direct Apply'
  | 'Common App'
  | 'University Portal'
  | 'Other';

export type CourseApplication = {
  id: string;
  userId: string;
  universityId?: string;

  universityName: string;
  courseName: string;
  courseUrl: string;

  degreeLevel?: string;
  subject?: string;
  studyMode?: string;
  intake?: string;
  countryFlag?: string;
  country?: string;

  applicationMethod?: ApplicationMethod;
  applicationCode?: string;

  deadline?: string;
  tuitionFee?: string;
  entryRequirementsSummary?: string;
  englishRequirementsSummary?: string;

  status: CourseApplicationStatus;
  progressPercentage: number;
  matchScore?: number;

  imageUrl?: string;
  logoUrl?: string;

  nextAction?: string;
  sourceConfidence: 'high' | 'medium' | 'low';
  createdAt: string;
  updatedAt: string;
  
  scholarships?: Array<{
    id: string;
    title: string;
    description?: string;
    url?: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
};

export type StageStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'not_applicable';

export type ApplicationStage = {
  id: string;
  applicationId: string;
  name: string;
  order: number;
  description?: string;
  status: StageStatus;
  isRequired: boolean;
  icon?: string;
  tasks?: ApplicationWorkspaceTask[];
};

export type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'waiting_on_someone'
  | 'blocked'
  | 'not_applicable';

export type TaskType = 'required' | 'recommended' | 'optional' | 'risk';
export type TaskPriority = 'high' | 'medium' | 'low';
export type SupportToolType = 'sop_maximiser' | 'interview_prep' | 'mentor' | 'test_prep' | 'profile_review';

export type ApplicationWorkspaceTask = {
  id: string;
  applicationId: string;
  stageId: string;

  title: string;
  description?: string;
  dueDate?: string;

  priority: TaskPriority;
  type: TaskType;
  status: TaskStatus;

  sourceUrl?: string;
  supportToolType?: SupportToolType;
  confidence: 'high' | 'medium' | 'low';

  notes?: string;
  createdBy: 'ai' | 'user';
  createdAt: string;
  updatedAt: string;
};

export type KeyFact = {
  value: string;
  confidence: 'high' | 'medium' | 'low';
  sourceUrl?: string;
  label?: string;
};

export type ApplicationKeyFacts = {
  deadline?: KeyFact;
  tuitionFee?: KeyFact;
  applicationMethod?: KeyFact;
  entryRequirements?: KeyFact;
  englishRequirements?: KeyFact;
  matchScore?: number;
  matchLabel?: string;
};

export type ApplicationWorkspace = {
  application: CourseApplication;
  keyFacts: ApplicationKeyFacts;
  stages: ApplicationStage[];
};

export type ShortlistedUniversity = {
  id: string;
  universityId: string;
  universityName: string;
  country: string;
  countryFlag?: string;
  imageUrl?: string;
  logoUrl?: string;
  courseSearchUrl?: string;
};

export type UpcomingDeadline = {
  date: string;
  label: string;
  universityName: string;
  applicationId: string;
  daysLeft: number;
};

export type ApplicationOverview = {
  activeApplications: number;
  submitted: number;
  offersReceived: number;
  tasksCompleted: number;
  totalTasks: number;
};
