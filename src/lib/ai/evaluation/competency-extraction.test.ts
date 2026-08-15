import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractCompetencyClaims } from './competency-extraction';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function chatResponse(content: string) {
  return new Response(
    JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

describe('extractCompetencyClaims', () => {
  it('returns nothing and makes no call when there are no sources with text', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractCompetencyClaims({
      sources: [{ id: 's1', kind: 'activity', text: '' }],
      apiKey: 'test-key',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('links a claim only to evidenceIds that actually match a supplied source', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse(
        JSON.stringify({
          claims: [
            {
              id: 'c1',
              type: 'soft',
              label: 'Leadership',
              situation: 'Coordinated a 12-person team for a food drive.',
              evidenceIds: ['s1', 'nonexistent-source'],
            },
          ],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractCompetencyClaims({
      sources: [{ id: 's1', kind: 'activity', text: 'Coordinated a 12-person team for a food drive.' }],
      apiKey: 'test-key',
    });

    expect(result[0]?.evidenceRefs).toHaveLength(1);
    expect(result[0]?.evidenceRefs[0]?.id).toBe('s1');
  });

  it('preserves a null situation rather than the extractor being forced to invent one', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse(
        JSON.stringify({
          claims: [
            { id: 'c1', type: 'hard', label: 'Public speaking', situation: null, evidenceIds: [] },
          ],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractCompetencyClaims({
      sources: [{ id: 's1', kind: 'activity', text: 'Gave a talk once.' }],
      apiKey: 'test-key',
    });

    expect(result[0]?.situation).toBeNull();
    expect(result[0]?.evidenceRefs).toEqual([]);
  });
});
