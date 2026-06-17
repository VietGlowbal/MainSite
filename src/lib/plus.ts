/**
 * GlowBal Plus — subscription packages + state helpers.
 *
 * Three packages built on a single Plus feature set, differing by commitment
 * length, effective monthly price, and bundled AI strategy credits (the metered
 * unit; free users get 2). Payments run through Stripe payment links — one per
 * package — set via env so they can be swapped without code changes.
 *
 * Shared display strings live here so the /plus page, the success activation
 * route, and the audit record all agree on price/credits/duration.
 */

export type PlusPlanId = 'plus-6m' | 'plus-12m' | 'plus-24m';

export type PlusPackage = {
  id: PlusPlanId;
  /** Subtitle under the plan name, e.g. "12 months". */
  durationLabel: string;
  durationMonths: number;
  /** Total price shown large, e.g. "948,000đ". */
  priceLabel: string;
  /** Effective monthly price, e.g. "79,000đ/mo". */
  perMonthLabel: string;
  /** Optional struck-through original price. */
  originalPriceLabel?: string;
  /** Optional savings badge, e.g. "Save 20%". */
  saveLabel?: string;
  /** Optional bonus line, e.g. "+1 month free". */
  bonusLabel?: string;
  /** AI strategy credits granted by this package. */
  aiCredits: number;
  /** Highlight the middle "best value" card. */
  highlighted: boolean;
  /** Env var holding this package's Stripe payment link. */
  paymentLinkEnv: string;
};

export const PLUS_PACKAGES: PlusPackage[] = [
  {
    id: 'plus-6m',
    durationLabel: '6 months',
    durationMonths: 6,
    priceLabel: '594,000đ',
    perMonthLabel: '99,000đ/mo',
    aiCredits: 30,
    highlighted: false,
    paymentLinkEnv: 'STRIPE_PLUS_LINK_6M',
  },
  {
    id: 'plus-12m',
    durationLabel: '12 months',
    durationMonths: 12,
    priceLabel: '948,000đ',
    perMonthLabel: '79,000đ/mo',
    originalPriceLabel: '1,188,000đ',
    saveLabel: 'Save 20%',
    bonusLabel: '+1 month free',
    aiCredits: 100,
    highlighted: true,
    paymentLinkEnv: 'STRIPE_PLUS_LINK_12M',
  },
  {
    id: 'plus-24m',
    durationLabel: '24 months',
    durationMonths: 24,
    priceLabel: '1,656,000đ',
    perMonthLabel: '69,000đ/mo',
    originalPriceLabel: '2,376,000đ',
    saveLabel: 'Save 30%',
    bonusLabel: '+2 months free',
    aiCredits: 250,
    highlighted: false,
    paymentLinkEnv: 'STRIPE_PLUS_LINK_24M',
  },
];

/** Shared benefits listed on every Plus card. */
export const PLUS_BENEFITS = [
  'Unlock full scholarship details (eligibility, documents, deadlines)',
  'Full scholarship application roadmap + document checklist',
  'Strategy history — revisit and compare past strategies',
  'Access to Plus-only / premium scholarships',
  'Priority student-supporter access',
];

export const FREE_FEATURES = [
  'Search universities',
  'View limited scholarship previews',
  'Save scholarships',
  'Create a basic profile',
  '2 AI strategy suggestions',
];

export function getPlusPackage(id: string | null | undefined): PlusPackage | null {
  return PLUS_PACKAGES.find((p) => p.id === id) ?? null;
}

/** Resolve a package's Stripe payment link from env (server-only usage). */
export function getPaymentLink(pkg: PlusPackage): string | null {
  const link = process.env[pkg.paymentLinkEnv];
  return link && link.trim() ? link.trim() : null;
}

/** Compute an ISO expiry `months` from `from` (defaults to now). */
export function computeExpiry(months: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}
