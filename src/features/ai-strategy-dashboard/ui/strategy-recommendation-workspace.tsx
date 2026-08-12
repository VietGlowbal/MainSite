'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { StrategyRecommendationRecord } from '../domain';
import { StrategyRecommendationReport } from './strategy-recommendation-report';
import { Button, usePrefersReducedMotion } from '@/shared/ui';
import { useLanguage } from '@/lib/i18n';

/** Cycled while the strategy is generating. */
const LOADING_MESSAGES = [
  'Weighing strategic directions...',
  'Positioning your story...',
  'Evaluating your portfolio...',
  'Building your roadmap...',
] as const;

type LoadState = 'checking' | 'generating' | 'ready' | 'error';

/**
 * `/ai-strategy/[applicationId]/strategy/analysis/recommendation` — generation
 * gate AND the report itself, in one page.
 *
 * Unlike `AnalysisWorkspace` (which generates, then hands off to a separate
 * server-rendered report page), F7 has nowhere else to hand off to — this
 * route IS the Personalized Strategy report. So the gate renders the report
 * directly once it has one, instead of redirecting.
 *
 * ─── needsInputs IS A REDIRECT, NOT AN ERROR STATE ───────────────────────────
 *
 * The generation route 422s with `needsInputs: true` when the Personal Report
 * or Matching Report do not exist yet (`fetchOnboardingState`'s
 * `aiAnalysisComplete` should already have caught this and routed the student
 * back to `/strategy/analysis` before they ever reach this page — see
 * `domain/onboarding.ts` — but a server/client state race, or a Matching
 * Report row that was deleted after the redirect ran, can still land someone
 * here). A generic "Try again" button would just retry the same doomed call.
 * Sending them to the generation gate instead gives them a page that can
 * actually produce what is missing.
 */
export function StrategyRecommendationWorkspace({
  applicationId,
}: {
  applicationId: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [state, setState] = useState<LoadState>('checking');
  const [recommendation, setRecommendation] = useState<StrategyRecommendationRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const ran = useRef(false);

  useEffect(() => {
    if (state !== 'generating') return;
    const timer = setInterval(() => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [state]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void run();

    async function run() {
      try {
        const existingRes = await fetch(`/api/applications/${applicationId}/strategy/recommendation`);
        const existing = (await existingRes.json()) as { recommendation?: StrategyRecommendationRecord | null };
        if (existing.recommendation) {
          setRecommendation(existing.recommendation);
          setState('ready');
          return;
        }

        setState('generating');
        const generatedRes = await fetch(`/api/applications/${applicationId}/strategy/recommendation`, {
          method: 'POST',
        });
        const generated = (await generatedRes.json()) as {
          recommendation?: StrategyRecommendationRecord | null;
          error?: string;
          needsInputs?: boolean;
        };

        if (generated.needsInputs) {
          router.replace(`/ai-strategy/${applicationId}/strategy/analysis`);
          return;
        }

        if (!generatedRes.ok || !generated.recommendation) {
          setError(generated.error || t('Something went wrong. Please try again.'));
          setState('error');
          return;
        }

        setRecommendation(generated.recommendation);
        setState('ready');
      } catch {
        setError(t('Something went wrong. Please try again.'));
        setState('error');
      }
    }
  }, [applicationId, router, t]);

  if (state === 'ready' && recommendation) {
    return (
      <StrategyRecommendationReport
        applicationId={applicationId}
        recommendation={recommendation}
      />
    );
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center gap-gb-lg py-gb-7xl text-center">
        <p className="text-gb-md text-fg-error">{error ?? t('Something went wrong.')}</p>
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

  return (
    <div className="flex flex-col items-center gap-gb-xl py-gb-6xl text-center">
      <StrategyLoadingVideo />
      <p className="text-gb-xl font-semibold text-fg">
        {state === 'generating' ? t(LOADING_MESSAGES[messageIndex] ?? '') : t('Loading your strategy...')}
      </p>
      {state === 'generating' ? (
        <p className="text-gb-sm text-fg-tertiary">{t('This usually takes 30–60 seconds.')}</p>
      ) : null}
    </div>
  );
}

/** Same treatment as `AnalysisLoadingVideo` in `analysis-workspace.tsx`. */
function StrategyLoadingVideo() {
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
