'use client';

import { useCallback, useRef } from 'react';
import { T, useT } from '@/lib/i18n';
import { Button, Container, ICONS, KitIcon, Panel } from '@/shared/ui';
import { HeroGlobe } from '../hero-globe';
import { StrategyHubReports } from './strategy-hub-reports';
import { StrategyHubSoundToggle } from './strategy-hub-sound-toggle';
import { StrategyHubTour } from './strategy-hub-tour';
import { useStrategyHubSound } from './use-strategy-hub-sound';

const TRUST_ITEMS = [
  'Built around your profile',
  'Different for every application',
  'Made for real applications',
] as const;

/**
 * Keyframes for the Strategy Hub's decorative motion, ported from the
 * approved prototype (`GlowBal_Strategy_Hub_Best_Combined_Demo_v2.html`).
 * Defined once here rather than in `globals.css` because nothing else on the
 * site uses them — same call `match-badge.tsx` makes for its one-off
 * `fadeIn` keyframes. Every consumer pairs the `motion-safe:animate-[...]`
 * utility with a `motion-reduce:` fallback, so this whole block does nothing
 * for a visitor who has asked for reduced motion.
 */
function StrategyHubKeyframes() {
  return (
    <style>{`
      @keyframes gbStrategyVideoLogoBob { 50% { transform: translateY(-7px) rotate(4deg); } }
      @keyframes gbStrategyProgress { to { width: 100%; } }
      @keyframes gbStrategyPopCard { to { opacity: 1; transform: none; } }
      @keyframes gbStrategyPreviewIn {
        from { opacity: 0; transform: translateY(10px) scale(.985); }
        to { opacity: 1; transform: none; }
      }
      @keyframes gbStrategyBallFloat { 50% { transform: translateY(-18px) translateX(8px) scale(1.12); } }
    `}</style>
  );
}

export function StrategyHub({ isSignedIn }: { isSignedIn: boolean }) {
  const t = useT();
  const sound = useStrategyHubSound();
  const tourPlayRef = useRef<() => void>(() => undefined);

  const registerTourPlay = useCallback((play: () => void) => {
    tourPlayRef.current = play;
  }, []);

  function watchTour() {
    document.getElementById('tour')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => tourPlayRef.current(), 400);
  }

  return (
    <>
      <StrategyHubKeyframes />

      {/* Hero */}
      <section className="relative overflow-hidden pt-gb-7xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[-180px] inset-y-0 -z-10"
          style={{
            background:
              'radial-gradient(circle at 13% 23%, color-mix(in srgb, var(--color-brand) 7%, transparent), transparent 27%), ' +
              'radial-gradient(circle at 87% 22%, color-mix(in srgb, var(--color-gb-tier-recommend) 6%, transparent), transparent 26%)',
          }}
        />
        <Container className="grid items-center gap-gb-5xl pb-gb-6xl lg:grid-cols-[1.02fr_0.98fr]">
          <div className="flex flex-col items-start gap-gb-md">
            <div className="flex flex-wrap items-center gap-gb-lg">
              <p className="flex items-center gap-gb-sm text-gb-xs font-semibold uppercase tracking-[0.14em] text-fg-brand">
                <span className="flex h-gb-3xl w-gb-3xl items-center justify-center rounded-gb-md bg-brand-subtle" aria-hidden="true">
                  ✦
                </span>
                <T k="Your GlowBal Strategy" />
              </p>
              <StrategyHubSoundToggle enabled={sound.enabled} onToggle={sound.toggle} />
            </div>

            <h1 className="max-w-xl font-display text-gb-display-xl font-semibold leading-[0.99] tracking-gb-display-tight text-fg">
              <T k="Build a strategy for wherever you apply." />
            </h1>

            <p className="max-w-lg text-gb-lg leading-relaxed text-fg-tertiary">
              <T k="Open an application in My Portal and GlowBal builds the strategy around the exact university and course you picked." />
            </p>

            <div className="flex flex-wrap items-center gap-gb-lg pt-gb-md">
              <Button href="/apply" size="xl" onClick={sound.playFanfare}>
                <T k="Go to My Portal" />
              </Button>
              <Button
                variant="secondary"
                size="xl"
                onClick={() => {
                  sound.playChime();
                  watchTour();
                }}
              >
                <span
                  aria-hidden="true"
                  className="flex h-gb-2xl w-gb-2xl items-center justify-center rounded-full bg-brand-subtle text-fg-brand"
                >
                  ▶
                </span>
                <T k="Watch the 90 sec tour" />
              </Button>
            </div>

            <ul className="flex flex-wrap gap-gb-xl pt-gb-md">
              {TRUST_ITEMS.map((item) => (
                <li key={item} className="flex items-center gap-gb-sm text-gb-xs font-semibold text-fg-tertiary">
                  <span
                    aria-hidden="true"
                    className="flex h-gb-2xl w-gb-2xl items-center justify-center rounded-full bg-brand-subtle text-fg-brand"
                  >
                    <KitIcon art={ICONS.checkCircle} frame={14} />
                  </span>
                  {t(item)}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative flex min-h-[26rem] items-center justify-center">
            <HeroGlobe className="w-[85%] max-w-[26rem]" />
          </div>
        </Container>
      </section>

      <StrategyHubTour onPlay={sound.playChime} registerPlay={registerTourPlay} />
      <StrategyHubReports onSelect={sound.playBubble} />

      {/* Final CTA */}
      <section className="pt-gb-9xl">
        <Container>
          <Panel
            padding="md"
            className="relative overflow-hidden bg-brand text-center text-on-brand"
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="absolute h-gb-3xl w-gb-3xl rounded-full bg-white/15 motion-safe:animate-[gbStrategyBallFloat_6s_ease-in-out_infinite]"
                  style={{
                    left: `${12 + i * 24}%`,
                    top: i % 2 === 0 ? '18%' : '62%',
                    animationDelay: `${i * 0.8}s`,
                  }}
                />
              ))}
            </div>
            <div className="relative mx-auto flex max-w-xl flex-col items-center gap-gb-lg py-gb-xl">
              <h2 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight">
                <T k="Ready to choose where you are going?" />
              </h2>
              <p className="text-gb-md text-on-brand/85">
                <T k="Open an application in My Portal and GlowBal will build the strategy from there." />
              </p>
              <Button
                href="/apply"
                variant="secondary"
                size="xl"
                onClick={sound.playFanfare}
              >
                <T k="Go to My Portal" />
              </Button>
            </div>
          </Panel>
        </Container>
      </section>

      {/* Signed-out visitors get the sign-up close, same as the previous /ai-strategy explainer. */}
      {isSignedIn ? null : (
        <section className="pt-gb-6xl">
          <Container>
            <Panel className="flex flex-col items-start gap-gb-lg">
              <h2 className="font-display text-gb-xl font-semibold text-fg">
                <T k="Ready to start yours?" />
              </h2>
              <p className="max-w-2xl text-gb-md text-fg-tertiary">
                <T k="Create a free account to save universities, plan an application and build your first strategy." />
              </p>
              <div className="flex flex-wrap gap-gb-lg">
                <Button href="/auth" size="lg">
                  <T k="Create an account" />
                </Button>
                <Button href="/how-it-works" variant="secondary" size="lg">
                  <T k="Read how GlowBal works" />
                </Button>
              </div>
            </Panel>
          </Container>
        </section>
      )}
    </>
  );
}
