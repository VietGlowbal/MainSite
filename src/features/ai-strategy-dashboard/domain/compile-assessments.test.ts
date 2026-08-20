import { describe, expect, it } from 'vitest';
import type { ApplicationRequirement } from '@/lib/apply-types';
import { scoreEvidenceItem } from '@/shared/evaluation/f3-evidence';
import type { PlanningContext } from './planning-context';
import { compileAssessments } from './compile-assessments';

function requirement(
  id: string,
  studentStatus: ApplicationRequirement['studentStatus'],
  isMandatory = true,
): ApplicationRequirement {
  return {
    id,
    applicationId: 'app-1',
    requirementType: 'english',
    title: 'IELTS overall score',
    requirementText: 'IELTS overall 7.0',
    isMandatory,
    studentStatus,
    sourceUrl: 'https://example.edu/requirements',
    sourceId: 'official-entry-requirements',
    confidence: 0.95,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function context(overrides: Partial<PlanningContext> = {}): PlanningContext {
  const base: PlanningContext = {
    applicantState: null,
    programme: {
      applicationId: 'app-1',
      courseId: 'course-1',
      universityId: 1,
      universityName: 'Example University',
      courseName: 'Example Course',
      courseUrl: null,
      degreeLevel: null,
      subject: null,
      country: null,
      studyMode: null,
      intake: null,
      applicationMethod: null,
      applicationCode: null,
      applicationStatus: 'preparing',
    },
    programmeRequirements: [],
    requirementGaps: [],
    unresolvedRequirements: [],
    hardConstraints: [],
    strategy: null,
    identifiedGaps: [],
    interventionCandidates: [],
    existingEvidence: { verified: [], attributable: [], stated: [] },
    evidenceNeedsProof: [],
    missingEvidence: [],
    missingInputSignals: [],
    deadlines: [],
    userConstraints: [],
    currentPlanState: { stages: [], tasks: [], legacyRecommendations: [] },
    provenance: {
      personalReport: null,
      programmeFit: null,
      strategy: null,
      staleness: { personalReport: 'unknown', programmeFit: 'unknown', strategy: 'unknown' },
      sourceDiagnostics: [],
      contextHash: 'context-hash',
    },
  };

  return {
    ...base,
    ...overrides,
    programme: { ...base.programme, ...overrides.programme },
    existingEvidence: { ...base.existingEvidence, ...overrides.existingEvidence },
    currentPlanState: { ...base.currentPlanState, ...overrides.currentPlanState },
    provenance: { ...base.provenance, ...overrides.provenance },
  };
}

function assessment(contextValue: PlanningContext, id: string) {
  const result = compileAssessments(contextValue).find((item) => item.id === id);
  expect(result).toBeDefined();
  return result!;
}

describe('compileAssessments', () => {
  it('reports a stored met requirement as a deterministic meets finding', () => {
    const result = assessment(context({ programmeRequirements: [requirement('ielts-overall', 'met')] }), 'requirement:ielts-overall');

    expect(result).toMatchObject({
      kind: 'requirement',
      status: 'meets',
      severity: 'info',
      mode: 'deterministic',
      source: { provenance: 'database_factual', sourceId: 'ielts-overall' },
    });
  });

  it('reports a stored unmet mandatory requirement as a high-severity gap', () => {
    const result = assessment(context({ programmeRequirements: [requirement('ielts-overall', 'not_met')] }), 'requirement:ielts-overall');

    expect(result).toMatchObject({ status: 'gap', severity: 'high', currentState: 'not_met' });
  });

  it('reports a partially met requirement as a gap without inventing a numeric comparison', () => {
    const result = assessment(context({ programmeRequirements: [requirement('ielts-overall', 'partially_met')] }), 'requirement:ielts-overall');

    expect(result).toMatchObject({ status: 'gap', severity: 'high', currentState: 'partially_met' });
    expect(result.summary).not.toContain('6.5');
  });

  it('reports an unassessed student requirement value as unknown', () => {
    const result = assessment(context({ programmeRequirements: [requirement('ielts-overall', 'unknown')] }), 'requirement:ielts-overall');

    expect(result).toMatchObject({ status: 'unknown', severity: 'medium', currentState: 'unknown' });
  });

  it('does not hide the absence of any programme requirements', () => {
    const result = assessment(context(), 'requirements:availability');

    expect(result).toMatchObject({
      kind: 'requirement',
      status: 'unknown',
      severity: 'medium',
      source: { sourceId: 'application_requirements', provenance: 'unknown' },
    });
  });

  it('reports structurally established missing evidence as needs_attention', () => {
    const result = assessment(context({
      missingEvidence: [{
        description: 'Official transcript',
        reason: 'transcript_required_by_programme',
        source: 'programme_requirement',
      }],
    }), 'evidence:missing:programme-requirement-transcript-required-by-programme-official-transcript');

    expect(result).toMatchObject({
      status: 'needs_attention',
      severity: 'high',
      source: { provenance: 'database_factual' },
    });
  });

  it('recognizes existing evidence without creating a false absence finding', () => {
    const verified = scoreEvidenceItem({
      id: 'certificate-1',
      title: 'Robotics certificate',
      sourceKind: 'uploaded_document',
      quantifiedOutcome: null,
      qualitativeOutcome: null,
      hasDocument: true,
      attributingOrganisation: 'Example Academy',
      level: null,
    });
    const results = compileAssessments(context({
      existingEvidence: { verified: [verified], attributable: [], stated: [] },
    }));

    expect(results.find((item) => item.id === 'evidence:availability')).toMatchObject({
      status: 'meets',
      currentState: '1 evidence item available',
    });
    expect(results.some((item) => item.id === 'evidence:missing:unknown')).toBe(false);
  });

  it('preserves AI provenance for an F5-derived gap while keeping compilation deterministic', () => {
    const result = assessment(context({
      identifiedGaps: [{
        id: 'f5_dimension_academic_0',
        source: 'f5_dimension',
        description: 'Academic evidence is below the programme expectation.',
        dimensionKey: 'academicCompetitiveness',
        sourceAnalysisId: 'match-analysis-1',
      }],
    }), 'identified-gap:f5_dimension_academic_0');

    expect(result).toMatchObject({
      status: 'needs_attention',
      mode: 'deterministic',
      source: { provenance: 'ai_generated', sourceId: 'match-analysis-1' },
    });
    expect(result.evidence[0]).toMatchObject({ provenance: 'ai_generated' });
  });

  it('keeps explicit user constraints and deadline authority provenance distinct', () => {
    const results = compileAssessments(context({
      userConstraints: [{ kind: 'budget', value: 'USD 20,000/year' }],
      deadlines: [{
        date: '2027-01-15',
        kind: 'application',
        source: 'course_application',
        authority: 'user_set',
        confidence: 0.9,
        sourceReference: 'student confirmed',
        precedence: 'primary',
      }],
    }));

    expect(results.find((item) => item.id === 'constraint:budget-usd-20-000-year')).toMatchObject({
      source: { provenance: 'user_provided' },
    });
    expect(results.find((item) => item.id === 'deadline:application:course-application')).toMatchObject({
      status: 'meets',
      source: { provenance: 'user_provided' },
    });
  });

  it('is stable and deterministically sorted for the same context', () => {
    const first = requirement('b-requirement', 'met');
    const second = requirement('a-requirement', 'not_met');
    const input = context({ programmeRequirements: [first, second] });

    const firstRun = compileAssessments(input);
    const secondRun = compileAssessments(input);

    expect(firstRun).toEqual(secondRun);
    expect(firstRun.slice(0, 2).map((item) => item.id)).toEqual([
      'requirement:a-requirement',
      'requirement:b-requirement',
    ]);
  });

  it('handles an empty planning context without throwing and with predictable unknowns', () => {
    expect(() => compileAssessments(context())).not.toThrow();
    expect(compileAssessments(context()).map((item) => item.id)).toEqual([
      'requirements:availability',
      'evidence:availability',
      'deadline:application',
      'profile:evaluation',
    ]);
  });
});
