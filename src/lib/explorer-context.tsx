'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  APPLICATION_STAGES,
  type FilterCategory,
} from '@/lib/university-data';
import { type ExplorerUniversity } from '@/lib/explorer-utils';

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
  shortlist: number[]; // university IDs
  applications: ApplicationEntry[];
  toast: { message: string; visible: boolean } | null;
}

export interface ExplorerActions {
  setView: (view: ExplorerState['activeView'], universityId?: number) => void;
  setFilter: (filter: FilterCategory) => void;
  addToShortlist: (id: number) => void;
  removeFromShortlist: (id: number) => void;
  isShortlisted: (id: number) => boolean;
  proceedToApplications: () => void;
  advanceApplication: (universityId: number) => void;
  showToast: (message: string) => void;
  universities: ExplorerUniversity[];
  isLoggedIn: boolean;
  hasProfile: boolean;
}

// ── Filter helper ───────────────────────────────────────────────────────

export function filterUniversities(
  universities: ExplorerUniversity[],
  filter: FilterCategory,
): ExplorerUniversity[] {
  if (filter === 'All') return universities;
  const tag = filter === 'Arts & Humanities' ? 'Arts' : filter;
  return universities.filter((u) => u.tags.includes(tag));
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
  hasProfile: boolean;
}

export function UniversityExplorerProvider({
  children,
  initialUniversities,
  initialShortlist,
  initialApplications,
  isLoggedIn,
  hasProfile,
}: ProviderProps) {
  const supabase = useMemo(() => createClient(), []);
  const [activeView, setActiveView] =
    useState<ExplorerState['activeView']>('browse');
  const [selectedUniversityId, setSelectedUniversityId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('All');
  const [shortlist, setShortlist] = useState<number[]>(initialShortlist);
  const [applications, setApplications] = useState<ApplicationEntry[]>(initialApplications);
  const [toast, setToast] = useState<ExplorerState['toast']>(null);

  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Actions ─────────────────────────────────────────────────────────

  const setView = useCallback(
    (view: ExplorerState['activeView'], universityId?: number) => {
      setActiveView(view);
      setSelectedUniversityId(
        view === 'detail' && universityId != null ? universityId : null,
      );
    },
    [],
  );

  const setFilter = useCallback((filter: FilterCategory) => {
    setActiveFilter(filter);
  }, []);

  const addToShortlist = useCallback(
    async (id: number) => {
      setShortlist((prev) => {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      });

      if (!isLoggedIn) return;

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const uni = initialUniversities.find((u) => u.id === id);

      // Persist to Supabase
      const { data: inserted } = await supabase
        .from('user_universities')
        .upsert(
          {
            user_id: userData.user.id,
            university_id: id,
            status: 'interested',
            match_score: uni?.match_score ?? null,
          },
          { onConflict: 'user_id,university_id' },
        )
        .select('id')
        .single();

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
    [isLoggedIn, supabase, initialUniversities],
  );

  const removeFromShortlist = useCallback(
    async (id: number) => {
      setShortlist((prev) => prev.filter((x) => x !== id));

      if (!isLoggedIn) return;

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      await supabase
        .from('user_universities')
        .delete()
        .eq('user_id', userData.user.id)
        .eq('university_id', id);
    },
    [isLoggedIn, supabase],
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
  }, [shortlist, isLoggedIn, supabase]);

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
    [isLoggedIn, supabase, applications],
  );

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

  // ── Context value ───────────────────────────────────────────────────

  const value: ExplorerState & ExplorerActions = {
    activeView,
    selectedUniversityId,
    activeFilter,
    shortlist,
    applications,
    toast,
    universities: initialUniversities,
    setView,
    setFilter,
    addToShortlist,
    removeFromShortlist,
    isShortlisted,
    proceedToApplications,
    advanceApplication,
    showToast,
    isLoggedIn,
    hasProfile,
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
