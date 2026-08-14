import { afterEach, describe, expect, it, vi } from 'vitest';
import { OPENAI_CHAT_COMPLETIONS_URL } from '../openai-client';
import { extractCmcaitfFields } from './cmcaitf-extraction';

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

describe('extractCmcaitfFields', () => {
  it('makes no model call and returns all-null fields when there is no free text at all', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractCmcaitfFields({
      inputs: [{ id: 'a1', title: 'Peer tutoring', freeText: '' }],
      apiKey: 'test-key',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]?.cmcaitf).toEqual({
      context: null,
      motivation: null,
      challenge: null,
      action: null,
      impact: null,
      transformation: null,
      future: null,
    });
    expect(result[0]?.structuredCapture).toBe(false);
  });

  it('maps the model output back onto the matching activity id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse(
        JSON.stringify({
          items: [
            {
              activityId: 'a1',
              context: 'At school in 2024.',
              motivation: 'Wanted to help classmates.',
              challenge: null,
              action: 'Organised weekly sessions.',
              impact: null,
              transformation: null,
              future: null,
            },
          ],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractCmcaitfFields({
      inputs: [{ id: 'a1', title: 'Peer tutoring', freeText: 'Ran weekly tutoring at school in 2024 to help classmates.' }],
      apiKey: 'test-key',
    });

    expect(result[0]?.cmcaitf.context).toBe('At school in 2024.');
    expect(result[0]?.cmcaitf.action).toBe('Organised weekly sessions.');
    expect(result[0]?.cmcaitf.challenge).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      OPENAI_CHAT_COMPLETIONS_URL,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('leaves a field null when the model provides nothing for it, rather than inventing content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse(
        JSON.stringify({
          items: [
            {
              activityId: 'a1',
              context: null,
              motivation: null,
              challenge: null,
              action: 'Ran weekly sessions.',
              impact: null,
              transformation: null,
              future: null,
            },
          ],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractCmcaitfFields({
      inputs: [{ id: 'a1', title: 'Peer tutoring', freeText: 'Ran weekly sessions.' }],
      apiKey: 'test-key',
    });

    expect(result[0]?.cmcaitf.action).toBe('Ran weekly sessions.');
    expect(result[0]?.cmcaitf.impact).toBeNull();
    expect(result[0]?.cmcaitf.transformation).toBeNull();
  });

  it('strips a literal trailing "|null" the model echoed from the prompt schema hint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse(
        JSON.stringify({
          items: [
            {
              activityId: 'a1',
              context: null,
              motivation: 'Accepted onto the program.|null',
              challenge: null,
              action: null,
              impact: null,
              transformation: null,
              future: null,
            },
          ],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractCmcaitfFields({
      inputs: [{ id: 'a1', title: 'Programme', freeText: 'Accepted onto the program.' }],
      apiKey: 'test-key',
    });

    expect(result[0]?.cmcaitf.motivation).toBe('Accepted onto the program.');
  });

  it('falls back to empty fields for an input the model did not return an item for', async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(JSON.stringify({ items: [] })));
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractCmcaitfFields({
      inputs: [{ id: 'a1', title: 'Peer tutoring', freeText: 'Something happened.' }],
      apiKey: 'test-key',
    });

    expect(result[0]?.cmcaitf.context).toBeNull();
  });
});
