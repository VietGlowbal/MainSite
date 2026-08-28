import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractReflectionSignalSummaries, isNearVerbatimReflectionSummary } from './reflection-signal-extraction';

afterEach(() => vi.unstubAllGlobals());

describe('reflection signal normalization guard', () => {
  it('rejects a reflection answer copied into a report-facing summary', () => {
    const raw = 'I genuinely enjoy exploring artificial intelligence, especially how machine learning systems learn and make decisions.';
    expect(isNearVerbatimReflectionSummary(raw, raw)).toBe(true);
    expect(isNearVerbatimReflectionSummary('interest in understanding machine-learning systems', raw)).toBe(false);
  });

  it('keeps raw reflection in the extractor only when the model repeats it', async () => {
    const raw = 'I genuinely enjoy exploring artificial intelligence, especially how machine learning systems learn and make decisions.';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ signals: [{ key: 'q1', summary: raw }] }) } }] }),
    }));

    const summaries = await extractReflectionSignalSummaries({
      apiKey: 'test-key',
      model: 'gpt-4o',
      signals: [{ key: 'q1', dimension: 'interests_motivations', value: raw, status: 'isolated' }],
    });

    expect(summaries.get('q1')).toBe('a self-reported interest');
  });
});
