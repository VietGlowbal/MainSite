/**
 * CORE 1 — Planning Context Compiler
 * GATE 1: Domain Contract (types only)
 *
 * This file defines ONLY types. No runtime logic, no hashing, no Zod parsing,
 * no Supabase, no React, no fetching, no compilation.
 *
 * Governing invariants:
 *   - strategy     ≠ planner
 *   - gap          ≠ action
 *   - requirement gap ≠ evidence gap
 *   - stated evidence ≠ missing evidence
 *   - unmet requirement ≠ missing evidence
 *   - missing evaluation metric ≠ missing evidence
 *   - AI-proposed opportunity ≠ current gap
 *   - recommendation ≠ factual evidence
 *   - DB query failure ≠ empty result
 *   - source row exists ≠ source is current
 *   - different hash algorithms cannot be directly compared
 */

import type { ProfileEvaluation } from '@/shared/evaluation/engine';
import type { EvidenceItem } from '@/shared/evaluation/f3-evidence';
import type { ProgrammeFit } from '@/features/apply/domain/ai-reports';
import type { ImprovementAction } from '@/lib/match-insights';
import type {
  StrategyRecommendation,
  PortfolioOpportunity,
  StrategyRoadmap,
} from './strategy-recommendation';
import type { Recommendation } from './recommendation';
import type {
  ApplicationRequirement,
  ApplicationStage,
  ApplicationTask,
  CourseApplicationStatus,
  RequirementStatus,
  RequirementType,
} from '@/lib/apply-types';

// ─── Source diagnostics ───────────────────────────────────────────────────────

/**
 * Describes the observed state of one upstream data source.
 *
 * - present:     row(s) exist and parsed cleanly
 * - missing:     no row exists (e.g. user hasn't generated F5 yet)
 * - invalid:     row(s) exist but failed validation/parsing
 * - unavailable: the query itself failed (network, RLS, etc.)
 *
 * Gate 2 fills these; Core 1 compiler reads them.
 */
export type SourceStatus = 'present' | 'missing' | 'invalid' | 'unavailable';

export type SourceDiagnostic = {
  /** Logical name of the upstream source, e.g. 'student_personal_report_versions'. */
  source: string;
  status: SourceStatus;
  /** Short reason, safe to log — no sensitive content. */
  message?: string;
};

// ─── Source provenance ────────────────────────────────────────────────────────

/**
 * Source-level metadata about one upstream AI analysis result.
 * Enables downstream staleness reasoning without re-querying.
 *
 * All fields except `id` and `generatedAt` are nullable because not every
 * source type tracks all metadata. Consumers must branch on null.
 */
export type SourceProvenance = {
  /** DB primary key of the source row. */
  id: string;
  /** ISO-8601 timestamp of when the source was generated. */
  generatedAt: string;
  /** SHA-256 (or equivalent) hash of the inputs used to generate this source. */
  inputHash: string | null;
  promptVersion: string | null;
  engineVersion: string | null;
  modelName: string | null;
  /**
   * For F7: the ID of the applicant analysis row (`applicant_analyses.id`)
   * that was used to generate this strategy. Allows verifying exact F7 ancestry.
   */
  sourceAnalysisId: string | null;
  /**
   * For F7: the ID of the match analysis row (`application_match_analyses.id`)
   * that was used to generate this strategy. Allows verifying exact F7 ancestry.
   */
  sourceMatchAnalysisId: string | null;
};

// ─── Staleness ────────────────────────────────────────────────────────────────

/**
 * Whether a source is known-current, known-stale, or indeterminate.
 *
 * IMPORTANT: only emit `current` or `stale` when deterministic evidence
 * supports the claim. The default must be `unknown`.
 *
 * Rules:
 *   - Never compare hashes from different hash algorithms or different input
 *     definitions as if they are the same currency.
 *   - `source row exists` does NOT imply `current`.
 *   - `unknown` is always honest; invented `current` is a bug.
 */
export type StalenessState = 'current' | 'stale' | 'unknown';

// ─── Programme summary ────────────────────────────────────────────────────────

/**
 * A planning-scoped view of the application and related course/university data.
 *
 * Does NOT copy the full CourseApplication, Course, or University rows.
 * Includes only the fields that planning logic actually needs to reason about.
 * All fields that may be absent are nullable.
 */
export type PlanningProgrammeSummary = {
  applicationId: string;
  courseId: string | null;
  universityId: number | null;
  universityName: string;
  courseName: string;
  courseUrl: string | null;
  degreeLevel: string | null;
  subject: string | null;
  country: string | null;
  studyMode: string | null;
  intake: string | null;
  applicationMethod: string | null;
  applicationCode: string | null;
  applicationStatus: CourseApplicationStatus;
};

// ─── Requirement gap ─────────────────────────────────────────────────────────

/**
 * A course requirement that the applicant does not fully satisfy.
 *
 * IMPORTANT: RequirementGap is distinct from MissingEvidence and
 * InterventionCandidate. It is a factual status from the requirements table,
 * not an evidence artifact absence, not an action recommendation.
 *
 * Status values derived from `RequirementStatus` in apply-types:
 *   - not_met:      applicant demonstrably fails this requirement
 *   - partially_met: some conditions satisfied but not all
 *   - needs_review: status is unclear and requires human/AI review
 *   - unknown:      status has not been assessed
 *
 * (Only `not_met` and `partially_met` are surfaced as RequirementGaps;
 * `needs_review` and `unknown` are surfaced as unresolved requirements.
 * The compiler enforces this separation — do not merge the two categories.)
 */
export type RequirementGap = {
  requirementId: string;
  requirementType: RequirementType;
  title: string | null;
  requirementText: string;
  /** `not_met` or `partially_met` — narrows RequirementStatus for gaps only. */
  status: Extract<RequirementStatus, 'not_met' | 'partially_met'>;
  isMandatory: boolean;
  /** 0–1 model confidence in the status assessment. */
  confidence: number;
  sourceUrl: string | null;
};

/**
 * A course requirement whose status is genuinely indeterminate.
 * Separate from RequirementGap — unknown ≠ not_met.
 */
export type UnresolvedRequirement = {
  requirementId: string;
  requirementType: RequirementType;
  title: string | null;
  requirementText: string;
  status: Extract<RequirementStatus, 'needs_review' | 'unknown'>;
  isMandatory: boolean;
  confidence: number;
  sourceUrl: string | null;
};

// ─── Hard constraint ─────────────────────────────────────────────────────────

/**
 * A grounded feasibility constraint that planning must respect absolutely.
 *
 * IMPORTANT: strategic recommendations are NOT hard constraints.
 * Only grounded facts qualify: official deadlines, mandatory requirements,
 * eligibility gates.
 */
export type HardConstraintKind =
  | 'application_deadline'
  | 'mandatory_requirement'
  | 'eligibility_gate';

export type HardConstraint = {
  kind: HardConstraintKind;
  description: string;
  /** 0–1 confidence in this constraint's accuracy. */
  confidence: number;
  /** Direct URL to the authoritative source, if available. */
  sourceUrl: string | null;
};

// ─── Planning gap ─────────────────────────────────────────────────────────────

/**
 * A weakness, mismatch, or limitation in the applicant's current profile.
 *
 * PlanningGap is NOT an action — it describes a current deficiency.
 * Core 2 may later decide to act on a gap via an InterventionCandidate.
 *
 * Sources:
 *   - f5_dimension: a gap string from a ProgrammeFit dimension
 *   - f5_limitation: a top-level ProgrammeFit limitation
 *   - f4_limitation: a limitation from the ProfileEvaluation narrative base
 */
export type PlanningGapSource = 'f5_dimension' | 'f5_limitation' | 'f4_limitation';

export type PlanningGap = {
  /** Stable identifier within the context: e.g. `f5_dimension_academicCompetitiveness_0`. */
  id: string;
  source: PlanningGapSource;
  description: string;
  /**
   * For `f5_dimension` gaps: the dimension key (e.g. 'academicCompetitiveness').
   * For `f5_limitation` and `f4_limitation` gaps: explicitly null.
   */
  dimensionKey: string | null;
  /**
   * The ID of the match analysis or evaluation source that produced this gap,
   * for provenance tracing.
   */
  sourceAnalysisId: string | null;
};

// ─── Intervention candidate ───────────────────────────────────────────────────

/**
 * A possible future action that planning may schedule as a Step.
 *
 * IMPORTANT: InterventionCandidate is NOT a scheduled Step. Core 3 may later
 * structure accepted decisions into a hierarchy. Core 1 only reports what exists.
 *
 * Two source kinds are supported:
 *
 *   F5ImprovementCandidate — preserves the full ImprovementAction structure.
 *     Do NOT reduce to a summary string; structured fields are needed for
 *     future Core 3 planning decisions (pillar, uplift, actionType, etc.).
 *
 *   F7RoadmapCandidate — a prioritized roadmap item from F7.
 *     These are strategic priorities, not pillar-level actions.
 */
export type F5ImprovementCandidate = {
  source: 'f5_improvement';
  /** ID of the match analysis row this action came from. */
  sourceAnalysisId: string;
  /** The full ImprovementAction as produced by the match insights AI. */
  action: ImprovementAction;
};

export type F7RoadmapCandidate = {
  source: 'f7_priority';
  /** ID of the strategy recommendation row this priority came from. */
  sourceAnalysisId: string;
  /** The raw priority string from StrategyRoadmap.prioritize[]. */
  label: string;
  /** The roadmap.why rationale explaining this priority. */
  rationale: string;
};

export type InterventionCandidate = F5ImprovementCandidate | F7RoadmapCandidate;

// ─── Evidence classification ──────────────────────────────────────────────────

/**
 * Existing evidence items, organized by verification tier.
 *
 * All three tiers contain EXISTING evidence — evidence that the student has
 * actually entered or attached. None of these represent absent artifacts.
 *
 *   verified:     tier === 'verified' in F3
 *   attributable: tier === 'attributable' in F3
 *   stated:       tier === 'stated' in F3 — EXISTING, not missing
 *
 * The `EvidenceItem` type comes from `@/shared/evaluation/f3-evidence`.
 */
export type ExistingEvidenceByTier = {
  verified: EvidenceItem[];
  attributable: EvidenceItem[];
  stated: EvidenceItem[];
};

/**
 * Evidence that exists but relies only on the applicant's own statement
 * without stronger external confirmation.
 *
 * This is a SUBSET of existingEvidence.stated — not a separate category of
 * absent evidence. Items here appear in both stated and evidenceNeedsProof.
 *
 * SEMANTIC INVARIANT: evidenceNeedsProof ⊆ existingEvidence.stated
 */
export type EvidenceNeedsProof = EvidenceItem[];

/**
 * An artifact or document that is genuinely absent from the application
 * when its presence is structurally required or expected.
 *
 * IMPORTANT: Do NOT use this for:
 *   - F4 missingInputs (missing assessment signals → MissingInputSignal)
 *   - F3 item-level missingInputs (missing item attributes → MissingInputSignal)
 *   - Stated-tier evidence (existing, just unverified → evidenceNeedsProof)
 *   - Unmet requirements (a different concept → RequirementGap)
 *
 * Valid examples:
 *   - An essay document that a programme explicitly requires is not present
 *   - A transcript required by an application rule is absent
 *   - A document type the user must upload is missing from uploaded_documents
 */
export type MissingEvidenceItem = {
  /** Human-readable description of the absent artifact. */
  description: string;
  /** Why this artifact is expected (e.g. 'essay_required_by_programme'). */
  reason: string;
  /** Source of the determination that this artifact is absent. */
  source: 'programme_requirement' | 'application_rule' | 'evaluation_finding';
};

/**
 * An input signal that is absent from an existing item or evaluation,
 * preventing full assessment of that item/framework.
 *
 * IMPORTANT: MissingInputSignal is NOT missing evidence (no artifact is absent).
 * It describes an assessment gap — a metric or attribute the evaluation could
 * not score because the student hasn't provided the underlying data.
 *
 * Sources:
 *   - F3 item-level `missingInputs` (e.g. "[Olympiad trophy] Needs quantified outcome")
 *   - F4 narrative base `missingInputs` (e.g. "growthArc", "evidenceDensity")
 *   - Any other framework's missingInputs fields
 */
export type MissingInputSignal = {
  /** Human-readable description of what signal is absent. */
  description: string;
  /**
   * Framework/framework sub-dimension that couldn't be assessed.
   * E.g. 'f4_base', 'f3_item:evidence-id-xyz'.
   */
  frameworkContext: string;
};

// ─── Deadline ─────────────────────────────────────────────────────────────────

export type PlanningDeadlineSource =
  | 'course_application'
  | 'university'
  | 'user'
  | 'other';

/**
 * Whether this deadline is the primary application-level value or a fallback.
 *
 * - primary:  the value stored in the application's own deadline field
 *             (course_applications.deadline). Takes precedence over fallbacks.
 * - fallback: a secondary source used only when no primary value exists
 *             (e.g. university-level default deadline).
 *
 * NOTE: `primary` does NOT imply the deadline is officially authoritative truth.
 * It means it is the highest-precedence value available in storage.
 * Official authority must be independently verified.
 */
export type DeadlinePrecedence = 'primary' | 'fallback';

/**
 * How the deadline value was established — its epistemic authority.
 *
 * - official:  sourced from a verified official university/programme page
 * - user_set:  explicitly entered or confirmed by the student
 * - derived:   inferred from context (e.g. extracted from course text)
 * - unknown:   authority cannot be determined
 */
export type DeadlineAuthority = 'official' | 'user_set' | 'derived' | 'unknown';

/**
 * A normalized deadline candidate from one upstream source.
 *
 * This represents OBSERVED source facts — not the result of source reconciliation.
 * `precedence` (which candidate wins) is determined by the compiler, not stored here.
 *
 * Gate 2 populates `deadlineCandidates` in PlanningContextSources.
 * The compiler resolves precedence and produces PlanningDeadline[].
 */
export type DeadlineCandidate = {
  date: string;
  kind: string;
  source: PlanningDeadlineSource;
  authority: DeadlineAuthority;
  confidence: number | null;
  sourceReference: string | null;
};

/**
 * A planning-relevant deadline in the compiled PlanningContext.
 *
 * Extends DeadlineCandidate with `precedence`, which is the compiler's
 * reconciliation decision over all candidates for the same deadline kind.
 *
 * Core 3 owns scheduling — do not put derived task deadlines here.
 */
export type PlanningDeadline = DeadlineCandidate & {
  /**
   * Whether this deadline won as the primary application-level value
   * or was retained as a fallback. Determined by the compiler.
   * Does NOT imply official authority — see `authority` for that.
   */
  precedence: DeadlinePrecedence;
};

// ─── User constraints ─────────────────────────────────────────────────────────

/**
 * An explicit planning constraint stored by the user.
 *
 * IMPORTANT: Only include constraints actually stored in the database.
 * Do NOT infer availability, workload capacity, or personal circumstances
 * from profile fields.
 */
export type UserConstraintKind =
  | 'budget'
  | 'target_intake'
  | 'study_mode'
  | 'funding_source'
  | 'other';

export type UserConstraint = {
  kind: UserConstraintKind;
  /** Human-readable value of the constraint as stored. */
  value: string;
};

// ─── Strategy ─────────────────────────────────────────────────────────────────

/**
 * The planning-relevant view of an F7 StrategyRecommendation.
 *
 * IMPORTANT:
 *   - strategy may be null if no F7 report exists. There is NO F5 fallback.
 *   - F5 ProgrammeFit fills identifiedGaps and interventionCandidates only.
 *   - Do NOT synthesize a fake strategy from F5 data.
 *   - opportunities contains only ai_proposed items — these are potential
 *     opportunities, NOT current gaps.
 */
/**
 * A PortfolioOpportunity narrowed to source === 'ai_proposed'.
 *
 * PortfolioOpportunity is a single object type (not a discriminated union),
 * so Extract<PortfolioOpportunity, { source: 'ai_proposed' }> resolves to
 * never. This type intersection is the correct narrowing approach.
 */
export type AiProposedPortfolioOpportunity = Omit<PortfolioOpportunity, 'source'> & {
  source: 'ai_proposed';
};

export type PlanningStrategy = {
  /** F7.1 — the chosen strategic direction name. */
  direction: string;
  /** F7.1 — explanation of why this direction was chosen. */
  rationale: string;
  /** F7.3 — expected applicant positioning after acting on this strategy. */
  targetPositioning: string;
  /** F7.6 — ordered list of strategic actions to prioritize. */
  priorities: StrategyRoadmap['prioritize'];
  /** F7.6 — list of things to avoid. */
  avoid: StrategyRoadmap['avoid'];
  /** F7.6 — expected competitive position after executing the strategy. */
  expectedPositioning: StrategyRoadmap['expectedPositioning'];
  /** F7.5 — differentiation insight and proposal. */
  differentiation: {
    insight: string;
    proposal: string;
  };
  /**
   * F7.4 — AI-proposed portfolio opportunities only.
   * `existing_activity` items are excluded; those are already in the student's
   * profile and do not represent new suggestions.
   */
  aiProposedOpportunities: AiProposedPortfolioOpportunity[];
  // Provenance lives in PlanningProvenance.strategy — not embedded here.
};

// ─── Provenance block ─────────────────────────────────────────────────────────

export type PlanningProvenance = {
  /** Provenance of the Personal Report (student_personal_report_versions). */
  personalReport: SourceProvenance | null;
  /** Provenance of the Programme Fit analysis (application_match_analyses). */
  programmeFit: SourceProvenance | null;
  /** Provenance of the F7 Strategy row (application_strategy_recommendations). */
  strategy: SourceProvenance | null;
  /**
   * Staleness of each upstream source.
   * Only emit `current` or `stale` when deterministic evidence supports it.
   * Default: `unknown`.
   */
  staleness: {
    personalReport: StalenessState;
    programmeFit: StalenessState;
    strategy: StalenessState;
  };
  /** Diagnostics for every data source that was attempted. */
  sourceDiagnostics: SourceDiagnostic[];
  /**
   * A deterministic SHA-256 hash of planning-relevant state.
   * Changes when any planning-relevant input changes (requirements, tasks,
   * deadlines, strategy, evidence state, recommendation statuses).
   * Does NOT change when only presentation or volatile/random fields change.
   * Core 4 uses this to detect when replanning is needed.
   */
  contextHash: string;
};

// ─── Planning context ─────────────────────────────────────────────────────────

/**
 * The compiled output of Core 1 — a normalized, validated snapshot of all
 * facts, context, and strategy needed for Core 2 decisions and Core 3
 * hierarchical planning.
 *
 * IMPORTANT: PlanningContext contains only facts and context. It does not:
 *   - Generate phases, steps, or micro-steps (Core 3)
 *   - Schedule execution tasks or derive student task deadlines (Core 4)
 *   - Decide how to act on gaps (Core 2)
 *   - Modify the Planner UI
 */
export type PlanningContext = {
  // ── Who is this applicant? ───────────────────────────────────────────────
  /** Full ProfileEvaluation from the Personal Report. Null if not yet generated. */
  applicantState: ProfileEvaluation | null;

  // ── Which programme? ─────────────────────────────────────────────────────
  programme: PlanningProgrammeSummary;

  // ── Requirements ─────────────────────────────────────────────────────────
  /** All `application_requirements` rows for this application. */
  programmeRequirements: ApplicationRequirement[];
  /** Requirements where studentStatus is not_met or partially_met. */
  requirementGaps: RequirementGap[];
  /** Requirements where studentStatus is needs_review or unknown. */
  unresolvedRequirements: UnresolvedRequirement[];

  // ── Hard constraints ─────────────────────────────────────────────────────
  /**
   * Grounded constraints planning must respect (deadlines, mandatory gates).
   * NOT strategic recommendations.
   */
  hardConstraints: HardConstraint[];

  // ── Strategy (F7) ────────────────────────────────────────────────────────
  /**
   * Null when no F7 StrategyRecommendation exists.
   * NEVER synthesized from F5. F5 data belongs in identifiedGaps and
   * interventionCandidates only.
   */
  strategy: PlanningStrategy | null;

  // ── Gaps & opportunities ─────────────────────────────────────────────────
  /** Weaknesses / mismatches sourced from F5 dimensions/limitations and F4. */
  identifiedGaps: PlanningGap[];
  /**
   * Possible future actions from F5 ImprovementActions and F7 roadmap
   * priorities. Core 2 converts these into Steps.
   */
  interventionCandidates: InterventionCandidate[];

  // ── Evidence ─────────────────────────────────────────────────────────────
  /** All existing F3 evidence, split by verification tier. */
  existingEvidence: ExistingEvidenceByTier;
  /**
   * Subset of stated evidence that needs stronger external proof.
   * Items here are also present in existingEvidence.stated.
   */
  evidenceNeedsProof: EvidenceNeedsProof;
  /**
   * Genuinely absent artifacts — only populated when absence can be
   * deterministically established. Default is empty ([]).
   */
  missingEvidence: MissingEvidenceItem[];
  /**
   * Assessment signals absent from existing items or frameworks.
   * NOT the same as missing evidence artifacts.
   */
  missingInputSignals: MissingInputSignal[];

  // ── Deadlines ────────────────────────────────────────────────────────────
  deadlines: PlanningDeadline[];

  // ── User constraints ─────────────────────────────────────────────────────
  /** Only constraints explicitly stored by the user. Never inferred. */
  userConstraints: UserConstraint[];

  // ── Current plan execution state ─────────────────────────────────────────
  currentPlanState: {
    /** application_stages rows — conceptually ≈ Phase in the future hierarchy. */
    stages: ApplicationStage[];
    /** application_tasks rows — conceptually ≈ Step in the future hierarchy. */
    tasks: ApplicationTask[];
    /**
     * application_recommendations rows via the richer AI Strategy Dashboard
     * Recommendation model (not the older ApplicationRecommendation type).
     * Classified LEGACY_COMPATIBILITY — not ground-truth profile/programme facts.
     */
    legacyRecommendations: Recommendation[];
  };

  // ── Provenance ───────────────────────────────────────────────────────────
  provenance: PlanningProvenance;
};

// ─── Sourced inputs for the fetcher (Gate 2 contract) ────────────────────────

/**
 * The normalized, validated input contract for Core 1's compiler.
 *
 * Gate 2 (fetchPlanningContextSources) is responsible for:
 *   1. Querying all upstream sources from Supabase
 *   2. Parsing / validating raw DB rows into typed domain objects
 *   3. Recording source diagnostics for failures
 *   4. Populating this struct
 *
 * The compiler (compilePlanningContext) must remain pure — it receives this
 * struct and produces PlanningContext without performing any I/O.
 *
 * IMPORTANT: This struct contains validated domain types, NOT raw DB rows.
 * Gate 2 performs all snake_case → camelCase and DB-to-domain conversions.
 */
// ─── Evidence inventory ───────────────────────────────────────────────────────

/**
 * A normalized view of one uploaded document, for planning-relevant
 * absence detection.
 *
 * Gate 2 populates this from uploaded_documents rows.
 * The compiler uses this inventory to reason about genuinely absent artifacts
 * when evaluating missingEvidence.
 *
 * Only planning-relevant fields are included — no parsed text, no storage key.
 */
export type PlanningEvidenceDocument = {
  id: string;
  /** Document type tag (e.g. 'cv', 'transcript', 'essay', 'certificate'). */
  type: string | null;
  fileName: string | null;
  /** False if the document has been soft-deleted or superseded. */
  active: boolean;
};

export type PlanningEvidenceInventory = {
  documents: PlanningEvidenceDocument[];
};

// ─── Sourced inputs for the fetcher (Gate 2 contract) ────────────────────────

/**
 * The normalized, validated input contract for Core 1's compiler.
 *
 * Gate 2 (fetchPlanningContextSources) is responsible for:
 *   1. Querying all upstream sources from Supabase
 *   2. Parsing / validating raw DB rows into typed domain objects
 *   3. Recording source diagnostics for failures
 *   4. Populating this struct
 *
 * The compiler (compilePlanningContext) must remain pure — it receives this
 * struct and produces PlanningContext without performing any I/O.
 *
 * IMPORTANT: This struct contains validated domain types, NOT raw DB rows.
 * Gate 2 performs all snake_case → camelCase and DB-to-domain conversions.
 */
export type PlanningContextSources = {
  applicationId: string;
  userId: string;

  // ── Application & programme facts ────────────────────────────────────────
  /**
   * The planning-scoped programme summary, already normalized from the
   * course_applications + courses + universities join.
   */
  programme: PlanningProgrammeSummary;
  /**
   * All application_requirements rows, already mapped to ApplicationRequirement.
   * Empty array if none exist (not null — absence of requirements is distinct
   * from a query failure, which is represented in diagnostics).
   */
  requirements: ApplicationRequirement[];
  stages: ApplicationStage[];
  tasks: ApplicationTask[];
  recommendations: Recommendation[];

  // ── Deadline candidates ──────────────────────────────────────────────────
  /**
   * All deadline values retrieved from upstream sources, normalized and typed.
   * Gate 2 populates one entry per source (course_application, university, etc.).
   * The compiler resolves precedence and produces PlanningContext.deadlines.
   *
   * Do NOT put the final reconciled PlanningDeadline[] here — that is the
   * compiler's output, not its input.
   */
  deadlineCandidates: DeadlineCandidate[];

  // ── Evidence inventory ───────────────────────────────────────────────────
  /**
   * The current uploaded document inventory for this user.
   * Used by the compiler to reason about genuinely absent evidence artifacts.
   * Gate 2 populates this from uploaded_documents.
   */
  evidenceInventory: PlanningEvidenceInventory;

  // ── Upstream AI analysis results ─────────────────────────────────────────
  /**
   * The most recent validated ProfileEvaluation from
   * student_personal_report_versions.structured_evaluation,
   * plus its source provenance metadata.
   * Null if no report exists or the stored JSONB failed validation.
   */
  profileEvaluation: {
    data: ProfileEvaluation;
    provenance: SourceProvenance;
  } | null;

  /**
   * The most recent completed application_match_analyses row,
   * validated via programmeFitSchema, plus provenance.
   * improvementActions contains the ImprovementAction[] from the
   * improvement_actions JSONB column, pre-validated.
   * Null if none exists or parsing fails.
   */
  programmeFit: {
    data: ProgrammeFit;
    improvementActions: ImprovementAction[];
    provenance: SourceProvenance;
  } | null;

  /**
   * The most recent application_strategy_recommendations row,
   * validated via strategyRecommendationSchema, plus provenance.
   * Null if none exists or parsing fails.
   */
  strategyRecommendation: {
    data: StrategyRecommendation;
    provenance: SourceProvenance;
  } | null;

  // ── User constraints ─────────────────────────────────────────────────────
  /**
   * Explicit planning constraints extracted from the student's profile.
   * Only fields actually stored in student_profiles are included.
   * Empty array if the profile has no planning-relevant constraints.
   */
  userConstraints: UserConstraint[];

  // ── Diagnostics ──────────────────────────────────────────────────────────
  /**
   * One diagnostic entry per data source that was attempted.
   * Gate 2 populates this for every source, regardless of success or failure.
   * The compiler uses this to record provenance.sourceDiagnostics.
   */
  diagnostics: SourceDiagnostic[];
};
