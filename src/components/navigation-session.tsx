'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { onboardingIsComplete } from '@/features/onboarding';
import { createClient } from '@/lib/supabase/client';

/**
 * Supabase does not emit a browser `storage` event for a write made in this
 * tab. The onboarding wizard dispatches this event after its profile upsert so
 * every mounted navigation can switch audiences without waiting for a reload.
 */
export const NAVIGATION_ONBOARDING_COMPLETED_EVENT =
  'glowbal:navigation-onboarding-completed';

export function notifyNavigationOnboardingCompleted(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(NAVIGATION_ONBOARDING_COMPLETED_EVENT));
}

export type NavigationSessionUser = {
  id: string;
  name: string;
  avatarUrl?: string;
};

export type NavigationSessionValue = {
  /** False until both auth and, when signed in, onboarding state are known. */
  ready: boolean;
  signedIn: boolean;
  user: NavigationSessionUser | null;
  completed: boolean;
};

const UNRESOLVED_SESSION: NavigationSessionValue = {
  ready: false,
  signedIn: false,
  user: null,
  completed: false,
};

const PROFILE_READ_RETRY_DELAY_MS = 50;
const LOGIN_LOGGED_SESSION_KEY = 'gb_login_logged';

const NavigationSessionContext = createContext<NavigationSessionValue | null>(null);

function summarizeUser(user: User): NavigationSessionUser {
  const metadataName = user.user_metadata?.full_name;
  const metadataAvatar = user.user_metadata?.avatar_url;
  const name =
    (typeof metadataName === 'string' && metadataName.trim()) ||
    user.email?.split('@')[0] ||
    'Profile';

  return {
    id: user.id,
    name,
    ...(typeof metadataAvatar === 'string' && metadataAvatar
      ? { avatarUrl: metadataAvatar }
      : {}),
  };
}

function recordLoginAuthEvent(event: string, hasUser: boolean): void {
  try {
    if (event === 'SIGNED_IN' && hasUser) {
      if (window.sessionStorage.getItem(LOGIN_LOGGED_SESSION_KEY) === '1') return;

      window.sessionStorage.setItem(LOGIN_LOGGED_SESSION_KEY, '1');
      if (typeof fetch === 'function') {
        void fetch('/api/auth/login-event', { method: 'POST' }).catch(() => {});
      }
    } else if (event === 'SIGNED_OUT') {
      window.sessionStorage.removeItem(LOGIN_LOGGED_SESSION_KEY);
    }
  } catch {
    // Login telemetry must never interfere with auth or navigation state.
  }
}

function waitForProfileRetry(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, PROFILE_READ_RETRY_DELAY_MS);
  });
}

/**
 * One client-side source of truth for navigation audience state.
 *
 * The initial value is deliberately unresolved. Consumers must wait for
 * `ready` before choosing an audience; otherwise a completed student would see
 * the first-time onboarding action during hydration while Supabase loads.
 */
export function NavigationSessionProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<NavigationSessionValue>(UNRESOLVED_SESSION);

  useEffect(() => {
    let active = true;
    let requestVersion = 0;
    let currentUserId: string | null = null;
    let completedByEventForUserId: string | null = null;
    let sawAuthEvent = false;

    async function syncUser(authUser: User | null) {
      if (!active) return;

      if (!authUser) {
        requestVersion += 1;
        currentUserId = null;
        completedByEventForUserId = null;
        setSession({ ready: true, signedIn: false, user: null, completed: false });
        return;
      }

      const user = summarizeUser(authUser);

      // INITIAL_SESSION and getUser commonly report the same identity. Keep the
      // freshest display metadata, but do not issue the profile read twice.
      if (currentUserId === authUser.id) {
        setSession((current) =>
          current.user?.id === authUser.id ? { ...current, user } : current,
        );
        return;
      }

      currentUserId = authUser.id;
      completedByEventForUserId = null;
      const version = ++requestVersion;

      // Auth is known, onboarding is not. Remaining unresolved here is what
      // prevents the first-time CTA flashing for a completed student.
      setSession({ ready: false, signedIn: true, user, completed: false });

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const { data: profile, error } = await supabase
          .from('student_profiles')
          .select('onboarding_completed, study_level, preferred_countries')
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (!active || version !== requestVersion) return;

        if (!error) {
          setSession({
            ready: true,
            signedIn: true,
            user,
            completed:
              completedByEventForUserId === authUser.id ||
              onboardingIsComplete(profile),
          });
          return;
        }

        // A same-tab wizard save is a stronger signal than a failed read.
        // Its event already resolved the state, so do not retry or overwrite it.
        if (completedByEventForUserId === authUser.id) return;

        if (attempt === 0) {
          await waitForProfileRetry();
          if (
            !active ||
            version !== requestVersion ||
            completedByEventForUserId === authUser.id
          ) {
            return;
          }
        }
      }

      // Persistent read failures intentionally leave this signed-in identity
      // unresolved. Consumers therefore withhold both audience action sets
      // instead of treating an infrastructure error as incomplete onboarding.
    }

    function onOnboardingCompleted() {
      const userId = currentUserId;
      if (!userId) return;

      completedByEventForUserId = userId;
      setSession((current) =>
        current.signedIn && current.user?.id === userId
          ? { ...current, ready: true, completed: true }
          : current,
      );
    }

    window.addEventListener(
      NAVIGATION_ONBOARDING_COMPLETED_EVENT,
      onOnboardingCompleted,
    );

    // One authoritative auth read for the provider's lifetime. If Supabase
    // emits an auth event before it resolves, the newer event wins.
    void supabase.auth.getUser().then(({ data }) => {
      if (!sawAuthEvent) void syncUser(data.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      sawAuthEvent = true;
      recordLoginAuthEvent(event, Boolean(nextSession?.user));
      void syncUser(nextSession?.user ?? null);
    });

    return () => {
      active = false;
      requestVersion += 1;
      window.removeEventListener(
        NAVIGATION_ONBOARDING_COMPLETED_EVENT,
        onOnboardingCompleted,
      );
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <NavigationSessionContext.Provider value={session}>
      {children}
    </NavigationSessionContext.Provider>
  );
}

export function useNavigationSession(): NavigationSessionValue {
  return useContext(NavigationSessionContext) ?? UNRESOLVED_SESSION;
}
