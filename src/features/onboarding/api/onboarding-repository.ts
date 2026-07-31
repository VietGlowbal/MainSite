import { createClient } from '@/lib/supabase/client';
import { answersToProfilePatch, completedStepCount, ONBOARDING_FLOW } from '../domain';
import {
  ONBOARDING_FLOW_ID,
  ONBOARDING_FLOW_VERSION,
  type OnboardingAnswers,
} from '../domain';

export type OnboardingSaveResult =
  | { ok: true; warning?: string }
  | { ok: false; message: string };

export interface OnboardingRepository {
  saveCurrentUser(answers: OnboardingAnswers): Promise<OnboardingSaveResult>;
}

/**
 * Browser-safe repository for the onboarding client.
 *
 * The renderer and controller do not know about Supabase. Keeping this adapter
 * behind the feature API also leaves a clean seam for a server action later.
 */
export class SupabaseOnboardingRepository implements OnboardingRepository {
  private readonly supabase = createClient();

  async saveCurrentUser(answers: OnboardingAnswers): Promise<OnboardingSaveResult> {
    const {
      data: userData,
      error: userError,
    } = await this.supabase.auth.getUser();

    if (userError || !userData.user) {
      return { ok: false, message: 'Please sign in so we can save your profile.' };
    }

    const userId = userData.user.id;
    const completedSteps = completedStepCount(answers);
    const now = new Date().toISOString();

    const { error: responseError } = await this.supabase
      .from('student_onboarding_responses')
      .upsert(
        {
          user_id: userId,
          flow_id: ONBOARDING_FLOW_ID,
          flow_version: ONBOARDING_FLOW_VERSION,
          answers,
          completed_steps: completedSteps,
          status: completedSteps === ONBOARDING_FLOW.steps.length ? 'completed' : 'in_progress',
          updated_at: now,
        },
        { onConflict: 'user_id,flow_id,flow_version' },
      );

    const profilePatch = answersToProfilePatch(answers);
    const { error: profileError } = await this.supabase
      .from('student_profiles')
      .upsert(
        {
          user_id: userId,
          ...profilePatch,
          onboarding_completed: true,
          onboarding_completed_at: now,
          updated_at: now,
        },
        { onConflict: 'user_id' },
      );

    if (profileError) {
      return { ok: false, message: profileError.message };
    }

    if (responseError && responseError.code !== '42P01') {
      return {
        ok: true,
        warning: 'Your profile was saved, but the onboarding draft could not be synced yet.',
      };
    }

    return { ok: true };
  }
}
