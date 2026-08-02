import { describe, expect, it } from 'vitest';
import {
  buildEvidenceProfile,
  parseReach,
  tierFor,
  type EvidenceInput,
} from './evidence';

function input(overrides: Partial<EvidenceInput> = {}): EvidenceInput {
  return {
    id: 'a1',
    kind: 'achievement',
    title: 'Award',
    category: 'academic_award',
    organisation: null,
    competition: null,
    level: null,
    when: null,
    hasDocument: false,
    ...overrides,
  };
}

describe('parseReach', () => {
  it('reads English levels', () => {
    expect(parseReach('International')).toBe('international');
    expect(parseReach('National round')).toBe('national');
    expect(parseReach('Provincial')).toBe('provincial');
    expect(parseReach('District level')).toBe('district');
    expect(parseReach('School')).toBe('school');
  });

  it('reads Vietnamese levels, with and without diacritics', () => {
    expect(parseReach('Quốc tế')).toBe('international');
    expect(parseReach('quoc te')).toBe('international');
    expect(parseReach('Quốc gia')).toBe('national');
    expect(parseReach('Cấp tỉnh')).toBe('provincial');
    expect(parseReach('Cấp huyện')).toBe('district');
    expect(parseReach('Cấp trường')).toBe('school');
  });

  it('returns unknown rather than guessing', () => {
    expect(parseReach(null)).toBe('unknown');
    expect(parseReach('')).toBe('unknown');
    expect(parseReach('Gold')).toBe('unknown');
  });
});

describe('tierFor', () => {
  it('promotes anything with a document to verified', () => {
    expect(tierFor(input({ hasDocument: true }))).toBe('verified');
  });

  it('treats a named body as checkable', () => {
    expect(tierFor(input({ organisation: 'Ministry of Education' }))).toBe('attributable');
    expect(tierFor(input({ competition: 'IMO' }))).toBe('attributable');
  });

  it('falls back to self-reported', () => {
    expect(tierFor(input())).toBe('stated');
    expect(tierFor(input({ organisation: '   ' }))).toBe('stated');
  });
});

describe('buildEvidenceProfile', () => {
  it('ranks tier above reach', () => {
    // The hierarchy the framework is named for: a documented school prize
    // outranks an unverifiable international claim.
    const profile = buildEvidenceProfile([
      input({ id: 'intl', title: 'Intl olympiad', level: 'International' }),
      input({ id: 'school', title: 'School prize', level: 'School', hasDocument: true }),
    ]);
    expect(profile.items[0]?.id).toBe('school');
    expect(profile.items[1]?.id).toBe('intl');
  });

  it('orders by reach within a tier', () => {
    const profile = buildEvidenceProfile([
      input({ id: 'low', level: 'School', hasDocument: true }),
      input({ id: 'high', level: 'National', hasDocument: true }),
    ]);
    expect(profile.items[0]?.id).toBe('high');
  });

  it('counts each tier', () => {
    const profile = buildEvidenceProfile([
      input({ id: '1', hasDocument: true }),
      input({ id: '2', organisation: 'VNU' }),
      input({ id: '3' }),
      input({ id: '4' }),
    ]);
    expect(profile.counts).toEqual({ verified: 1, attributable: 1, stated: 2 });
  });

  it('excludes activities from needsProof, because they cannot take a document', () => {
    const profile = buildEvidenceProfile([
      input({ id: 'act', kind: 'activity', title: 'Club lead' }),
      input({ id: 'ach', kind: 'achievement', title: 'Maths prize' }),
    ]);
    expect(profile.needsProof.map((i) => i.id)).toEqual(['ach']);
  });

  it('reports low confidence when nothing is checkable', () => {
    const profile = buildEvidenceProfile([input({ id: '1' }), input({ id: '2' })]);
    expect(profile.confidence).toBe('low');
  });

  it('reports high confidence when everything is evidenced', () => {
    const profile = buildEvidenceProfile([
      input({ id: '1', hasDocument: true }),
      input({ id: '2', organisation: 'VNU' }),
    ]);
    expect(profile.confidence).toBe('high');
  });

  it('survives an empty profile without dividing by zero', () => {
    const profile = buildEvidenceProfile([]);
    expect(profile.items).toEqual([]);
    expect(profile.confidence).toBe('low');
    expect(profile.strongest).toEqual([]);
  });
});
