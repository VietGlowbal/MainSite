import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { createClientMock, createAdminClientMock, isAdminMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  isAdminMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }));
vi.mock('@/lib/auth-helpers', () => ({ isAdmin: isAdminMock }));

import { POST } from './route';

function requestWithFile(file: File) {
  const form = new FormData();
  form.append('file', file);
  return new Request('http://localhost/api/admin/news/images', { method: 'POST', body: form }) as unknown as NextRequest;
}

describe('POST /api/admin/news/images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'admin-1' } } })) },
    });
    isAdminMock.mockResolvedValue(true);
    createAdminClientMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ error: null })),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://cdn.example.com/news-images/test.webp' } })),
        })),
      },
    });
  });

  it('rejects a request without an authenticated admin', async () => {
    createClientMock.mockResolvedValueOnce({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    });

    const response = await POST(requestWithFile(new File([new Uint8Array([1, 2, 3])], 'hero.png', { type: 'image/png' })));

    expect(response.status).toBe(401);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it('rejects an authenticated non-admin', async () => {
    isAdminMock.mockResolvedValueOnce(false);

    const response = await POST(requestWithFile(new File([new Uint8Array([1, 2, 3])], 'hero.png', { type: 'image/png' })));

    expect(response.status).toBe(403);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it('rejects non-image bytes even when the file declares an allowed MIME type', async () => {
    const response = await POST(requestWithFile(new File([new Uint8Array([1, 2, 3, 4])], 'hero.png', { type: 'image/png' })));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/valid image/i);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it('rejects SVG uploads before any image processing or storage access', async () => {
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'hero.svg', { type: 'image/svg+xml' });
    const response = await POST(requestWithFile(svg));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/JPEG|PNG|WebP/i);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it('rejects files larger than 10 MB before processing', async () => {
    const response = await POST(requestWithFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'hero.webp', { type: 'image/webp' })));

    expect(response.status).toBe(413);
    expect((await response.json()).error).toMatch(/10 MB/i);
  });

  it('normalizes a valid PNG to WebP and returns its public URL', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    const response = await POST(requestWithFile(new File([png], 'hero.png', { type: 'image/png' })));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual(expect.objectContaining({ url: expect.stringContaining('/news-images/'), width: 1, height: 1 }));
    expect(createAdminClientMock).toHaveBeenCalledTimes(1);
  });

  it('returns 503 when the server-side storage client is not configured', async () => {
    createAdminClientMock.mockImplementationOnce(() => { throw new Error('missing service role'); });
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );

    const response = await POST(requestWithFile(new File([png], 'hero.png', { type: 'image/png' })));

    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/storage/i);
  });
});
