import { SITE_URL } from '@/lib/site-url';

export const EMAIL_BRAND = {
  name: 'GlowBal',
  tagline: 'Go Glow, Go GlowBal',
  supportEmail: 'support@glowbal-education.com',
  siteUrl: SITE_URL,
  logoUrl: `${SITE_URL}/brand/glowbal-wordmark.png`,
  globeUrl: `${SITE_URL}/brand/apply-globe.png`,
  colours: {
    background: '#050505',
    card: '#0B0B0D',
    cardSoft: '#111114',
    brand: '#E11D48',
    brandBright: '#FF304F',
    text: '#FAFAFA',
    secondary: '#A3A3A3',
    muted: '#737373',
    line: '#2A2A2E',
  },
} as const;

export type EmailSenderKind = 'default' | 'mentorship' | 'marketing';

function address(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function branded(value: string): string {
  if (/^[^<>]+<[^<>]+>$/.test(value.trim())) return value.trim();
  return `GlowBal <${value.trim()}>`;
}

/**
 * support@glowbal-education.com is the product-wide default sender.
 *
 * EMAIL_FROM_* may override it for a deliberately configured sending stream,
 * but the old WAITLIST_FROM_EMAIL variable is intentionally not consulted here:
 * production historically used it for unrelated mentorship/waitlist mail and
 * allowing it to win would silently keep new product mail on the old identity.
 */
export function getEmailSender(kind: EmailSenderKind = 'default'): string {
  const defaultAddress = address(process.env.EMAIL_FROM_DEFAULT, EMAIL_BRAND.supportEmail);
  if (kind === 'mentorship') {
    return branded(address(process.env.EMAIL_FROM_MENTORSHIP, defaultAddress));
  }
  if (kind === 'marketing') {
    return branded(address(process.env.EMAIL_FROM_MARKETING, defaultAddress));
  }
  return branded(defaultAddress);
}

export function getEmailReplyTo(): string {
  return address(process.env.EMAIL_REPLY_TO, EMAIL_BRAND.supportEmail);
}

export const EMAIL_SOCIALS = [
  {
    label: 'LinkedIn',
    href: process.env.NEXT_PUBLIC_GLOWBAL_LINKEDIN_URL?.trim() || '',
    glyph: 'in',
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/glowbal_education/',
    glyph: '◎',
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/glowbal.education',
    glyph: 'f',
  },
  {
    label: 'Website',
    href: SITE_URL,
    glyph: '↗',
  },
] as const;
