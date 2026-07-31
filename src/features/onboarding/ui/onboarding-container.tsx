'use client';

import { useOnboardingController } from '../hooks';
import { useSearchParams } from 'next/navigation';
import type { OnboardingControllerOptions } from '../domain';
import { CurrentOnboardingView } from './current-onboarding-view';

export function OnboardingContainer(options: OnboardingControllerOptions) {
  const searchParams = useSearchParams();
  const viewModel = useOnboardingController({
    ...options,
    fromSearch: options.fromSearch ?? searchParams.get('from') === 'search',
  });
  return <CurrentOnboardingView {...viewModel} />;
}
