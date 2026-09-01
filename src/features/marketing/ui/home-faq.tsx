import { Section } from '@/shared/ui';
import { getLocaleText, type Locale } from '@/lib/i18n/locale';

export type FaqEntry = {
  question: string;
  answer: string;
};

/** English source copy for Figma 375:10078; the dictionary can translate it later. */
export const HOME_FAQ: readonly FaqEntry[] = [
  {
    question: 'What is GlowBal?',
    answer:
      'GlowBal is a study-abroad planning platform that helps you explore universities, discover scholarships and organise your next steps in one place.',
  },
  {
    question: 'Is GlowBal free?',
    answer:
      'You can explore universities and start building your profile for free. Any optional paid service is clearly explained before it applies.',
  },
  {
    question: 'What is the AI strategy suggestion?',
    answer:
      'It turns the information you add into practical next steps for your university and scholarship plan. It is guidance, so always check official requirements before you apply.',
  },
  {
    question: 'Who are the student supporters?',
    answer:
      'They are students and graduates who share first-hand experience of applications, scholarships and student life. Their availability and areas of expertise vary.',
  },
  {
    question: 'Do I need to know which university I want?',
    answer:
      'No. You can begin with a country, subject or budget and use GlowBal to compare universities before deciding where to apply.',
  },
  {
    question: 'Why do I need to create a profile?',
    answer:
      'Your profile gives GlowBal the context to organise relevant opportunities, save your shortlist and make your next steps more personal.',
  },
];

function ToggleIcon() {
  return (
    <span
      aria-hidden="true"
      className="grid size-[22px] shrink-0 place-items-center rounded-gb-full border-2 border-current text-gb-xs leading-none text-fg-muted"
    >
      <span className="group-open:hidden">+</span>
      <span className="hidden group-open:inline">−</span>
    </span>
  );
}

/** Figma 375:10078 accordion, kept server-rendered with native details/summary. */
export function HomeFaq({ entries = HOME_FAQ, locale = 'en' }: { entries?: readonly FaqEntry[]; locale?: Locale }) {
  return (
    <Section containerClassName="flex flex-col gap-gb-7xl">
      <div className="mx-auto max-w-gb-width-xl text-center">
        <h2 className="font-display text-gb-display-sm font-semibold text-fg md:text-gb-display-md">
          {getLocaleText(locale, 'Frequently asked questions')}
        </h2>
        <p className="mt-gb-2xl text-gb-lg text-fg-tertiary md:text-gb-xl">
          {getLocaleText(locale, 'Everything you need to know about the product and billing.')}
        </p>
      </div>

      <div className="mx-auto w-full max-w-gb-width-xl">
        {entries.map((entry, index) => (
          <details
            key={entry.question}
            className="group border-t border-line pt-gb-3xl [&:not(:first-child)]:mt-gb-4xl"
            {...(index === 0 ? { open: true } : {})}
          >
            <summary className="flex cursor-pointer list-none items-start gap-gb-xl rounded-gb-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1 text-gb-md font-semibold text-fg">{getLocaleText(locale, entry.question)}</span>
              <ToggleIcon />
            </summary>
            <p className="mt-gb-xs max-w-[calc(100%-40px)] text-gb-md text-fg-tertiary">
              {getLocaleText(locale, entry.answer)}
            </p>
          </details>
        ))}
      </div>
    </Section>
  );
}
