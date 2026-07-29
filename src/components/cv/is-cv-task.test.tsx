import { describe, expect, it } from 'vitest';
import { isCvTask } from './is-cv-task';

describe('isCvTask', () => {
  it.each([
    ['Review your CV', undefined],
    ['Upload résumé', 'Get AI feedback'],
    ['Improve application document', 'Polish your curriculum vitae'],
  ])('recognises CV work: %s', (title, description) => {
    expect(isCvTask({ title, description })).toBe(true);
  });

  it('does not claim unrelated document tasks', () => {
    expect(isCvTask({ title: 'Upload transcript', description: 'Academic records' })).toBe(false);
  });
});
