import { describe, expect, it } from 'vitest';
import { runVaguenessGate } from './f6-vagueness';

const SPECIFIC =
  'I want to work on hospital scheduling software. In 2024 I spent two months at Bach Mai Hospital rebuilding their outpatient rota, which cut waiting times by about a fifth.';

const VAGUE_LONG =
  'I am passionate about helping people and making a difference in the world around me, and I believe that studying this subject will let me grow as a person and give back to those who need it most in my community and beyond.';

describe('runVaguenessGate — vague input', () => {
  it('flags a short, generic answer as weak with reasons', () => {
    const report = runVaguenessGate([{ field: 'goals', label: 'Goals', value: 'Be a doctor.' }]);
    expect(report.findings[0]?.severity).toBe('weak');
    expect(report.findings[0]?.reasons).toContain('too_short');
  });

  it('flags a long answer that never lands on anything concrete', () => {
    const report = runVaguenessGate([{ field: 'goals', label: 'Goals', value: VAGUE_LONG }]);
    expect(report.findings[0]?.severity).toBe('weak');
    expect(report.findings[0]?.reasons).toContain('generic_opening');
  });

  it('generates a targeted clarification question rather than fabricating an answer', () => {
    const report = runVaguenessGate([{ field: 'goals', label: 'Goals', value: 'Be a doctor.' }]);
    expect(report.findings[0]?.clarificationPrompt).toBeTruthy();
    expect(report.findings[0]?.clarificationPrompt).toContain('Goals');
    // The prompt asks a question; it must never contain a fabricated answer
    // on the student's behalf.
    expect(report.findings[0]?.clarificationPrompt).toMatch(/\?/);
  });

  it('does not penalise a stock opening on an otherwise substantial answer', () => {
    const value = `I have always wanted to work in public health. ${SPECIFIC}`;
    const report = runVaguenessGate([{ field: 'goals', label: 'Goals', value }]);
    expect(report.findings[0]?.reasons).toContain('generic_opening');
    expect(report.findings[0]?.severity).toBe('ok');
    expect(report.findings[0]?.clarificationPrompt).toBeNull();
  });
});

describe('runVaguenessGate — missing input', () => {
  it('marks an empty field as empty, not weak', () => {
    const report = runVaguenessGate([{ field: 'goals', label: 'Goals', value: '' }]);
    expect(report.findings[0]?.severity).toBe('empty');
    expect(report.findings[0]?.reasons).toEqual(['missing']);
  });

  it('marks a null/undefined value the same as empty', () => {
    const report = runVaguenessGate([
      { field: 'a', label: 'A', value: null },
      { field: 'b', label: 'B', value: undefined },
    ]);
    expect(report.findings.every((finding) => finding.severity === 'empty')).toBe(true);
  });

  it('generates a "you have not answered yet" clarification for a missing field, never a fabricated answer', () => {
    const report = runVaguenessGate([{ field: 'goals', label: 'Career goals', value: '' }]);
    expect(report.findings[0]?.clarificationPrompt).toContain("haven't answered");
  });

  it('returns insufficient when nothing at all is usable', () => {
    const report = runVaguenessGate([
      { field: 'a', label: 'A', value: '' },
      { field: 'b', label: 'B', value: 'No.' },
    ]);
    expect(report.verdict).toBe('insufficient');
    expect(report.confidence).toBe('low');
  });
});

describe('runVaguenessGate — confidence behaviour', () => {
  it('reports high confidence when every field lands', () => {
    const report = runVaguenessGate([
      { field: 'a', label: 'A', value: SPECIFIC },
      { field: 'b', label: 'B', value: SPECIFIC },
    ]);
    expect(report.confidence).toBe('high');
  });

  it('reports thin verdict when fewer than half the fields are usable', () => {
    const report = runVaguenessGate([
      { field: 'a', label: 'A', value: SPECIFIC },
      { field: 'b', label: 'B', value: '' },
      { field: 'c', label: 'C', value: '' },
    ]);
    expect(report.verdict).toBe('thin');
  });

  it('lists only the usable field ids', () => {
    const report = runVaguenessGate([
      { field: 'a', label: 'A', value: SPECIFIC },
      { field: 'b', label: 'B', value: '' },
    ]);
    expect(report.usableFields).toEqual(['a']);
  });

  it('credits substantial prose without digits as specific', () => {
    const value =
      'My interest grew out of two years running the peer tutoring scheme at my school, where I worked with students who had fallen behind in maths after long absences. Explaining the same idea five different ways taught me more about how people learn than any class I have taken.';
    const report = runVaguenessGate([{ field: 'goals', label: 'Goals', value }]);
    expect(report.findings[0]?.severity).toBe('ok');
  });
});
