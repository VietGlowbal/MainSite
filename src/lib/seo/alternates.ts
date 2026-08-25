import { SITE_URL } from '@/lib/site-url';

export type LocaleAlternates = {
  canonical: string;
  languages: {
    en: string;
    vi: string;
    'x-default': string;
  };
};

/**
 * Generates reciprocal hreflang and canonical metadata for English (default) URLs.
 */
export function buildLocaleAlternates(path: string): LocaleAlternates {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedPath = cleanPath === '/' ? '' : cleanPath;
  const enUrl = `${SITE_URL}${normalizedPath}`;
  const viUrl = `${SITE_URL}/vi${normalizedPath}`;

  return {
    canonical: enUrl,
    languages: {
      en: enUrl,
      vi: viUrl,
      'x-default': enUrl,
    },
  };
}

/**
 * Generates reciprocal hreflang and canonical metadata for Vietnamese (/vi/...) URLs.
 */
export function buildViLocaleAlternates(path: string): LocaleAlternates {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedPath = cleanPath === '/' ? '' : cleanPath;
  const enUrl = `${SITE_URL}${normalizedPath}`;
  const viUrl = `${SITE_URL}/vi${normalizedPath}`;

  return {
    canonical: viUrl,
    languages: {
      en: enUrl,
      vi: viUrl,
      'x-default': enUrl,
    },
  };
}
