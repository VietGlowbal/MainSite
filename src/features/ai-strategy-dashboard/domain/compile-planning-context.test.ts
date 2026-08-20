import { describe, expect, it } from 'vitest';
import type { ApplicationRequirement } from '@/lib/apply-types';
import type { PlanningContextSources, SourceProvenance } from './planning-context';
import { compileAssessments } from './compile-assessments';
import { compilePlanningContext } from './compile-planning-context';

const provenance = (id: string): SourceProvenance => ({
  id,
  generatedAt: '2026-08-20T00:00:00.000Z',
  inputHash: `${id}-hash`,
  promptVersion: `${id}-prompt`,
  engineVersion: null,
  modelName: 'test-model',
  sourceAnalysisId: null,
  sourceMatchAnalysisId: null,
});

function requirement(
  id: string,
  status: ApplicationRequirement['studentStatus'],
  mandatory = true,
): ApplicationRequirement {
  return {
    id,
    applicationId: 'app-1',
    requirementType: 'academic',
    title: 'Academic entry requirement',
    requirementText: 'Programme entry requirement',
    isMandatory: mandatory,
    studentStatus: status,
    sourceUrl: 'https://example.edu/requirements',
    sourceId: 'example-entry-page',
    confidence: 0.9,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function sources(): PlanningContextSources {
  return {
    applicationId: 'app-1',
    userId: 'user-1',
    programme: {
      applicationId: 'app-1', courseId: 'course-1', universityId: 1,
      universityName: 'Example University', courseName: 'Example MSc', courseUrl: null,
      degreeLevel: null, subject: null, country: null, studyMode: null, intake: null,
      applicationMethod: null, applicationCode: null, applicationStatus: 'preparing',
    },
    requirements: [requirement('req-unresolved', 'unknown'), requirement('req-gap', 'not_met')],
    stages: [],
    tasks: [],
    recommendations: [],
    deadlineCandidates: [
      { date: '2027-01-15', kind: 'application', source: 'university', authority: 'official', confidence: 0.8, sourceReference: 'https://example.edu/deadline' },
      { date: '2027-01-10', kind: 'application', source: 'course_application', authority: 'user_set', confidence: 0.9, sourceReference: 'student confirmed' },
    ],
    evidenceInventory: { documents: [] },
    profileEvaluation: null,
    programmeFit: {
      data: {
        classification: 'match', confidence: 80, limitations: ['Need more official evidence.'],
        eligibility: { requiredSubjects: 'unknown', minimumQualification: 'unknown', languageRequirement: 'unknown', citizenshipRequirement: 'unknown', deadline: 'unknown' },
        dimensions: {
          academicCompetitiveness: { status: 'assessed', score: 3, summary: 'Adequate academic signal.', strengths: [], gaps: ['Academic evidence is limited.'], evidence: [] },
          personaAlignment: { status: 'assessed', score: 3, summary: 'Adequate alignment.', strengths: [], gaps: [], evidence: [] },
          financialFeasibility: { status: 'not_available', score: null, summary: 'No financial information.', strengths: [], gaps: [], evidence: [] },
          careerDirection: { status: 'assessed', score: 3, summary: 'Adequate direction.', strengths: [], gaps: [], evidence: [] },
          applicationReadiness: { status: 'assessed', score: 3, summary: 'Adequate readiness.', strengths: [], gaps: [], evidence: [] },
        },
      },
      improvementActions: [],
      provenance: provenance('f5-analysis'),
    },
    strategyRecommendation: {
      data: {
        directionOptions: [
          { name: 'Research focus', identityFit: 8, evidenceStrength: 7, consistency: 8, differentiation: 7, futureAlignment: 8, scalability: 7, overall: 8 },
          { name: 'Industry focus', identityFit: 6, evidenceStrength: 6, consistency: 6, differentiation: 6, futureAlignment: 6, scalability: 6, overall: 6 },
        ],
        chosenDirection: 'Research focus', chosenDirectionWhy: 'Best supported direction.', narrative: 'A focused narrative.',
        positioningBefore: 'Generalist', positioningAfter: 'Research-led applicant', positioningRationale: 'Evidence supports it.',
        portfolioEvaluations: [
          { name: 'Existing project', source: 'existing_activity', strategicContribution: 'Already complete.', recommendation: 'recommended' },
          { name: 'New research project', source: 'ai_proposed', strategicContribution: 'Adds research proof.', recommendation: 'highly_recommended' },
        ],
        differentiationInsight: 'Research signal is differentiating.', differentiationProposal: 'Show a research portfolio.',
        roadmap: { chosenStrategy: 'Research focus', why: 'It fits evidence.', prioritize: ['Document research work'], avoid: ['Generic claims'], expectedPositioning: 'Research-led', longTermNarrative: 'Sustained research interest.' },
      },
      provenance: provenance('f7-strategy'),
    },
    userConstraints: [{ kind: 'budget', value: 'USD 20,000' }],
    diagnostics: [
      { source: 'application_requirements', status: 'present' },
      { source: 'uploaded_documents', status: 'unavailable', message: 'RLS denied' },
    ],
  };
}

describe('compilePlanningContext', () => {
  it('normalizes complete sources while retaining grounded and AI-derived information separately', () => {
    const context = compilePlanningContext(sources());

    expect(context.requirementGaps).toMatchObject([{ requirementId: 'req-gap', status: 'not_met' }]);
    expect(context.unresolvedRequirements).toMatchObject([{ requirementId: 'req-unresolved', status: 'unknown' }]);
    expect(context.hardConstraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'mandatory_requirement', description: 'Academic entry requirement' }),
      expect.objectContaining({ kind: 'application_deadline', description: 'Application deadline: 2027-01-10' }),
    ]));
    expect(context.strategy?.aiProposedOpportunities).toEqual([
      expect.objectContaining({ name: 'New research project', source: 'ai_proposed' }),
    ]);
    expect(context.interventionCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'f7_priority', sourceAnalysisId: 'f7-strategy' }),
    ]));
  });

  it('uses explicit source precedence and retains competing candidates instead of selecting a database-first row', () => {
    const context = compilePlanningContext(sources());
    expect(context.deadlines).toEqual([
      expect.objectContaining({ source: 'course_application', date: '2027-01-10', precedence: 'primary' }),
      expect.objectContaining({ source: 'university', date: '2027-01-15', precedence: 'fallback' }),
    ]);
  });

  it('is safe with missing optional reports and propagates unavailable diagnostics', () => {
    const input = sources();
    input.programmeFit = null;
    input.strategyRecommendation = null;
    input.requirements = [];
    const context = compilePlanningContext(input);

    expect(context.strategy).toBeNull();
    expect(context.identifiedGaps).toEqual([]);
    expect(context.provenance.programmeFit).toBeNull();
    expect(context.provenance.sourceDiagnostics).toContainEqual(
      expect.objectContaining({ source: 'uploaded_documents', status: 'unavailable' }),
    );
  });

  it('remains diagnostic and null-safe when every optional source is absent', () => {
    const input = sources();
    input.requirements = [];
    input.deadlineCandidates = [];
    input.programmeFit = null;
    input.strategyRecommendation = null;
    input.userConstraints = [];
    input.diagnostics = [{ source: 'application_requirements', status: 'missing' }];
    const context = compilePlanningContext(input);

    expect(context.programmeRequirements).toEqual([]);
    expect(context.requirementGaps).toEqual([]);
    expect(context.deadlines).toEqual([]);
    expect(context.strategy).toBeNull();
    expect(compileAssessments(context)).toContainEqual(
      expect.objectContaining({ id: 'requirements:availability', currentState: 'missing' }),
    );
  });

  it('deduplicates repeated F5 source content without collapsing distinct provenance categories', () => {
    const input = sources();
    input.programmeFit!.data.dimensions.academicCompetitiveness.gaps.push('Academic evidence is limited.');
    input.programmeFit!.data.limitations.push('Need more official evidence.');
    const context = compilePlanningContext(input);

    expect(context.identifiedGaps.filter((gap) => gap.description === 'Academic evidence is limited.')).toHaveLength(1);
    expect(context.identifiedGaps.filter((gap) => gap.description === 'Need more official evidence.')).toHaveLength(1);
  });

  it('preserves F5 provenance through Assess findings', () => {
    const context = compilePlanningContext(sources());
    const assessment = compileAssessments(context).find((item) => item.id === 'identified-gap:f5_dimension:academicCompetitiveness:Academic evidence is limited.');

    expect(assessment).toMatchObject({
      mode: 'deterministic',
      source: { sourceId: 'f5-analysis', provenance: 'ai_generated' },
    });
    expect(assessment?.evidence[0]).toMatchObject({ provenance: 'ai_generated', sourceId: 'f5-analysis' });
  });

  it('is deterministic for reordered source collections and exposes a stable context hash', () => {
    const first = sources();
    const second = sources();
    second.requirements.reverse();
    second.deadlineCandidates.reverse();
    second.diagnostics.reverse();

    const firstContext = compilePlanningContext(first);
    const secondContext = compilePlanningContext(second);
    expect(secondContext).toEqual(firstContext);
    expect(firstContext.provenance.contextHash).toMatch(/^core1-fnv1a-32:[0-9a-f]{8}$/);
  });

  it('compiles sources to context to Assess findings without I/O', () => {
    const results = compileAssessments(compilePlanningContext(sources()));
    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'requirement:req-gap', status: 'gap', mode: 'deterministic' }),
      expect.objectContaining({ kind: 'identified_gap', source: expect.objectContaining({ provenance: 'ai_generated' }) }),
    ]));
  });
});
