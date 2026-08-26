import { describe, expect, it } from 'vitest';
import {
  CRITICAL_ACTION_PENALTY,
  MAX_CRITICAL_PENALTY,
  READINESS_DISCLAIMER,
  canRunFinalCheck,
  computeReadiness,
  orderedReviews,
  readinessState,
  finalCheckGenerationSchema,
  parseFinalCheckRow,
  unsupportedPillars,
  type ComponentKey,
  type ComponentState,
  type ComponentStatus,
  type DocumentReview,
  type NarrativeAudit,
} from './final-check';

function components(map: Partial<Record<ComponentKey, ComponentStatus>>): ComponentState[] {
  return (Object.keys(map) as ComponentKey[]).map((key) => ({
    key,
    status: map[key] as ComponentStatus,
    updatedAt: null,
  }));
}

function review(key: ComponentKey, tier: DocumentReview['tier']): DocumentReview {
  return {
    key,
    purpose: 'purpose',
    evidence: 'evidence',
    strength: 'strength',
    gap: 'gap',
    strategicContribution: 'contribution',
    recommendedAction: 'action',
    tier,
  };
}

const ALL_REVIEWED = components({
  cv: 'reviewed',
  essay: 'reviewed',
  lor: 'reviewed',
  supporting: 'reviewed',
});

describe('computeReadiness', () => {
  it('is 100 when every component is attached and reviewed with nothing critical open', () => {
    expect(computeReadiness(ALL_REVIEWED, []).percent).toBe(100);
    expect(computeReadiness(ALL_REVIEWED, []).state).toBe('strong');
  });

  it('is 0 when nothing is attached', () => {
    const empty = computeReadiness(components({}), []);
    expect(empty.percent).toBe(0);
    expect(empty.state).toBe('not_started');
    expect(empty.missing).toHaveLength(4);
  });

  it('scores an attached but unreviewed document as half credit', () => {
    const drafts = computeReadiness(
      components({ cv: 'draft', essay: 'draft', lor: 'draft', supporting: 'draft' }),
      [],
    );
    expect(drafts.percent).toBe(50);
    expect(drafts.unreviewed).toHaveLength(4);
  });

  it('excludes a not_required component and redistributes its weight', () => {
    // No letter is asked for. The application is complete without one, so it
    // must not be scored as though something were missing.
    const noLetterNeeded = computeReadiness(
      components({ cv: 'reviewed', essay: 'reviewed', lor: 'not_required', supporting: 'reviewed' }),
      [],
    );
    expect(noLetterNeeded.percent).toBe(100);
    expect(noLetterNeeded.excluded).toEqual(['lor']);
    expect(noLetterNeeded.missing).not.toContain('lor');
  });

  it('distinguishes a missing letter from one that is not required', () => {
    const missing = computeReadiness(
      components({ cv: 'reviewed', essay: 'reviewed', lor: 'missing', supporting: 'reviewed' }),
      [],
    );
    expect(missing.percent).toBeLessThan(100);
    expect(missing.missing).toEqual(['lor']);
  });

  it('weights the essay above supporting materials', () => {
    const essayMissing = computeReadiness(
      components({ cv: 'reviewed', essay: 'missing', lor: 'reviewed', supporting: 'reviewed' }),
      [],
    );
    const supportingMissing = computeReadiness(
      components({ cv: 'reviewed', essay: 'reviewed', lor: 'reviewed', supporting: 'missing' }),
      [],
    );
    expect(essayMissing.percent).toBeLessThan(supportingMissing.percent);
  });

  it('deducts for each outstanding critical action', () => {
    const one = computeReadiness(ALL_REVIEWED, [review('cv', 'critical')]);
    expect(one.percent).toBe(100 - CRITICAL_ACTION_PENALTY);
    expect(one.criticalActions).toBe(1);
  });

  it('ignores strategic and polish actions in the score', () => {
    const soft = computeReadiness(ALL_REVIEWED, [
      review('cv', 'strategic'),
      review('essay', 'polish'),
    ]);
    expect(soft.percent).toBe(100);
    expect(soft.criticalActions).toBe(0);
  });

  it('caps the critical penalty so a thorough review cannot bottom out a good application', () => {
    const many = computeReadiness(ALL_REVIEWED, [
      review('cv', 'critical'),
      review('essay', 'critical'),
      review('lor', 'critical'),
      review('supporting', 'critical'),
      review('cv', 'critical'),
      review('essay', 'critical'),
    ]);
    expect(many.percent).toBe(100 - MAX_CRITICAL_PENALTY);
  });

  it('never returns a negative percentage', () => {
    const bad = computeReadiness(components({ cv: 'missing', essay: 'missing' }), [
      review('cv', 'critical'),
      review('essay', 'critical'),
    ]);
    expect(bad.percent).toBeGreaterThanOrEqual(0);
  });
});

describe('readinessState', () => {
  it.each([
    [0, 'not_started'],
    [20, 'early'],
    [50, 'taking_shape'],
    [80, 'nearly_there'],
    [95, 'strong'],
  ] as const)('%s%% is %s', (percent, expected) => {
    expect(readinessState(percent)).toBe(expected);
  });

  it('has no state that reads as advice to submit', () => {
    const labels = [0, 20, 50, 80, 100].map(readinessState);
    for (const label of labels) {
      expect(label).not.toMatch(/submit|send|apply now/i);
    }
  });
});

describe('orderedReviews', () => {
  it('leads with critical findings', () => {
    const ordered = orderedReviews([
      review('supporting', 'polish'),
      review('essay', 'strategic'),
      review('cv', 'critical'),
    ]);
    expect(ordered.map((entry) => entry.tier)).toEqual(['critical', 'strategic', 'polish']);
  });

  it('does not mutate the input', () => {
    const input = [review('supporting', 'polish'), review('cv', 'critical')];
    orderedReviews(input);
    expect(input[0]?.tier).toBe('polish');
  });
});

describe('unsupportedPillars', () => {
  const audit: NarrativeAudit = {
    coreNarrative: 'core',
    whatTheReaderRemembers: 'line',
    pillars: [
      { theme: 'Education access', evidenceStrength: 'strong', consistency: 'strong', coverage: ['cv', 'essay'] },
      { theme: 'Research', evidenceStrength: 'weak', consistency: 'weak', coverage: ['lor'] },
      { theme: 'Innovation', evidenceStrength: 'moderate', consistency: 'moderate', coverage: [] },
    ],
    checks: [],
    overweightedThemes: [],
    unevidencedClaims: [],
  };

  it('flags a theme with no coverage and a theme with weak evidence', () => {
    const flagged = unsupportedPillars(audit).map((pillar) => pillar.theme);
    expect(flagged).toEqual(['Research', 'Innovation']);
  });

  it('leaves a well-evidenced theme alone', () => {
    expect(unsupportedPillars(audit).map((p) => p.theme)).not.toContain('Education access');
  });
});

describe('canRunFinalCheck', () => {
  it('needs at least two real components before it will review anything', () => {
    expect(canRunFinalCheck(components({ cv: 'draft' }))).toBe(false);
    expect(canRunFinalCheck(components({ cv: 'draft', essay: 'reviewed' }))).toBe(true);
  });

  it('does not count missing or not_required components as material to review', () => {
    expect(
      canRunFinalCheck(components({ cv: 'draft', essay: 'missing', lor: 'not_required' })),
    ).toBe(false);
  });
});

describe('wording guarantees', () => {
  it('states that readiness is neither a prediction nor submit advice', () => {
    expect(READINESS_DISCLAIMER).toContain('not a prediction');
    expect(READINESS_DISCLAIMER).toContain('not advice about whether to submit');
    expect(READINESS_DISCLAIMER).not.toMatch(/\b(chance|odds|likelihood|probability)\b/i);
  });
});

describe('parseFinalCheckRow', () => {
  const validRow = {
    id: 'check-1',
    components: [
      { key: 'cv', status: 'reviewed', updatedAt: null },
      { key: 'essay', status: 'reviewed', updatedAt: null },
      { key: 'lor', status: 'reviewed', updatedAt: null },
      { key: 'supporting', status: 'reviewed', updatedAt: null },
    ],
    document_reviews: [review('cv', 'critical')],
    narrative_audit: {
      coreNarrative: 'core',
      whatTheReaderRemembers: 'line',
      pillars: [],
      checks: [],
      overweightedThemes: [],
      unevidencedClaims: [],
    },
    limitations: ['No letter attached'],
    created_at: '2026-08-20T00:00:00.000Z',
    prompt_version: 'final-check-v1',
  };

  it('recomputes readiness rather than trusting a stored figure', () => {
    const parsed = parseFinalCheckRow(validRow);
    // One critical finding against four reviewed components.
    expect(parsed?.readiness.percent).toBe(100 - CRITICAL_ACTION_PENALTY);
  });

  it('degrades a malformed audit to null but keeps the document reviews', () => {
    const parsed = parseFinalCheckRow({ ...validRow, narrative_audit: { nonsense: true } });
    expect(parsed).not.toBeNull();
    expect(parsed?.narrativeAudit).toBeNull();
    expect(parsed?.documentReviews).toHaveLength(1);
  });

  it('returns null when the components or reviews are malformed', () => {
    expect(parseFinalCheckRow({ ...validRow, components: 'nope' })).toBeNull();
    expect(parseFinalCheckRow({ ...validRow, document_reviews: [{ key: 'cv' }] })).toBeNull();
  });

  it('accepts a check with no narrative audit at all', () => {
    const parsed = parseFinalCheckRow({ ...validRow, narrative_audit: null });
    expect(parsed?.narrativeAudit).toBeNull();
  });
});

describe('finalCheckGenerationSchema', () => {
  it('has no readiness field — the model must not author the score', () => {
    const parsed = finalCheckGenerationSchema.safeParse({
      documentReviews: [],
      narrativeAudit: null,
      limitations: [],
      readinessPercent: 84,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && 'readinessPercent' in parsed.data).toBe(false);
  });

  it('rejects an unknown action tier rather than coercing it', () => {
    const parsed = finalCheckGenerationSchema.safeParse({
      documentReviews: [{ ...review('cv', 'critical'), tier: 'urgent' }],
      narrativeAudit: null,
      limitations: [],
    });
    expect(parsed.success).toBe(false);
  });
});
