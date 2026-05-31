export type StudentQuestionIntent =
  | 'compare'
  | 'cost'
  | 'scholarship'
  | 'visa'
  | 'application'
  | 'course-info'
  | 'general';

export type FunnelStage =
  | 'early-research'
  | 'shortlisting'
  | 'application'
  | 'decision';

export type StudentQuestionSource =
  | 'ai-generated'
  | 'manual'
  | 'search-console'
  | 'forum'
  | 'user-question';

export type StudentQuestionStatus =
  | 'new'
  | 'clustered'
  | 'drafted'
  | 'reviewed'
  | 'published'
  | 'rejected';

export type StudentQuestion = {
  id: string;
  question: string;
  studentSegment: string;
  targetCountry?: string;
  subject?: string;
  intent: StudentQuestionIntent;
  funnelStage: FunnelStage;
  importanceScore: number;
  source: StudentQuestionSource;
  status: StudentQuestionStatus;
  createdAt: string;
  updatedAt: string;
};

export type RecommendedPageType =
  | 'ranking'
  | 'guide'
  | 'comparison'
  | 'scholarship'
  | 'cost'
  | 'course-database'
  | 'methodology';

export type TopicCluster = {
  id: string;
  title: string;
  slug: string;
  primaryQuestion: string;
  relatedQuestions: string[];
  studentSegment: string;
  targetCountry?: string;
  subject?: string;
  recommendedPageType: RecommendedPageType;
  existingPageSlug?: string;
  action: 'create-new-page' | 'update-existing-page' | 'ignore';
  priorityScore: number;
  createdAt: string;
  updatedAt: string;
};

export type GeoSource = {
  id: string;
  title: string;
  url: string;
  sourceType:
    | 'official-university'
    | 'official-scholarship'
    | 'official-government'
    | 'ranking'
    | 'glowbal-internal';
  relatedSlug: string;
  notes?: string;
  lastCheckedAt: string;
};

export type GeoReviewStatus = 'draft' | 'needs-review' | 'publishable';

export type GeoQualityCheck = {
  slug: string;
  passed: boolean;
  publishable: boolean;
  reviewRequired: boolean;
  reviewStatus: GeoReviewStatus;
  score: number;
  duplicateRisk: 'low' | 'medium' | 'high';
  hasShortAnswer: boolean;
  hasMethodology: boolean;
  hasFaqs: boolean;
  hasSources: boolean;
  hasTodoSources: boolean;
  hasClearStudentSegment: boolean;
  hasGlowbalCTA: boolean;
  officialSourceCount: number;
  todoSourceCount: number;
  blockerReasons: string[];
  notes: string[];
};

export type GeoPageMetadata = {
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  slug: string;
  openGraphTitle: string;
  openGraphDescription: string;
  pageType: string;
  topic?: string;
  heroImage?: string;
  heroImagePrompt?: string;
  heroImageStyle?: 'ai' | 'svg-fallback';
  readingTimeMinutes?: number;
  lastUpdated: string;
  schema: {
    article?: Record<string, unknown>;
    faq?: Record<string, unknown>;
    breadcrumb?: Record<string, unknown>;
    organization?: Record<string, unknown>;
  };
};

export type DraftManifest = {
  generatedAt: string;
  clusterId: string;
  slug: string;
  title: string;
  filePath: string;
  pageType: RecommendedPageType;
};

export type GeoConfig = {
  mode: 'testing' | 'production';
  questionsPerRun: number;
  draftPagesPerRun: number;
  allowMultipleOpenGeoPRs: boolean;
  requireHumanReview: boolean;
  autoMerge: boolean;
  allowGenericDrafts: boolean;
  requireSourcesForPublishable: boolean;
  directPublishToSite?: boolean;
};
