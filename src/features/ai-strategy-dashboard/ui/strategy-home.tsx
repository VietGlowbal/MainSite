import { Button, Panel, Section } from '@/shared/ui';

/**
 * Strategy Home — requirements.md Requirement 2, Stage 1 of the V2 journey.
 *
 * ⚠️ NO FIGMA FRAME READ YET. `docs/redesign-status.md` records a real node id
 * for this screen (`375:18445`, canvas Khanh Linh - Chi) that nobody has
 * opened — this is built to the V2 text spec's structure and copy, using the
 * existing Untitled UI token system, per Open decision 1's stated default. A
 * follow-up pass should read the frame and correct layout/spacing/copy
 * against it rather than treat this as final.
 *
 * Testimonials are clearly-fictional placeholders (see TESTIMONIALS below),
 * not real student quotes — also per Open decision 1. There is no demo video
 * asset, so that section is omitted per requirements.md 2.6 rather than
 * rendering a broken embed.
 */

const HOW_IT_WORKS = [
  { step: 1, title: 'Review your profile' },
  { step: 2, title: 'Add achievements' },
  { step: 3, title: 'AI analyses your application' },
  { step: 4, title: 'AI compares you against your course' },
  { step: 5, title: 'Receive a live improvement roadmap' },
] as const;

const BENEFITS = [
  { title: 'Personalised', body: 'Every recommendation is unique.' },
  { title: 'AI Powered', body: 'Analyses hundreds of factors instantly.' },
  {
    title: 'Continuously Updated',
    body: 'Improve something? Your strategy updates automatically.',
  },
  {
    title: 'Course Specific',
    body: 'Every recommendation is based on your chosen university course.',
  },
] as const;

/** Placeholder — not real student quotes. See the file-level note. */
const TESTIMONIALS = [
  { quote: 'I had no idea what universities actually wanted.', attribution: 'Sample testimonial' },
  {
    quote: 'The strategy showed me weaknesses I never considered.',
    attribution: 'Sample testimonial',
  },
  {
    quote: 'It made the application process much less stressful.',
    attribution: 'Sample testimonial',
  },
] as const;

export function StrategyHome({
  courseName,
  universityName,
  startHref,
}: {
  courseName: string;
  universityName: string;
  startHref: string;
}) {
  return (
    <div className="flex flex-col gap-gb-7xl">
      <Section padded={false} className="py-gb-7xl" containerClassName="flex flex-col items-center gap-gb-2xl text-center">
        <p className="text-gb-sm font-semibold text-fg-brand">
          {courseName} · {universityName}
        </p>
        <h1 className="max-w-gb-width-xl font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg">
          Build your personalised roadmap into university.
        </h1>
        <p className="max-w-gb-width-xl text-gb-xl text-fg-tertiary">
          Our AI analyses your profile, compares you against your chosen university course, and
          creates a personalised action plan that updates as you improve.
        </p>
        <Button href={startHref} size="lg" className="min-w-64">
          Start My Strategy
        </Button>
      </Section>

      <Section padded={false} containerClassName="flex flex-col gap-gb-3xl">
        <h2 className="font-display text-gb-display-sm font-semibold text-fg">How it works</h2>
        <div className="grid gap-gb-3xl sm:grid-cols-2 lg:grid-cols-5">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} className="flex flex-col gap-gb-md">
              <span className="flex size-[40px] items-center justify-center rounded-gb-full bg-brand-subtle text-gb-md font-semibold text-fg-brand">
                {item.step}
              </span>
              <p className="text-gb-md font-semibold text-fg">{item.title}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section padded={false} containerClassName="flex flex-col gap-gb-3xl">
        <div className="grid gap-gb-3xl sm:grid-cols-2 xl:grid-cols-4">
          {BENEFITS.map((benefit) => (
            <Panel key={benefit.title}>
              <p className="text-gb-lg font-semibold text-fg">{benefit.title}</p>
              <p className="mt-gb-xs text-gb-sm text-fg-tertiary">{benefit.body}</p>
            </Panel>
          ))}
        </div>
      </Section>

      <Section padded={false} containerClassName="flex flex-col gap-gb-3xl">
        <h2 className="font-display text-gb-display-sm font-semibold text-fg">
          What students say
        </h2>
        <div className="grid gap-gb-3xl sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <Panel key={t.quote}>
              <p className="text-gb-md text-fg">“{t.quote}”</p>
              <p className="mt-gb-lg text-gb-sm text-fg-tertiary">{t.attribution}</p>
            </Panel>
          ))}
        </div>
      </Section>

      <Section padded={false} containerClassName="flex flex-col items-center gap-gb-lg text-center">
        <Button href={startHref} size="lg" className="min-w-64">
          Start My Strategy
        </Button>
      </Section>
    </div>
  );
}
