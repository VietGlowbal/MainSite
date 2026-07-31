'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearOnboardingDraft,
  ONBOARDING_SKIP_KEY,
  readOnboardingDraft,
  writeOnboardingDraft,
  SupabaseOnboardingRepository,
} from '../api';
import {
  answersFromProfile,
  completedStepCount,
  createEmptyAnswers,
  ONBOARDING_FLOW_STEPS,
  normalizeAnswers,
  type OnboardingAnswers,
  type OnboardingControllerOptions,
  type OnboardingViewModel,
} from '../domain';

export function useOnboardingController({
  initialProfile = null,
  initialResponse = null,
  isSignedIn,
  fromSearch = false,
}: OnboardingControllerOptions): OnboardingViewModel {
  const router = useRouter();
  const repository = useMemo(() => new SupabaseOnboardingRepository(), []);
  const [draft] = useState(() => readOnboardingDraft());
  const [answers, setAnswers] = useState<OnboardingAnswers>(() => {
    const serverAnswers = answersFromProfile(initialProfile, initialResponse);
    if (!draft) return serverAnswers;

    const merged = { ...createEmptyAnswers(), ...serverAnswers };
    for (const key of Object.keys(merged) as Array<keyof OnboardingAnswers>) {
      const serverValue = serverAnswers[key];
      const draftValue = draft.answers[key];
      if (isEmptyAnswer(serverValue) && !isEmptyAnswer(draftValue)) {
        Object.assign(merged, { [key]: draftValue });
      }
    }
    return normalizeAnswers(merged);
  });
  const [currentStepIndex, setCurrentStepIndex] = useState(() => {
    const savedIndex = ONBOARDING_FLOW_STEPS.findIndex((step) => step.id === draft?.stepId);
    return savedIndex >= 0 ? savedIndex : 0;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    writeOnboardingDraft(answers, ONBOARDING_FLOW_STEPS[currentStepIndex]?.id);
  }, [answers, currentStepIndex]);

  const completedSteps = useMemo(() => completedStepCount(answers), [answers]);

  const updateAnswer = useCallback(
    <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) => {
      setAnswers((current) => ({ ...current, [key]: value }));
      setMessage(null);
    },
    [],
  );

  const next = useCallback(() => {
    setCurrentStepIndex((current) => Math.min(current + 1, ONBOARDING_FLOW_STEPS.length - 1));
    setMessage(null);
  }, []);

  const back = useCallback(() => {
    setCurrentStepIndex((current) => Math.max(current - 1, 0));
    setMessage(null);
  }, []);

  const skip = useCallback(() => {
    try {
      window.sessionStorage.setItem(ONBOARDING_SKIP_KEY, '1');
      window.localStorage.setItem('glowbal-search-visited', '1');
    } catch {
      // Ignore browser storage failures.
    }
    router.push('/universities');
  }, [router]);

  const submit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSubmitting(true);
      setMessage(null);
      writeOnboardingDraft(answers, ONBOARDING_FLOW_STEPS[currentStepIndex]?.id);

      if (!isSignedIn) {
        router.push(`/auth?redirect=${encodeURIComponent('/onboarding?complete=1')}`);
        return;
      }

      const result = await repository.saveCurrentUser(answers);
      if (!result.ok) {
        setMessage(result.message);
        setIsSubmitting(false);
        return;
      }

      clearOnboardingDraft();
      if (result.warning) setMessage(result.warning);
      router.push('/universities');
    },
    [answers, currentStepIndex, isSignedIn, repository, router],
  );

  const activeStep = ONBOARDING_FLOW_STEPS[currentStepIndex] ?? ONBOARDING_FLOW_STEPS[0]!;

  return {
    answers,
    completedSteps,
    currentStepIndex,
    activeStep,
    canGoBack: currentStepIndex > 0,
    canGoNext: currentStepIndex < ONBOARDING_FLOW_STEPS.length - 1,
    isSignedIn,
    isSubmitting,
    message,
    fromSearch,
    steps: ONBOARDING_FLOW_STEPS,
    updateAnswer,
    next,
    back,
    skip,
    submit,
  };
}

function isEmptyAnswer(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object') return Object.keys(value).length === 0;
  return typeof value !== 'string' || value.trim().length === 0;
}
