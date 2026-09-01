import { SITE_URL } from '@/lib/site-url';
import { localizePath } from '@/lib/i18n/locale';

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
  const enUrl = `${SITE_URL}${localizePath(path, 'en') === '/' ? '' : localizePath(path, 'en')}`;
  const viPath = localizePath(path, 'vi');
  const viUrl = `${SITE_URL}${viPath === '/' ? '' : viPath}`;

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
  const enPath = localizePath(path, 'en');
  const enUrl = `${SITE_URL}${enPath === '/' ? '' : enPath}`;
  const viPath = localizePath(path, 'vi');
  const viUrl = `${SITE_URL}${viPath === '/' ? '' : viPath}`;

  return {
    canonical: viUrl,
    languages: {
      en: enUrl,
      vi: viUrl,
      'x-default': enUrl,
    },
  };
}
