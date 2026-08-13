import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const image = vi.hoisted(() => {
  const pipeline: Record<string, ReturnType<typeof vi.fn>> = {};
  pipeline['rotate'] = vi.fn(() => pipeline);
  pipeline['resize'] = vi.fn(() => pipeline);
  pipeline['webp'] = vi.fn(() => pipeline);
  pipeline['toBuffer'] = vi.fn(async () => Buffer.from('normalised-logo'));
  return {
    pipeline,
    sharp: vi.fn(() => pipeline),
  };
});

vi.mock('sharp', () => ({ default: image.sharp }));

const { persistUniversityLogo, universityLogoStoragePath } = await import('./logo-storage');

const upload = vi.fn(async () => ({ error: null }));
const getPublicUrl = vi.fn((path: string) => ({
  data: { publicUrl: `https://assets.example/${path}` },
}));
const from = vi.fn(() => ({ upload, getPublicUrl }));
const admin = { storage: { from } } as unknown as SupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
  upload.mockResolvedValue({ error: null });
  image.pipeline['toBuffer']?.mockResolvedValue(Buffer.from('normalised-logo'));
});

afterEach(() => vi.unstubAllGlobals());

describe('university logo storage', () => {
  it('uses the established deterministic storage path', () => {
    expect(universityLogoStoragePath({ id: 108, name: 'Université de Birmingham' })).toBe(
      'universities/00108-universite-de-birmingham/logo.webp',
    );
  });

  it('normalises and uploads a resolved logo before returning its public URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'content-length': '3', 'content-type': 'image/png' },
        }),
      ),
    );

    const publicUrl = await persistUniversityLogo(
      admin,
      { id: 108, name: 'University of Birmingham' },
      'https://source.example/logo.png',
    );

    const path = 'universities/00108-university-of-birmingham/logo.webp';
    expect(image.sharp).toHaveBeenCalledOnce();
    expect(upload).toHaveBeenCalledWith(path, Buffer.from('normalised-logo'), {
      cacheControl: '31536000',
      contentType: 'image/webp',
      upsert: true,
    });
    expect(publicUrl).toBe(`https://assets.example/${path}`);
  });

  it('leaves the URL empty when the source cannot be downloaded so cron can retry', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 503 })));

    const publicUrl = await persistUniversityLogo(
      admin,
      { id: 108, name: 'University of Birmingham' },
      'https://source.example/logo.png',
    );

    expect(publicUrl).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });
});
