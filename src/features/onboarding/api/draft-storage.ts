import { migrateLegacyAnswers, normalizeAnswers } from '../domain';
import type { OnboardingAnswers } from '../domain';

export const ONBOARDING_DRAFT_KEY = 'glowbal-onboarding-v2-draft';
export const ONBOARDING_SKIP_KEY = 'glowbal-onboarding-skipped';

type DraftPayload = {
  version: 2;
  answers: OnboardingAnswers;
  stepId?: string;
};

export type OnboardingDraftState = {
  answers: OnboardingAnswers;
  stepId?: string;
};

export function readOnboardingDraft(): OnboardingDraftState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DraftPayload>;
      if (parsed.version === 2 && parsed.answers) {
        return {
          answers: normalizeAnswers(parsed.answers),
          ...(parsed.stepId ? { stepId: parsed.stepId } : {}),
        };
      }
    }

    const legacyRaw = window.localStorage.getItem('glowbal-onboarding-draft');
    if (!legacyRaw) return null;
    const migrated = migrateLegacyAnswers(JSON.parse(legacyRaw));
    return migrated ? { answers: migrated } : null;
  } catch {
    return null;
  }
}

export function writeOnboardingDraft(answers: OnboardingAnswers, stepId?: string): void {
  if (typeof window === 'undefined') return;

  try {
    const payload: DraftPayload = {
      version: 2,
      answers,
      ...(stepId ? { stepId } : {}),
    };
    window.localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // A full localStorage or privacy mode should not block onboarding.
  }
}

export function clearOnboardingDraft(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
    window.localStorage.removeItem('glowbal-onboarding-draft');
  } catch {
    // Ignore storage failures during cleanup.
  }
}
