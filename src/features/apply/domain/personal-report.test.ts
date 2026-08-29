import { describe, expect, it } from 'vitest';
import {
  runProfileEvaluation,
  type EvidenceItemInput,
  type NarrativeActivity,
  type ProfileEvaluationInput,
} from '@/shared/evaluation';
import { buildEvidenceBank } from '@/shared/evidence/build-evidence-bank';
import type { EvidenceBank } from '@/shared/evidence/domain';
import { buildPersonalReport } from './personal-report';
import { buildPersonalCanvasDetails, derivedSocialProofMetrics } from './personal-canvas-details';

const TUTOR: NarrativeActivity = {
  id: 'tutor',
  title: 'Peer tutoring programme',
  role: 'organiser',
  behaviour: 'built a structured weekly programme from scratch',
  domainTheme: 'education access',
  statedMotivation: 'I wanted to help classmates who fell behind after long absences.',
  outcome: 'Average scores rose by 15%.',
  organisation: 'School Learning Centre',
  level: 'School',
  period: '2024–2025',
  sources: [{ type: 'teacher_reference' }],
  evidenceRefs: [{ id: 'tutor', kind: 'activity', label: 'Peer tutoring' }],
};

const CODING: NarrativeActivity = {
  id: 'coding',
  title: 'School coding club',
  role: 'organiser',
  behaviour: 'built a curriculum and recruited 20 members',
  domainTheme: 'education access',
  statedMotivation: 'I wanted more students to have the chance to learn to code.',
  outcome: 'Membership grew to 45 students.',
  organisation: 'School Coding Club',
  level: 'School',
  period: '2023–2025',
  sources: [{ type: 'club_record' }],
  evidenceRefs: [{ id: 'coding', kind: 'activity', label: 'Coding club' }],
};

const CAREERBRIDGE: NarrativeActivity = {
  id: 'careerbridge',
  title: 'CareerBridge',
  role: 'founder',
  behaviour: 'built an information programme after identifying a gap',
  domainTheme: 'education access',
  statedMotivation: 'I noticed students had no clear source of scholarship information.',
  outcome: 'Reached 350 students across six schools.',
  organisation: 'CareerBridge',
  level: 'National',
  year: 2025,
  competition: 'Social Innovation Challenge',
  evidenceKey: 'careerbridge.pdf',
  reviewStatus: 'reviewed',
  sources: [{ type: 'certificate', verified: true }],
  evidenceRefs: [{ id: 'careerbridge', kind: 'achievement', label: 'CareerBridge' }],
};

const NATIONAL_PRIZE: EvidenceItemInput = {
  id: 'e1',
  title: 'National maths prize',
  sourceKind: 'structured_achievement',
  quantifiedOutcome: 'Ranked 1st out of 5,000 competitors.',
  qualitativeOutcome: null,
  hasDocument: true,
  attributingOrganisation: 'Ministry of Education',
  level: 'Quốc gia',
};

const SELF_REPORTED_EVIDENCE: EvidenceItemInput = {
  id: 'e2',
  title: 'Volunteer reading programme',
  sourceKind: 'applicant_statement',
  quantifiedOutcome: null,
  qualitativeOutcome: 'Helped younger students enjoy reading more.',
  hasDocument: false,
  attributingOrganisation: null,
  level: null,
};

function input(overrides: Partial<ProfileEvaluationInput> = {}): ProfileEvaluationInput {
  return {
    subjectId: 'student-1',
    writtenFields: [
      {
        field: 'careerGoals',
        label: 'Career goals',
        value:
          'I want to work on hospital scheduling software. In 2024 I spent two months at Bach Mai Hospital rebuilding their outpatient rota.',
      },
    ],
    reflectionRecords: [],
    competencyClaims: [],
    evidenceItems: [NATIONAL_PRIZE],
    narrativeActivities: [TUTOR, CODING, CAREERBRIDGE],
    intendedDirection: null,
    generatedAt: '2026-08-13T00:00:00.000Z',
    ...overrides,
  };
}

function report(overrides: Partial<ProfileEvaluationInput> = {}, evidenceBank?: EvidenceBank) {
  const args = input(overrides);
  const evaluation = runProfileEvaluation(args);
  return buildPersonalReport({
    evaluation,
    activities: args.narrativeActivities,
    intendedDirection: args.intendedDirection,
    generatedAt: args.generatedAt,
    ...(evidenceBank ? { evidenceBank } : {}),
  });
}

describe('buildPersonalReport', () => {
  it('user with rich evidence: builds every section from three converging activities', () => {
    const result = report();

    expect(result.coreIdentity.available).toBe(true);
    expect(result.coreIdentity.recurringRole).toBe('organiser');
    expect(result.signaturePattern.available).toBe(true);
    expect(result.signaturePattern.patternStrength).toBe('established');
    expect(result.emergingThemes.available).toBe(true);
    expect(result.emergingThemes.themes[0]?.theme).toBe('education access');
    expect(result.personalPositioning.available).toBe(true);
    expect(result.proofOfMe.available).toBe(true);
    expect(result.proofOfMe.cards.length).toBeGreaterThan(0);
  });

  it('user with thin evidence: sections report insufficient data rather than inventing content', () => {
    const result = report({
      narrativeActivities: [
        { ...TUTOR, behaviour: null, role: null, domainTheme: null, statedMotivation: null, outcome: null },
      ],
      evidenceItems: [],
    });

    expect(result.coreIdentity.available).toBe(false);
    expect(result.coreIdentity.insufficientData?.reason).toBeTruthy();
    expect(result.signaturePattern.available).toBe(false);
    expect(result.personalPositioning.available).toBe(false);
  });

  it('fewer than three activities: pattern is emerging, not established', () => {
    const result = report({ narrativeActivities: [TUTOR, CODING] });

    expect(result.signaturePattern.available).toBe(true);
    expect(result.signaturePattern.patternStrength).toBe('emerging');
    expect(result.coreIdentity.interpretation).toContain('emerging pattern');
  });

  it('no activities at all: every synthesis section needs more evidence, with an add-activity action', () => {
    const result = report({ narrativeActivities: [], evidenceItems: [] });

    expect(result.coreIdentity.available).toBe(false);
    expect(result.coreIdentity.insufficientData?.actions[0]?.kind).toBe('add_activity');
    expect(result.signaturePattern.available).toBe(false);
    expect(result.emergingThemes.available).toBe(false);
    expect(result.proofOfMe.available).toBe(false);
    expect(result.proofOfMe.insufficientData?.actions[0]?.kind).toBe('add_activity');
  });

  it('no uploaded evidence: Proof of Me cards fall back to self-reported verification, not invented documents', () => {
    const result = report({ evidenceItems: [] });

    expect(result.proofOfMe.available).toBe(true);
    for (const card of result.proofOfMe.cards) {
      expect(card.verificationStatus).toBe('stated');
    }
  });

  it('mixed verified and self-reported evidence: each Proof of Me card carries its own tier, not a blended one', () => {
    const result = report({ evidenceItems: [NATIONAL_PRIZE, SELF_REPORTED_EVIDENCE] });

    const tiers = new Set(result.proofOfMe.cards.map((card) => card.verificationStatus));
    // At least one activity has no matching evidence item at all, so it
    // falls back to 'stated' — proving tiers are assessed per-card.
    expect(tiers.has('stated')).toBe(true);
  });

  it('unresolved motivation: repeated activity choice alone is only ever an emerging hypothesis', () => {
    const result = report({
      narrativeActivities: [
        { ...TUTOR, statedMotivation: null },
        { ...CODING, statedMotivation: null },
        { ...CAREERBRIDGE, statedMotivation: null },
      ],
    });

    expect(result.drivingForce.isHypothesis).toBe(true);
    expect(result.drivingForce.headline).toContain('hypothesis');
    expect(result.drivingForce.explanation).toContain('EMERGING HYPOTHESIS');
  });

  it('recurring behavioural pattern: names trigger, response, method and value with supporting examples', () => {
    const result = report();

    expect(result.signaturePattern.steps).toHaveLength(4);
    const method = result.signaturePattern.steps.find((step) => step.key === 'method');
    expect(method?.examples.length).toBeGreaterThan(0);
  });

  it('no recurring pattern: dissimilar activities produce no_pattern rather than a forced pattern', () => {
    const result = report({
      narrativeActivities: [
        { ...TUTOR, behaviour: 'organised a debate tournament', role: 'competitor', domainTheme: 'public speaking', outcome: null },
        { ...CODING, behaviour: 'painted a mural for the school festival', role: 'artist', domainTheme: 'the arts', outcome: null },
      ],
    });

    expect(result.signaturePattern.available).toBe(false);
    expect(['no_pattern', 'insufficient']).toContain(result.signaturePattern.patternStrength);
  });

  it('never reads programme fit or computes an admissions score', () => {
    const result = report();
    const serialized = JSON.stringify(result).toLowerCase();
    expect(serialized).not.toContain('programmefit');
    expect(serialized).not.toContain('admission');
    expect(serialized).not.toContain('probability');
    expect(serialized).not.toContain('programme fit');
    expect(serialized).not.toContain('application strategy');
  });

  it('global report not tied to applicationId: the input and output contain no applicationId field', () => {
    const args = input();
    const evaluation = runProfileEvaluation(args);
    const result = buildPersonalReport({
      evaluation,
      activities: args.narrativeActivities,
      intendedDirection: args.intendedDirection,
      generatedAt: args.generatedAt,
    });

    // Neither the evaluation input nor the rendered report has any applicationId
    // field — changing or adding a university application can never affect this
    // report's content or trigger regeneration.
    expect('applicationId' in args).toBe(false);
    expect('applicationId' in result).toBe(false);

    // `subjectId` is the student's own userId, not an applicationId — confirmed
    // by reading engine.ts: it is used to scope the evaluation output, not to
    // route to a specific application.
    expect(args.subjectId).toBe('student-1');
  });

  it('overallEvidenceConfidence is exactly the engine floor confidence', () => {
    const args = input();
    const evaluation = runProfileEvaluation(args);
    const result = buildPersonalReport({
      evaluation,
      activities: args.narrativeActivities,
      intendedDirection: args.intendedDirection,
      generatedAt: args.generatedAt,
    });
    expect(result.overallEvidenceConfidence).toBe(evaluation.confidence);
  });

  it('emits the application report contract with bounded summary and explicit evidence gaps', () => {
    const result = report({ evidenceItems: [] });
    const summaryWords = result.snapshot?.summary.trim().split(/\s+/).length ?? 0;

    expect(summaryWords).toBeGreaterThanOrEqual(150);
    expect(summaryWords).toBeLessThanOrEqual(200);
    expect(result.growthAreas?.[0]).toMatchObject({
      kind: 'growth_area',
      scope: 'insufficient',
      currentGap: expect.any(String),
      importance: expect.any(String),
      direction: expect.any(String),
      limitations: expect.any(Array),
    });
    expect(result.keyTakeaways).toEqual(
      expect.objectContaining({
        whatMakesYouStandOut: expect.any(Object),
        competitiveAdvantage: expect.any(Object),
        growthOpportunity: expect.any(Object),
      }),
    );
  });

  it('does not interpolate first-person activity motivation into the executive snapshot', () => {
    const result = report();

    expect(result.snapshot?.summary).not.toContain('I wanted to help classmates');
    expect(result.snapshot?.summary).toContain('activity-level reflection');
  });

  it('uses the persisted Evidence Bank for coverage and preserves raw-source provenance', () => {
    const evidenceBank = buildEvidenceBank({
      academicRecords: [],
      activities: [
        {
          id: 'careerbridge',
          kind: 'achievement',
          title: CAREERBRIDGE.title,
          freeText: CAREERBRIDGE.outcome,
          evidenceKey: 'document-1',
        },
      ],
      documents: [{ id: 'document-1', fileName: 'CareerBridge confirmation.pdf' }],
    });
    const result = report({ narrativeActivities: [CAREERBRIDGE] }, evidenceBank);

    expect(result.evidenceCoverage?.strongEvidence).toContain('achievement:careerbridge');
    expect(result.evidenceCoverage?.weakEvidence).not.toContain('achievement:careerbridge');
  });

  it('retains metadata and quantified outcomes in Social Proof instead of counting cards only', () => {
    const args = input({
      evidenceItems: [
        {
          ...NATIONAL_PRIZE,
          id: 'tutor',
          title: TUTOR.title,
          sourceKind: 'structured_achievement',
          quantifiedOutcome: TUTOR.outcome,
          hasDocument: false,
          attributingOrganisation: TUTOR.organisation ?? null,
          level: TUTOR.level ?? null,
        },
      ],
    });
    const evaluation = runProfileEvaluation(args);
    const result = buildPersonalReport({
      evaluation,
      activities: args.narrativeActivities,
      intendedDirection: args.intendedDirection,
      generatedAt: args.generatedAt,
    });
    expect(result.proofOfMe.cards[0]).toMatchObject({ organisation: expect.any(String), period: expect.any(String) });

    const canvas = buildPersonalCanvasDetails({
      activities: args.narrativeActivities,
      coreIdentity: result.coreIdentity,
      drivingForce: result.drivingForce,
      emergingThemes: result.emergingThemes,
      personalPositioning: result.personalPositioning,
      proofOfMe: result.proofOfMe,
      intendedDirection: args.intendedDirection,
    });
    expect(canvas.socialProof.find((metric) => metric.key === 'metadataCoverage')?.value).toBeGreaterThan(0);
    expect(canvas.socialProof.find((metric) => metric.key === 'quantifiedOutcomes')?.value).toBeGreaterThan(0);
    expect(canvas.socialProof.find((metric) => metric.key === 'teamMembersLed')).toMatchObject({ value: 20, evidenceIds: ['coding'], sourceActivityIds: ['coding'] });
    expect(canvas.socialProof.find((metric) => metric.key === 'communityReach')).toMatchObject({ value: 350, evidenceIds: ['careerbridge'], sourceActivityIds: ['careerbridge'] });
    expect(canvas.socialProof.find((metric) => metric.key === 'yearsOfCommitment')).toMatchObject({ value: 3, evidenceIds: ['coding'], sourceActivityIds: ['coding'] });
  });

  it('omits derived numeric Social Proof when no number is explicitly present', () => {
    const metrics = derivedSocialProofMetrics([{
      activityId: 'qualitative',
      title: 'Qualitative project',
      role: 'organiser',
      personalContribution: 'Supported a small group',
      outcome: 'Participants felt more confident',
      period: null,
      evidenceRefs: [{ id: 'qualitative', kind: 'activity', label: 'Qualitative project' }],
    }] as never);

    expect(metrics).toEqual([]);
  });

  it('routes Q1 into emerging themes and Q3 into positioning as explicitly scoped context', () => {
    const reflectionAnswerSignals = [
      { key: 'q1' as const, dimension: 'interests_motivations' as const, value: 'access to practical education', summary: 'interest in practical education', status: 'isolated' as const },
      { key: 'q3' as const, dimension: 'problem_domains' as const, value: 'unequal access to education', summary: 'unequal education access', status: 'isolated' as const },
    ];
    const args = input({ reflectionAnswerSignals });
    const evaluation = runProfileEvaluation(args);
    const result = buildPersonalReport({
      evaluation,
      activities: args.narrativeActivities,
      intendedDirection: args.intendedDirection,
      generatedAt: args.generatedAt,
    });

    expect(result.emergingThemes.themes.some((theme) =>
      theme.evidenceRefs.some((ref) => ref.id === 'profile:reflection_q1'),
    )).toBe(true);
    expect(result.personalPositioning.evidenceRefs.some((ref) => ref.id === 'profile:reflection_q3')).toBe(true);
  });
});
