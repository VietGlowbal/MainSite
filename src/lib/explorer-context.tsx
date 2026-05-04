'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  APPLICATION_STAGES,
  type FilterCategory,
  type University,
} from '@/lib/university-data';

// ── Interfaces ──────────────────────────────────────────────────────────

export interface ApplicationEntry {
  universityId: number;
  currentStage: number; // index into APPLICATION_STAGES (0–5)
  submittedAt: string; // ISO date string
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
}

// ── Filter helper ───────────────────────────────────────────────────────

export function filterUniversities(
  universities: University[],
  filter: FilterCategory,
): University[] {
  if (filter === 'All') return universities;
  const tag = filter === 'Arts & Humanities' ? 'Arts' : filter;
  return universities.filter((u) => u.tags.includes(tag));
}

// ── Context ─────────────────────────────────────────────────────────────

const ExplorerContext = createContext<(ExplorerState & ExplorerActions) | null>(
  null,
);

// ── Provider ────────────────────────────────────────────────────────────

export function UniversityExplorerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [activeView, setActiveView] =
    useState<ExplorerState['activeView']>('browse');
  const [selectedUniversityId, setSelectedUniversityId] = useState<
    number | null
  >(null);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('All');
  const [shortlist, setShortlist] = useState<number[]>([]);
  const [applications, setApplications] = useState<ApplicationEntry[]>([]);
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

  const addToShortlist = useCallback((id: number) => {
    setShortlist((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  }, []);

  const removeFromShortlist = useCallback((id: number) => {
    setShortlist((prev) => prev.filter((x) => x !== id));
  }, []);

  const isShortlisted = useCallback(
    (id: number) => shortlist.includes(id),
    [shortlist],
  );

  const proceedToApplications = useCallback(() => {
    setShortlist((prevShortlist) => {
      setApplications((prevApps) => {
        const newApps = prevShortlist
          .filter(
            (id) => !prevApps.some((a) => a.universityId === id),
          )
          .map((id) => ({
            universityId: id,
            currentStage: 0,
            submittedAt: new Date().toISOString(),
          }));
        return [...prevApps, ...newApps];
      });
      return []; // clear shortlist
    });
    setActiveView('applications');
  }, []);

  const advanceApplication = useCallback((universityId: number) => {
    const maxStage = APPLICATION_STAGES.length - 1;
    setApplications((prev) =>
      prev.map((app) =>
        app.universityId === universityId && app.currentStage < maxStage
          ? { ...app, currentStage: app.currentStage + 1 }
          : app,
      ),
    );
  }, []);

  const showToast = useCallback((message: string) => {
    // Clear any existing timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    // Replace any existing toast with the new one
    setToast({ message, visible: true });

    // Auto-dismiss after 3 seconds
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
    setView,
    setFilter,
    addToShortlist,
    removeFromShortlist,
    isShortlisted,
    proceedToApplications,
    advanceApplication,
    showToast,
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
