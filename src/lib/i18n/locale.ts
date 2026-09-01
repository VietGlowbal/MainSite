import { translations } from '@/lib/i18n-catalog';

export type Locale = 'en' | 'vi';

export const homeCopy = {
  en: {
    title: 'The all-in-one solution for scholarship seekers',
    description:
      'From discovering suitable universities and scholarships to building a personalised strategy and tracking your applications, GlowBal supports your entire journey.',
    metadataTitle: 'GlowBal | Find Universities, Scholarships & Study Abroad Support',
    metadataDescription:
      'GlowBal helps students discover global universities, find scholarships, and build application strategies with AI and real student supporters.',
  },
  vi: {
    title:
      translations['The all-in-one solution for scholarship seekers'] ??
      'The all-in-one solution for scholarship seekers',
    description:
      translations['From discovering suitable universities and scholarships to building a personalised strategy and tracking your applications, GlowBal supports your entire journey.'] ??
      'From discovering suitable universities and scholarships to building a personalised strategy and tracking your applications, GlowBal supports your entire journey.',
    metadataTitle: 'GlowBal Du Học | Tìm Trường, Học Bổng & Chiến Lược Ứng Tuyển',
    metadataDescription:
      'GlowBal là nền tảng giúp học sinh, sinh viên Việt Nam tìm trường đại học quốc tế, khám phá học bổng và xây dựng chiến lược du học, ứng tuyển phù hợp với hồ sơ cá nhân.',
  },
} satisfies Record<Locale, Record<'title' | 'description' | 'metadataTitle' | 'metadataDescription', string>>;

function splitPath(path: string): { pathname: string; suffix: string } {
  const match = path.match(/^([^?#]*)([?#].*)?$/);
  return {
    pathname: match?.[1] || '/',
    suffix: match?.[2] || '',
  };
}

function withoutLocale(pathname: string): string {
  if (pathname === '/vi' || pathname === '/vi/') return '/';
  return pathname.startsWith('/vi/') ? pathname.slice(3) || '/' : pathname;
}

export function isLocalizedPublicPath(pathname: string): boolean {
  const base = withoutLocale(pathname).replace(/\/$/, '') || '/';
  if (['/', '/about', '/how-it-works', '/news', '/universities', '/scholarships', '/advisors'].includes(base)) {
    return true;
  }
  if (/^\/news\/[^/]+$/.test(base)) return true;
  if (/^\/advisors\/[^/]+$/.test(base) && base !== '/advisors/apply') return true;
  return /^\/universities\/\d+$/.test(base);
}

export function getLocaleFromPath(path: string): Locale {
  return splitPath(path).pathname === '/vi' || splitPath(path).pathname.startsWith('/vi/') ? 'vi' : 'en';
}

/** Map a public route to its locale-specific counterpart without double-prefixing. */
export function localizePath(path: string, locale: Locale): string {
  const { pathname, suffix } = splitPath(path);
  const base = withoutLocale(pathname);
  if (!isLocalizedPublicPath(base)) return path;
  const normalized = base === '/' ? '' : base;
  return `${locale === 'vi' ? `/vi${normalized}` : normalized || '/'}${suffix}`;
}

export const withLocale = localizePath;

export function getLocaleText(
  locale: Locale,
  source: string,
  vars?: Record<string, string | number>,
): string {
  const value = locale === 'vi' ? translations[source] ?? source : source;
  return vars
    ? value.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : `{${key}}`))
    : value;
}
