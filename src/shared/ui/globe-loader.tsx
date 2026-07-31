'use client';

import { useSyncExternalStore } from 'react';
import { useLanguage } from '@/lib/i18n';
import { TID, testId } from '@/shared/lib';
import { LOADING_PHRASES, nextPhraseIndex } from './loading-phrases';

/** How long a phrase holds before the next one fades in. */
const PHRASE_MS = 2400;

/**
 * `size="sm"` is for a loader that shares a panel with other content (an
 * inline "recalculating" state). `"md"` is the standalone popup.
 */
export type GlobeLoaderSize = 'sm' | 'md';

const GLOBE_SIZE: Record<GlobeLoaderSize, string> = {
  sm: 'size-gb-6xl',
  md: 'size-gb-9xl',
};

/**
 * Type size for the rotating line, plus a two-line height reserve.
 *
 * The reserve is not cosmetic. The card is a fixed 240px wide and is centred in
 * the viewport, so a phrase that wraps to two lines ("Checking the weather
 * abroad") makes the card taller than a phrase that does not ("Pondering") —
 * and since it is centred, the whole card jumps every time the ticker fires.
 * Reserving both lines up front costs one empty line under the short phrases
 * and keeps the card still.
 *
 * The values are two lines of the matching line-height, which the spacing scale
 * happens to express exactly: text-md is 16/24, so 2 x 24 = 48 = 6xl; text-sm
 * is 14/20, so 2 x 20 = 40 = 5xl. A case in `loading-overlay.test.tsx` guards
 * the assumption that no phrase needs a third line.
 */
const PHRASE_TEXT: Record<GlobeLoaderSize, string> = {
  sm: 'text-gb-sm min-h-gb-5xl',
  md: 'text-gb-md min-h-gb-6xl',
};

/* ─────────────────────────────────────────────────────────────────────────
   Reduced motion

   useSyncExternalStore rather than useState + useEffect. Both are "read a
   browser value the server cannot know", and this is the primitive built for
   that: it renders the server snapshot during hydration and re-reads the real
   one immediately afterwards, without the mismatch that a lazy initializer
   would cause or the extra render a setState-in-effect would.
   ───────────────────────────────────────────────────────────────────────── */

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

let reducedMotionQuery: MediaQueryList | null = null;
function reducedMotionMedia(): MediaQueryList {
  return (reducedMotionQuery ??= window.matchMedia(REDUCED_MOTION));
}

function subscribeReducedMotion(onChange: () => void) {
  const media = reducedMotionMedia();
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

const getReducedMotion = () => reducedMotionMedia().matches;
/** The server has no OS preference to read; motion is the safe default. */
const getServerReducedMotion = () => false;

/**
 * Exported for other looping-video loaders in the app (the AI Strategy
 * Dashboard's analysis wait, currently) so each one doesn't redefine its own
 * copy of the same media-query subscription.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getServerReducedMotion);
}

/* ─────────────────────────────────────────────────────────────────────────
   The phrase ticker

   One module-level timer shared by every mounted loader, rather than an
   interval per component. Two payoffs beyond the obvious one: two loaders on
   screen at once show the same word instead of drifting out of step, and the
   timer only exists while something is actually being waited on.
   ───────────────────────────────────────────────────────────────────────── */

let phraseIndex = 0;
let phraseTimer: ReturnType<typeof setInterval> | null = null;
const phraseListeners = new Set<() => void>();

function subscribePhrase(onChange: () => void) {
  phraseListeners.add(onChange);

  if (phraseTimer === null) {
    // First loader on screen since the ticker last stopped: jump somewhere new
    // so a user who waits twice in a row does not get the same word both times.
    phraseIndex = nextPhraseIndex(phraseIndex);
    phraseTimer = setInterval(() => {
      phraseIndex = nextPhraseIndex(phraseIndex);
      for (const listener of phraseListeners) listener();
    }, PHRASE_MS);
  }

  return () => {
    phraseListeners.delete(onChange);
    if (phraseListeners.size === 0 && phraseTimer !== null) {
      clearInterval(phraseTimer);
      phraseTimer = null;
    }
  };
}

const getPhraseIndex = () => phraseIndex;
/** Every server render starts at the same phrase — see the hydration note above. */
const getServerPhraseIndex = () => 0;

/**
 * The three dots after the phrase, appearing one at a time.
 *
 * `aria-hidden` because a screen reader announcing "dot dot dot" on a 1.5s
 * loop is not information — the live region on the card already says the app
 * is busy.
 */
function Dots() {
  return (
    <span aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="animate-gb-loader-dot motion-reduce:animate-none"
          style={{ animationDelay: `${i * 220}ms` }}
        >
          .
        </span>
      ))}
    </span>
  );
}

/**
 * The spinning globe on its plate.
 *
 * The clip is a real `<video>` rather than a sprite sheet or a Lottie file
 * because that is what the designer supplied. It is muted + `playsInline`,
 * which together are what iOS Safari requires before it will autoplay at all;
 * dropping either turns this into a still frame on every iPhone.
 *
 * The `poster` covers the gap before the video's first frame decodes — without
 * it the plate is briefly empty, which is the one thing a loading indicator
 * cannot afford.
 */
function Globe({ size }: { size: GlobeLoaderSize }) {
  const reduced = usePrefersReducedMotion();

  return (
    <div
      className={`${GLOBE_SIZE[size]} shrink-0 overflow-hidden rounded-gb-full bg-loader-plate`}
      aria-hidden="true"
    >
      {reduced ? (
        // A background rather than an <img>: the frame is purely decorative
        // (the card's live region carries the meaning), and this way it needs
        // neither an empty alt nor a next/image exemption.
        <div
          className="size-full bg-cover bg-center"
          style={{ backgroundImage: 'url(/loading-globe-poster.jpg)' }}
        />
      ) : (
        <video
          className="size-full object-cover"
          src="/loading-globe.mp4"
          poster="/loading-globe-poster.jpg"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        />
      )}
    </div>
  );
}

/**
 * GlobeLoader — the white card that appears whenever the app is busy.
 *
 * A spinning globe, a playful present-participle that swaps every couple of
 * seconds, and three dots that appear one at a time after it.
 *
 * This is the presentational half. It renders wherever it is placed and knows
 * nothing about *why* the app is busy — `GlobalLoadingOverlay` in
 * `loading-overlay.tsx` is what floats it over the page in response to the
 * loading store, and `LoadingScreen` below is what a route-level `loading.tsx`
 * uses. Render this directly only for a loader that belongs inside one panel.
 *
 * Accessibility: the card is a polite live region naming the *task* (the
 * `label`, or a generic fallback), not the joke. A screen-reader user gets
 * "Saving your profile. Loading." once, and is not re-interrupted every 2.4s
 * when the phrase rotates — which is why the rotating line itself is hidden.
 */
export function GlobeLoader({
  label,
  size = 'md',
  className,
}: {
  /**
   * What the app is actually doing, e.g. "Saving your profile".
   *
   * An English source string, not pre-translated: it goes through `t()` here,
   * so the forty-odd call sites across the app can pass a literal without
   * every one of them having to reach for the language context first. Add the
   * Vietnamese to `i18n-dictionary` alongside the rest of the UI copy.
   */
  label?: string | undefined;
  size?: GlobeLoaderSize;
  className?: string | undefined;
}) {
  const { lang, t } = useLanguage();
  const index = useSyncExternalStore(subscribePhrase, getPhraseIndex, getServerPhraseIndex);

  const phrase = LOADING_PHRASES[index] ?? LOADING_PHRASES[0];
  const text = phrase ? (lang === 'vi' ? phrase.vi : phrase.en) : '';

  return (
    <div
      {...testId(TID.globalLoader)}
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center gap-gb-lg rounded-gb-2xl border border-line bg-surface text-center shadow-gb-lg ${
        size === 'sm' ? 'p-gb-xl' : 'w-gb-width-xs p-gb-3xl'
      } ${className ?? ''}`}
    >
      <Globe size={size} />

      <div className="flex flex-col gap-gb-xxs">
        {/* `key` restarts the fade on every swap; without it React reuses the
            node and the animation only ever plays once. */}
        <p
          key={index}
          aria-hidden="true"
          className={`animate-gb-loader-phrase font-medium text-fg motion-reduce:animate-none ${PHRASE_TEXT[size]}`}
        >
          {text}
          <Dots />
        </p>

        {label ? <p className="text-gb-sm text-fg-muted">{t(label)}</p> : null}
      </div>

      {/* The only thing announced. Deliberately static. */}
      <span className="sr-only">{t(label ?? 'Loading')}</span>
    </div>
  );
}

/**
 * A full-viewport centred GlobeLoader, for a route segment's `loading.tsx`.
 *
 * `min-h-screen` rather than `fixed`: a route-level loading UI replaces the
 * page content, so it should occupy the page rather than float over it. The
 * floating variant is `GlobalLoadingOverlay`.
 *
 * ⚠️ ADDING A `loading.tsx` IS NOT A FREE UI CHANGE. It wraps the segment in a
 * Suspense boundary, which lets Next prerender a static shell for a route that
 * was previously dynamic-and-skipped. The page body then runs at build time —
 * and if its data fetch throws there, the build fails rather than the page
 * falling back to server rendering.
 *
 * This is not hypothetical: a root `src/app/loading.tsx` was tried here and
 * broke `npm run build` on /admin/news, whose layout reads cookies() and whose
 * page fetches through the service-role client. CI builds with placeholder
 * Supabase credentials, so the build-time fetch fails. Note that a Vercel
 * preview will NOT catch this — it builds with real credentials.
 *
 * So: add `loading.tsx` per route, deliberately, and run `npm run build` with
 * placeholder credentials afterwards. Client-side navigation does not need it
 * — `RouteLoading` already covers every route for that.
 */
export function LoadingScreen({ label }: { label?: string | undefined }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-gb-xl">
      <GlobeLoader {...(label === undefined ? {} : { label })} />
    </div>
  );
}

/**
 * The loader floated over a route's own skeleton.
 *
 * For the three segments that already ship a skeleton shaped like the page
 * they are about to become — those are worth keeping, because they hold the
 * layout still and stop the page jumping on arrival. This adds the loader on
 * top so the wait still reads as "working" rather than as a page of grey bars.
 *
 * `pointer-events-none`, unlike `GlobalLoadingOverlay`: there is nothing
 * underneath to protect from a stray click, and swallowing scroll on a
 * full-page skeleton would be actively annoying.
 */
export function PageLoaderOverlay({ label }: { label?: string | undefined }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-gb-xl">
      <div className="animate-gb-loader-in motion-reduce:animate-none">
        <GlobeLoader {...(label === undefined ? {} : { label })} />
      </div>
    </div>
  );
}
