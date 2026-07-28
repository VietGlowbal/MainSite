import { describe, expect, it } from 'vitest';
import {
  STAGE_TEMPLATE,
  confidenceToNumber,
  groupTasksByStage,
  type ExtractedTask,
} from './extract-course';

function task(partial: Partial<ExtractedTask> & Pick<ExtractedTask, 'stage' | 'title'>): ExtractedTask {
  return {
    description: null,
    priority: 'medium',
    taskType: 'general',
    sourceUrl: null,
    confidence: 'medium',
    ...partial,
  };
}

describe('stage template', () => {
  it('is the five stages the workspace stepper draws', () => {
    expect(STAGE_TEMPLATE.map((s) => s.name)).toEqual([
      'Research',
      'Check eligibility',
      'Prepare documents',
      'Improve application',
      'Submit',
    ]);
  });

  it('has unique slugs, which the stage upsert keys on', () => {
    const slugs = STAGE_TEMPLATE.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('groupTasksByStage', () => {
  it('always returns all five stages, in template order', () => {
    const grouped = groupTasksByStage([]);
    expect(grouped).toHaveLength(5);
    expect(grouped.map((g) => g.stage.key)).toEqual(STAGE_TEMPLATE.map((s) => s.key));
  });

  it('keeps empty stages rather than dropping them', () => {
    // A stage with nothing in it is information — "we found nothing to do here
    // yet" — and the stepper needs a stable five-step spine regardless.
    const grouped = groupTasksByStage([task({ stage: 'submit', title: 'Pay the fee' })]);
    expect(grouped).toHaveLength(5);
    expect(grouped.filter((g) => g.tasks.length === 0)).toHaveLength(4);
  });

  it('buckets each task into its own stage', () => {
    const grouped = groupTasksByStage([
      task({ stage: 'research', title: 'Read the course page' }),
      task({ stage: 'documents', title: 'Request two references' }),
      task({ stage: 'documents', title: 'Draft your statement' }),
    ]);

    const byKey = Object.fromEntries(grouped.map((g) => [g.stage.key, g.tasks.length]));
    expect(byKey).toEqual({ research: 1, eligibility: 0, documents: 2, improve: 0, submit: 0 });
  });

  it('preserves the order tasks arrived in, which becomes sort_order', () => {
    const grouped = groupTasksByStage([
      task({ stage: 'documents', title: 'First' }),
      task({ stage: 'research', title: 'Unrelated' }),
      task({ stage: 'documents', title: 'Second' }),
    ]);

    const documents = grouped.find((g) => g.stage.key === 'documents');
    expect(documents?.tasks.map((t) => t.title)).toEqual(['First', 'Second']);
  });

  it('loses nothing', () => {
    const tasks = STAGE_TEMPLATE.flatMap((s) => [
      task({ stage: s.key, title: `${s.key} a` }),
      task({ stage: s.key, title: `${s.key} b` }),
    ]);
    const total = groupTasksByStage(tasks).reduce((sum, g) => sum + g.tasks.length, 0);
    expect(total).toBe(tasks.length);
  });
});

describe('confidenceToNumber', () => {
  it('maps the model’s words onto the numeric column', () => {
    expect(confidenceToNumber('high')).toBe(0.9);
    expect(confidenceToNumber('medium')).toBe(0.7);
    expect(confidenceToNumber('low')).toBe(0.5);
  });

  it('stays inside the range a NUMERIC confidence column expects', () => {
    for (const c of ['high', 'medium', 'low'] as const) {
      expect(confidenceToNumber(c)).toBeGreaterThan(0);
      expect(confidenceToNumber(c)).toBeLessThanOrEqual(1);
    }
  });
});
