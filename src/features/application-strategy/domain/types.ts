/**
 * Application Strategy (Feature 2) — entity and view-model types.
 *
 * These mirror supabase-application-strategy.sql. Database rows arrive
 * snake_cased and are mapped in api/strategy-repository.ts; everything above
 * that layer sees the camelCase shapes here.
 */

// ── Shared ────────────────────────────────────────────────────────────────

/**
 * Where a claim came from. Deliberately per-field rather than one URL per
 * document: "the programme requires X" and "the fees are Y" are usually two
 * different pages, and a single source link makes both unverifiable.
 */
export type StrategySource = {
  /** Which field this backs, e.g. 'programmeObjectives'. */
  field: string;
  url: string;
  /** The heading the claim sat under, when the page had one. */
  heading?: string | null;
  /** Short verbatim excerpt. Not the whole page. */
  snippet?: string | null;
};

/**
 * The only four values the UI may display. Wider than the DB CHECK on purpose:
 * that constraint and this union are the same fact, and status.ts owns deriving
 * it.
 */
export type WorkspaceStatus = 'not_started' | 'in_progress' | 'needs_attention' | 'ready_for_audit';

/** Whether a value was established from the programme, the student, or both. */
export type DataOrigin = 'university' | 'profile' | 'mixed';

// ── Strategy root ─────────────────────────────────────────────────────────

export type ApplicationStrategy = {
  id: string;
  userId: string;
  applicationId: string;
  status: WorkspaceStatus;
  createdAt: string;
  updatedAt: string;
};

// ── CV target profile ─────────────────────────────────────────────────────

/** The seven fields, as keys. Ordered as the approved design lays them out. */
export const TARGET_PROFILE_FIELDS = [
  'careerDirection',
  'universityPositioning',
  'educationPhilosophy',
  'environment',
  'programmeObjectives',
  'priorityCapabilities',
  'careerAlignment',
] as const;

export type TargetProfileField = (typeof TARGET_PROFILE_FIELDS)[number];

export type CvTargetProfile = {
  id: string;
  strategyId: string;
  careerDirection: string | null;
  universityPositioning: string | null;
  educationPhilosophy: string | null;
  environment: string | null;
  programmeObjectives: string | null;
  priorityCapabilities: string | null;
  careerAlignment: string | null;
  /** What the generator could not establish. Surfaced per card, not as prose. */
  missingInformation: string[];
  sourcesUsed: StrategySource[];
  /** Bumped on any field change; a CvReview records the value it assessed. */
  version: number;
  /** NULL until generated once — distinct from "generated then cleared". */
  generatedAt: string | null;
  updatedAt: string;
};

/** Exactly what the generator is contracted to return. */
export type TargetProfileGeneration = {
  careerDirection: string;
  universityPositioning: string;
  educationPhilosophy: string;
  environment: string;
  programmeObjectives: string;
  priorityCapabilities: string;
  careerAlignment: string;
  missingInformation: string[];
  sourcesUsed: StrategySource[];
};

// ── Structured CV ─────────────────────────────────────────────────────────

export type CvSectionKind =
  | 'contact'
  | 'education'
  | 'experience'
  | 'activities'
  | 'projects'
  | 'research'
  | 'awards'
  | 'skills'
  | 'certifications'
  | 'publications'
  | 'interests'
  | 'custom';

export type CvEntry = {
  id: string;
  organization?: string | null;
  role?: string | null;
  location?: string | null;
  /** Free text ("2024", "Sep 2024"). Students give varying precision and a
   *  DATE would have to invent the missing part. Same call as
   *  student_achievements.year in supabase-reflection.sql. */
  startDate?: string | null;
  endDate?: string | null;
  current?: boolean;
  bullets: string[];
  /** Metrics or proof the student has confirmed. Never AI-generated. */
  evidence?: string | null;
  /** The student_achievements / student_activities row this came from. */
  linkedProfileItemId?: string | null;
  /** Collapsed in the editor by default. Presentation, persisted for comfort. */
  collapsed?: boolean;
};

export type CvSection = {
  id: string;
  kind: CvSectionKind;
  /** Only meaningful for kind 'custom'; otherwise the catalogue label wins. */
  title?: string | null;
  entries: CvEntry[];
};

export type CvLayoutKey = 'academic' | 'technical' | 'leadership';

export type StructuredCv = {
  id: string;
  strategyId: string;
  sourceDocumentId: string | null;
  /** Array position IS the section order the student arranged. */
  sections: CvSection[];
  selectedLayout: CvLayoutKey | null;
  contentVersion: number;
  lastReviewedVersion: number | null;
  lastExportedVersion: number | null;
  updatedAt: string;
};

// ── CV review ─────────────────────────────────────────────────────────────

export type CvStrength = {
  title: string;
  /** Quoted from the CV. The prompt forbids paraphrase here. */
  evidence: string;
  targetProfileArea: string;
  programmeRelevance: string;
  strength: 'strong' | 'moderate';
};

export type CvMissingSignal = {
  signal: string;
  reason: string;
  action: string;
  /** Constrained to a real section kind so "Open relevant section" resolves. */
  targetSection: CvSectionKind;
  /** Blocks readiness when true. */
  critical: boolean;
};

export type CvReview = {
  id: string;
  cvId: string;
  targetProfileVersion: number;
  contentVersion: number;
  strengths: CvStrength[];
  missingSignals: CvMissingSignal[];
  summary: string;
  sourcesUsed: StrategySource[];
  model: string;
  createdAt: string;
};

// ── Statement ─────────────────────────────────────────────────────────────

export type StatementBrief = {
  /** What the statement has to demonstrate. */
  mustDemonstrate: string[];
  programmeInformation: string[];
  /** Evidence the student already has. Never invented experiences. */
  evidenceToConsider: string[];
  /** So the statement does not just restate the CV. */
  coveredByCv: string[];
  missingInformation: string[];
};

export type StatementStrategy = {
  id: string;
  strategyId: string;
  prompt: string | null;
  wordLimit: number | null;
  brief: StatementBrief;
  sourceUrls: StrategySource[];
  updatedAt: string;
};

export type StatementOverview = {
  communicates: string;
  strongestQuality: string;
  mostImportantIssue: string;
  answersPrompt: 'yes' | 'partly' | 'no' | 'unknown';
};

export type FindingSeverity = 'strength' | 'suggestion' | 'problem';

export type StatementFinding = {
  id: string;
  category: string;
  severity: FindingSeverity;
  explanation: string;
  /** Verbatim substring of the draft. The anchor quote-matching relies on. */
  quote: string | null;
  /** Offsets at analysis time. Stale after an edit; the quote is the fallback. */
  quoteStart?: number | null;
  quoteEnd?: number | null;
  suggestedAction: string;
  /** Optional rewrite. Only ever shown as a suggestion. */
  suggestedRevision?: string | null;
};

export const AACC_PILLARS = ['academic', 'activities', 'character', 'contribution'] as const;

export type AaccPillarKey = (typeof AACC_PILLARS)[number];

export type AaccPillar = {
  /**
   * 0–100: how clearly the CURRENT DRAFT demonstrates this area. Not an
   * admission probability. Rendered as small secondary text, never a ring.
   */
  score: number;
  explanation: string;
  /** Quoted from the statement. */
  evidence: string[];
  missingEvidence: string[];
  recommendedImprovement: string;
};

/**
 * Four pillars and nothing else.
 *
 * There is deliberately NO overall score field. The product rule is that no
 * aggregate may be presented as an admission likelihood, and the cheapest way
 * to guarantee that is for there to be no such number to render.
 */
export type AaccAssessment = Record<AaccPillarKey, AaccPillar>;

export type ReadinessCheckKey =
  | 'promptAnswered'
  | 'wordLimit'
  | 'placeholderText'
  | 'incompleteSentences'
  | 'unsupportedClaims'
  | 'profileContradictions'
  | 'repeatedSections'
  | 'programmeReferences'
  | 'unresolvedFeedback';

export type ReadinessCheck = {
  key: ReadinessCheckKey;
  passed: boolean;
  detail: string;
};

export type StatementReadiness = {
  checks: ReadinessCheck[];
  /** Statement-level only. Not the Feature 4 Submit Audit. */
  state: 'needs_attention' | 'ready';
};

export type StatementAnalysis = {
  id: string;
  statementId: number | null;
  strategyId: string;
  contentVersion: number;
  overview: StatementOverview;
  ideasAndStructure: StatementFinding[];
  opening: StatementFinding[];
  aacc: AaccAssessment;
  readiness: StatementReadiness;
  model: string;
  createdAt: string;
};

// ── Shared AI context ─────────────────────────────────────────────────────

/**
 * Everything a Feature 2 AI operation is allowed to know, assembled once
 * server-side. No operation reads candidate or programme data directly.
 */
export type ApplicationStrategyContext = {
  candidate: {
    academics: string | null;
    achievements: unknown[];
    activities: unknown[];
    goals: string | null;
    preferences: unknown;
  };
  application: {
    universityName: string;
    courseName: string;
    requirements: string | null;
    courseSummary: string | null;
    deadline: string | null;
    sources: StrategySource[];
  };
  documents: {
    cvText: string | null;
    structuredCv: StructuredCv | null;
    statementText: string | null;
  };
  /**
   * Facts about the inputs themselves — notably "a CV was uploaded but its text
   * could not be extracted". Without this the model reports the document as
   * absent, which reads to the student as their upload having been ignored.
   */
  notes: string[];
};

// ── Overview view model ───────────────────────────────────────────────────

export type CvWorkspaceSummary = {
  status: WorkspaceStatus;
  updatedAt: string | null;
  targetProfileStatus: WorkspaceStatus;
  contentStatus: WorkspaceStatus;
  reviewStatus: WorkspaceStatus;
  selectedLayout: CvLayoutKey | null;
  exportStatus: 'none' | 'ready' | 'outdated';
  reviewOutdated: boolean;
};

export type StatementWorkspaceSummary = {
  status: WorkspaceStatus;
  wordCount: number;
  wordLimit: number | null;
  lastSavedAt: string | null;
  lastAnalyzedAt: string | null;
  ideasStatus: WorkspaceStatus;
  openingStatus: WorkspaceStatus;
  aaccStatus: WorkspaceStatus;
  readinessStatus: WorkspaceStatus;
  analysisOutdated: boolean;
};

/**
 * What the overview page renders. Nullable throughout: the page has to degrade
 * to an actionable incomplete state rather than blocking, so a missing course
 * name is a value it omits, not an error.
 */
export type StrategyOverview = {
  strategyId: string;
  applicationId: string;
  status: WorkspaceStatus;
  application: {
    universityName: string | null;
    universityLogoUrl: string | null;
    courseName: string | null;
    degreeLevel: string | null;
    deadline: string | null;
    applicationStatus: string | null;
  };
  cv: CvWorkspaceSummary;
  statement: StatementWorkspaceSummary;
  /**
   * Where each card goes, and which of them is THE next thing to do.
   *
   * Resolved here rather than in the page because the destinations depend on the
   * full status inputs, and the page only has the summarised statuses. A page
   * that reconstructed inputs from statuses in order to ask again would be
   * guessing at the very thing this object already knows.
   */
  actions: {
    next: { href: string; label: string };
    cvHref: string;
    statementHref: string;
  };
};
