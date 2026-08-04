import { describe, expect, it } from 'vitest';
import { runVaguenessGate, type VaguenessField } from './vagueness';

const SPECIFIC =
  'I want to work on hospital scheduling software. In 2024 I spent two months at Bach Mai Hospital rebuilding their outpatient rota, which cut waiting times by about a fifth.';

const VAGUE_LONG =
  'I am passionate about helping people and making a difference in the world around me, and I believe that studying this subject will let me grow as a person and give back to those who need it most in my community and beyond.';

function fields(overrides: Partial<Record<string, string | null>> = {}): VaguenessField[] {
  return [
    { field: 'careerGoals', label: 'Career goals', value: SPECIFIC, ...{} },
    { field: 'motivations', label: 'Motivations', value: SPECIFIC },
  ].map((f) => (f.field in overrides ? { ...f, value: overrides[f.field] ?? null } : f));
}

describe('runVaguenessGate', () => {
  it('passes a concrete answer', () => {
    const report = runVaguenessGate([
      { field: 'careerGoals', label: 'Career goals', value: SPECIFIC },
    ]);
    expect(report.findings[0]?.severity).toBe('ok');
    expect(report.findings[0]?.reasons).toEqual([]);
    expect(report.verdict).toBe('sufficient');
  });

  it('marks an empty field as empty, not weak', () => {
    // A question not reached is a prompt to continue; a bad answer is a prompt
    // to revise. The report says different things for each.
    const report = runVaguenessGate([{ field: 'goals', label: 'Goals', value: '' }]);
    expect(report.findings[0]?.severity).toBe('empty');
    expect(report.findings[0]?.reasons).toEqual(['missing']);
  });

  it('flags a short answer', () => {
    const report = runVaguenessGate([{ field: 'goals', label: 'Goals', value: 'Be a doctor.' }]);
    expect(report.findings[0]?.severity).toBe('weak');
    expect(report.findings[0]?.reasons).toContain('too_short');
  });

  it('does not penalise a stock opening on an otherwise real answer', () => {
    const value = `I have always wanted to work in public health. ${SPECIFIC}`;
    const report = runVaguenessGate([{ field: 'goals', label: 'Goals', value }]);
    expect(report.findings[0]?.reasons).toContain('generic_opening');
    // Style note only — the answer still counts as usable.
    expect(report.findings[0]?.severity).toBe('ok');
  });

  it('flags a long answer that says nothing', () => {
    const report = runVaguenessGate([{ field: 'goals', label: 'Goals', value: VAGUE_LONG }]);
    expect(report.findings[0]?.severity).toBe('weak');
    expect(report.findings[0]?.reasons).toContain('generic_opening');
  });

  it('credits substantial prose without digits as specific', () => {
    // The failure mode that would make students distrust the report: a
    // considered paragraph marked empty because it contains no numbers.
    const value =
      'My interest grew out of two years running the peer tutoring scheme at my school, where I worked with students who had fallen behind in maths after long absences. Explaining the same idea five different ways taught me more about how people learn than any class I have taken, and it is why I want to study education alongside statistics rather than either on its own.';
    const report = runVaguenessGate([{ field: 'goals', label: 'Goals', value }]);
    expect(report.findings[0]?.reasons).not.toContain('no_specifics');
    expect(report.findings[0]?.severity).toBe('ok');
  });

  it('lists only usable fields', () => {
    const report = runVaguenessGate([
      { field: 'a', label: 'A', value: SPECIFIC },
      { field: 'b', label: 'B', value: '' },
    ]);
    expect(report.usableFields).toEqual(['a']);
  });

  it('returns insufficient when nothing is usable', () => {
    const report = runVaguenessGate([
      { field: 'a', label: 'A', value: '' },
      { field: 'b', label: 'B', value: 'No.' },
    ]);
    expect(report.verdict).toBe('insufficient');
    expect(report.confidence).toBe('low');
  });

  it('returns thin when fewer than half the fields land', () => {
    const report = runVaguenessGate([
      { field: 'a', label: 'A', value: SPECIFIC },
      { field: 'b', label: 'B', value: '' },
      { field: 'c', label: 'C', value: '' },
    ]);
    expect(report.verdict).toBe('thin');
  });

  it('reports high confidence when every field lands', () => {
    expect(runVaguenessGate(fields()).confidence).toBe('high');
  });
});
