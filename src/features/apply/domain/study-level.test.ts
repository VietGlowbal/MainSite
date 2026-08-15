import { describe, expect, it } from 'vitest';
import { studyLevelFromStored, studyLevelLabel } from './study-level';

describe('studyLevelFromStored', () => {
  it('recognises the onboarding wizard’s canonical tokens', () => {
    expect(studyLevelFromStored('undergraduate')).toBe('undergraduate');
    expect(studyLevelFromStored('postgraduate')).toBe('postgraduate');
    expect(studyLevelFromStored('phd')).toBe('phd');
  });

  it('recognises the older reflection form’s display-string values (the exact bug named in the spec)', () => {
    // A student who only completed onboarding never wrote one of these
    // strings — this is the READ side recognising values the OLD reflection
    // form wrote before it was retired, so historical rows still resolve.
    expect(studyLevelFromStored('Bachelor’s Degree')).toBe('undergraduate');
    expect(studyLevelFromStored('Master or Post-Graduate Certificate')).toBe('postgraduate');
    expect(studyLevelFromStored('College Diploma / Certificate')).toBe('diploma');
  });

  it('never confuses "undergraduate" (onboarding) with "Bachelor’s Degree" (old reflection form) as two different facts', () => {
    // Both resolve to the same canonical token — the whole point of the fix.
    expect(studyLevelFromStored('undergraduate')).toBe(studyLevelFromStored('Bachelor’s Degree'));
  });

  it('returns undefined for null, empty, and genuinely unrecognised values rather than guessing', () => {
    expect(studyLevelFromStored(null)).toBeUndefined();
    expect(studyLevelFromStored(undefined)).toBeUndefined();
    expect(studyLevelFromStored('')).toBeUndefined();
    expect(studyLevelFromStored('some future value nobody wrote yet')).toBeUndefined();
  });

  it('every canonical level has a label', () => {
    expect(studyLevelLabel('undergraduate')).toBeTruthy();
    expect(studyLevelLabel('postgraduate')).toBeTruthy();
    expect(studyLevelLabel('phd')).toBeTruthy();
    expect(studyLevelLabel('diploma')).toBeTruthy();
  });
});
