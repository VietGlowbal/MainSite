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
 * WAITLIST_FROM_EMAIL is retained as a compatibility fallback while production
 * moves to the general EMAIL_FROM_* variables. New deployments should set
 * EMAIL_FROM_DEFAULT=support@glowbal-education.com.
 */
export function getEmailSender(kind: EmailSenderKind = 'default'): string {
  const legacy = process.env.WAITLIST_FROM_EMAIL;
  if (kind === 'mentorship') {
    return branded(address(process.env.EMAIL_FROM_MENTORSHIP, process.env.EMAIL_FROM_DEFAULT || legacy || EMAIL_BRAND.supportEmail));
  }
  if (kind === 'marketing') {
    return branded(address(process.env.EMAIL_FROM_MARKETING, process.env.EMAIL_FROM_DEFAULT || legacy || EMAIL_BRAND.supportEmail));
  }
  return branded(address(process.env.EMAIL_FROM_DEFAULT, legacy || EMAIL_BRAND.supportEmail));
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
