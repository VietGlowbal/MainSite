import { ProgressBar } from '@/shared/ui';

/**
 * "GlowBal's AI is reading this course page" — the state between pasting a URL
 * and having a checklist.
 *
 * WHY THIS EXISTS. That window is a minute or so of an application row that has
 * a placeholder name, no course, no country, no deadline and no tasks. Every
 * screen rendered it as an absence: "Unknown University" as the page heading, a
 * padlock over "No tasks yet", a 0% ring. Absence is indistinguishable from
 * breakage, and students read it as breakage. Nothing here is new information —
 * it is the same pending row, said out loud.
 *
 * WHY THE LIST IS NOT A STEP INDICATOR. The obvious build is a checklist that
 * ticks off "Opening the page → Reading requirements → Finding deadlines" as
 * the worker advances. We do not know which step the worker is on: the job runs
 * in the background and reports only queued / running / done. Animating a step
 * cursor over it would be inventing progress, so the items below are framed as
 * what the AI is gathering — true for the whole window, and it never claims a
 * step is finished that might not be.
 *
 * Same reason the bar is indeterminate. See ProgressBar for why a fake 90% is
 * worse than an honest sweep.
 */

/** What the extractor pulls out of a course page. See lib/course-parser. */
const GATHERING = [
  'Course name, level and subject',
  'Entry requirements and grades',
  'Application deadlines',
  'Official links worth keeping',
  'The steps you need to take',
];

export function ResearchProgress({
  /** The course URL's host, when there is nothing better to name the target. */
  target,
  className,
}: {
  target?: string | null | undefined;
  className?: string | undefined;
}) {
  return (
    <section
      aria-live="polite"
      className={`flex flex-col gap-gb-2xl rounded-gb-2xl border border-line bg-surface p-gb-4xl ${className ?? ''}`}
    >
      <div className="flex flex-col gap-gb-md">
        <div className="flex items-center gap-gb-md">
          <PulseDot />
          <h2 className="font-display text-gb-xl font-semibold text-fg">
            GlowBal&rsquo;s AI is reading the course page
          </h2>
        </div>
        <p className="text-gb-md text-fg-tertiary">
          {target ? (
            <>
              We&rsquo;re going through <span className="font-semibold text-fg-secondary">{target}</span>{' '}
              and building your application checklist. This usually takes about a minute — the page
              fills in on its own.
            </>
          ) : (
            <>
              We&rsquo;re going through the official course page and building your application
              checklist. This usually takes about a minute — the page fills in on its own.
            </>
          )}
        </p>
      </div>

      <ProgressBar label="Reading the course page" />

      <div className="flex flex-col gap-gb-lg">
        <h3 className="text-gb-sm font-semibold text-fg-secondary">What we&rsquo;re gathering</h3>
        <ul className="flex flex-col gap-gb-md">
          {GATHERING.map((item, index) => (
            <li key={item} className="flex items-center gap-gb-lg text-gb-sm text-fg-tertiary">
              {/* Staggered so the column reads as a queue being worked through
                  rather than five things blinking in unison. */}
              <span
                aria-hidden="true"
                style={{ animationDelay: `${index * 180}ms` }}
                className="size-gb-lg shrink-0 animate-pulse rounded-gb-full bg-line-strong motion-reduce:animate-none"
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * A soft pulsing dot — "something is happening right now".
 *
 * Two stacked spans rather than one animated element: the outer ring fades and
 * expands while the solid core stays put, so the mark never disappears at the
 * trough of the animation the way a single pulsing dot does.
 */
function PulseDot() {
  return (
    <span aria-hidden="true" className="relative flex size-gb-lg shrink-0">
      <span className="absolute inline-flex size-full animate-ping rounded-gb-full bg-brand opacity-75 motion-reduce:animate-none" />
      <span className="relative inline-flex size-full rounded-gb-full bg-brand" />
    </span>
  );
}

/**
 * The one-line version, for panels too small to carry the full block — the
 * banner subtitle, the progress card in the sidebar, a row in the list.
 */
export function ResearchingInline({
  children = 'Researching this course…',
  className,
}: {
  children?: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <span
      aria-live="polite"
      className={`inline-flex items-center gap-gb-md text-gb-sm text-fg-tertiary ${className ?? ''}`}
    >
      <PulseDot />
      {children}
    </span>
  );
}
