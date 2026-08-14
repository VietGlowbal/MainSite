import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { NextResponse, type NextRequest } from 'next/server';
import { isAdmin } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif']);
const STORAGE_BUCKET = 'news-images';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Sign in required', status: 401 as const };
  if (!(await isAdmin(user.id))) return { ok: false as const, error: 'Forbidden', status: 403 as const };
  return { ok: true as const };
}

/**
 * Validate the declared type and the bytes, then normalize every upload to a
 * bounded WebP. The service-role client is intentionally kept in this server
 * route; the browser only receives a public-read URL.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const form = await request.formData().catch(() => null);
  const value = form?.get('file');
  if (!(value instanceof File)) {
    return NextResponse.json({ error: 'Choose an image file' }, { status: 400 });
  }
  if (value.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Images must be 10 MB or smaller' }, { status: 413 });
  }
  if (!ALLOWED_MIME_TYPES.has(value.type.toLowerCase())) {
    return NextResponse.json({ error: 'Only JPEG, PNG, WebP, and AVIF images are supported' }, { status: 400 });
  }

  let normalized: { data: Buffer; info: { width: number; height: number } };
  try {
    const source = Buffer.from(await value.arrayBuffer());
    const metadata = await sharp(source, { failOn: 'error' }).metadata();
    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
      return NextResponse.json({ error: 'The uploaded file is not a valid image' }, { status: 400 });
    }

    normalized = await sharp(source, { failOn: 'error' })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    return NextResponse.json({ error: 'The uploaded file is not a valid image' }, { status: 400 });
  }

  try {
    const path = `uploads/${randomUUID()}.webp`;
    const admin = createAdminClient();
    const storage = admin.storage.from(STORAGE_BUCKET);
    const { error: uploadError } = await storage.upload(path, normalized.data, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });
    if (uploadError) {
      return NextResponse.json({ error: 'Image storage is not configured yet' }, { status: 503 });
    }

    const { data: publicData } = storage.getPublicUrl(path);
    if (!publicData.publicUrl) {
      return NextResponse.json({ error: 'Image storage did not return a public URL' }, { status: 503 });
    }
    return NextResponse.json({
      url: publicData.publicUrl,
      width: normalized.info.width,
      height: normalized.info.height,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Image storage is not configured yet' }, { status: 503 });
  }
}
