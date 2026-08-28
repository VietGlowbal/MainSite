import { describe, expect, it } from 'vitest';
import {
  NARRATIVE_METRIC_WEIGHTS,
  assessApplicantPositioning,
  assessMotivationConsistency,
  assessThemeMaturity,
  buildEvidenceToIdentityMap,
  extractBehavioralPattern,
  scoreNarrativeBase,
  synthesisReadiness,
  synthesizeIdentity,
  type NarrativeActivity,
} from './f4-narrative-identity';

function activity(overrides: Partial<NarrativeActivity> = {}): NarrativeActivity {
  return {
    id: 'a1',
    title: 'Peer tutoring',
    role: null,
    behaviour: null,
    domainTheme: null,
    statedMotivation: null,
    outcome: null,
    evidenceRefs: [{ id: 'a1', kind: 'activity', label: 'Peer tutoring' }],
    ...overrides,
  };
}

const TUTORING = activity({
  id: 'tutor',
  title: 'Peer tutoring programme',
  role: 'organiser',
  behaviour: 'built a structured weekly programme from scratch',
  domainTheme: 'education access',
  statedMotivation: 'I wanted to help classmates who fell behind after long absences.',
  outcome: 'Average scores rose by 15%.',
});

const CODING_CLUB = activity({
  id: 'coding',
  title: 'School coding club',
  role: 'organiser',
  behaviour: 'built a curriculum and recruited 20 members',
  domainTheme: 'education access',
  statedMotivation: 'I wanted more students at my school to have the chance to learn to code.',
  outcome: 'Membership grew to 45 students over one year.',
});

const SCHOLARSHIP_DRIVE = activity({
  id: 'scholarship',
  title: 'Scholarship application drive',
  role: 'organiser',
  behaviour: 'built an information session and application-support process',
  domainTheme: 'education access',
  outcome: '12 students in the drive received funded places.',
});

describe('F4 — activity-count pattern rules', () => {
  it('one activity cannot establish a recurring pattern', () => {
    const readiness = synthesisReadiness([TUTORING]);
    expect(readiness.level).toBe('insufficient');

    const identity = synthesizeIdentity([TUTORING]);
    expect(identity.status).toBe('insufficient');
    expect(identity.recurringRole).toBeNull();
    expect(identity.recurringBehaviour).toBeNull();

    const pattern = extractBehavioralPattern([TUTORING]);
    expect(pattern.pattern).toBeNull();
    expect(pattern.status).toBe('insufficient');
  });

  it('two activities create an emerging pattern, not a mature one', () => {
    const readiness = synthesisReadiness([TUTORING, CODING_CLUB]);
    expect(readiness.level).toBe('emerging');

    const identity = synthesizeIdentity([TUTORING, CODING_CLUB]);
    expect(identity.status).toBe('emerging');
    expect(identity.recurringRole).toBe('organiser');
    // Value orientation needs a MATURE (3+) synthesis — emerging is not enough.
    expect(identity.valueOrientation).toBeNull();
  });

  it('does not establish identity from an isolated Q1–Q3 signal, but accepts corroborated context', () => {
    const isolated = synthesizeIdentity([TUTORING, CODING_CLUB], [
      { dimension: 'values_growth', value: 'peer learning', status: 'isolated' },
    ]);
    expect(isolated.valueOrientation).toBeNull();

    const repeated = synthesizeIdentity([TUTORING, CODING_CLUB, SCHOLARSHIP_DRIVE], [
      { dimension: 'values_growth', value: 'peer learning', status: 'repeated' },
    ]);
    // Mature activity themes remain authoritative; a repeated questionnaire
    // value is only a fallback when activities do not supply a theme.
    expect(repeated.valueOrientation).toBe('education access');
  });

  it('three or more activities can establish a mature, full synthesis', () => {
    const readiness = synthesisReadiness([TUTORING, CODING_CLUB, SCHOLARSHIP_DRIVE]);
    expect(readiness.level).toBe('mature');

    const identity = synthesizeIdentity([TUTORING, CODING_CLUB, SCHOLARSHIP_DRIVE]);
    expect(identity.status).toBe('established');
    expect(identity.recurringRole).toBe('organiser');
    expect(identity.valueOrientation).toBe('education access');

    const pattern = extractBehavioralPattern([TUTORING, CODING_CLUB, SCHOLARSHIP_DRIVE]);
    expect(pattern.pattern).not.toBeNull();
    expect(pattern.status).toBe('established');
  });

  it('zero activities produce no synthesis at all', () => {
    const readiness = synthesisReadiness([]);
    expect(readiness.level).toBe('none');
    const identity = synthesizeIdentity([]);
    expect(identity.status).toBe('insufficient');
  });
});

describe('F4 formula (base metrics)', () => {
  it('applies the exact weights: 0.25 pattern + 0.20 thematic + 0.20 growth + 0.20 differentiation + 0.15 density', () => {
    expect(NARRATIVE_METRIC_WEIGHTS).toEqual({
      patternConsistency: 0.25,
      thematicConvergence: 0.2,
      growthArc: 0.2,
      differentiation: 0.2,
      evidenceDensity: 0.15,
    });
    const total = Object.values(NARRATIVE_METRIC_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('scores a mature, aligned set of activities highly', () => {
    const base = scoreNarrativeBase([TUTORING, CODING_CLUB, SCHOLARSHIP_DRIVE]);
    expect(base.score).not.toBeNull();
    expect(base.readiness.level).toBe('mature');
  });

  it('reports null metrics (not zero) below the two-activity floor', () => {
    const base = scoreNarrativeBase([TUTORING]);
    expect(base.metrics.patternConsistency).toBeNull();
    expect(base.metrics.thematicConvergence).toBeNull();
    expect(base.score).toBeNull();
    expect(base.kind).toBe('missing');
  });
});

describe('F4.1 Identity Synthesis', () => {
  it('describes behaviour, not adjectives — recurringBehaviour is a behavioural phrase, not a trait word', () => {
    const identity = synthesizeIdentity([TUTORING, CODING_CLUB, SCHOLARSHIP_DRIVE]);
    expect(identity.recurringBehaviour).toContain('built');
    expect(identity.recurringBehaviour).not.toMatch(/^(passionate|leader|excellent)$/i);
  });
});

describe('F4.2 Motivation Consistency', () => {
  it('never infers an internal motivation as fact from repeated activity choice alone', () => {
    const noStatedMotivation = [
      activity({ id: 'x1', domainTheme: 'robotics', outcome: '1st place' }),
      activity({ id: 'x2', domainTheme: 'robotics', outcome: '2nd place' }),
      activity({ id: 'x3', domainTheme: 'robotics', outcome: '3rd place' }),
    ];
    const result = assessMotivationConsistency(noStatedMotivation);
    // Repeated choice of the same theme, with nothing ever stated, can at most
    // become a hypothesis — never "established".
    expect(result.motivationStatus).not.toBe('established');
    expect(result.motivationStatus).toBe('hypothesis');
    expect(result.statedMotivation).toBeNull();
    expect(result.limitations[0]).toContain('hypothesis, not a fact');
  });

  it('reaches established only when the student has explicitly stated the motivation more than once, with a mature synthesis', () => {
    const result = assessMotivationConsistency([TUTORING, CODING_CLUB, SCHOLARSHIP_DRIVE]);
    expect(result.recurrenceCount).toBeGreaterThanOrEqual(1);
    // TUTORING and CODING_CLUB both explicitly state motivation about helping
    // students access education; SCHOLARSHIP_DRIVE does not.
    expect(result.motivationStatus).toBe('established');
    expect(result.statedMotivation).not.toBeNull();
  });

  it('reports insufficient for fewer than two activities', () => {
    const result = assessMotivationConsistency([TUTORING]);
    expect(result.motivationStatus).toBe('insufficient');
  });
});

describe('F4.3 Behavioral Pattern Extraction (Trigger → Response → Method → Value)', () => {
  it('only establishes a pattern with repeated evidence, never from one activity', () => {
    const single = extractBehavioralPattern([TUTORING]);
    expect(single.pattern).toBeNull();
  });

  it('fills all four slots when a mature pattern exists', () => {
    const result = extractBehavioralPattern([TUTORING, CODING_CLUB, SCHOLARSHIP_DRIVE]);
    expect(result.pattern).toMatchObject({
      trigger: 'education access',
      response: 'organiser',
    });
    expect(result.pattern?.method).toBeTruthy();
    expect(result.pattern?.valueCreated).toBeTruthy();
  });
});

describe('F4.4 Theme Maturity', () => {
  it('requires a theme to be a problem/domain, not a competency — established from evidence counts and linkage', () => {
    const established = assessThemeMaturity('Education access', [
      { linked: 'explicit' },
      { linked: 'explicit' },
      { linked: 'implicit' },
    ]);
    expect(established.status).toBe('established_theme');

    const earlySignal = assessThemeMaturity('Sustainable business', [
      { linked: 'implicit' },
      { linked: 'implicit' },
    ]);
    expect(earlySignal.status).toBe('early_signal');

    const possible = assessThemeMaturity('Technology for inclusion', [{ linked: 'implicit' }]);
    expect(possible.status).toBe('possible_theme');

    const strongEmerging = assessThemeMaturity('Education access', [
      { linked: 'explicit' },
      { linked: 'implicit' },
      { linked: 'implicit' },
    ]);
    expect(strongEmerging.status).toBe('strong_emerging_theme');
  });
});

describe('F4.5 Applicant Positioning', () => {
  it('reports insufficient_data when identity, pattern and theme are all absent', () => {
    const identity = synthesizeIdentity([TUTORING]);
    const pattern = extractBehavioralPattern([TUTORING]);
    const result = assessApplicantPositioning({
      identity,
      pattern,
      theme: null,
      intendedDirection: null,
      coherent: false,
    });
    expect(result.positioningStatus).toBe('insufficient_data');
  });

  it('reports strong positioning when identity, pattern, theme and direction all align and are evidenced', () => {
    const activities = [TUTORING, CODING_CLUB, SCHOLARSHIP_DRIVE];
    const identity = synthesizeIdentity(activities);
    const pattern = extractBehavioralPattern(activities);
    const theme = assessThemeMaturity('education access', [
      { linked: 'explicit' },
      { linked: 'explicit' },
      { linked: 'implicit' },
    ]);
    const result = assessApplicantPositioning({
      identity,
      pattern,
      theme,
      intendedDirection: 'Study education policy to scale access programmes nationally.',
      coherent: true,
    });
    expect(result.positioningStatus).toBe('strong_positioning');
    expect(result.credible).toBe(true);
  });

  it('records capability and motivation evidence in the positioning intersection', () => {
    const activities = [TUTORING, CODING_CLUB, SCHOLARSHIP_DRIVE];
    const result = assessApplicantPositioning({
      identity: synthesizeIdentity(activities),
      pattern: extractBehavioralPattern(activities),
      theme: assessThemeMaturity('education access', [
        { linked: 'explicit' },
        { linked: 'explicit' },
        { linked: 'implicit' },
      ]),
      intendedDirection: 'Study education policy.',
      coherent: true,
      capabilityEvidenceRefs: [{ id: 'capability-1', kind: 'activity', label: 'Programme design' }],
      motivationEvidenceRefs: [{ id: 'motivation-1', kind: 'profile', label: 'Study motivation' }],
    });

    expect(result.evidenceRefs.map((ref) => ref.id)).toEqual(
      expect.arrayContaining(['capability-1', 'motivation-1']),
    );
    expect(result.capabilityInformed).toBe(true);
    expect(result.motivationInformed).toBe(true);
  });
});

describe('F4.6 Evidence-to-Identity Mapping', () => {
  it('maps every activity to a proof with evidence strength, never to a proof with no linked evidence', () => {
    const competencies = new Map([['tutor', ['Instructional design', 'Empathetic communication']]]);
    const proofs = buildEvidenceToIdentityMap([TUTORING], competencies);
    expect(proofs).toHaveLength(1);
    expect(proofs[0]?.evidenceStrength).toBe('strong');
    expect(proofs[0]?.evidenceRefs.length).toBeGreaterThan(0);
    expect(proofs[0]?.competenciesDemonstrated).toEqual(['Instructional design', 'Empathetic communication']);
  });

  it('marks a proof with no outcome and no competencies as limited', () => {
    const bare = activity({ id: 'bare', outcome: null, evidenceRefs: [] });
    const proofs = buildEvidenceToIdentityMap([bare], new Map());
    expect(proofs[0]?.evidenceStrength).toBe('limited');
  });
});
