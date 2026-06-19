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

export const PLUS_CURRENCY = 'vnd'; // zero-decimal in Stripe: unit_amount === VND

/**
 * Facebook (Messenger) chat link for the "Not sure? Chat with our in-house
 * team" CTA on the payment page. TODO: replace the placeholder with the real
 * GlowBal Messenger/page URL before shipping.
 */
export const GLOWBAL_FB_CHAT_URL = 'https://www.facebook.com/messages/t/1091699360701390';

/**
 * Free statement-of-purpose AI analyses a non-Plus user gets before being
 * prompted to upgrade. Enforced server-side in /api/ai/analyze-statement.
 */
export const FREE_SOP_ANALYSES = 3;

export type PlusPackage = {
  id: PlusPlanId;
  /** Subtitle under the plan name, e.g. "12 months". */
  durationLabel: string;
  durationMonths: number;
  /** Charge amount in VND (Stripe zero-decimal: passed straight as unit_amount). */
  amountVnd: number;
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
};

export const PLUS_PACKAGES: PlusPackage[] = [
  {
    id: 'plus-6m',
    durationLabel: '6 months',
    durationMonths: 6,
    amountVnd: 594000,
    priceLabel: '594,000đ',
    perMonthLabel: '99,000đ/mo',
    aiCredits: 30,
    highlighted: false,
  },
  {
    id: 'plus-12m',
    durationLabel: '12 months',
    durationMonths: 12,
    amountVnd: 948000,
    priceLabel: '948,000đ',
    perMonthLabel: '79,000đ/mo',
    originalPriceLabel: '1,188,000đ',
    saveLabel: 'Save 20%',
    bonusLabel: '+1 month free',
    aiCredits: 100,
    highlighted: true,
  },
  {
    id: 'plus-24m',
    durationLabel: '24 months',
    durationMonths: 24,
    amountVnd: 1656000,
    priceLabel: '1,656,000đ',
    perMonthLabel: '69,000đ/mo',
    originalPriceLabel: '2,376,000đ',
    saveLabel: 'Save 30%',
    bonusLabel: '+2 months free',
    aiCredits: 250,
    highlighted: false,
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

/** Compute an ISO expiry `months` from `from` (defaults to now). */
export function computeExpiry(months: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}
