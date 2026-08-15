import { describe, expect, it } from 'vitest';
import {
  runProfileEvaluation,
  type CompetencyClaim,
  type EvidenceItemInput,
  type NarrativeActivity,
  type ProfileEvaluationInput,
} from '@/shared/evaluation';
import { buildPersonalReport } from './personal-report';

const TUTOR: NarrativeActivity = {
  id: 'tutor',
  title: 'Peer tutoring programme',
  role: 'organiser',
  behaviour: 'built a structured weekly programme from scratch',
  domainTheme: 'education access',
  statedMotivation: 'I wanted to help classmates who fell behind after long absences.',
  outcome: 'Average scores rose by 15%.',
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
  evidenceRefs: [{ id: 'careerbridge', kind: 'achievement', label: 'CareerBridge' }],
};

const VERIFIED_EVIDENCE: EvidenceItemInput = {
  id: 'e1',
  title: 'National maths prize',
  sourceKind: 'structured_achievement',
  quantifiedOutcome: 'Ranked 1st out of 5,000 competitors.',
  qualitativeOutcome: null,
  hasDocument: true,
  attributingOrganisation: 'Ministry of Education',
  level: 'National',
};

const STATED_EVIDENCE: EvidenceItemInput = {
  id: 'e2',
  title: 'Volunteer reading programme',
  sourceKind: 'applicant_statement',
  quantifiedOutcome: null,
  qualitativeOutcome: 'Helped younger students enjoy reading more.',
  hasDocument: false,
  attributingOrganisation: null,
  level: null,
};

const HARD_CLAIM: CompetencyClaim = {
  id: 'c1',
  type: 'hard',
  label: 'Statistical reasoning',
  situation: 'Analysed six months of tutoring attendance data to redesign the weekly schedule for maximum turnout.',
  evidenceRefs: [{ id: 'tutor', kind: 'activity', label: 'Peer tutoring' }],
};

function input(overrides: Partial<ProfileEvaluationInput> = {}): ProfileEvaluationInput {
  return {
    subjectId: 'student-1',
    writtenFields: [],
    reflectionRecords: [],
    competencyClaims: [HARD_CLAIM],
    evidenceItems: [VERIFIED_EVIDENCE, STATED_EVIDENCE],
    narrativeActivities: [TUTOR, CODING, CAREERBRIDGE],
    intendedDirection: 'combining engineering and education access work',
    generatedAt: '2026-08-13T00:00:00.000Z',
    ...overrides,
  };
}

function analyticsFor(overrides: Partial<ProfileEvaluationInput> = {}) {
  const args = input(overrides);
  const evaluation = runProfileEvaluation(args);
  const report = buildPersonalReport({
    evaluation,
    activities: args.narrativeActivities,
    intendedDirection: args.intendedDirection,
    generatedAt: args.generatedAt,
  });
  if (!report.analytics) throw new Error('buildPersonalReport must always set analytics');
  return { report, analytics: report.analytics, evaluation };
}

describe('buildPersonalReportAnalytics — competencyEvidenceProfile', () => {
  it('the hard-skill axis score is exactly the F2 hard category score, not a re-derived number', () => {
    const { analytics, evaluation } = analyticsFor();
    const hard = analytics.competencyEvidenceProfile.find((metric) => metric.key === 'hard');
    expect(hard?.score).toBe(evaluation.competencies.categories.hard.score);
  });

  it('an axis with zero claims of that type stays null rather than showing zero', () => {
    const { analytics } = analyticsFor({ competencyClaims: [HARD_CLAIM] });
    const soft = analytics.competencyEvidenceProfile.find((metric) => metric.key === 'soft');
    const meta = analytics.competencyEvidenceProfile.find((metric) => metric.key === 'meta');
    expect(soft?.score).toBeNull();
    expect(meta?.score).toBeNull();
  });

  it('the tangible-impact axis averages only evidence items that actually reported a quantified outcome', () => {
    const { analytics, evaluation } = analyticsFor();
    const tangible = analytics.competencyEvidenceProfile.find((metric) => metric.key === 'tangibleImpact');
    const expected = evaluation.evidence.assessed
      .map((item) => item.metrics.tangibleImpact)
      .filter((value): value is number => value !== null);
    expect(tangible?.score).toBe(Math.round(expected.reduce((sum, v) => sum + v, 0) / expected.length));
  });

  it('with no evidence items at all, every impact axis is null, never zero', () => {
    const { analytics } = analyticsFor({ evidenceItems: [] });
    const tangible = analytics.competencyEvidenceProfile.find((metric) => metric.key === 'tangibleImpact');
    const intangible = analytics.competencyEvidenceProfile.find((metric) => metric.key === 'intangibleImpact');
    expect(tangible?.score).toBeNull();
    expect(intangible?.score).toBeNull();
  });
});

describe('buildPersonalReportAnalytics — narrativeIdentitySignals', () => {
  it('every bar is read directly from the F4 base metrics, not recomputed', () => {
    const { analytics, evaluation } = analyticsFor();
    for (const metric of analytics.narrativeIdentitySignals) {
      const key = metric.key as keyof typeof evaluation.narrativeIdentity.base.metrics;
      expect(metric.score).toBe(evaluation.narrativeIdentity.base.metrics[key]);
    }
  });

  it('growth arc is always null — no fake time series without real chronology', () => {
    const { analytics } = analyticsFor();
    const growthArc = analytics.narrativeIdentitySignals.find((metric) => metric.key === 'growthArc');
    expect(growthArc?.score).toBeNull();
  });
});

describe('buildPersonalReportAnalytics — signaturePatternSupport', () => {
  it('always returns all four canonical steps, even when the pattern is unavailable', () => {
    const { analytics } = analyticsFor({ narrativeActivities: [] });
    expect(analytics.signaturePatternSupport.map((step) => step.key)).toEqual([
      'trigger',
      'response',
      'method',
      'valueCreated',
    ]);
    expect(analytics.signaturePatternSupport.every((step) => step.evidenceCount === 0)).toBe(true);
  });

  it('evidenceCount matches the number of activities the section shows as examples for that step', () => {
    const { analytics, report } = analyticsFor();
    for (const step of analytics.signaturePatternSupport) {
      const sectionStep = report.signaturePattern.steps.find((s) => s.key === step.key);
      expect(step.evidenceCount).toBe(sectionStep?.examples.length ?? 0);
    }
  });
});

describe('buildPersonalReportAnalytics — themeMaturity', () => {
  it('uses the exact same themes (and order) the Emerging Themes cards show', () => {
    const { analytics, report } = analyticsFor();
    expect(analytics.themeMaturity.map((t) => t.theme)).toEqual(report.emergingThemes.themes.map((t) => t.theme));
  });

  it('maturityScore is the documented categorical encoding of status, not an independent number', () => {
    const { analytics } = analyticsFor();
    for (const theme of analytics.themeMaturity) {
      if (theme.status === 'established_theme') expect(theme.maturityScore).toBe(100);
      if (theme.status === 'strong_emerging_theme') expect(theme.maturityScore).toBe(75);
      if (theme.status === 'early_signal') expect(theme.maturityScore).toBe(50);
      if (theme.status === 'possible_theme') expect(theme.maturityScore).toBe(25);
    }
  });
});

describe('buildPersonalReportAnalytics — positioningDimensions', () => {
  it('every dimension is not_available with a null score when positioning is insufficient_data', () => {
    const { analytics, report } = analyticsFor({ narrativeActivities: [] });
    expect(report.personalPositioning.available).toBe(false);
    expect(analytics.positioningDimensions.every((dimension) => dimension.status === 'not_available')).toBe(true);
    expect(analytics.positioningDimensions.every((dimension) => dimension.score === null)).toBe(true);
  });

  it('the coherence dimension matches the section card boolean exactly — chart and cards never disagree', () => {
    const { analytics, report } = analyticsFor();
    const coherence = analytics.positioningDimensions.find((d) => d.key === 'coherence');
    expect(coherence?.status === 'strong').toBe(report.personalPositioning.coherent);
  });

  it('a strong dimension scores 100 and a limited one scores 25 — a categorical encoding, not invented precision', () => {
    const { analytics } = analyticsFor();
    for (const dimension of analytics.positioningDimensions) {
      if (dimension.status === 'strong') expect(dimension.score).toBe(100);
      if (dimension.status === 'limited') expect(dimension.score).toBe(25);
    }
  });
});

describe('buildPersonalReportAnalytics — evidenceSummary', () => {
  it('verification counts match the F3 evidence profile exactly', () => {
    const { analytics, evaluation } = analyticsFor();
    expect(analytics.evidenceSummary.verification).toEqual({
      verified: evaluation.evidence.counts.verified,
      attributable: evaluation.evidence.counts.attributable,
      stated: evaluation.evidence.counts.stated,
    });
    expect(analytics.evidenceSummary.totalItems).toBe(evaluation.evidence.items.length);
  });

  it('strength counts sum to the number of activities (one Proof of Me entry per activity)', () => {
    const { analytics } = analyticsFor();
    const { strong, moderate, limited } = analytics.evidenceSummary.strength;
    expect(strong + moderate + limited).toBe(3);
  });

  it('competency claim counts match the F2 category claim counts', () => {
    const { analytics, evaluation } = analyticsFor();
    expect(analytics.evidenceSummary.competencyClaims).toEqual({
      hard: evaluation.competencies.categories.hard.claims.length,
      soft: evaluation.competencies.categories.soft.claims.length,
      meta: evaluation.competencies.categories.meta.claims.length,
    });
  });
});
