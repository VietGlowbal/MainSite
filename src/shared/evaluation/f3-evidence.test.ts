import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_METRIC_WEIGHTS,
  buildEvidenceProfile,
  parseReach,
  scoreEvidenceItem,
  tierFor,
  type EvidenceItemInput,
} from './f3-evidence';

function input(overrides: Partial<EvidenceItemInput> = {}): EvidenceItemInput {
  return {
    id: 'e1',
    title: 'National maths olympiad',
    sourceKind: 'applicant_statement',
    quantifiedOutcome: null,
    qualitativeOutcome: null,
    hasDocument: false,
    attributingOrganisation: null,
    level: null,
    ...overrides,
  };
}

describe('F3 formula', () => {
  it('applies the exact weights: 0.40 tangible + 0.30 intangible + 0.30 traceability', () => {
    expect(EVIDENCE_METRIC_WEIGHTS).toEqual({
      tangibleImpact: 0.4,
      intangibleImpact: 0.3,
      traceability: 0.3,
    });
    const total = Object.values(EVIDENCE_METRIC_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('scores a fully-documented, quantified item highest', () => {
    const item = scoreEvidenceItem(
      input({
        hasDocument: true,
        quantifiedOutcome: 'Raised $3,000 for the shelter.',
        qualitativeOutcome: 'Learned to manage a team under a tight deadline.',
      }),
    );
    expect(item.score).not.toBeNull();
    expect(item.metrics.tangibleImpact).not.toBeNull();
    expect(item.metrics.intangibleImpact).not.toBeNull();
    expect(item.metrics.traceability).toBe(100);
  });
});

describe('F3 — quality (A) vs verification status (B) are separate outputs', () => {
  it('scores a claim as high-quality but unverifiable when the outcome is strong but nothing backs it', () => {
    const item = scoreEvidenceItem(
      input({
        quantifiedOutcome: 'Placed 1st out of 5,000 competitors nationally.',
        hasDocument: false,
        attributingOrganisation: null,
      }),
    );
    expect(item.tier).toBe('stated');
    expect(item.metrics.tangibleImpact).toBeGreaterThan(50);
  });

  it('scores a claim as verified but low-quality when a document exists but no outcome was described', () => {
    const item = scoreEvidenceItem(input({ hasDocument: true }));
    expect(item.tier).toBe('verified');
    expect(item.metrics.tangibleImpact).toBeNull();
    expect(item.metrics.intangibleImpact).toBeNull();
    // Traceability alone still produces a score — it is always assessable.
    expect(item.score).not.toBeNull();
  });
});

describe('F3 — verification tiers', () => {
  it('promotes anything with a document to verified', () => {
    expect(tierFor(input({ hasDocument: true }))).toBe('verified');
  });

  it('treats a named external body as checkable without a document', () => {
    expect(tierFor(input({ attributingOrganisation: 'Ministry of Education' }))).toBe('attributable');
  });

  it('falls back to self-reported with nothing else', () => {
    expect(tierFor(input())).toBe('stated');
  });

  it('reads reach bands in English and Vietnamese', () => {
    expect(parseReach('International')).toBe('international');
    expect(parseReach('Quốc gia')).toBe('national');
    expect(parseReach(null)).toBe('unknown');
  });
});

describe('F3 — missing metric handling', () => {
  it('reports unassessed, not zero, when nothing was described at all', () => {
    const item = scoreEvidenceItem(input());
    // traceability is always assessable, so this item still gets *a* score —
    // but the outcome metrics correctly stay null rather than becoming 0.
    expect(item.metrics.tangibleImpact).toBeNull();
    expect(item.metrics.intangibleImpact).toBeNull();
    expect(item.missingInputs).toEqual(
      expect.arrayContaining(['outcome.tangibleImpact', 'outcome.intangibleImpact']),
    );
  });
});

describe('buildEvidenceProfile', () => {
  it('ranks tier above reach — a documented school prize outranks an unverifiable international claim', () => {
    const profile = buildEvidenceProfile([
      input({ id: 'intl', title: 'Intl olympiad', level: 'International' }),
      input({ id: 'school', title: 'School prize', level: 'School', hasDocument: true }),
    ]);
    expect(profile.items[0]?.id).toBe('f3:school');
    expect(profile.items[1]?.id).toBe('f3:intl');
  });

  it('excludes nothing from needsProof by kind — F3 unifies achievements, activities and any source kind alike', () => {
    const profile = buildEvidenceProfile([
      input({ id: 'a', sourceKind: 'applicant_statement' }),
      input({ id: 'b', sourceKind: 'structured_achievement', hasDocument: true }),
    ]);
    expect(profile.needsProof.map((item) => item.itemId)).toEqual(['a']);
  });

  it('reports low confidence when nothing is checkable', () => {
    const profile = buildEvidenceProfile([input({ id: '1' }), input({ id: '2' })]);
    expect(profile.confidence).toBe('low');
  });

  it('reports high confidence when everything is verified or attributable', () => {
    const profile = buildEvidenceProfile([
      input({ id: '1', hasDocument: true }),
      input({ id: '2', attributingOrganisation: 'VNU' }),
    ]);
    expect(profile.confidence).toBe('high');
  });

  it('survives an empty profile', () => {
    const profile = buildEvidenceProfile([]);
    expect(profile.items).toEqual([]);
    expect(profile.confidence).toBe('low');
  });
});
