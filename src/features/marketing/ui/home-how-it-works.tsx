import { FeatureCard, Section } from '@/shared/ui';

/**
 * "How GLOWBAL works" — Figma 104:7211 (1440x714, white).
 *
 * The plan called this section "3 thẻ gói học bổng (header đỏ)". It is neither:
 * there are FOUR cards, they are steps rather than pricing tiers, and the only
 * red is the icon tile. Read the node, not the plan.
 *
 * This is the one section on the page whose copy is finished — all four cards
 * are written in Vietnamese, which is why the English below is a translation
 * back rather than the usual other way round. Two things were still kit
 * defaults and are corrected here:
 *
 *  - "Learn more" was left untranslated in an otherwise Vietnamese design.
 *  - The link is painted #6941c6, Untitled UI's purple. That is exactly the
 *    leftover CLAUDE.md flags on the Home frame, so it reads the rose brand
 *    through `text-fg-brand`.
 *
 * The hrefs are mine — the design carries no links. Each points at the route
 * that step actually lands on, and all four exist today.
 *
 * The header is left-aligned here and centred in 104:7164 two sections up. That
 * is the design's choice, not a slip on either side; both were checked.
 */
const STEPS = [
  {
    icon: 'messageChatCircle',
    title: 'Pick a university',
    body: 'Search for a university you care about, or browse by country, major, budget and scholarship odds.',
    href: '/universities',
  },
  {
    icon: 'zap',
    title: 'Create your free GLOWBAL profile',
    body: 'Add your basics so GLOWBAL can surface the scholarships that fit and save your application plan.',
    href: '/onboarding',
  },
  {
    icon: 'chartBreakoutSquare',
    title: 'Choose your scholarships',
    body: 'See the scholarship opportunities tied to the university you picked and save the ones you want to apply for.',
    href: '/scholarships',
  },
  {
    icon: 'messageSmileCircle',
    title: 'Build your AI strategy',
    body: 'Get a personalised strategy showing what to prepare, what to improve, and how to approach each scholarship.',
    href: '/apply',
  },
] as const;

export function HomeHowItWorks() {
  return (
    <Section padded={false} className="py-gb-9xl" containerClassName="flex flex-col gap-gb-7xl">
      <div className="flex w-full max-w-gb-width-xl flex-col gap-gb-2xl">
        {/* No letter-spacing on this one. The four Bricolage headings in this
            file disagree with each other — see the note in tokens.css. */}
        <h2 className="font-display text-gb-display-md font-semibold text-fg">How GLOWBAL works</h2>
        <p className="text-gb-xl text-fg-tertiary">
          No agencies, no endless tabs. Just the clearest path from a dream university to a
          scholarship plan.
        </p>
      </div>

      {/* Four across at 1280 — the design's arrangement — then 2x2, then
          stacked. A grid rather than the design's wrapping flex row: measured at
          1024, that row put three cards up and stretched the fourth across the
          full container on its own. Four steps read better two-and-two anyway. */}
      <div className="grid w-full gap-gb-3xl sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((step) => (
          <FeatureCard
            key={step.title}
            icon={step.icon}
            title={step.title}
            body={step.body}
            href={step.href}
            actionLabel="Learn more"
          />
        ))}
      </div>
    </Section>
  );
}
