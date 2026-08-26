import { describe, expect, it } from 'vitest';
import { isCompleteContentValue, isContentValueCompatible } from './recommendation';

describe('canonical content compatibility', () => {
  it('preserves valid values for wording-only schema changes', () => {
    const previous = { type: 'long_text' as const, prompt: 'Explain your motivation' };
    const next = { type: 'long_text' as const, prompt: 'Explain your academic motivation' };
    const value = { type: 'long_text' as const, text: 'A grounded answer' };
    expect(isContentValueCompatible(next, value)).toBe(true);
    expect(isCompleteContentValue(next, value)).toBe(true);
    expect(previous.type).toBe(next.type);
  });

  it('rejects a removed single-select option and checklist item', () => {
    expect(isContentValueCompatible({ type: 'single_select', prompt: 'Focus', semanticKey: 'focus', options: [{ value: 'essay', label: 'Essay' }] }, { type: 'single_select', value: 'portfolio' })).toBe(false);
    expect(isContentValueCompatible({ type: 'checklist', items: ['Transcript'] }, { type: 'checklist', checkedItems: ['Transcript', 'CV'] })).toBe(false);
  });

  it('rejects unknown structured-table columns without rejecting partial rows', () => {
    const schema = { type: 'structured_table' as const, columns: [{ key: 'school', label: 'School', type: 'text' as const }] };
    expect(isContentValueCompatible(schema, { type: 'structured_table', rows: [{ school: 'Uni' }] })).toBe(true);
    expect(isContentValueCompatible(schema, { type: 'structured_table', rows: [{ wrong: 'value' }] })).toBe(false);
  });
});
