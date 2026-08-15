import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock, generateReflectionCardMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  generateReflectionCardMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/ai/reflection-card-generation', () => ({
  generateReflectionCard: generateReflectionCardMock,
}));

import { POST } from './route';

/**
 * This route is stateless by design — see the route's own doc comment — so
 * these tests assert it never touches the database, only calls the AI
 * generator with exactly the payload it was given and returns its result
 * (or a graceful, data-preserving error).
 */

function client(authed = true) {
  return {
    auth: {
      getUser: async () => ({ data: { user: authed ? { id: 'user-1' } : null } }),
    },
  };
}

function request(body: unknown) {
  return new Request('http://localhost/api/reflection/reflection-card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  title: 'Vice President — Entrepreneurship Club',
  organisation: 'Entrepreneurship Club',
  categoryLabel: 'Leadership & Initiative',
  reflection: {
    context: 'The club was struggling to get members to finish projects.',
    action: 'I redesigned the weekly workshops and coordinated four team leads.',
  },
};

const ORIGINAL_API_KEY = process.env.OPENAI_API_KEY;

beforeEach(() => {
  createClientMock.mockReset();
  generateReflectionCardMock.mockReset();
  process.env.OPENAI_API_KEY = 'test-key';
});

afterAll(() => {
  process.env.OPENAI_API_KEY = ORIGINAL_API_KEY;
});

describe('POST /api/reflection/reflection-card', () => {
  it('rejects an unauthenticated request', async () => {
    createClientMock.mockResolvedValue(client(false));
    const response = await POST(request(VALID_BODY));
    expect(response.status).toBe(401);
    expect(generateReflectionCardMock).not.toHaveBeenCalled();
  });

  it('rejects a request with no reflection answers at all', async () => {
    createClientMock.mockResolvedValue(client());
    const response = await POST(
      request({ ...VALID_BODY, reflection: {} }),
    );
    expect(response.status).toBe(400);
    expect(generateReflectionCardMock).not.toHaveBeenCalled();
  });

  it('calls the generator with the title/organisation/category/reflection it was given, and returns the card', async () => {
    createClientMock.mockResolvedValue(client());
    const card = {
      story: 'Led entrepreneurship initiatives during a growth period.',
      contributions: ['Redesigned workshops'],
      evidence: [],
      demonstratedSkills: [{ skill: 'Leadership', evidence: 'Coordinated four team leads.' }],
      status: 'generated' as const,
    };
    generateReflectionCardMock.mockResolvedValue(card);

    const response = await POST(request(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.card).toEqual(card);
    expect(generateReflectionCardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: VALID_BODY.title,
        organisation: VALID_BODY.organisation,
        categoryLabel: VALID_BODY.categoryLabel,
        reflection: VALID_BODY.reflection,
        apiKey: 'test-key',
      }),
    );
  });

  it('returns 503 without an OpenAI key configured, without losing the request', async () => {
    delete process.env.OPENAI_API_KEY;
    createClientMock.mockResolvedValue(client());

    const response = await POST(request(VALID_BODY));
    expect(response.status).toBe(503);
    expect(generateReflectionCardMock).not.toHaveBeenCalled();
  });

  it('returns a "saved but could not summarise" error when generation throws, per spec', async () => {
    createClientMock.mockResolvedValue(client());
    generateReflectionCardMock.mockRejectedValue(new Error('model returned invalid JSON'));

    const response = await POST(request(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toMatch(/saved your reflection/i);
  });
});
