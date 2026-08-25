import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const {
  createClientMock,
  isAdminMock,
  getArticleByIdMock,
  updateArticleMock,
  createArticleMock,
  listArticlesForAdminMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  isAdminMock: vi.fn(),
  getArticleByIdMock: vi.fn(),
  updateArticleMock: vi.fn(),
  createArticleMock: vi.fn(),
  listArticlesForAdminMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/auth-helpers', () => ({ isAdmin: isAdminMock }));
vi.mock('@/lib/geo-cms', async () => {
  const actual = await vi.importActual<typeof import('@/lib/geo-cms')>('@/lib/geo-cms');
  return {
    ...actual,
    getArticleById: getArticleByIdMock,
    updateArticle: updateArticleMock,
    createArticle: createArticleMock,
    listArticlesForAdmin: listArticlesForAdminMock,
    deleteArticle: vi.fn(),
  };
});
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

import { PATCH } from './[id]/route';
import { POST } from './route';
import { GeoArticleConflictError } from '@/lib/geo-cms';

const ARTICLE = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'A useful article',
  slug: 'a-useful-article',
  description: 'Summary',
  excerpt: 'Summary',
  key_takeaway: null,
  body: 'Body',
  topic: 'Universities',
  tags: [],
  hero_image: 'https://cdn.example.com/hero.webp',
  hero_image_style: null,
  reading_time_minutes: 4,
  meta: { heroImageAlt: 'Students on campus' },
  status: 'draft' as const,
  source: 'manual' as const,
  pipeline_cluster_id: null,
  author_id: null,
  published_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function request(body: unknown) {
  return new Request('http://localhost/api/admin/news/article-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('PATCH /api/admin/news/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'admin-1' } } })) },
    });
    isAdminMock.mockResolvedValue(true);
    getArticleByIdMock.mockResolvedValue(ARTICLE);
    updateArticleMock.mockResolvedValue({ ...ARTICLE, status: 'published' });
    createArticleMock.mockResolvedValue({ ...ARTICLE, id: '22222222-2222-4222-8222-222222222222' });
    listArticlesForAdminMock.mockResolvedValue([ARTICLE]);
  });

  it('returns 401 when there is no authenticated session', async () => {
    createClientMock.mockResolvedValueOnce({ auth: { getUser: vi.fn(async () => ({ data: { user: null } })) } });

    const response = await PATCH(request({ body: 'New body' }), { params: Promise.resolve({ id: ARTICLE.id }) });

    expect(response.status).toBe(401);
    expect(updateArticleMock).not.toHaveBeenCalled();
  });

  it('returns 403 for an authenticated non-admin', async () => {
    isAdminMock.mockResolvedValueOnce(false);

    const response = await PATCH(request({ body: 'New body' }), { params: Promise.resolve({ id: ARTICLE.id }) });

    expect(response.status).toBe(403);
    expect(updateArticleMock).not.toHaveBeenCalled();
  });

  it('allows an admin to update and revalidates both old and new slugs', async () => {
    updateArticleMock.mockResolvedValueOnce({ ...ARTICLE, slug: 'new-slug' });

    const response = await PATCH(request({ slug: 'new-slug', body: ARTICLE.body }), { params: Promise.resolve({ id: ARTICLE.id }) });

    expect(response.status).toBe(200);
    expect(updateArticleMock).toHaveBeenCalledWith(ARTICLE.id, expect.objectContaining({ slug: 'new-slug' }));
    expect(revalidatePathMock).toHaveBeenCalledWith('/news');
    expect(revalidatePathMock).toHaveBeenCalledWith('/news/new-slug');
    expect(revalidatePathMock).toHaveBeenCalledWith('/news/a-useful-article');
  });

  it('rejects malformed PATCH payloads before reading or writing the article', async () => {
    const response = await PATCH(request({ status: 'not-a-status' }), { params: Promise.resolve({ id: ARTICLE.id }) });

    expect(response.status).toBe(400);
    expect(getArticleByIdMock).not.toHaveBeenCalled();
    expect(updateArticleMock).not.toHaveBeenCalled();
  });

  it('rejects publishing until every checklist field is complete', async () => {
    const response = await PATCH(request({ status: 'published', description: null }), { params: Promise.resolve({ id: ARTICLE.id }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errors).toContain('Description is required');
    expect(updateArticleMock).not.toHaveBeenCalled();
  });

  it('blocks publishing with a structured blocker when the description carries generator draft copy', async () => {
    getArticleByIdMock.mockResolvedValueOnce({
      ...ARTICLE,
      description: 'A Glowbal draft guide for vietnamese applicants',
      excerpt: 'A Glowbal draft guide for vietnamese applicants',
    });

    const response = await PATCH(request({ status: 'published' }), { params: Promise.resolve({ id: ARTICLE.id }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.blockers.map((blocker: { code: string }) => blocker.code)).toContain('PLACEHOLDER_COPY');
    expect(updateArticleMock).not.toHaveBeenCalled();
  });

  it('blocks publishing with a structured blocker when the body still carries TODO_SOURCE_REQUIRED markers', async () => {
    getArticleByIdMock.mockResolvedValueOnce({
      ...ARTICLE,
      body: 'Tuition is £24,000.\n- TODO_SOURCE_REQUIRED: official fee page',
    });

    const response = await PATCH(request({ status: 'published' }), { params: Promise.resolve({ id: ARTICLE.id }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.blockers.map((blocker: { code: string }) => blocker.code)).toContain('PLACEHOLDER_SOURCE_MARKER');
    expect(updateArticleMock).not.toHaveBeenCalled();
  });

  it('publishes cleanly when the checklist and publication gate are satisfied', async () => {
    const response = await PATCH(request({ status: 'published' }), { params: Promise.resolve({ id: ARTICLE.id }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.blockers).toBeUndefined();
    expect(updateArticleMock).toHaveBeenCalled();
  });

  it('returns 409 when an autosave token is stale', async () => {
    updateArticleMock.mockRejectedValueOnce(new GeoArticleConflictError());

    const response = await PATCH(request({ body: 'New body', expected_updated_at: ARTICLE.updated_at }), { params: Promise.resolve({ id: ARTICLE.id }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('ARTICLE_CONFLICT');
  });

  it('accepts PostgreSQL timestamps with a timezone offset as autosave tokens', async () => {
    const expectedUpdatedAt = '2026-01-01T00:00:00+00:00';

    const response = await PATCH(request({ body: 'New body', expected_updated_at: expectedUpdatedAt }), { params: Promise.resolve({ id: ARTICLE.id }) });

    expect(response.status).toBe(200);
    expect(updateArticleMock).toHaveBeenCalledWith(
      ARTICLE.id,
      expect.objectContaining({ expected_updated_at: expectedUpdatedAt }),
    );
  });

  it('creates a draft for an authenticated admin', async () => {
    const response = await POST(new Request('http://localhost/api/admin/news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'A new article', body: 'Body' }),
    }) as unknown as NextRequest);

    expect(response.status).toBe(201);
    expect(createArticleMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'A new article', body: 'Body' }), 'admin-1');
  });

  it('rejects malformed collection payloads', async () => {
    const response = await POST(new Request('http://localhost/api/admin/news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 42 }),
    }) as unknown as NextRequest);

    expect(response.status).toBe(400);
    expect(createArticleMock).not.toHaveBeenCalled();
  });

  it('preserves legacy Markdown structure when an admin saves it', async () => {
    const legacyBody = '## Heading\n\n- One\n- Two\n\n[Read more](/news/other)\n\n![Campus](/news-images/campus.webp)';

    await PATCH(request({ body: legacyBody }), { params: Promise.resolve({ id: ARTICLE.id }) });

    expect(updateArticleMock).toHaveBeenCalledWith(ARTICLE.id, expect.objectContaining({ body: legacyBody }));
  });
});
