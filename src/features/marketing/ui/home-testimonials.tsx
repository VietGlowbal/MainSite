import Image from 'next/image';
import { Section } from '@/shared/ui';

const TESTIMONIALS = [
  {
    quote:
      'GlowBal helped me narrow hundreds of options down to the universities genuinely worth considering.',
    image: '/images/testimonials/vietnamese-student-01.webp',
  },
  {
    quote: 'For the first time, I understood why a university suited my profile.',
    image: '/images/testimonials/vietnamese-student-02.webp',
  },
  {
    quote: 'I no longer have to manage everything across different files and notes.',
    image: '/images/testimonials/vietnamese-student-03.webp',
  },
] as const;

/**
 * Student feedback supplied in Home.md. The portraits are AI-generated
 * illustrations, and the labels stay anonymous so the layout does not invent
 * an identity for a real quote.
 */
export function HomeTestimonials() {
  return (
    <Section
      tone="dark"
      padded={false}
      className="py-gb-9xl"
      containerClassName="flex flex-col gap-gb-7xl"
    >
      <div className="mx-auto max-w-gb-width-xl text-center">
        <p className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-brand md:text-gb-display-sm">
          Testimonials
        </p>
        <h2 className="mt-gb-xl font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg-on-inverse md:text-gb-display-lg">
          What do students say about GlowBal?
        </h2>
      </div>

      <div className="grid gap-gb-3xl md:grid-cols-3">
        {TESTIMONIALS.map(({ quote, image }, index) => (
          <figure
            key={quote}
            className="group flex h-full flex-col overflow-hidden rounded-gb-2xl border border-line-on-inverse bg-surface-inverse-deep transition-transform duration-300 hover:-translate-y-gb-sm"
          >
            <div className="relative aspect-4/3 overflow-hidden bg-surface-inverse">
              <Image
                src={image}
                alt=""
                fill
                sizes="(min-width: 1280px) 405px, (min-width: 768px) 33vw, calc(100vw - 32px)"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-surface-inverse-strong/90 to-transparent"
              />
              <figcaption className="absolute inset-x-gb-xl bottom-gb-xl flex flex-wrap items-end justify-between gap-gb-md">
                <span className="rounded-gb-xs border border-brand bg-brand px-gb-lg py-gb-sm text-gb-sm font-semibold text-on-brand shadow-gb-xs">
                  Anonymous student
                </span>
                <span className="text-gb-xs font-medium text-fg-on-inverse-secondary">
                  Illustrative portrait
                </span>
              </figcaption>
            </div>

            <div className="relative mx-gb-xl -mt-gb-lg mb-gb-xl flex flex-1 flex-col rounded-gb-xl bg-surface p-gb-3xl shadow-gb-lg">
              <span
                aria-hidden="true"
                className="font-display text-gb-display-lg font-semibold leading-none text-brand"
              >
                “
              </span>
              <blockquote className="-mt-gb-xl text-gb-lg font-medium leading-relaxed text-fg">
                {quote}
              </blockquote>
              <div className="mt-auto flex items-center justify-between border-t border-line pt-gb-xl text-gb-sm font-semibold text-fg-brand">
                <span>Student feedback</span>
                <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              </div>
            </div>
          </figure>
        ))}
      </div>
    </Section>
  );
}
