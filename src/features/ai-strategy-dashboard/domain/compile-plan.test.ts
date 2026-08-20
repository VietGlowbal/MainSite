import { describe, expect, it } from 'vitest';
import type { ApplicationRequirement } from '@/lib/apply-types';
import type { AssessmentProvenance } from './assessment';
import { compileAssessments } from './compile-assessments';
import { compileDecisions } from './compile-decisions';
import { compilePlan } from './compile-plan';
import { compilePlanningContext } from './compile-planning-context';
import type { DecisionResult } from './decision';
import type { PlanningContextSources, SourceProvenance } from './planning-context';

function decision(
  id: string,
  status: DecisionResult['status'],
  provenance: AssessmentProvenance = 'database_factual',
): DecisionResult {
  return {
    id,
    subject: id.replace('decision:', '').replaceAll('-', ' '),
    status,
    title: id,
    summary: `Summary for ${id}.`,
    options: [{
      id: `option:${id}`,
      label: id,
      feasibility: status === 'blocked' ? 'infeasible' : status === 'needs_information' ? 'uncertain' : 'feasible',
      reasons: [{ assessmentId: `assessment:${id}`, label: id, detail: null, provenance }],
    }],
    supportingAssessmentIds: [`assessment:${id}`],
    blockingAssessmentIds: status === 'blocked' || status === 'needs_information' ? [`assessment:${id}`] : [],
    mode: 'deterministic',
  };
}

describe('compilePlan', () => {
  it('turns a blocked decision into a deterministic blocker-resolution hierarchy', () => {
    const plan = compilePlan([decision('decision:application-eligibility', 'blocked')]);
    expect(plan).toMatchObject({
      readiness: 'requires_enrichment',
      phases: [{
        id: 'phase:resolve_blockers',
        steps: [{
          id: 'step:resolve_blockers:decision-application-eligibility',
          microSteps: [{ readiness: 'requires_enrichment' }],
        }],
      }],
    });
  });

  it('keeps missing information unresolved instead of fabricating downstream actions', () => {
    const plan = compilePlan([decision('decision:application-eligibility', 'needs_information')]);
    expect(plan).toMatchObject({ readiness: 'requires_user_input', phases: [{ id: 'phase:resolve_information' }] });
    expect(plan.phases[0]?.steps[0]?.microSteps[0]?.title).toContain('information required');
  });

  it('preserves a user-choice gate without selecting an option', () => {
    const plan = compilePlan([decision('decision:attention-focus', 'needs_user_choice')]);
    expect(plan).toMatchObject({ readiness: 'requires_user_input', phases: [{ id: 'phase:confirm_choices' }] });
    expect(plan.phases[0]?.steps[0]?.microSteps[0]).toMatchObject({ readiness: 'requires_user_input' });
  });

  it('does not label an available direction as recommended', () => {
    const plan = compilePlan([decision('decision:attention-focus', 'available')]);
    expect(plan.phases[0]).toMatchObject({ id: 'phase:available_direction', title: 'Structure available direction' });
    expect(JSON.stringify(plan)).not.toContain('recommended');
  });

  it('retains AI-derived provenance without making it a hard phase', () => {
    const plan = compilePlan([decision('decision:attention-focus', 'available', 'ai_generated')]);
    expect(plan.phases[0]).toMatchObject({ id: 'phase:available_direction', sourceProvenances: ['ai_generated'] });
  });

  it('groups and orders semantic decision states explicitly', () => {
    const plan = compilePlan([
      decision('decision:attention-focus', 'available'),
      decision('decision:choice', 'needs_user_choice'),
      decision('decision:information', 'needs_information'),
      decision('decision:application-eligibility', 'blocked'),
      decision('decision:constraint-context', 'available'),
    ]);
    expect(plan.phases.map((phase) => phase.id)).toEqual([
      'phase:resolve_blockers',
      'phase:resolve_information',
      'phase:confirm_choices',
      'phase:available_direction',
    ]);
  });

  it('has stable IDs and ordering when input order changes', () => {
    const decisions = [
      decision('decision:attention-focus', 'available'),
      decision('decision:application-eligibility', 'blocked'),
      decision('decision:choice', 'needs_user_choice'),
    ];
    expect(compilePlan(decisions)).toEqual(compilePlan([...decisions].reverse()));
  });

  it('returns a safe empty plan for no decisions', () => {
    expect(compilePlan([])).toEqual({ id: 'plan:deterministic:811c9dc5', readiness: 'empty', phases: [] });
  });

  it('does not produce execution or scheduling state', () => {
    const plan = compilePlan([decision('decision:application-eligibility', 'blocked')]);
    const serialized = JSON.stringify(plan);
    for (const forbidden of ['"status"', 'deadline', 'completed', 'calendar', 'reminder', 'task']) {
      expect(serialized).not.toContain(forbidden);
    }
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
        academicCompetitiveness: { status: 'assessed', score: 3, summary: 'Limited academic fit.', strengths: [], gaps: ['AI academic signal', 'AI narrative signal'], evidence: [] },
        personaAlignment: { status: 'assessed', score: 3, summary: 'Adequate.', strengths: [], gaps: [], evidence: [] },
        financialFeasibility: { status: 'not_available', score: null, summary: 'Unavailable.', strengths: [], gaps: [], evidence: [] },
        careerDirection: { status: 'assessed', score: 3, summary: 'Adequate.', strengths: [], gaps: [], evidence: [] },
        applicationReadiness: { status: 'assessed', score: 3, summary: 'Adequate.', strengths: [], gaps: [], evidence: [] },
      },
    }, improvementActions: [], provenance: integrationProvenance,
  },
  strategyRecommendation: null, userConstraints: [], diagnostics: [{ source: 'application_requirements', status: 'present' }],
};

describe('Core 1 to Core 3 integration', () => {
  it('compiles factual blockers and unresolved AI choices into a traceable non-execution plan', () => {
    const plan = compilePlan(compileDecisions(compileAssessments(compilePlanningContext(integrationSources))));
    expect(plan.phases.map((phase) => phase.id)).toEqual(['phase:resolve_blockers', 'phase:confirm_choices']);
    expect(plan.phases[0]?.sourceDecisionIds).toEqual(['decision:application-eligibility']);
    expect(plan.phases[1]).toMatchObject({ sourceProvenances: ['ai_generated'] });
    expect(plan.phases[1]?.steps[0]?.microSteps[0]?.readiness).toBe('requires_user_input');
  });
});
