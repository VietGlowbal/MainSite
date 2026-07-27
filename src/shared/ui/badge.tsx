/**
 * Badge — the kit's `Badge` component.
 *
 * Two shapes, because the design uses two and they are not interchangeable:
 *
 *  - `outline` — a hairline pill on a dark band, 6px radius, text-xs/medium.
 *    Figma I104:7413;3288:570947, the "New" marker in the footer link list.
 *
 *  - the tier variants — fully rounded, filled, text-sm/semibold. These encode
 *    the reach / recommend / safe classification that src/lib/admission-fit.ts
 *    computes, and the redesign promotes to the primary way of navigating the
 *    universities page. Colour pairs come from tokens.css, which deliberately
 *    keeps them separate from the brand ramp even though `reach` resolves to the
 *    same rose today: brand is identity, tier is a risk classification.
 *
 * `admissionBadgeVariant` below is the only sanctioned way to get from an
 * AdmissionCategory to a variant, so the mapping lives in one place rather than
 * being re-derived on every card.
 */

export type BadgeVariant = 'outline' | 'brand-subtle' | 'neutral' | 'reach' | 'recommend' | 'safe';

const VARIANTS: Record<BadgeVariant, string> = {
  outline:
    'rounded-gb-sm border border-line-on-inverse px-gb-sm py-gb-xxs text-gb-xs font-medium text-fg-on-inverse-muted',
  /*
   * Rose text on a rose-50 fill — Figma I105:8403, the ranking badge on the
   * university card ("top 50 toàn cầu"). Distinct from the `reach` tier badge
   * (solid rose, white text): this one is a soft label, not a risk signal.
   */
  'brand-subtle':
    'rounded-gb-full bg-brand-subtle px-gb-lg py-gb-xs text-gb-sm font-medium text-fg-brand',
  /*
   * The unemphasised sibling of `brand-subtle`, same geometry: grey text on a
   * neutral-50 fill. Figma 223:9496/223:9497, the country and institution-type
   * pills on a saved-list row, which sit in the same badge row as two
   * `brand-subtle` ranking pills.
   *
   * The mockup gives these a 1px #fff1f2 border — brand-50 on a neutral-50
   * fill, i.e. invisible, and left over from duplicating the rose pill without
   * changing the stroke. Reproducing an invisible border would only make the
   * pill 2px taller than its sibling, so the border is dropped instead.
   */
  neutral: 'rounded-gb-full bg-surface-muted px-gb-lg py-gb-xs text-gb-sm font-medium text-fg-muted',
  reach: 'rounded-gb-full bg-tier-reach px-gb-lg py-gb-sm text-gb-sm font-semibold text-on-tier-reach',
  recommend:
    'rounded-gb-full bg-tier-recommend px-gb-lg py-gb-sm text-gb-sm font-semibold text-on-tier-recommend',
  safe: 'rounded-gb-full bg-tier-safe px-gb-lg py-gb-sm text-gb-sm font-semibold text-on-tier-safe',
};

export function Badge({
  variant = 'outline',
  className,
  children,
}: {
  variant?: BadgeVariant | undefined;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  const classes = `inline-flex items-center whitespace-nowrap ${VARIANTS[variant]}`;
  return <span className={className ? `${classes} ${className}` : classes}>{children}</span>;
}

/**
 * Maps `AdmissionCategory` from src/lib/admission-fit.ts onto a badge variant.
 *
 * Typed structurally rather than importing the union, because shared/* must not
 * depend on app code (eslint enforces it). The three strings are the same three
 * that ADMISSION_CATEGORY_ORDER exports, so a rename there is a type error here.
 */
export function admissionBadgeVariant(
  category: 'reach' | 'recommended' | 'safe',
): Extract<BadgeVariant, 'reach' | 'recommend' | 'safe'> {
  if (category === 'reach') return 'reach';
  if (category === 'safe') return 'safe';
  return 'recommend';
}
