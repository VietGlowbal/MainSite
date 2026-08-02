'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, usePrefersReducedMotion } from '@/shared/ui';
import { useLanguage } from '@/lib/i18n';

/** Cycled while the analysis is generating. */
const LOADING_MESSAGES = [
  'Analysing profile...',
  'Understanding achievements...',
  'Comparing against course...',
  'Building recommendations...',
] as const;

type LoadState = 'checking' | 'generating' | 'error';

/**
 * `/ai-strategy/[applicationId]/strategy/analysis` — the generation gate.
 *
 * ─── THIS PAGE NO LONGER RENDERS THE REPORTS ─────────────────────────────────
 *
 * It used to generate both analyses and then render them stacked. They are now
 * two pages — `analysis/portrait` and `analysis/fit` — so all this does is make
 * sure both have been generated, then hand off to the first of them.
 *
 * Generation stays here, in one place, rather than moving into the two report
 * pages. Those are server components that render from stored rows; if each
 * generated its own half on demand, opening the fit page first would run one
 * model call, opening the portrait would run another, and a student switching
 * tabs could pay for the same analysis twice. One gate, both calls, then
 * navigate.
 *
 * The redirect is `replace`, not `push`: this page has nothing on it once its
 * job is done, and leaving it in history means Back lands on a spinner that
 * immediately forwards again.
 */
export function AnalysisWorkspace({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [state, setState] = useState<LoadState>('checking');
  const [error, setError] = useState<string | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const ran = useRef(false);

  const portraitHref = `/ai-strategy/${applicationId}/strategy/analysis/portrait`;

  useEffect(() => {
    if (state !== 'generating') return;
    const timer = setInterval(() => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [state]);

  // Arriving here is a client-side push from wherever the previous step left
  // the scroll position (often the bottom of a long form) — without this the
  // loading video renders off-screen and looks like a blank/broken page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void run();

    async function run() {
      try {
        const [applicantRes, matchRes] = await Promise.all([
          fetch(`/api/applications/${applicationId}/strategy/applicant-analysis`),
          fetch(`/api/applications/${applicationId}/strategy/course-match`),
        ]);
        const applicantJson = await applicantRes.json();
        const matchJson = await matchRes.json();

        const needsApplicant = !applicantJson.analysis;
        const needsMatch = !matchJson.analysis;

        if (!needsApplicant && !needsMatch) {
          router.replace(portraitHref);
          return;
        }

        setState('generating');

        const [applicantFinal, matchFinal] = await Promise.all([
          needsApplicant
            ? fetch(`/api/applications/${applicationId}/strategy/applicant-analysis`, {
                method: 'POST',
              }).then((r) => r.json())
            : Promise.resolve(applicantJson),
          needsMatch
            ? fetch(`/api/applications/${applicationId}/match-insights`, { method: 'POST' }).then(
                (r) => r.json(),
              )
            : Promise.resolve(matchJson),
        ]);

        if (applicantFinal.error || matchFinal.error) {
          setError(applicantFinal.error || matchFinal.error);
          setState('error');
          return;
        }

        router.replace(portraitHref);
      } catch {
        setError(t('Something went wrong. Please try again.'));
        setState('error');
      }
    }
  }, [applicationId, portraitHref, router, t]);

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center gap-gb-lg py-gb-7xl text-center">
        <p className="text-gb-md text-fg-error">{error ?? t('Analysis failed.')}</p>
        <Button
          onClick={() => {
            ran.current = false;
            setState('checking');
            setError(null);
          }}
        >
          {t('Try again')}
        </Button>
      </div>
    );
  }

  // `checking` shows the same treatment as `generating` rather than nothing:
  // the two GETs still take a moment, and a blank screen in that window is the
  // bug this page was already fixed for once.
  return (
    <div className="flex flex-col items-center gap-gb-xl py-gb-6xl text-center">
      <AnalysisLoadingVideo />
      <p className="text-gb-xl font-semibold text-fg">
        {state === 'generating' ? t(LOADING_MESSAGES[messageIndex] ?? '') : t('Loading your reports...')}
      </p>
      {state === 'generating' ? (
        <p className="text-gb-sm text-fg-tertiary">{t('This usually takes 30–60 seconds.')}</p>
      ) : null}
    </div>
  );
}

/**
 * Loops for as long as the "generating" state lasts (typically 30-60s, so
 * several loops of the ~10s clip) — same treatment `GlobeLoader`'s `Globe`
 * uses for `/loading-globe.mp4`: muted + `playsInline` (required for iOS
 * Safari autoplay), a `poster` for the gap before the first frame decodes,
 * and a static image instead of motion when the OS asks for reduced motion.
 */
function AnalysisLoadingVideo() {
  const reduced = usePrefersReducedMotion();

  return (
    <div className="w-full max-w-2xl overflow-hidden rounded-gb-2xl shadow-gb-lg" aria-hidden="true">
      {reduced ? (
        <div
          className="aspect-[960/668] w-full bg-cover bg-center"
          style={{ backgroundImage: 'url(/ai-strategy-loading-poster.jpg)' }}
        />
      ) : (
        <video
          className="w-full"
          src="/ai-strategy-loading.mp4"
          poster="/ai-strategy-loading-poster.jpg"
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
