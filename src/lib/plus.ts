/**
 * GlowBal Plus — subscription tiers, multi-currency pricing + state helpers.
 *
 * Plus is sold as three feature tiers (Monthly / Yearly / Yearly Premium) that differ by
 * how much they unlock — AI strategy credits, access length, mentor sessions, and expert reviews.
 * Pricing is canonical in VND; the pricing page lets the user switch the
 * display + checkout currency (VND by default, plus USD, GBP, EUR, CNY) and
 * payments charge in whichever they pick.
 *
 * Shared display strings + the currency maths live here so the /plus page, the
 * checkout route, and the success activation all agree.
 */

export type PlusPlanId = 'plus-starter' | 'plus-pro' | 'plus-premium';

/**
 * Master switch for selling Plus. Set to true for launch checkout.
 */
export const PLUS_SALES_ENABLED = true;

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
// currency; Stripe/VNPay then charges accordingly.

export const PLUS_DISPLAY_CURRENCIES = ['VND', 'USD', 'GBP', 'EUR', 'CNY'] as const;
export type DisplayCurrency = (typeof PLUS_DISPLAY_CURRENCIES)[number];
export const DEFAULT_DISPLAY_CURRENCY: DisplayCurrency = 'VND';

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
  VND: { stripe: 'vnd', symbol: '₫', locale: 'vi-VN', zeroDecimal: true, label: 'VND', minAmount: 12000 },
  USD: { stripe: 'usd', symbol: '$', locale: 'en-US', zeroDecimal: false, label: 'USD', minAmount: 50 },
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

/** Pretty price string for a tier in a currency, e.g. "$18", "349,000₫". */
export function formatPlanPrice(amountVnd: number, currency: DisplayCurrency): string {
  const major = planAmountMajor(amountVnd, currency);
  if (currency === 'VND') {
    return `${new Intl.NumberFormat('vi-VN').format(major)}₫`;
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
  if (currency === 'VND') return `${new Intl.NumberFormat('vi-VN').format(major)}₫`;
  return new Intl.NumberFormat(meta.locale, { style: 'currency', currency }).format(major);
}

export function meetsStripeMinimum(smallestUnits: number, currency: DisplayCurrency): boolean {
  return smallestUnits >= CURRENCY_META[currency].minAmount;
}

// ── Tiers ───────────────────────────────────────────────────────────────────

export type FeatureBullet = {
  type: 'check' | 'gift' | 'gap';
  text: string;
  strong?: string;
  extra?: string;
};

export type PlusPackage = {
  id: PlusPlanId;
  /** Tier name shown as the card title, e.g. "GlowBal Monthly". */
  name: string;
  tierLabel: string;
  /** One-line positioning under the name. */
  tagline: string;
  /** How long Plus stays active for this tier. */
  durationLabel: string;
  durationMonths: number;
  /** Strikethrough anchor price before discount. */
  anchorVnd: number;
  /** Canonical price in VND — all other currencies derive from this. */
  amountVnd: number;
  /** Monthly breakdown description or note. */
  perMonthLabel: string;
  savePill?: string;
  badge?: string;
  badgeType?: 'save' | 'full';
  /** AI strategy credits granted by this tier. */
  aiCredits: number;
  ctaText: string;
  ctaVariant: 'ghost' | 'solid' | 'dark';
  bullets: FeatureBullet[];
  /** Short summary highlights. */
  highlights: string[];
  /** Highlight the middle hero card. */
  highlighted: boolean;
};

export const PLUS_PACKAGES: PlusPackage[] = [
  {
    id: 'plus-starter',
    name: 'GlowBal Monthly',
    tierLabel: 'Monthly',
    tagline: 'Start finding your direction — no commitment yet.',
    durationLabel: '1 month of Plus access',
    durationMonths: 1,
    anchorVnd: 698000,
    amountVnd: 349000,
    perMonthLabel: 'Cancel anytime',
    aiCredits: 25,
    ctaText: 'Try it',
    ctaVariant: 'ghost',
    bullets: [
      {
        type: 'check',
        text: 'Easy / Target / Reach school matching — know exactly where you stand',
      },
      {
        type: 'check',
        text: 'Deadline reminders so you never miss a submission',
      },
      {
        type: 'check',
        text: 'AI CV / SOP review',
        extra: '(limited)',
      },
      {
        type: 'gap',
        text: 'Roadmap capped at 2×/month · no scholarship matching yet',
      },
    ],
    highlights: [
      'Easy / Target / Reach school matching',
      'Deadline reminders',
      'AI CV / SOP review (limited)',
    ],
    highlighted: false,
  },
  {
    id: 'plus-pro',
    name: 'GlowBal Yearly',
    tierLabel: 'Yearly',
    tagline: 'By your side all season — no more ceilings.',
    durationLabel: '12 months of Plus access',
    durationMonths: 12,
    anchorVnd: 4980000,
    amountVnd: 2490000,
    perMonthLabel: 'Just 207,000₫/month',
    savePill: 'You save 2,490,000₫',
    badge: '🏆 Best value',
    badgeType: 'save',
    aiCredits: 120,
    ctaText: 'Start your journey',
    ctaVariant: 'solid',
    bullets: [
      {
        type: 'check',
        text: 'Everything in Monthly,',
        strong: 'every limit removed',
      },
      {
        type: 'check',
        text: 'Unlimited roadmap + CV/SOP edits —',
        strong: 'until your file is flawless',
      },
      {
        type: 'check',
        text: 'Scholarship matching + real-time progress tracking',
      },
      {
        type: 'gift',
        text: '',
        strong: '3 free 1-on-1 sessions',
        extra: 'with a real scholarship mentor',
      },
    ],
    highlights: [
      'Everything in Monthly, every limit removed',
      'Unlimited roadmap + CV/SOP edits',
      'Scholarship matching + tracking',
      '3 free 1-on-1 mentor sessions',
    ],
    highlighted: true,
  },
  {
    id: 'plus-premium',
    name: 'GlowBal Premium',
    tierLabel: 'Yearly Premium',
    tagline: 'Stop carrying it alone — real experts stand behind your application.',
    durationLabel: '12 months of Plus access',
    durationMonths: 12,
    anchorVnd: 8980000,
    amountVnd: 4490000,
    perMonthLabel: '375,000₫/month',
    badge: '⭐ Most complete',
    badgeType: 'full',
    aiCredits: 500,
    ctaText: 'Go with an expert',
    ctaVariant: 'dark',
    bullets: [
      {
        type: 'check',
        text: 'Everything in Yearly — plus',
        strong: 'the human touch',
      },
      {
        type: 'check',
        text: 'Strategy reviewed by a',
        strong: 'real expert',
        extra: ', not just AI',
      },
      {
        type: 'check',
        text: 'An expert checks your',
        strong: 'entire application',
        extra: 'before you submit',
      },
      {
        type: 'gift',
        text: '',
        strong: '5 one-on-one sessions',
        extra: '+ mentor-vetted scholarship strategy',
      },
      {
        type: 'check',
        text: 'Priority support — someone’s always there when you need them',
      },
    ],
    highlights: [
      'Everything in Yearly + expert review',
      'Application checked before submit',
      '5 one-on-one mentor sessions',
      'Priority dedicated support',
    ],
    highlighted: false,
  },
];

// ── Free vs paid comparison matrix ───────────────────────────────────────────

export type PlanColumn = 'free' | PlusPlanId;

export const PLAN_COLUMNS: { key: PlanColumn; name: string }[] = [
  { key: 'free', name: 'Free' },
  { key: 'plus-starter', name: 'Monthly' },
  { key: 'plus-pro', name: 'Yearly' },
  { key: 'plus-premium', name: 'Yearly Premium' },
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
    label: '1:1 mentor sessions',
    values: { free: false, 'plus-starter': false, 'plus-pro': '3 sessions', 'plus-premium': '5 sessions' },
  },
  {
    label: 'Human expert application check',
    values: { free: false, 'plus-starter': false, 'plus-pro': false, 'plus-premium': true },
  },
  {
    label: 'Plus access',
    values: { free: '—', 'plus-starter': '1 month', 'plus-pro': '12 months', 'plus-premium': '12 months' },
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
