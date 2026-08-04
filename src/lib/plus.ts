/**
 * GlowBal Plus — subscription tiers, multi-currency pricing + state helpers.
 *
 * Plus is sold as three feature tiers (Starter / Pro / Premium) that differ by
 * how much they unlock — AI strategy credits, access length, and premium
 * features. Pricing is canonical in VND; the pricing page lets the user switch
 * the display + checkout currency (USD by default, plus VND, GBP, EUR, CNY) and
 * Stripe charges in whichever they pick.
 *
 * Shared display strings + the currency maths live here so the /plus page, the
 * checkout route, and the success activation all agree.
 */

export type PlusPlanId = 'plus-starter' | 'plus-pro' | 'plus-premium';

/**
 * Master switch for selling Plus. Off for launch — we are not taking payment
 * yet, and there is no Stripe webhook, so a payment that completed after the
 * user closed the tab would be charged without ever granting access.
 *
 * While this is false:
 *  - the tier cards render as a non-interactive preview ("Sắp ra mắt"),
 *  - POST /api/plus/checkout refuses, so hiding the button is not the only
 *    thing standing between a crafted request and a live Stripe session,
 *  - onboarding no longer ends on the upsell.
 *
 * To sell again: set this to true AND ship the webhook. Both, in that order.
 */
export const PLUS_SALES_ENABLED = false;

/**
 * Facebook (Messenger) chat link for the "Not sure? Chat with our in-house
 * team" CTA on the payment page.
 */
export const GLOWBAL_FB_CHAT_URL = 'https://www.facebook.com/messages/t/1091699360701390';

/**
 * Free statement-of-purpose AI analyses a non-Plus user gets before being
 * prompted to upgrade. Enforced server-side in /api/ai/analyze-statement.
 */
export const FREE_SOP_ANALYSES = 3;

// ── Multi-currency pricing ─────────────────────────────────────────────────
//
// Prices are authored in VND (the canonical amount per tier). Every other
// currency is derived from a static FX table — fine for a pricing page, and the
// same approach the universities explorer already uses. The user can switch the
// currency; Stripe then charges in that currency.

export const PLUS_DISPLAY_CURRENCIES = ['USD', 'VND', 'GBP', 'EUR', 'CNY'] as const;
export type DisplayCurrency = (typeof PLUS_DISPLAY_CURRENCIES)[number];
export const DEFAULT_DISPLAY_CURRENCY: DisplayCurrency = 'USD';

/** Approximate VND per 1 major unit of each currency (static, display-grade). */
const VND_PER_UNIT: Record<DisplayCurrency, number> = {
  VND: 1,
  USD: 25400,
  GBP: 32200,
  EUR: 27600,
  CNY: 3500,
};

type CurrencyMeta = {
  /** ISO code passed to Stripe (lower-case). */
  stripe: string;
  symbol: string;
  locale: string;
  /** True for currencies Stripe treats as having no minor unit (VND). */
  zeroDecimal: boolean;
  /** Human label for the switcher. */
  label: string;
  /** Stripe's minimum chargeable amount, in smallest units. */
  minAmount: number;
};

const CURRENCY_META: Record<DisplayCurrency, CurrencyMeta> = {
  USD: { stripe: 'usd', symbol: '$', locale: 'en-US', zeroDecimal: false, label: 'USD', minAmount: 50 },
  VND: { stripe: 'vnd', symbol: '₫', locale: 'vi-VN', zeroDecimal: true, label: 'VND', minAmount: 12000 },
  GBP: { stripe: 'gbp', symbol: '£', locale: 'en-GB', zeroDecimal: false, label: 'GBP', minAmount: 30 },
  EUR: { stripe: 'eur', symbol: '€', locale: 'en-IE', zeroDecimal: false, label: 'EUR', minAmount: 50 },
  CNY: { stripe: 'cny', symbol: '¥', locale: 'zh-CN', zeroDecimal: false, label: 'CNY', minAmount: 50 },
};

export function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return typeof value === 'string' && (PLUS_DISPLAY_CURRENCIES as readonly string[]).includes(value);
}

export function stripeCurrencyCode(currency: DisplayCurrency): string {
  return CURRENCY_META[currency].stripe;
}

export function currencyLabel(currency: DisplayCurrency): string {
  return CURRENCY_META[currency].label;
}

/**
 * The price of a tier in a given currency, as a whole major-unit number
 * (e.g. 18 for USD, 455000 for VND). VND is exact; other currencies are FX-
 * converted and rounded to a tidy whole number.
 */
export function planAmountMajor(amountVnd: number, currency: DisplayCurrency): number {
  if (currency === 'VND') return amountVnd;
  return Math.round(amountVnd / VND_PER_UNIT[currency]);
}

/** Pretty price string for a tier in a currency, e.g. "$18", "455,000 ₫". */
export function formatPlanPrice(amountVnd: number, currency: DisplayCurrency): string {
  const major = planAmountMajor(amountVnd, currency);
  if (currency === 'VND') {
    return `${new Intl.NumberFormat('vi-VN').format(major)} ₫`;
  }
  return new Intl.NumberFormat(CURRENCY_META[currency].locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(major);
}

/** The Stripe `unit_amount` (smallest units) to charge for a tier in a currency. */
export function planStripeUnitAmount(amountVnd: number, currency: DisplayCurrency): number {
  const major = planAmountMajor(amountVnd, currency);
  return CURRENCY_META[currency].zeroDecimal ? major : major * 100;
}

/** Format an already-charged Stripe amount (smallest units) for the audit record. */
export function formatChargedAmount(smallestUnits: number, currency: DisplayCurrency): string {
  const meta = CURRENCY_META[currency];
  const major = meta.zeroDecimal ? smallestUnits : smallestUnits / 100;
  if (currency === 'VND') return `${new Intl.NumberFormat('vi-VN').format(major)} ₫`;
  return new Intl.NumberFormat(meta.locale, { style: 'currency', currency }).format(major);
}

export function meetsStripeMinimum(smallestUnits: number, currency: DisplayCurrency): boolean {
  return smallestUnits >= CURRENCY_META[currency].minAmount;
}

// ── Tiers ───────────────────────────────────────────────────────────────────

export type PlusPackage = {
  id: PlusPlanId;
  /** Tier name shown as the card title, e.g. "Pro". */
  name: string;
  /** One-line positioning under the name. */
  tagline: string;
  /** How long Plus stays active for this tier. */
  durationLabel: string;
  durationMonths: number;
  /** Canonical price in VND — all other currencies derive from this. */
  amountVnd: number;
  /** AI strategy credits granted by this tier. */
  aiCredits: number;
  /**
   * Short bullet highlights for the card (full detail lives in the table).
   *
   * ⚠️ Do NOT re-add "<n> AI strategy credits" here. Every tier used to lead
   * with it and the rebuilt card (src/app/plus/plus-pricing.tsx) gives credits
   * their own plate directly above this list, so the bullet printed the same
   * number twice in the same card.
   */
  highlights: string[];
  /** Highlight the middle "most popular" card. */
  highlighted: boolean;
};

export const PLUS_PACKAGES: PlusPackage[] = [
  {
    id: 'plus-starter',
    name: 'Starter',
    tagline: 'Everything you need to apply with confidence',
    durationLabel: '6 months of Plus access',
    durationMonths: 6,
    amountVnd: 455000,
    aiCredits: 25,
    highlights: [
      'Full scholarship details & deadlines',
      'Application roadmap + document checklist',
      'Strategy history — revisit & compare',
    ],
    highlighted: false,
  },
  {
    id: 'plus-pro',
    name: 'Pro',
    tagline: 'Our most popular plan for serious applicants',
    durationLabel: '12 months of Plus access',
    durationMonths: 12,
    amountVnd: 1999000,
    aiCredits: 120,
    highlights: [
      'Everything in Starter',
      'Plus-only & premium scholarships',
      'Priority student-supporter access',
    ],
    highlighted: true,
  },
  {
    id: 'plus-premium',
    name: 'Premium',
    tagline: 'The complete, hands-on plan',
    durationLabel: '24 months of Plus access',
    durationMonths: 24,
    amountVnd: 8950000,
    aiCredits: 500,
    highlights: [
      'Everything in Pro',
      '1:1 onboarding & dedicated support',
      'A mentor session credit included',
    ],
    highlighted: false,
  },
];

// ── Free vs paid comparison matrix ───────────────────────────────────────────
//
// Drives the comparison table so it's easy to see, at a glance, what Free
// includes and what each paid tier adds. Columns: Free + the three tiers.

export type PlanColumn = 'free' | PlusPlanId;

export const PLAN_COLUMNS: { key: PlanColumn; name: string }[] = [
  { key: 'free', name: 'Free' },
  { key: 'plus-starter', name: 'Starter' },
  { key: 'plus-pro', name: 'Pro' },
  { key: 'plus-premium', name: 'Premium' },
];

export type ComparisonValue = boolean | string;

export type ComparisonRow = {
  label: string;
  values: Record<PlanColumn, ComparisonValue>;
};

export const PLUS_COMPARISON: ComparisonRow[] = [
  {
    label: 'University search & matching',
    values: { free: true, 'plus-starter': true, 'plus-pro': true, 'plus-premium': true },
  },
  {
    label: 'Save universities & scholarships',
    values: { free: true, 'plus-starter': true, 'plus-pro': true, 'plus-premium': true },
  },
  {
    label: 'AI strategy credits',
    values: { free: '2', 'plus-starter': '25', 'plus-pro': '120', 'plus-premium': '500' },
  },
  {
    label: 'Full scholarship details (eligibility, documents, deadlines)',
    values: { free: false, 'plus-starter': true, 'plus-pro': true, 'plus-premium': true },
  },
  {
    label: 'Application roadmap + document checklist',
    values: { free: false, 'plus-starter': true, 'plus-pro': true, 'plus-premium': true },
  },
  {
    label: 'Strategy history — revisit & compare',
    values: { free: false, 'plus-starter': true, 'plus-pro': true, 'plus-premium': true },
  },
  {
    label: 'Plus-only & premium scholarships',
    values: { free: false, 'plus-starter': false, 'plus-pro': true, 'plus-premium': true },
  },
  {
    label: 'Priority student-supporter access',
    values: { free: false, 'plus-starter': false, 'plus-pro': true, 'plus-premium': true },
  },
  {
    label: '1:1 onboarding & dedicated support',
    values: { free: false, 'plus-starter': false, 'plus-pro': false, 'plus-premium': true },
  },
  {
    label: 'Mentor session credit included',
    values: { free: false, 'plus-starter': false, 'plus-pro': false, 'plus-premium': true },
  },
  {
    label: 'Plus access',
    values: { free: '—', 'plus-starter': '6 months', 'plus-pro': '12 months', 'plus-premium': '24 months' },
  },
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
