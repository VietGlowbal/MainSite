'use client';

import { useEffect, useRef, useState } from 'react';
import { T, useT } from '@/lib/i18n';
import { Container } from '@/shared/ui';

const PLAY_DURATION_MS = 8200;

const POP_CARDS = [
  { text: 'Profile analysed', position: 'left-[6%] top-[18%]', delayMs: 700 },
  { text: 'Application selected', position: 'right-[7%] top-[29%]', delayMs: 2000 },
  { text: 'New strategy recommendation', position: 'left-[13%] bottom-[15%]', delayMs: 3300 },
  { text: 'Actions ready', position: 'right-[12%] bottom-[14%]', delayMs: 4800 },
] as const;

type TourState = 'idle' | 'playing' | 'done';

const COPY: Record<TourState, { title: string; body: string }> = {
  idle: {
    title: 'Meet your GlowBal strategy hub.',
    body: 'This short animation shows how a student moves from profile to strategy — open an application in My Portal to see it built for real.',
  },
  playing: {
    title: 'GlowBal is connecting the dots…',
    body: 'Profile, university match, reports, strategy and actions — all built from the application you choose.',
  },
  done: {
    title: "That's the whole journey.",
    body: 'Open My Portal to start building your own.',
  },
};

export function StrategyHubTour({
  onPlay,
  registerPlay,
}: {
  onPlay: () => void;
  /** Lets the hero's "Watch the tour" CTA trigger this section's play state. */
  registerPlay: (play: () => void) => void;
}) {
  const t = useT();
  const [state, setState] = useState<TourState>('idle');
  const [runId, setRunId] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function play() {
    onPlay();
    setState('playing');
    setRunId((id) => id + 1);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState('done'), PLAY_DURATION_MS);
  }

  useEffect(() => {
    registerPlay(play);
    // registerPlay identity is stable from the parent (useCallback); play()
    // itself is recreated each render but only its latest closure is needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerPlay]);

  const copy = COPY[state];

  return (
    <section id="tour" className="pt-gb-9xl">
      <Container className="flex flex-col gap-gb-3xl">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-gb-sm text-center">
          <p className="flex items-center gap-gb-sm text-gb-xs font-semibold uppercase tracking-[0.14em] text-fg-brand">
            <span aria-hidden="true">▶</span>
            <T k="See it in action" />
          </p>
          <h2 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
            <T k="Everything starts here." />
          </h2>
          <p className="text-gb-sm leading-relaxed text-fg-tertiary">
            <T k="See how GlowBal turns your profile into a strategy for any university or course you decide to apply to." />
          </p>
        </div>

        <div className="mx-auto w-full max-w-4xl rounded-gb-2xl border border-line bg-gradient-to-br from-brand-subtle via-surface to-info-subtle p-gb-md shadow-gb-md">
          <div className="relative overflow-hidden rounded-gb-xl border border-line bg-surface p-gb-3xl">
            {state === 'playing' && (
              <div
                key={runId}
                className="absolute inset-x-0 top-0 h-1 bg-line"
                aria-hidden="true"
              >
                <span
                  className="block h-full origin-left bg-brand motion-safe:animate-[gbStrategyProgress_8s_linear_forwards] motion-reduce:w-full"
                />
              </div>
            )}

            <div className="relative flex flex-col items-center gap-gb-xl text-center sm:flex-row sm:text-left">
              <button
                type="button"
                onClick={play}
                aria-label={t('Watch the 90 sec tour')}
                className="flex h-gb-9xl w-gb-9xl shrink-0 items-center justify-center rounded-full bg-brand text-gb-xl text-on-brand shadow-gb-md transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand motion-reduce:transition-none"
              >
                <span aria-hidden="true" className="motion-safe:animate-[gbStrategyVideoLogoBob_3s_ease-in-out_infinite]">
                  {state === 'idle' ? '▶' : '↻'}
                </span>
              </button>
              <div className="flex flex-col gap-gb-sm">
                <h3 className="font-display text-gb-xl font-semibold text-fg">{t(copy.title)}</h3>
                <p className="max-w-md text-gb-sm leading-relaxed text-fg-tertiary">{t(copy.body)}</p>
              </div>
            </div>

            {state === 'playing' && (
              <div key={`pops-${runId}`} aria-hidden="true">
                {POP_CARDS.map((card) => (
                  <span
                    key={card.text}
                    style={{ animationDelay: `${card.delayMs}ms` }}
                    className={[
                      'absolute hidden rounded-gb-full border border-line bg-surface px-gb-lg py-gb-sm text-gb-xs font-semibold text-fg-secondary shadow-gb-sm',
                      'opacity-0 motion-safe:animate-[gbStrategyPopCard_0.45s_ease-out_forwards] sm:block',
                      card.position,
                    ].join(' ')}
                  >
                    {t(card.text)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
