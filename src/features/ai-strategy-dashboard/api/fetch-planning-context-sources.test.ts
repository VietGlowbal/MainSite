/**
 * Gate 2 tests — fetchPlanningContextSources source adapter behavior.
 *
 * These tests exercise what Gate 2 is responsible for:
 *   - source fetching and normalization
 *   - diagnostic distinction (missing vs unavailable vs invalid vs present)
 *   - fatal vs non-fatal source failures
 *   - correct field mapping (pillar, estimatedUplift, stageId, etc.)
 *   - runtime validation boundaries (ProfileEvaluation, ProgrammeFit, ImprovementAction, F7)
 *   - user constraint and evidence inventory normalization
 *   - deadline candidate collection WITHOUT precedence
 *
 * They do NOT test compiler behavior (Gate 3).
 */

import { describe, expect, it } from 'vitest';
import {
  fetchPlanningContextSources,
  ApplicationNotFoundError,
} from './fetch-planning-context-sources';

// ─── Minimal Supabase fake ────────────────────────────────────────────────────
//
// The builder is fully chainable; any unknown method returns itself.
// `.maybeSingle()` and `.single()` resolve via `then`.
// The `resolve` function is the only place that returns actual data.
//
// This mirrors the pattern already in use in generate-recommendations.test.ts.

type MockTable = Record<string, unknown>;

function first<T>(items: readonly T[]): T {
  const item = items[0];
  if (!item) throw new Error('Expected test fixture item');
  return item;
}

function buildSupabase(db: {
  course_applications?: MockTable[] | null;
  course_applications_error?: { code?: string; message: string } | null;
  universities?: MockTable[] | null;
  universities_error?: { code?: string; message: string } | null;
  application_requirements?: MockTable[] | null;
  application_requirements_error?: { code?: string; message: string } | null;
  application_stages?: MockTable[] | null;
  application_stages_error?: { code?: string; message: string } | null;
  application_tasks?: MockTable[] | null;
  application_tasks_error?: { code?: string; message: string } | null;
  application_recommendations?: MockTable[] | null;
  application_recommendations_error?: { code?: string; message: string } | null;
  student_personal_report_versions?: MockTable[] | null;
  student_personal_report_versions_error?: { code?: string; message: string } | null;
  application_match_analyses?: MockTable[] | null;
  application_match_analyses_error?: { code?: string; message: string } | null;
  application_strategy_recommendations?: MockTable[] | null;
  application_strategy_recommendations_error?: { code?: string; message: string } | null;
  application_plans?: MockTable[] | null;
  application_plan_phases?: MockTable[] | null;
  application_plan_steps?: MockTable[] | null;
  application_plan_micro_steps?: MockTable[] | null;
  student_profiles?: MockTable[] | null;
  student_profiles_error?: { code?: string; message: string } | null;
  uploaded_documents?: MockTable[] | null;
  uploaded_documents_error?: { code?: string; message: string } | null;
}) {
  function makeBuilder(table: string) {
    const builder: Record<string, unknown> = {};

    const resolve = () => {
      const errKey = `${table}_error` as keyof typeof db;
      const dataKey = table as keyof typeof db;
      const err = db[errKey] as { code?: string; message: string } | null | undefined;
      if (err) return { data: null, error: err };
      const rows = db[dataKey] as MockTable[] | null | undefined;
      // Return null data for empty/not-provided tables (maybeSingle semantics
      // for tables with no rows)
      if (rows === undefined || rows === null) return { data: null, error: null };
      return { data: rows, error: null };
    };

    const maybeSingle = async () => {
      const { data, error } = resolve();
      if (error) return { data: null, error };
      const rows = data as MockTable[] | null;
      return { data: rows?.[0] ?? null, error: null };
    };

    // Every method returns builder for chaining; terminations resolve.
    const chain = () => builder;
    builder.select = chain;
    builder.eq = chain;
    builder.not = chain;
    builder.is = chain;
    builder.in = chain;
    builder.order = chain;
    builder.limit = chain;
    builder.neq = chain;
    builder.maybeSingle = maybeSingle;
    builder.single = maybeSingle; // alias
    // `then` makes the builder itself awaitable (no terminal method needed).
    builder.then = (onFulfilled: (v: unknown) => unknown) => {
      const result = resolve();
      return Promise.resolve(result).then(onFulfilled);
    };

    return builder;
  }

  return { from: (table: string) => makeBuilder(table) };
}

// ─── Fixture data ─────────────────────────────────────────────────────────────

const VALID_APP: MockTable = {
  id: 'app-1',
  user_id: 'user-1',
  course_id: 'course-1',
  university_id: 99,
  university_name: 'Oxford',
  course_name: 'Computer Science',
  course_url: 'https://oxford.ac.uk/cs',
  degree_level: 'undergraduate',
  subject: 'CS',
  study_mode: 'full_time',
  intake: 'September 2025',
  country: 'UK',
  application_method: 'UCAS',
  application_code: 'G400',
  status: 'preparing',
  deadline: '2025-01-15',
  deadline_source: 'user_set',
  deadline_confidence: 0.9,
};

const VALID_UNIVERSITY: MockTable = {
  name: 'University of Oxford',
  application_deadline: 'October 15',
};

const VALID_REQUIREMENT: MockTable = {
  id: 'req-1',
  application_id: 'app-1',
  course_id: 'course-1',
  requirement_type: 'academic',
  title: 'A-levels',
  requirement_text: 'AAA at A-level',
  is_mandatory: true,
  student_status: 'not_met',
  source_url: null,
  source_id: null,
  confidence: 0.95,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const VALID_STAGE: MockTable = {
  id: 'stage-1',
  application_id: 'app-1',
  name: 'Research',
  slug: 'research',
  description: 'Research phase',
  order_num: 1,
  status: 'in_progress',
  is_required: true,
  icon: null,
  why_this_matters: null,
  ai_generated: false,
  confidence: 1,
  started_at: null,
  completed_at: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const VALID_TASK: MockTable = {
  id: 'task-1',
  application_id: 'app-1',
  stage_id: 'stage-1',
  title: 'Improve essay opening',
  description: 'Sharpen hook',
  task_type: 'improvement',
  status: 'not_started',
  priority: 'high',
  due_date: null,
  action_label: null,
  action_type: null,
  action_target: null,
  source_url: null,
  confidence: 0.8,
  sort_order: 1,
  completed_at: null,
  created_by: 'ai',
  pillar: 'essays',
  estimated_uplift: 7,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const VALID_REC: MockTable = {
  id: 'rec-1',
  application_id: 'app-1',
  category: 'essays',
  pillar: 'essays',
  title: 'Sharpen opening',
  body: null,
  priority: 'high',
  status: 'not_started',
  estimated_impact: 7,
  estimated_effort: null,
  deadline: null,
  evidence_required: false,
  related_requirement: null,
  action_label: null,
  action_type: null,
  action_target: null,
  content_schema: null,
  content_value: null,
  submit_checklist: [],
  tips: [],
  suggested_questions: [],
  confidence: 0.8,
  is_dismissed: false,
  source_analysis_id: 'match-1',
  archived_at: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const VALID_PROFILE_EVALUATION = {
  subjectId: 'user-1',
  vagueness: { score: 80, flags: [] },
  reflection: { items: [] },
  competencies: { items: [] },
  evidence: { items: [], byTier: {} },
  narrativeIdentity: {
    base: {},
    readiness: {},
    identity: {},
    motivation: {},
    pattern: {},
    positioning: {},
  },
  programmeFit: {},
  confidence: { level: 'high', score: 85, factors: [] },
  generatedAt: '2025-01-01T00:00:00Z',
};

const VALID_REPORT_ROW: MockTable = {
  id: 'report-1',
  application_id: 'app-1',
  confirmed_snapshot_id: 'snapshot-1',
  source_analysis_version_id: 'analysis-1',
  report_contract_version: 'v3',
  cache_key: 'cache-1',
  report_v2: {
    coreIdentity: 'x',
    drivingForce: 'x',
    signaturePattern: 'x',
    emergingThemes: [],
    personalPositioning: 'x',
    proofOfMe: [],
    overallEvidenceConfidence: 80,
  },
  structured_evaluation: VALID_PROFILE_EVALUATION,
  evaluation_engine_version: 'v2',
  input_hash: 'hash-abc',
  prompt_version: 'personal-report-v2-vi',
  model_name: 'gpt-4o',
  trigger: 'manual',
  generated_at: '2025-01-01T00:00:00Z',
  created_at: '2025-01-01T00:00:00Z',
};

const VALID_IMPROVEMENT_ACTION: MockTable = {
  id: 'ia-1',
  pillar: 'essays',
  label: 'Sharpen opening',
  detail: 'Your opening is weak',
  estimatedUplift: 7,
  actionType: 'none',
  contentBlock: null,
  submitChecklist: ['Item 1'],
  tips: ['Tip 1'],
  suggestedQuestions: ['Q1'],
};

const VALID_MATCH_ROW: MockTable = {
  id: 'match-1',
  fit_classification: 'reach',
  fit_confidence: 60,
  fit_limitations: [],
  fit_eligibility: {
    requiredSubjects: 'unknown',
    minimumQualification: 'unknown',
    languageRequirement: 'unknown',
    citizenshipRequirement: 'unknown',
    deadline: 'unknown',
  },
  fit_dimensions: {
    academicCompetitiveness: { status: 'assessed', score: 2, summary: 'x', strengths: [], gaps: [], evidence: [] },
    personaAlignment: { status: 'assessed', score: 3, summary: 'x', strengths: [], gaps: [], evidence: [] },
    financialFeasibility: { status: 'assessed', score: 3, summary: 'x', strengths: [], gaps: [], evidence: [] },
    careerDirection: { status: 'assessed', score: 3, summary: 'x', strengths: [], gaps: [], evidence: [] },
    applicationReadiness: { status: 'assessed', score: 3, summary: 'x', strengths: [], gaps: [], evidence: [] },
  },
  input_hash: 'match-hash',
  prompt_version: 'match-insights-v2-vi',
  model_name: 'gpt-4o',
  improvement_actions: [VALID_IMPROVEMENT_ACTION],
  created_at: '2025-01-01T00:00:00Z',
};

const VALID_STRATEGY_ROW: MockTable = {
  id: 'strat-1',
  application_id: 'app-1',
  source_analysis_id: 'analysis-1',
  source_match_analysis_id: 'match-1',
  direction_options: [
    { name: 'Focus on research', identityFit: 8, evidenceStrength: 7, consistency: 8, differentiation: 7, futureAlignment: 8, scalability: 7, overall: 7.5 },
    { name: 'Industry track', identityFit: 7, evidenceStrength: 8, consistency: 7, differentiation: 8, futureAlignment: 7, scalability: 8, overall: 7.5 },
  ],
  chosen_direction: 'Focus on research',
  chosen_direction_why: 'Best aligns with identity',
  narrative: 'A strong candidate with research orientation.',
  positioning_before: 'Average candidate',
  positioning_after: 'Research-focused candidate',
  positioning_rationale: 'Research track suits identity',
  portfolio_evaluations: [
    { name: 'Research internship', source: 'existing_activity', strategicContribution: 'Shows research fit', recommendation: 'highly_recommended' },
    { name: 'ML project', source: 'ai_proposed', strategicContribution: 'Demonstrates skills', recommendation: 'recommended' },
  ],
  differentiation_insight: 'Cross-disciplinary background',
  differentiation_proposal: 'Lead with research narrative',
  roadmap: {
    chosenStrategy: 'Research focus',
    why: 'Identity fit',
    prioritize: ['Strengthen research narrative'],
    avoid: ['Generic statements'],
    expectedPositioning: 'Top quartile applicant',
    longTermNarrative: 'Research-driven career',
  },
  model_name: 'gpt-4o',
  prompt_version: 'strategy-recommendation-f7-v1',
  pdf_storage_path: null,
  created_at: '2025-01-02T00:00:00Z',
};

const VALID_F8_STRATEGY_ROW: MockTable = {
  id: 'strategy-f8-1',
  application_id: 'app-1',
  source_analysis_id: null,
  source_match_analysis_id: 'match-1',
  input_hash: 'strategy-f8-hash',
  model_name: 'gpt-4o',
  prompt_version: 'strategy-report-f8-v3',
  created_at: '2025-01-03T00:00:00Z',
  report_v2: {
    strategicOverview: {
      currentPosition: { profile: 'Current profile', keyStrength: 'Research evidence', biggestChallenge: 'Language evidence' },
      strategicGoal: { primaryObjective: 'Strengthen application', positioning: 'Research-focused applicant' },
      topPriorities: ['Strengthen language evidence'],
      expectedOutcome: 'A clearer application narrative',
    },
    priorityTable: [
      { key: 'language_evidence', title: 'Language evidence', currentSituation: 'No test result', whyItMatters: 'Entry condition', recommendedActions: ['Book test'], expectedImpact: 'Eligibility evidence', level: 'critical' },
      { key: 'research_narrative', title: 'Research narrative', currentSituation: 'Evidence is scattered', whyItMatters: 'Differentiation', recommendedActions: ['Organize examples'], expectedImpact: 'Clearer story', level: 'high' },
    ],
    profileDevelopmentStrategy: {
      academic: { currentStatus: 'Good foundation', gap: 'Language evidence', strategicFocus: 'Book test', expectedOutcome: 'Verified result' },
      experience: { currentStatus: 'Research activity', gap: 'Evidence structure', strategicFocus: 'Document impact', expectedOutcome: 'Clear examples' },
      differentiation: { currentAdvantage: 'Research interest', uniqueness: 'Cross-disciplinary view', amplifyHow: 'Use examples', desiredPerception: 'Focused applicant' },
    },
    narrativeStrategy: {
      coreNarrative: { centralStory: 'Research-led development', supportingEvidence: ['Project work'], admissionsValue: 'Clear motivation' },
      themes: [{ key: 'research_growth', title: 'Research growth', rationale: 'Matches the programme', evidence: ['Project work'] }],
      consistencyCheck: { supports: 'Research evidence', feelsDisconnected: 'Unrelated claims', emphasise: 'Research growth', supportingRole: 'Activities support the story' },
    },
    executionRoadmap: {
      phases: [{
        phaseKey: 'strengthen_foundation',
        name: 'Strengthen foundation',
        objective: 'Establish required evidence',
        keyActions: ['Book test'],
        deliverables: [{ key: 'ielts_booking', label: 'IELTS booking confirmation' }],
        successCriteria: ['A test is booked'],
        timeline: 'Before application',
      }],
    },
  },
};

const VALID_V3_STRATEGY_ROW: MockTable = {
  id: 'strategy-v3-1',
  application_id: 'app-1',
  source_analysis_id: 'analysis-1',
  source_match_analysis_id: 'match-1',
  input_hash: 'strategy-v3-hash',
  model_name: 'gpt-5.6-luna',
      prompt_version: 'strategy-report-synthesis-v3.1.0-structured-output',
  created_at: '2025-01-04T00:00:00Z',
  report_v2: {
    contractVersion: 'strategy-report-v3',
    generatedAt: '2025-01-04T00:00:00Z',
    strategicOverview: {
      currentPosition: {
        summary: 'Current profile.',
        profileStrength: { statement: 'Strength.', evidenceIds: [], metricIds: [] },
        keyChallenge: { statement: 'Challenge.', gapIds: [], requirementIds: [] },
        unclearArea: null,
        differentiatedPotential: null,
      },
      strategicOpportunity: { statement: 'Opportunity.', priorityKeys: [] },
      strategicGoal: { directionOfImprovement: 'Improve.', communicationGoal: 'Communicate.' },
      topPriorities: [],
      expectedOutcome: 'A clearer application.',
    },
    profileDevelopmentStrategy: {
      areas: ['academic', 'experience', 'differentiation', 'evidence'].map((category) => ({
        key: category,
        category,
        label: category,
        status: 'maintain',
        diagnosis: 'Stable.',
        whyItMatters: 'It matters.',
        suggestedDirection: 'Maintain it.',
        evidenceIds: [],
        metricIds: [],
        requirementIds: [],
        targetSourceRefs: [],
      })),
      activityAnalyses: [],
    },
    narrativeStrategy: {
      coreNarrativeDirection: {
        originTrigger: null,
        recurringMotivation: null,
        actions: [],
        capabilitiesDeveloped: [],
        emergingDirection: null,
        insight: 'No pattern established.',
        evidenceIds: [],
      },
      supportingThemes: [],
      narrativeTension: null,
      narrativeOptions: [],
    },
    strategicRoadmap: ['strengthen_foundation', 'build_competitive_advantages', 'craft_application', 'finalise_optimise'].map((phaseKey) => ({
      phaseKey,
      name: phaseKey,
      goal: 'Continue.',
      keyActions: [],
      deliverables: [],
      successCriteria: [],
      estimatedTimeline: 'As needed.',
      linkedPriorityKeys: [],
    })),
    evidenceIndex: [],
    targetSourceIndex: [],
    metadata: {
      strategyEngineVersion: 'strategy-v3.0.0',
      reportContractVersion: 'strategy-report-v3',
      profileDiagnosisPromptVersion: 'strategy-profile-diagnosis-v3.0.0',
      activityAnalysisPromptVersion: 'strategy-activity-analysis-v3.2.0',
      synthesisPromptVersion: 'strategy-report-synthesis-v3.1.0-structured-output',
      priorityFormulaVersion: 'impact-relevance-evidence-gap-feasibility-urgency-v1',
      personalReportVersionId: 'report-1',
      personalReportInputHash: 'hash-abc',
      sourceAnalysisVersionId: 'analysis-1',
      confirmedSnapshotId: 'snapshot-1',
      matchingReportId: 'match-1',
      matchingInputHash: 'match-hash',
      matchingContractVersion: 'matching-report-v3',
      matchingEngineVersion: 'matching-v3.1.0',
      targetProfileVersionId: null,
      selectedScholarshipVersionId: null,
      applicationDeadlineEvaluatedAt: '2025-01-04T00:00:00Z',
      model: 'gpt-5.6-luna',
      aiCallCount: 2,
    },
  },
};

const VALID_PROFILE: MockTable = {
  budget_range: '20000-30000',
  tuition_budget_usd: null,
  target_intake: 'September 2025',
  study_mode_preference: 'full_time',
  funding_source: 'self_funded',
};

const VALID_DOC: MockTable = {
  id: 'doc-1',
  type: 'cv',
  file_name: 'my_cv.pdf',
  is_active: true,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function allSources(overrides: Parameters<typeof buildSupabase>[0] = {}) {
  return buildSupabase({
    course_applications: [VALID_APP],
    universities: [VALID_UNIVERSITY],
    application_requirements: [VALID_REQUIREMENT],
    application_stages: [VALID_STAGE],
    application_tasks: [VALID_TASK],
    application_recommendations: [VALID_REC],
    student_personal_report_versions: [VALID_REPORT_ROW],
    application_match_analyses: [VALID_MATCH_ROW],
    application_strategy_recommendations: [VALID_STRATEGY_ROW],
    student_profiles: [VALID_PROFILE],
    uploaded_documents: [VALID_DOC],
    ...overrides,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('fetchPlanningContextSources', () => {
  it('maps only non-empty declared long-text availability answers from canonical planner inputs', async () => {
    const supabase = allSources({
      application_plans: [{ id: 'plan-1' }],
      application_plan_phases: [{ id: 'phase-1' }],
      application_plan_steps: [{ id: 'step-1' }],
      application_plan_micro_steps: [
        {
          id: 'availability-micro',
          content_schema: { type: 'long_text', prompt: 'When can you work?', semanticKey: 'planner.availability' },
          content_value: { type: 'long_text', text: 'Weekday evenings' },
        },
        {
          id: 'empty-capacity-micro',
          content_schema: { type: 'long_text', prompt: 'How much time?', semanticKey: 'planner.time_capacity' },
          content_value: { type: 'long_text', text: '   ' },
        },
        {
          id: 'undeclared-micro',
          content_schema: { type: 'long_text', prompt: 'Other', semanticKey: 'planner.other' },
          content_value: { type: 'long_text', text: 'Ignore this' },
        },
      ],
    });

    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.plannerInputs).toEqual([{
      semanticKey: 'planner.availability',
      value: 'Weekday evenings',
      microStepId: 'availability-micro',
      provenance: 'user_provided',
    }]);
    expect(result.diagnostics.find((diagnostic) => diagnostic.source === 'canonical_planner_inputs')).toMatchObject({ status: 'present' });
  });

  // ── 1. All optional sources absent ──────────────────────────────────────────
  it('returns valid PlanningContextSources with nulls/empty arrays when all optional sources are absent', async () => {
    const supabase = buildSupabase({ course_applications: [VALID_APP] });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.applicationId).toBe('app-1');
    expect(result.userId).toBe('user-1');
    expect(result.requirements).toEqual([]);
    expect(result.stages).toEqual([]);
    expect(result.tasks).toEqual([]);
    expect(result.recommendations).toEqual([]);
    expect(result.profileEvaluation).toBeNull();
    expect(result.programmeFit).toBeNull();
    expect(result.strategyRecommendation).toBeNull();
    expect(result.userConstraints).toEqual([]);
    expect(result.evidenceInventory.documents).toEqual([]);
    expect(result.deadlineCandidates).toHaveLength(1); // app-level deadline

    // Diagnostics distinguish missing sources
    const statuses = Object.fromEntries(result.diagnostics.map((d) => [d.source, d.status]));
    expect(statuses['application_requirements']).toBe('missing');
    expect(statuses['application_stages']).toBe('missing');
    expect(statuses['application_tasks']).toBe('missing');
    expect(statuses['application_recommendations']).toBe('missing');
    expect(statuses['student_personal_report_versions']).toBe('missing');
    expect(statuses['application_match_analyses']).toBe('missing');
    expect(statuses['application_strategy_recommendations']).toBe('missing');
    expect(statuses['student_profiles']).toBe('missing');
    expect(statuses['uploaded_documents']).toBe('missing');
  });

  // ── 2. Application missing / unauthorized ────────────────────────────────────
  it('throws ApplicationNotFoundError when application is missing', async () => {
    const supabase = buildSupabase({ course_applications: null });
    await expect(
      fetchPlanningContextSources(supabase as never, 'app-missing', 'user-1'),
    ).rejects.toBeInstanceOf(ApplicationNotFoundError);
  });

  it('throws ApplicationNotFoundError when application query errors', async () => {
    const supabase = buildSupabase({
      course_applications_error: { message: 'unauthorized' },
    });
    await expect(
      fetchPlanningContextSources(supabase as never, 'app-1', 'user-1'),
    ).rejects.toBeInstanceOf(ApplicationNotFoundError);
  });

  // ── 3. Requirements query failure → unavailable ──────────────────────────────
  it('produces unavailable diagnostic (not missing) for requirements query failure', async () => {
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      application_requirements_error: { message: 'boom' },
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.requirements).toEqual([]);
    const req = result.diagnostics.find((d) => d.source === 'application_requirements');
    expect(req?.status).toBe('unavailable');
  });

  // ── 4. Requirements successful empty → missing ───────────────────────────────
  it('produces missing diagnostic for empty requirements result', async () => {
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      application_requirements: [],
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.requirements).toEqual([]);
    const req = result.diagnostics.find((d) => d.source === 'application_requirements');
    expect(req?.status).toBe('missing');
  });

  // ── 5. Valid requirements → correct ApplicationRequirement mapping ────────────
  it('maps requirement rows to ApplicationRequirement correctly', async () => {
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      application_requirements: [VALID_REQUIREMENT],
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.requirements).toHaveLength(1);
    const req = first(result.requirements);
    expect(req.id).toBe('req-1');
    expect(req.applicationId).toBe('app-1');
    expect(req.requirementType).toBe('academic');
    expect(req.isMandatory).toBe(true);
    expect(req.studentStatus).toBe('not_met');
    expect(req.requirementText).toBe('AAA at A-level');
    expect(req.confidence).toBe(0.95);
    const diag = result.diagnostics.find((d) => d.source === 'application_requirements');
    expect(diag?.status).toBe('present');
  });

  // ── 6. Task mapping preserves pillar, estimatedUplift, stageId, status ────────
  it('preserves pillar, estimatedUplift, stageId and status on tasks', async () => {
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      application_tasks: [VALID_TASK],
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.tasks).toHaveLength(1);
    const task = first(result.tasks);
    expect(task.pillar).toBe('essays');
    expect(task.estimatedUplift).toBe(7);
    expect(task.stageId).toBe('stage-1');
    expect(task.status).toBe('not_started');
  });

  // ── 7. Recommendations use richer Recommendation reader ───────────────────────
  it('uses recommendationFromRow preserving planner-specific fields', async () => {
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      application_recommendations: [VALID_REC],
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.recommendations).toHaveLength(1);
    const rec = first(result.recommendations);
    expect(rec.id).toBe('rec-1');
    expect(rec.category).toBe('essays');
    expect(rec.pillar).toBe('essays');
    expect(rec.status).toBe('not_started');
    expect(rec.sourceAnalysisId).toBe('match-1');
    expect(rec.archivedAt).toBeNull();
    // Not the minimal ApplicationRecommendation — must have these fields:
    expect('estimatedImpact' in rec).toBe(true);
    expect('evidenceRequired' in rec).toBe(true);
  });

  // ── 8. Valid ProfileEvaluation → populated with provenance ───────────────────
  it('populates profileEvaluation with data and provenance', async () => {
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      student_personal_report_versions: [VALID_REPORT_ROW],
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.profileEvaluation).not.toBeNull();
    expect(result.profileEvaluation!.data.subjectId).toBe('user-1');
    expect(result.profileEvaluation!.provenance.id).toBe('report-1');
    expect(result.profileEvaluation!.provenance.inputHash).toBe('hash-abc');
    expect(result.profileEvaluation!.provenance.promptVersion).toBe('personal-report-v2-vi');
    expect(result.profileEvaluation!.provenance.sourceAnalysisId).toBeNull();
    expect(result.profileEvaluation!.provenance.sourceMatchAnalysisId).toBeNull();
    const diag = result.diagnostics.find((d) => d.source === 'student_personal_report_versions');
    expect(diag?.status).toBe('present');
  });

  // ── 9. Malformed structured_evaluation → null + invalid ──────────────────────
  it('produces null profileEvaluation and invalid diagnostic for malformed structured_evaluation', async () => {
    const malformedRow: MockTable = {
      ...VALID_REPORT_ROW,
      structured_evaluation: { not_a_profile: true },
    };
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      student_personal_report_versions: [malformedRow],
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.profileEvaluation).toBeNull();
    const diag = result.diagnostics.find((d) => d.source === 'student_personal_report_versions');
    expect(diag?.status).toBe('invalid');
  });

  // ── 10. Valid ProgrammeFit + actual ImprovementAction shape ──────────────────
  it('populates programmeFit with validated data and improvementActions', async () => {
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      application_match_analyses: [VALID_MATCH_ROW],
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.programmeFit).not.toBeNull();
    expect(result.programmeFit!.data.classification).toBeDefined();
    expect(result.programmeFit!.improvementActions).toHaveLength(1);
    const action = first(result.programmeFit!.improvementActions);
    expect(action.id).toBe('ia-1');
    expect(action.pillar).toBe('essays');
    expect(action.label).toBe('Sharpen opening');
    expect(action.estimatedUplift).toBe(7);
    expect(result.programmeFit!.provenance.id).toBe('match-1');
    expect(result.programmeFit!.provenance.inputHash).toBe('match-hash');
    const diag = result.diagnostics.find((d) => d.source === 'application_match_analyses');
    expect(diag?.status).toBe('present');
  });

  // ── 11. Malformed ProgrammeFit → null + invalid ───────────────────────────────
  it('produces null programmeFit and invalid diagnostic for malformed fit schema', async () => {
    const badMatch: MockTable = {
      ...VALID_MATCH_ROW,
      fit_classification: 'INVALID_ENUM_VALUE',
    };
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      application_match_analyses: [badMatch],
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.programmeFit).toBeNull();
    const diag = result.diagnostics.find((d) => d.source === 'application_match_analyses');
    expect(diag?.status).toBe('invalid');
  });

  // ── 12. Malformed ImprovementAction → invalid (no unsafe cast) ───────────────
  it('produces invalid diagnostic for malformed improvement_actions, does not cast', async () => {
    const badMatch: MockTable = {
      ...VALID_MATCH_ROW,
      improvement_actions: [{ title: 'wrong shape', description: 'no pillar field' }],
    };
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      application_match_analyses: [badMatch],
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.programmeFit).toBeNull();
    const diag = result.diagnostics.find((d) => d.source === 'application_match_analyses');
    expect(diag?.status).toBe('invalid');
  });

  it('falls back to the newest valid report when a newer row is malformed', async () => {
    const badMatch: MockTable = {
      ...VALID_MATCH_ROW,
      id: 'match-bad',
      fit_classification: 'INVALID_ENUM_VALUE',
      created_at: '2025-02-01T00:00:00Z',
    };
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      application_match_analyses: [badMatch, VALID_MATCH_ROW],
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.programmeFit?.provenance.id).toBe('match-1');
    expect(result.diagnostics.find((diagnostic) => diagnostic.source === 'application_match_analyses')?.status).toBe('present');
  });

  // ── 13. Valid F7 → strategyRecommendation populated ──────────────────────────
  it('populates strategyRecommendation with provenance including F7 ancestry IDs', async () => {
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      application_strategy_recommendations: [VALID_STRATEGY_ROW],
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.strategyRecommendation).not.toBeNull();
    expect(result.strategyRecommendation!.data.chosenDirection).toBe('Focus on research');
    const prov = result.strategyRecommendation!.provenance;
    expect(prov.id).toBe('strat-1');
    // source_analysis_id → applicant_analyses.id
    expect(prov.sourceAnalysisId).toBe('analysis-1');
    // source_match_analysis_id → application_match_analyses.id
    expect(prov.sourceMatchAnalysisId).toBe('match-1');
    expect(prov.promptVersion).toBe('strategy-recommendation-f7-v1');
    expect(result.strategyRoadmap).toMatchObject({ kind: 'f7' });
    const diag = result.diagnostics.find((d) => d.source === 'application_strategy_recommendations');
    expect(diag?.status).toBe('present');
  });

  it('prefers a current validated F8 report_v2 roadmap over the F7 fallback', async () => {
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      application_strategy_recommendations: [VALID_F8_STRATEGY_ROW],
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.strategyRoadmap).toMatchObject({
      kind: 'f8',
      provenance: { id: 'strategy-f8-1', inputHash: 'strategy-f8-hash' },
      data: { executionRoadmap: { phases: [{ phaseKey: 'strengthen_foundation' }] } },
    });
    expect(result.strategyRecommendation).toBeNull();
  });

  it('selects a validated Strategy V3 roadmap before F8/F7 compatibility fallbacks', async () => {
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      application_strategy_recommendations: [VALID_V3_STRATEGY_ROW],
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.strategyRoadmap).toMatchObject({
      kind: 'v3',
      provenance: {
        id: 'strategy-v3-1',
        inputHash: 'strategy-v3-hash',
        engineVersion: 'strategy-v3.0.0',
      },
    });
    expect(result.strategyRecommendation).toBeNull();
  });

  // ── 14. Malformed F7 → null + invalid ─────────────────────────────────────────
  it('produces null strategyRecommendation and invalid diagnostic for malformed F7 row', async () => {
    const badStrat: MockTable = {
      ...VALID_STRATEGY_ROW,
      chosen_direction: 'Does not match any option',
    };
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      application_strategy_recommendations: [badStrat],
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.strategyRecommendation).toBeNull();
    const diag = result.diagnostics.find((d) => d.source === 'application_strategy_recommendations');
    expect(diag?.status).toBe('invalid');
  });

  // ── 15. Explicit stored user constraints ──────────────────────────────────────
  it('normalizes explicit stored user constraints', async () => {
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      student_profiles: [VALID_PROFILE],
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    const kinds = result.userConstraints.map((c) => c.kind);
    expect(kinds).toContain('budget');
    expect(kinds).toContain('target_intake');
    expect(kinds).toContain('study_mode');
    expect(kinds).toContain('funding_source');
    const budget = result.userConstraints.find((c) => c.kind === 'budget');
    expect(budget?.value).toBe('20000-30000');
  });

  // ── 16. No explicit user constraints → [] ─────────────────────────────────────
  it('returns empty userConstraints when profile has no constraint fields', async () => {
    const emptyProfile: MockTable = {
      budget_range: null,
      tuition_budget_usd: null,
      target_intake: null,
      study_mode_preference: null,
      funding_source: null,
    };
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      student_profiles: [emptyProfile],
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');
    expect(result.userConstraints).toEqual([]);
  });

  // ── 17. Current uploaded documents → evidenceInventory populated ───────────────
  it('populates evidenceInventory with current document facts', async () => {
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      uploaded_documents: [VALID_DOC],
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.evidenceInventory.documents).toHaveLength(1);
    const doc = first(result.evidenceInventory.documents);
    expect(doc.id).toBe('doc-1');
    expect(doc.type).toBe('cv');
    expect(doc.fileName).toBe('my_cv.pdf');
    expect(doc.active).toBe(true);
    const diag = result.diagnostics.find((d) => d.source === 'uploaded_documents');
    expect(diag?.status).toBe('present');
  });

  // ── 18. Evidence query failure → diagnostic unavailable ────────────────────────
  it('produces unavailable diagnostic and empty inventory when document query fails', async () => {
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      uploaded_documents_error: { message: 'RLS denied' },
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.evidenceInventory.documents).toEqual([]);
    const diag = result.diagnostics.find((d) => d.source === 'uploaded_documents');
    expect(diag?.status).toBe('unavailable');
  });

  // ── 19. Application-level deadline candidate present, NO precedence field ────
  it('includes application-level deadline candidate without precedence', async () => {
    const supabase = buildSupabase({ course_applications: [VALID_APP] });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    const appCandidate = result.deadlineCandidates.find((c) => c.source === 'course_application');
    expect(appCandidate).toBeDefined();
    expect(appCandidate!.date).toBe('2025-01-15');
    expect(appCandidate!.authority).toBe('user_set');
    expect(appCandidate!.confidence).toBe(0.9);
    // precedence must NOT exist on DeadlineCandidate
    expect('precedence' in (appCandidate as object)).toBe(false);
  });

  // ── 20. University deadline candidate present independently ───────────────────
  it('includes university deadline candidate independently when present', async () => {
    const supabase = buildSupabase({
      course_applications: [VALID_APP],
      universities: [VALID_UNIVERSITY],
    });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    const uniCandidate = result.deadlineCandidates.find((c) => c.source === 'university');
    expect(uniCandidate).toBeDefined();
    expect(uniCandidate!.date).toBe('October 15');
    expect('precedence' in (uniCandidate as object)).toBe(false);
  });

  // ── 21. Unknown deadline authority ────────────────────────────────────────────
  it('assigns authority=unknown when deadline_source cannot be classified', async () => {
    const appWithUnknownSource: MockTable = {
      ...VALID_APP,
      deadline_source: 'some_random_scraper_value',
    };
    const supabase = buildSupabase({ course_applications: [appWithUnknownSource] });
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    const appCandidate = result.deadlineCandidates.find((c) => c.source === 'course_application');
    expect(appCandidate!.authority).toBe('unknown');
  });

  // ── 22. Same source never receives contradictory final diagnostics ────────────
  it('each logical source has exactly one final diagnostic', async () => {
    const supabase = allSources();
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    const sourceNames = result.diagnostics.map((d) => d.source);
    const uniqueNames = new Set(sourceNames);
    expect(sourceNames.length).toBe(uniqueNames.size);
  });

  // ── Bonus: full happy path ────────────────────────────────────────────────────
  it('successfully populates all fields in the happy path', async () => {
    const supabase = allSources();
    const result = await fetchPlanningContextSources(supabase as never, 'app-1', 'user-1');

    expect(result.programme.universityName).toBe('Oxford');
    expect(result.programme.applicationStatus).toBe('preparing');
    expect(result.requirements).toHaveLength(1);
    expect(result.stages).toHaveLength(1);
    expect(result.tasks).toHaveLength(1);
    expect(result.recommendations).toHaveLength(1);
    expect(result.profileEvaluation).not.toBeNull();
    expect(result.programmeFit).not.toBeNull();
    expect(result.strategyRecommendation).not.toBeNull();
    expect(result.userConstraints.length).toBeGreaterThan(0);
    expect(result.evidenceInventory.documents).toHaveLength(1);
    expect(result.deadlineCandidates.length).toBeGreaterThanOrEqual(1);

    // Canonical planner inputs are absent before the first canonical plan;
    // every upstream source supplied by this fixture is present.
    for (const diag of result.diagnostics) {
      expect(diag.status).toBe(diag.source === 'canonical_planner_inputs' ? 'missing' : 'present');
    }
  });
});
