import { Section } from '@/shared/ui';
import { MissingContent } from './missing-content';

/**
 * Home FAQ — Figma 104:7347 (1440x826).
 *
 * Six `_FAQ item` rows, each a 1px top rule with 24px of padding above the
 * question, on a 768px measure centred in the container.
 *
 * Built on <details>/<summary> rather than state: the whole section stays a
 * Server Component, the accordion works before hydration, and browser
 * find-in-page can open a collapsed answer — none of which a useState version
 * gives you. The design's open row (104:7355) is the first one, which is what
 * `defaultOpen` reproduces.
 *
 * ⚠️ THE ANSWERS ARE NOT WRITTEN. The questions are GLOWBAL's own and are
 * copied verbatim from the design, but the one answer the mockup fills in is
 * still Untitled UI's ("Yes, you can try us for free for 30 days..."), and it
 * describes a 30-day trial and an onboarding call that this product does not
 * offer. Every answer here is a claim about pricing, staffing or process, so
 * they have to come from the owner rather than from me. Until then each row
 * shows MissingContent, and this section blocks the "/" swap.
 */

export type FaqEntry = {
  question: string;
  /** Omit until the real answer exists — do not fill with plausible copy. */
  answer?: string;
};

/**
 * The six questions from Figma 104:7355–104:7360, in order.
 *
 * English source strings with Vietnamese in i18n-dictionary.ts, the same as
 * every other Home section; the design writes them in Vietnamese.
 */
export const HOME_FAQ: readonly FaqEntry[] = [
  { question: 'What is GlowBal?' },
  { question: 'Is GlowBal free?' },
  { question: 'What is the AI strategy suggestion?' },
  { question: 'Who are the student supporters?' },
  { question: 'Do I need to know which university I want?' },
  { question: 'Why do I need to create a profile?' },
];

/**
 * The accordion marker, Figma "plus-circle" (2:36547), 24px frame.
 *
 * Written inline rather than through KitIcon because it is two states in one
 * shape: the design shows plus-circle collapsed and minus-circle expanded, and
 * minus-circle is exactly this path minus its vertical stroke. So the ring and
 * the horizontal bar are one path, the vertical bar is a second, and `open`
 * hides the second. Both `d` values are verbatim halves of the export.
 */
function ToggleIcon() {
  return (
    <svg
      viewBox="0 0 22 22"
      width={22}
      height={22}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0 text-fg-muted"
    >
      <path d="M7 11H15M21 11C21 16.5228 16.5228 21 11 21C5.47715 21 1 16.5228 1 11C1 5.47715 5.47715 1 11 1C16.5228 1 21 5.47715 21 11Z" />
      <path d="M11 7V15" className="group-open:hidden" />
    </svg>
  );
}

export function HomeFaq({ entries = HOME_FAQ }: { entries?: readonly FaqEntry[] }) {
  return (
    <Section containerClassName="flex flex-col gap-gb-7xl">
      <div className="mx-auto max-w-gb-width-xl text-center">
        <h2 className="font-display text-gb-display-sm font-medium md:text-gb-display-md">
          Frequently asked questions
        </h2>
        <p className="mt-gb-2xl text-gb-lg text-fg-tertiary md:text-gb-xl">
          Everything you need to know about the product and billing.
        </p>
      </div>

      <div className="mx-auto w-full max-w-gb-width-xl">
        {entries.map((entry, i) => (
          <details
            key={entry.question}
            /* `group` + `group-open:` is what lets the marker react to the
               element's own open state without any JavaScript. */
            className="group border-t border-line pt-gb-3xl [&:not(:first-child)]:mt-gb-4xl"
            {...(i === 0 ? { open: true } : {})}
          >
            <summary className="flex cursor-pointer list-none items-start gap-gb-xl rounded-gb-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1 text-gb-md font-semibold text-fg">
                {entry.question}
              </span>
              <ToggleIcon />
            </summary>
            {entry.answer ? (
              <p className="mt-gb-xs max-w-[calc(100%-40px)] text-gb-md text-fg-tertiary">
                {entry.answer}
              </p>
            ) : (
              <MissingContent
                node="104:7355"
                label={`Câu trả lời cho "${entry.question}"`}
                className="mt-gb-lg"
              />
            )}
          </details>
        ))}
      </div>
    </Section>
  );
}
