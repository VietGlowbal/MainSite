import { describe, expect, it } from 'vitest';
import type { ApplicationRequirement } from '@/lib/apply-types';
import type { AssessmentResult } from './assessment';
import { compileAssessments } from './compile-assessments';
import { compileDecisions } from './compile-decisions';
import { compilePlanningContext } from './compile-planning-context';
import type { PlanningContextSources, SourceProvenance } from './planning-context';

function assessment(overrides: Partial<AssessmentResult> = {}): AssessmentResult {
  return {
    id: 'assessment:base', kind: 'requirement', subject: 'Entry requirement', currentState: 'met',
    status: 'meets', severity: 'info', title: 'Requirement met', summary: 'A requirement is met.',
    evidence: [], source: { kind: 'requirement', sourceId: 'req-1', provenance: 'database_factual' },
    decisionBasis: 'hard_constraint', confidence: 1, mode: 'deterministic',
    ...overrides,
  };
}

function decision(decisions: ReturnType<typeof compileDecisions>, id: string) {
  const result = decisions.find((item) => item.id === id);
  expect(result).toBeDefined();
  return result!;
}

describe('compileDecisions', () => {
  it('blocks the current application only for a confirmed hard constraint failure', () => {
    const result = decision(compileDecisions([assessment({ id: 'requirement:entry', status: 'gap', currentState: 'not_met' })]), 'decision:application-eligibility');
    expect(result).toMatchObject({ status: 'blocked', options: [{ feasibility: 'infeasible' }], blockingAssessmentIds: ['requirement:entry'] });
  });

  it('keeps a met hard requirement feasible', () => {
    const result = decision(compileDecisions([assessment()]), 'decision:application-eligibility');
    expect(result).toMatchObject({ status: 'available', options: [{ feasibility: 'feasible' }] });
  });

  it('uses needs_information for an unknown critical requirement', () => {
    const result = decision(compileDecisions([assessment({ id: 'requirement:entry', status: 'unknown', currentState: 'unknown', decisionBasis: 'information_gap' })]), 'decision:application-eligibility');
    expect(result).toMatchObject({ status: 'needs_information', options: [{ feasibility: 'uncertain' }] });
  });

  it('does not turn an AI-derived soft negative into a hard blocker', () => {
    const aiGap = assessment({
      id: 'identified-gap:f5-academic', kind: 'identified_gap', subject: 'Academic competitiveness',
      status: 'needs_attention', currentState: 'gap identified', decisionBasis: 'soft_signal',
      source: { kind: 'identified_gap', sourceId: 'match-1', provenance: 'ai_generated' },
    });
    const decisions = compileDecisions([assessment(), aiGap]);

    expect(decision(decisions, 'decision:application-eligibility').status).toBe('available');
    const focus = decision(decisions, 'decision:attention-focus');
    expect(focus).toMatchObject({ status: 'available', blockingAssessmentIds: [] });
    expect(focus.options[0]?.reasons[0]).toMatchObject({ provenance: 'ai_generated', assessmentId: 'identified-gap:f5-academic' });
  });

  it('requires user choice when multiple feasible soft-signal directions lack a deterministic winner', () => {
    const first = assessment({ id: 'identified-gap:a', kind: 'identified_gap', subject: 'Academic evidence', status: 'needs_attention', decisionBasis: 'soft_signal' });
    const second = assessment({ id: 'identified-gap:b', kind: 'identified_gap', subject: 'Narrative evidence', status: 'needs_attention', decisionBasis: 'soft_signal' });
    const focus = decision(compileDecisions([assessment(), second, first]), 'decision:attention-focus');

    expect(focus.status).toBe('needs_user_choice');
    expect(focus.options.map((option) => option.id)).toEqual(['option:attention:identified-gap-a', 'option:attention:identified-gap-b']);
  });

  it('uses only a declared planner input to resolve the selected attention direction', () => {
    const first = assessment({ id: 'identified-gap:a', kind: 'identified_gap', subject: 'Academic evidence', status: 'needs_attention', decisionBasis: 'soft_signal' });
    const second = assessment({ id: 'identified-gap:b', kind: 'identified_gap', subject: 'Narrative evidence', status: 'needs_attention', decisionBasis: 'soft_signal' });
    const focus = decision(compileDecisions([assessment(), first, second], [{ semanticKey: 'planner.attention_focus', value: 'option:attention:identified-gap-b', microStepId: 'micro-1', provenance: 'user_provided' }]), 'decision:attention-focus');

    expect(focus).toMatchObject({ status: 'available', options: [{ id: 'option:attention:identified-gap-b' }] });
  });

  it('records a user constraint without falsely blocking feasibility when no comparable candidate fact exists', () => {
    const budget = assessment({
      id: 'constraint:budget', kind: 'constraint', subject: 'budget', currentState: 'USD 20,000',
      decisionBasis: 'user_constraint', source: { kind: 'constraint', sourceId: 'budget', provenance: 'user_provided' },
    });
    const decisions = compileDecisions([assessment(), budget]);
    expect(decision(decisions, 'decision:application-eligibility').status).toBe('available');
    expect(decision(decisions, 'decision:constraint-context')).toMatchObject({ status: 'available', options: [{ feasibility: 'uncertain' }] });
  });

  it('is safe with no assessments and refuses to infer feasibility', () => {
    const result = decision(compileDecisions([]), 'decision:application-eligibility');
    expect(result).toMatchObject({ status: 'needs_information', options: [{ feasibility: 'uncertain' }] });
  });

  it('uses stable IDs and ordering for reordered assessment input', () => {
    const inputs = [
      assessment({ id: 'identified-gap:b', kind: 'identified_gap', subject: 'B', status: 'needs_attention', decisionBasis: 'soft_signal' }),
      assessment({ id: 'identified-gap:a', kind: 'identified_gap', subject: 'A', status: 'needs_attention', decisionBasis: 'soft_signal' }),
      assessment({ id: 'requirement:met' }),
    ];
    expect(compileDecisions(inputs)).toEqual(compileDecisions([...inputs].reverse()));
    expect(compileDecisions(inputs).map((item) => item.id)).toEqual([
      'decision:attention-focus', 'decision:application-eligibility',
    ]);
  });
});

const integrationProvenance: SourceProvenance = {
  id: 'match-1', generatedAt: '2026-08-20T00:00:00.000Z', inputHash: 'hash', promptVersion: 'f5',
  engineVersion: null, modelName: 'test', sourceAnalysisId: null, sourceMatchAnalysisId: null,
};

const integrationRequirement: ApplicationRequirement = {
  id: 'entry', applicationId: 'app-1', requirementType: 'academic', title: 'Entry requirement',
  requirementText: 'Official entry rule', isMandatory: true, studentStatus: 'not_met',
  sourceUrl: 'https://example.edu', sourceId: 'official', confidence: 1,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

const integrationSources: PlanningContextSources = {
  applicationId: 'app-1', userId: 'user-1',
  programme: { applicationId: 'app-1', courseId: 'course-1', universityId: 1, universityName: 'Example University', courseName: 'Example Course', courseUrl: null, degreeLevel: null, subject: null, country: null, studyMode: null, intake: null, applicationMethod: null, applicationCode: null, applicationStatus: 'preparing' },
  requirements: [integrationRequirement], stages: [], tasks: [], recommendations: [], deadlineCandidates: [], evidenceInventory: { documents: [] }, profileEvaluation: null,
  programmeFit: {
    data: {
      classification: 'match', confidence: 80, limitations: [],
      eligibility: { requiredSubjects: 'unknown', minimumQualification: 'unknown', languageRequirement: 'unknown', citizenshipRequirement: 'unknown', deadline: 'unknown' },
      dimensions: {
        academicCompetitiveness: { status: 'assessed', score: 3, summary: 'Limited academic fit.', strengths: [], gaps: ['AI-derived competitiveness signal'], evidence: [] },
        personaAlignment: { status: 'assessed', score: 3, summary: 'Adequate.', strengths: [], gaps: [], evidence: [] },
        financialFeasibility: { status: 'not_available', score: null, summary: 'Unavailable.', strengths: [], gaps: [], evidence: [] },
        careerDirection: { status: 'assessed', score: 3, summary: 'Adequate.', strengths: [], gaps: [], evidence: [] },
        applicationReadiness: { status: 'assessed', score: 3, summary: 'Adequate.', strengths: [], gaps: [], evidence: [] },
      },
    }, improvementActions: [], provenance: integrationProvenance,
  },
  strategyRecommendation: null, userConstraints: [],
  diagnostics: [{ source: 'application_requirements', status: 'present' }],
};

describe('Core 1 to Core 2 integration', () => {
  it('carries factual blockers, unknowns, and AI provenance through pure compilers without planner tasks', () => {
    const context = compilePlanningContext(integrationSources);
    const assessments = compileAssessments(context);
    const decisions = compileDecisions(assessments);

    expect(decision(decisions, 'decision:application-eligibility').status).toBe('blocked');
    expect(decision(decisions, 'decision:attention-focus').options[0]?.reasons[0]?.provenance).toBe('ai_generated');
    expect(decisions.some((item) => 'tasks' in item || 'steps' in item || 'phases' in item)).toBe(false);
  });
});
