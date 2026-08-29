import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractReflectionFindings, extractReflectionSignalSummaries, isNearVerbatimReflectionSummary } from './reflection-signal-extraction';

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

    expect(summaries.get('q1')).toBeUndefined();
  });

  it('returns structured explicit meaning without replacing the raw evidence signal', async () => {
    const raw = 'I enjoy exploring artificial intelligence and learning why digital tools can help people.';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ signals: [{
        key: 'q1',
        summary: 'interest in accessible artificial intelligence',
        q1: {
          interests: ['artificial intelligence'],
          intellectualCuriosity: ['how systems make decisions'],
          problemInterests: ['access to useful technology'],
          themeCandidates: ['accessible technology'],
        },
      }] }) } }] }),
    }));

    const findings = await extractReflectionFindings({
      apiKey: 'test-key',
      model: 'gpt-4o',
      signals: [{ key: 'q1', dimension: 'interests_motivations', value: raw, status: 'isolated' }],
    });

    expect(findings.get('q1')).toMatchObject({
      key: 'q1',
      summary: 'interest in accessible artificial intelligence',
      q1: { interests: ['artificial intelligence'], themeCandidates: ['accessible technology'] },
    });
  });

  it('removes only near-verbatim fields while preserving meaningful sibling fields', async () => {
    const raw = 'I enjoy helping younger students through computing and making technical spaces more welcoming.';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ signals: [{
        key: 'q1',
        summary: raw,
        q1: {
          interests: ['computing'],
          intellectualCuriosity: [],
          problemInterests: [],
          themeCandidates: [],
        },
      }] }) } }] }),
    }));

    const findings = await extractReflectionFindings({
      apiKey: 'test-key',
      signals: [{ key: 'q1', dimension: 'interests_motivations', value: raw, status: 'isolated' }],
    });

    expect(findings.get('q1')).toMatchObject({ key: 'q1', summary: null, q1: { interests: ['computing'] } });
  });

  it('does not create a generic normalized finding when the structured call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const findings = await extractReflectionFindings({
      apiKey: 'test-key',
      signals: [{ key: 'q6', dimension: 'career_direction', value: 'I want to improve public transport.', status: 'isolated' }],
    });
    expect(findings).toEqual(new Map());
  });
});
