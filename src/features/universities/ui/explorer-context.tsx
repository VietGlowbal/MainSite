'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { setFocusUniversity } from '@/lib/selection-cache';
import {
  APPLICATION_STAGES,
  type FilterCategory,
} from '@/lib/university-data';
import { type ExplorerUniversity } from '@/lib/explorer-utils';
// Country normalisation lives in the domain layer (pure + unit-tested):
// src/features/universities/domain/country.ts
import { countriesMatch } from '@/features/universities/domain';

export type { ExplorerUniversity };

// ── Interfaces ──────────────────────────────────────────────────────────

export interface ApplicationEntry {
  universityId: number;
  userUniversityId: number; // ID in user_universities table
  currentStage: number;
  submittedAt: string;
}

export interface ExplorerState {
  activeView: 'browse' | 'detail' | 'shortlist' | 'applications';
  selectedUniversityId: number | null;
  activeFilter: FilterCategory;
  selectedCountries: string[];
  previewCountry: string | null;
  shortlist: number[]; // university IDs
  applications: ApplicationEntry[];
  toast: { message: string; visible: boolean } | null;
  /** Whether the "log in to continue" gate modal is showing (guest-only). */
  loginGateOpen: boolean;
}

export interface ExplorerActions {
  setView: (view: ExplorerState['activeView'], universityId?: number) => void;
  /** Open the login gate — used to funnel guests toward signing in. */
  requireLogin: () => void;
  closeLoginGate: () => void;
  setFilter: (filter: FilterCategory) => void;
  toggleCountry: (country: string) => void;
  clearCountries: () => void;
  setPreviewCountry: (country: string | null) => void;
  addToShortlist: (id: number) => void;
  removeFromShortlist: (id: number) => void;
  isShortlisted: (id: number) => boolean;
  proceedToApplications: () => void;
  advanceApplication: (universityId: number) => void;
  showToast: (message: string) => void;
  universities: ExplorerUniversity[];
  isLoggedIn: boolean;
  authPending: boolean;
  hasProfile: boolean;
  /** Whether Reach/Recommended/Safe grouping is unlocked (CV or SOP uploaded). */
  admissionUnlocked: boolean;
  /** Applicant strength score (0–100) backing the grouping, when available. */
  profileStrength: number | null;
}

// ── Filter helper ───────────────────────────────────────────────────────

export function filterUniversities(
  universities: ExplorerUniversity[],
  filter: FilterCategory,
  selectedCountries: string[] = [],
): ExplorerUniversity[] {
  return universities.filter((u) => {
    const matchesCountry =
      selectedCountries.length === 0 ||
      selectedCountries.some((country) => countriesMatch(country, u.country));
    if (!matchesCountry) return false;
    if (filter === 'All') return true;
    const tag = filter === 'Arts & Humanities' ? 'Arts' : filter;
    return u.tags.includes(tag);
  });
}

// ── Context ─────────────────────────────────────────────────────────────

const ExplorerContext = createContext<(ExplorerState & ExplorerActions) | null>(
  null,
);

// ── Provider ────────────────────────────────────────────────────────────

interface ProviderProps {
  children: ReactNode;
  initialUniversities: ExplorerUniversity[];
  initialShortlist: number[];
  initialApplications: ApplicationEntry[];
  isLoggedIn: boolean;
  authPending?: boolean;
  hasProfile: boolean;
  admissionUnlocked: boolean;
  profileStrength: number | null;
}

export function UniversityExplorerProvider({
  children,
  initialUniversities,
  initialShortlist,
  initialApplications,
  isLoggedIn,
  authPending = false,
  hasProfile,
  admissionUnlocked,
  profileStrength,
}: ProviderProps) {
  const [activeView, setActiveView] =
    useState<ExplorerState['activeView']>('browse');
  const [selectedUniversityId, setSelectedUniversityId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('All');
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [previewCountry, setPreviewCountry] = useState<string | null>(null);
  const [shortlist, setShortlist] = useState<number[]>(initialShortlist);
  const [applications, setApplications] = useState<ApplicationEntry[]>(initialApplications);
  const [toast, setToast] = useState<ExplorerState['toast']>(null);
  const [loginGateOpen, setLoginGateOpen] = useState(false);

  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // This effect synchronizes server-provided auth data before children render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShortlist((current) =>
      current.length === initialShortlist.length &&
      current.every((id, index) => id === initialShortlist[index])
        ? current
        : initialShortlist,
    );
  }, [initialShortlist]);

  // ── Actions ─────────────────────────────────────────────────────────

  const requireLogin = useCallback(() => setLoginGateOpen(true), []);
  const closeLoginGate = useCallback(() => setLoginGateOpen(false), []);

  const setView = useCallback(
    (view: ExplorerState['activeView'], universityId?: number) => {
      // Opening a university profile (and the scholarship CTA inside it) is
      // gated behind login — guests get the sign-in prompt instead. We collect
      // user data to train the matcher, so anonymous browsing stops at the list.
      if (view === 'detail' && !isLoggedIn) {
        setLoginGateOpen(true);
        return;
      }
      setActiveView(view);
      setSelectedUniversityId(
        view === 'detail' && universityId != null ? universityId : null,
      );
    },
    [isLoggedIn],
  );

  const setFilter = useCallback((filter: FilterCategory) => {
    setActiveFilter(filter);
  }, []);

  const toggleCountry = useCallback((country: string) => {
    setSelectedCountries((prev) => (
      prev.includes(country)
        ? prev.filter((value) => value !== country)
        : [...prev, country]
    ));
  }, []);

  const clearCountries = useCallback(() => {
    setSelectedCountries([]);
  }, []);

  /*
   * Declared here rather than further down with the other feedback helpers
   * because `addToShortlist` depends on it. A useCallback dependency array is
   * evaluated where the hook is called, so naming a `const` defined below this
   * point throws on the TDZ — hoisting is the fix, not an eslint-disable.
   */
  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, visible: true });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 3000);
  }, []);

  const addToShortlist = useCallback(
    async (id: number) => {
      // Remember the chosen university so other pages (e.g. /scholarships) can
      // restore this focus after the user navigates away (see selection-cache).
      const chosen = initialUniversities.find((u) => u.id === id);
      if (chosen) {
        setFocusUniversity({ id: chosen.id, name: chosen.name, country: chosen.country });
      }

      if (!isLoggedIn) {
        setShortlist((prev) => (prev.includes(id) ? prev : [...prev, id]));
        return;
      }

      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Persist to Supabase
      const { data: inserted, error: insertError } = await supabase
        .from('user_universities')
        .upsert(
          {
            user_id: userData.user.id,
            university_id: id,
            status: 'interested',
            match_score: chosen?.match_score ?? null,
          },
          { onConflict: 'user_id,university_id' },
        )
        .select('id')
        .single();

      /*
       * This error used to be discarded, and the optimistic state above was left
       * in place — so a failed save looked exactly like a successful one until
       * the next reload, when the university silently vanished. That is not
       * hypothetical: `public.user_universities` is missing from at least one
       * project this runs against (supabase-schema.sql:151 creates it), and
       * there every save on this page was quietly lost, taking /my-universities
       * and the /apply shortlist down with it.
       *
       * Rolling the optimistic state back is what makes the failure visible.
       */
      if (insertError) {
        console.error('addToShortlist: saving to user_universities failed:', insertError.message);
        showToast('Could not save that university. Please try again.');
        return;
      }

      setShortlist((prev) => (prev.includes(id) ? prev : [...prev, id]));

      // Generate tasks from templates
      if (inserted) {
        const { data: templates } = await supabase
          .from('task_templates')
          .select('*')
          .order('sort_order');

        if (templates && templates.length > 0) {
          const tasks = templates.map(
            (t: { title: string; description: string; category: string; sort_order: number; tips: unknown }) => ({
              user_university_id: inserted.id,
              title: t.title,
              description: t.description,
              category: t.category,
              sort_order: t.sort_order,
              tips: t.tips,
              deadline: null,
            }),
          );
          await supabase.from('application_tasks').insert(tasks);
        }
      }
    },
    [isLoggedIn, initialUniversities, showToast],
  );

  const removeFromShortlist = useCallback(
    async (id: number) => {
      if (!isLoggedIn) {
        setShortlist((prev) => prev.filter((x) => x !== id));
        return;
      }

      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error } = await supabase
        .from('user_universities')
        .delete()
        .eq('user_id', userData.user.id)
        .eq('university_id', id);
      if (error) {
        console.error('removeFromShortlist: deleting user_universities failed:', error.message);
        showToast('Could not update your list. Please try again.');
        return;
      }
      setShortlist((prev) => prev.filter((x) => x !== id));
    },
    [isLoggedIn, showToast],
  );

  const isShortlisted = useCallback(
    (id: number) => shortlist.includes(id),
    [shortlist],
  );

  const proceedToApplications = useCallback(async () => {
    const currentShortlist = [...shortlist];
    setShortlist([]);
    setActiveView('applications');

    if (!isLoggedIn) {
      // Client-only fallback
      setApplications((prevApps) => {
        const newApps = currentShortlist
          .filter((id) => !prevApps.some((a) => a.universityId === id))
          .map((id) => ({
            universityId: id,
            userUniversityId: 0,
            currentStage: 0,
            submittedAt: new Date().toISOString(),
          }));
        return [...prevApps, ...newApps];
      });
      return;
    }

    const supabase = (await import('@/lib/supabase/client')).createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Update status to 'applying' for all shortlisted
    for (const uniId of currentShortlist) {
      await supabase
        .from('user_universities')
        .update({ status: 'applying', updated_at: new Date().toISOString() })
        .eq('user_id', userData.user.id)
        .eq('university_id', uniId);
    }

    // Refresh applications from DB
    const { data: userUnis } = await supabase
      .from('user_universities')
      .select('id, university_id, status, added_at')
      .eq('user_id', userData.user.id)
      .in('status', ['applying', 'applied', 'offer', 'rejected', 'enrolled']);

    if (userUnis) {
      const statusToStage: Record<string, number> = {
        applying: 0,
        applied: 2,
        offer: 5,
        rejected: 5,
        enrolled: 5,
      };
      setApplications(
        userUnis.map((uu: { id: number; university_id: number; status: string; added_at: string }) => ({
          universityId: uu.university_id,
          userUniversityId: uu.id,
          currentStage: statusToStage[uu.status] ?? 0,
          submittedAt: uu.added_at,
        })),
      );
    }
  }, [shortlist, isLoggedIn]);

  const advanceApplication = useCallback(
    async (universityId: number) => {
      const maxStage = APPLICATION_STAGES.length - 1;

      setApplications((prev) =>
        prev.map((app) =>
          app.universityId === universityId && app.currentStage < maxStage
            ? { ...app, currentStage: app.currentStage + 1 }
            : app,
        ),
      );

      if (!isLoggedIn) return;

      // Map stage to status
      const app = applications.find((a) => a.universityId === universityId);
      if (!app) return;

      const newStage = Math.min(app.currentStage + 1, maxStage);
      const stageToStatus: Record<number, string> = {
        0: 'applying',
        1: 'applying',
        2: 'applied',
        3: 'applied',
        4: 'applied',
        5: 'offer',
      };

      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      await supabase
        .from('user_universities')
        .update({
          status: stageToStatus[newStage] ?? 'applying',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userData.user.id)
        .eq('university_id', universityId);
    },
    [isLoggedIn, applications],
  );

  // ── Context value ───────────────────────────────────────────────────

  const value: ExplorerState & ExplorerActions = {
    activeView,
    selectedUniversityId,
    activeFilter,
    selectedCountries,
    previewCountry,
    shortlist,
    applications,
    toast,
    loginGateOpen,
    universities: initialUniversities,
    setView,
    requireLogin,
    closeLoginGate,
    setFilter,
    toggleCountry,
    clearCountries,
    setPreviewCountry,
    addToShortlist,
    removeFromShortlist,
    isShortlisted,
    proceedToApplications,
    advanceApplication,
    showToast,
    isLoggedIn,
    authPending,
    hasProfile,
    admissionUnlocked,
    profileStrength,
  };

  return (
    <ExplorerContext.Provider value={value}>{children}</ExplorerContext.Provider>
  );
}

// ── Convenience hook ────────────────────────────────────────────────────

export function useExplorer(): ExplorerState & ExplorerActions {
  const context = useContext(ExplorerContext);
  if (!context) {
    throw new Error(
      'useExplorer must be used within a UniversityExplorerProvider',
    );
  }
  return context;
}
