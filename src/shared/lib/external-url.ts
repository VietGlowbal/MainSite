/**
 * Canonicalize an external link without allowing active or local schemes into
 * a user-visible href. Relative URLs are intentionally not accepted here.
 */
export function canonicalizeExternalUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) return null;
  if (/[\u0000-\u0020\u007f]/.test(value)) return null;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (/[\u0000-\u0020\u007f]/.test(decoded)) return null;
  if (/^(?:javascript|data|vbscript|file|blob):/i.test(decoded)) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname) return null;
  return url.toString();
}

export function isSafeExternalUrl(value: unknown): value is string {
  return canonicalizeExternalUrl(value) !== null;
}
