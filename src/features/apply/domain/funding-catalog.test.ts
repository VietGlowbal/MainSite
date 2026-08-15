import { describe, expect, it } from 'vitest';
import {
  FUNDING_SOURCE_CATALOG,
  FUNDING_SOURCE_IDS,
  fundingSource,
  fundingSourceFromStored,
  fundingSourceLabel,
} from './funding-catalog';

describe('the catalogue', () => {
  it('gives every option an id, a label, a description and an icon', () => {
    for (const source of FUNDING_SOURCE_CATALOG) {
      expect(source.id, source.label).toMatch(/^[a-z_]+$/);
      expect(source.label.length, source.id).toBeGreaterThan(0);
      // The gloss is the point of the redesign — "Scholarship" alone leaves a
      // student guessing whether an intention counts or only a confirmed award.
      expect(source.description.length, source.id).toBeGreaterThan(0);
      expect(source.icon.length, source.id).toBeGreaterThan(0);
    }
  });

  it('has no duplicate ids', () => {
    expect(new Set(FUNDING_SOURCE_IDS).size).toBe(FUNDING_SOURCE_IDS.length);
  });

  it('resolves an id to its option', () => {
    expect(fundingSource('scholarship').label).toBe('Scholarship');
    expect(fundingSourceLabel('student_loan')).toBe('Student loan');
  });
});

describe('fundingSourceFromStored', () => {
  it('reads an id straight back', () => {
    expect(fundingSourceFromStored('employer_or_sponsor')).toBe('employer_or_sponsor');
  });

  it('reads the display strings the previous form stored', () => {
    // The whole reason this function exists: the column holds prose for every
    // student who answered before the ids landed, and rejecting it would read
    // as having lost their answer.
    expect(fundingSourceFromStored('Personal savings or parents')).toBe(
      'personal_savings_or_parents',
    );
    expect(fundingSourceFromStored('Not decided yet')).toBe('not_decided_yet');
  });

  it('tolerates case, padding and odd whitespace in a stored label', () => {
    expect(fundingSourceFromStored('  student   LOAN  ')).toBe('student_loan');
  });

  it('treats an unknown or empty value as unanswered', () => {
    expect(fundingSourceFromStored('Crowdfunding')).toBeUndefined();
    expect(fundingSourceFromStored('')).toBeUndefined();
    expect(fundingSourceFromStored('   ')).toBeUndefined();
    expect(fundingSourceFromStored(null)).toBeUndefined();
    expect(fundingSourceFromStored(undefined)).toBeUndefined();
  });
});
