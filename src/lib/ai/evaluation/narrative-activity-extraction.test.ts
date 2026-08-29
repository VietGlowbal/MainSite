import { afterEach, describe, expect, it, vi } from 'vitest';
import { OPENAI_CHAT_COMPLETIONS_URL } from '../openai-client';
import { extractRoleAndTheme } from './narrative-activity-extraction';

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

describe('extractRoleAndTheme', () => {
  it('makes no model call and returns all-null fields when there is no free text at all', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractRoleAndTheme({
      inputs: [{ id: 'a1', title: 'Peer tutoring', freeText: '' }],
      apiKey: 'test-key',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: 'a1', role: null, domainTheme: null }]);
  });

  it('maps the model output back onto the matching activity id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse(
        JSON.stringify({
          items: [{ activityId: 'a1', role: 'Ran weekly tutoring sessions', domainTheme: 'Education access' }],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractRoleAndTheme({
      inputs: [{ id: 'a1', title: 'Peer tutoring', freeText: 'Ran weekly tutoring at school to help classmates catch up.' }],
      apiKey: 'test-key',
    });

    expect(result[0]?.role).toBe('Ran weekly tutoring sessions');
    expect(result[0]?.domainTheme).toBe('Education access');
    expect(fetchMock).toHaveBeenCalledWith(
      OPENAI_CHAT_COMPLETIONS_URL,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('preserves additive trigger, problem, ownership, and method evidence fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      chatResponse(JSON.stringify({
        items: [{
          activityId: 'a1',
          role: 'Ran weekly tutoring sessions',
          domainTheme: 'Education access',
          trigger: 'Noticed younger students lacked support',
          problem: 'Different skill levels made group teaching difficult',
          ownership: 'Planned the sessions and adapted the schedule',
          method: 'Grouped learners by need and reviewed progress weekly',
        }],
      })),
    ));

    const result = await extractRoleAndTheme({
      inputs: [{ id: 'a1', title: 'Peer tutoring', freeText: 'Ran weekly tutoring at school.' }],
      apiKey: 'test-key',
    });

    expect(result[0]).toMatchObject({
      trigger: 'Noticed younger students lacked support',
      problem: 'Different skill levels made group teaching difficult',
      ownership: 'Planned the sessions and adapted the schedule',
      method: 'Grouped learners by need and reviewed progress weekly',
    });
  });

  it('leaves both fields null when the model does not support them, rather than inventing a theme', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse(JSON.stringify({ items: [{ activityId: 'a1', role: null, domainTheme: null }] })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractRoleAndTheme({
      inputs: [{ id: 'a1', title: 'Peer tutoring', freeText: 'Something happened once.' }],
      apiKey: 'test-key',
    });

    expect(result[0]?.role).toBeNull();
    expect(result[0]?.domainTheme).toBeNull();
  });

  it('falls back to null fields for an input the model did not return an item for', async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(JSON.stringify({ items: [] })));
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractRoleAndTheme({
      inputs: [{ id: 'a1', title: 'Peer tutoring', freeText: 'Ran weekly sessions.' }],
      apiKey: 'test-key',
    });

    expect(result[0]).toEqual({ id: 'a1', role: null, domainTheme: null });
  });
});
