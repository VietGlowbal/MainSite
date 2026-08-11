import { Section } from '@/shared/ui';

const TESTIMONIALS = [
  'GlowBal helped me narrow hundreds of options down to the universities genuinely worth considering.',
  'For the first time, I understood why a university suited my profile.',
  'I no longer have to manage everything across different files and notes.',
] as const;

/** Student feedback supplied in Home.md; no names are invented for anonymous quotes. */
export function HomeTestimonials() {
  return (
    <Section
      padded={false}
      className="bg-surface-muted py-gb-9xl"
      containerClassName="flex flex-col gap-gb-7xl"
    >
      <div className="mx-auto max-w-gb-width-xl text-center">
        <p className="text-gb-md font-semibold text-brand">Student stories</p>
        <h2 className="mt-gb-lg font-display text-gb-display-sm font-semibold text-fg md:text-gb-display-md">
          What do students say about GlowBal?
        </h2>
      </div>

      <div className="grid gap-gb-3xl md:grid-cols-3">
        {TESTIMONIALS.map((quote, index) => (
          <figure
            key={quote}
            className="group flex min-h-[300px] flex-col rounded-gb-xl border border-line bg-surface p-gb-4xl shadow-gb-xs transition-transform duration-300 hover:-translate-y-gb-sm hover:shadow-gb-lg"
          >
            <span className="font-display text-gb-display-md font-semibold leading-none text-brand/20">
              “
            </span>
            <blockquote className="mt-gb-lg text-gb-lg font-medium leading-relaxed text-fg-secondary">
              {quote}
            </blockquote>
            <figcaption className="mt-auto flex items-center justify-between border-t border-line pt-gb-2xl text-gb-sm font-semibold text-brand">
              <span>Student feedback</span>
              <span>{String(index + 1).padStart(2, '0')}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
