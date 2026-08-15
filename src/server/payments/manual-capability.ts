import { createHmac, timingSafeEqual } from 'node:crypto';

export function createManualReviewToken(reviewId: string, version: number, secret: string): string {
  if (!reviewId || !Number.isSafeInteger(version) || version < 1) throw new Error('Invalid review capability');
  const payload = `${reviewId}.${version}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

export function verifyManualReviewToken(
  token: string,
  secret: string,
): { reviewId: string; version: number } | null {
  const parts = token.split('.');
  const reviewId = parts[0];
  const versionText = parts[1];
  const signature = parts[2];
  if (parts.length !== 3 || !reviewId || !versionText || !signature || !/^\d+$/.test(versionText) || !/^[a-f0-9]{64}$/.test(signature)) return null;
  const version = Number(versionText);
  if (!Number.isSafeInteger(version) || version < 1) return null;
  const expected = createHmac('sha256', secret).update(`${reviewId}.${version}`).digest();
  const supplied = Buffer.from(signature, 'hex');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  return { reviewId, version };
}
