import type { SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const DEFAULT_BUCKET = 'university-images';
const LOGO_SIZE = 512;
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 6_000;

export type PersistUniversityLogoOptions = {
  /** Absolute shared cron deadline. No request may outlive it. */
  deadlineMs?: number | undefined;
  /** Per-host cap, additionally bounded by deadlineMs. */
  requestTimeoutMs?: number | undefined;
};

function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'university';
}

export function universityLogoStoragePath(university: { id: number; name: string }): string {
  const id = String(university.id).padStart(5, '0');
  return `universities/${id}-${slugify(university.name)}/logo.webp`;
}

/**
 * Download, normalise and persist a resolved logo in the public university
 * asset bucket. The directory stores this stable URL instead of depending on
 * a Wikimedia/Google/university host at portal-render time.
 *
 * Returning null deliberately leaves `logo_url` empty so the scheduled job
 * retries later. Saving the external URL on failure would make the row look
 * complete and permanently bypass that retry.
 */
export async function persistUniversityLogo(
  admin: SupabaseClient,
  university: { id: number; name: string },
  sourceUrl: string,
  options: PersistUniversityLogoOptions = {},
): Promise<string | null> {
  const bucket = process.env.UNIVERSITY_IMAGES_BUCKET?.trim() || DEFAULT_BUCKET;
  const path = universityLogoStoragePath(university);
  const remainingMs = (options.deadlineMs ?? Number.POSITIVE_INFINITY) - Date.now();
  if (remainingMs <= 0) return null;
  const timeoutMs = Math.max(
    1,
    Math.min(options.requestTimeoutMs ?? FETCH_TIMEOUT_MS, remainingMs),
  );

  try {
    const response = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'glowbal-edu-platform/1.0 (university imagery)' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_SOURCE_BYTES) return null;

    const source = Buffer.from(await response.arrayBuffer());
    if (source.byteLength === 0 || source.byteLength > MAX_SOURCE_BYTES) return null;
    if (Date.now() >= (options.deadlineMs ?? Number.POSITIVE_INFINITY)) return null;

    const logo = await sharp(source, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({
        width: LOGO_SIZE,
        height: LOGO_SIZE,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: true,
      })
      .webp({ quality: 90, alphaQuality: 100 })
      .toBuffer();
    if (Date.now() >= (options.deadlineMs ?? Number.POSITIVE_INFINITY)) return null;

    const { error } = await admin.storage.from(bucket).upload(path, logo, {
      cacheControl: '31536000',
      contentType: 'image/webp',
      upsert: true,
    });
    if (error) {
      console.error('[university-images] logo upload failed:', error.message);
      return null;
    }

    return admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  } catch (error) {
    console.error('[university-images] logo persistence failed:', error);
    return null;
  }
}
