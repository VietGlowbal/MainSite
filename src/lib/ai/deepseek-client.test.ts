import { describe, expect, it, vi } from 'vitest';
import { deepSeekJsonCompletion } from './deepseek-client';

const request = {
  apiKey: 'test-key',
  model: 'deepseek-v4-pro',
  messages: [
    { role: 'system' as const, content: 'Return JSON only.' },
    { role: 'user' as const, content: 'Return an empty JSON object.' },
  ],
  temperature: 0,
  maxTokens: 100,
};

describe('deepSeekJsonCompletion', () => {
  it('does not multiply provider calls when DeepSeek returns an error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{"error":"bad request"}', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(deepSeekJsonCompletion(request)).rejects.toThrow(
      'DeepSeek request failed (400)',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('aborts a provider call at the configured deadline', async () => {
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      deepSeekJsonCompletion({ ...request, timeoutMs: 5 }),
    ).rejects.toThrow('DeepSeek request timed out.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
