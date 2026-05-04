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
  FILTER_CATEGORIES,
  type FilterCategory,
} from '@/lib/university-data';
import type { University } from '@/lib/types';

// ── Extended university type for the explorer ───────────────────────────

export interface ExplorerUniversity {
  // Core fields from Supabase `universities` table
  id: number;
  name: string;
  country: string;
  type?: string | null;
  qs_rank?: number | null;
  the_rank?: number | null;
  strengths?: string | null;
  specific_insight?: string | null;
  teaching_style?: string | null;
  international_environment?: string | null;
  gpa_range?: string | null;
  english_requirement?: string | null;
  standardized_test?: string | null;
  admission_difficulty?: string | null;
  accept_rate?: string | null;
  application_deadline?: string | null;
  scholarship?: string | null;
  tuition_usd?: string | null;
  living_cost_usd?: string | null;
  housing?: string | null;
  industry_connections?: string | null;
  internship_coop?: string | null;
  employability?: string | null;
  best_for?: string | null;
  weaknesses?: string | null;
  notes?: string | null;

  // Computed / display fields
  match_score: number | null;
  is_saved: boolean;

  // Visual fields for the explorer UI (derived from data)
  emoji: string;
  color: string;
  tags: string[];
  rank: string;
  location: string;
  rating: number;
  reviews: number;
  description: string;
  stats: { students: string; staff: string; campuses: string };
  requirements: string[];
  reviewsData: { name: string; stars: number; text: string }[];
}

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

// ── Helper: derive display fields from Supabase university data ─────────

const COUNTRY_EMOJIS: Record<string, string> = {
  'United States': '🇺🇸', 'United Kingdom': '🇬🇧', Canada: '🇨🇦',
  Australia: '🇦🇺', Germany: '🇩🇪', Netherlands: '🇳🇱', France: '🇫🇷',
  Singapore: '🇸🇬', Japan: '🇯🇵', Switzerland: '🇨🇭', Ireland: '🇮🇪',
  Sweden: '🇸🇪', Spain: '🇪🇸', Italy: '🇮🇹', 'South Korea': '🇰🇷',
  'Hong Kong': '🇭🇰', 'New Zealand': '🇳🇿', 'United Arab Emirates': '🇦🇪',
  Qatar: '🇶🇦',
};

const COUNTRY_COLORS: Record<string, string> = {
  'United States': '#1a3a6c', 'United Kingdom': '#4a0a0a', Canada: '#8b0000',
  Australia: '#003d7c', Germany: '#1a1a2e', Netherlands: '#ff6600',
  France: '#002654', Singapore: '#c8102e', Japan: '#bc002d',
  Switzerland: '#d52b1e', Ireland: '#169b62', Sweden: '#006aa7',
  Spain: '#c60b1e', Italy: '#008c45', 'South Korea': '#003478',
  'Hong Kong': '#de2910', 'New Zealand': '#00247d', 'United Arab Emirates': '#00732f',
  Qatar: '#8a1538',
};

function deriveTags(uni: University & { match_score: number | null }): string[] {
  const tags: string[] = [];
  if (uni.qs_rank && uni.qs_rank <= 50) tags.push('Global Top 50');
  if (uni.qs_rank && uni.qs_rank <= 200) tags.push('Top 200');

  const strengths = (uni.strengths ?? '').toLowerCase();
  const bestFor = (uni.best_for ?? '').toLowerCase();
  const combined = `${strengths} ${bestFor}`;

  if (/engineer|cs|computer|data|physics|math|chem|bio|stem/i.test(combined)) tags.push('STEM');
  if (/art|design|music|drama|film|creative|humanities|literature|history|philosophy/i.test(combined)) tags.push('Arts');
  if (/russell group/i.test(uni.notes ?? '')) tags.push('Russell Group');
  if (/business|mba|finance|economics|management/i.test(combined)) tags.push('Business');
  if (/medicine|health|nursing|pharmacy/i.test(combined)) tags.push('Medicine');

  if (tags.length === 0) tags.push(uni.type ?? 'University');
  return tags;
}

export function toExplorerUniversity(
  uni: University & { match_score: number | null; is_saved: boolean },
): ExplorerUniversity {
  const rank = uni.qs_rank ? `#${uni.qs_rank} QS` : uni.the_rank ? `#${uni.the_rank} THE` : '';

  // Build requirements from available data
  const reqs: string[] = [];
  if (uni.gpa_range) reqs.push(`GPA: ${uni.gpa_range}`);
  if (uni.english_requirement) reqs.push(uni.english_requirement);
  if (uni.standardized_test) reqs.push(uni.standardized_test);
  if (uni.admission_difficulty) reqs.push(`Difficulty: ${uni.admission_difficulty}`);
  if (reqs.length === 0) reqs.push('See university website for requirements');

  return {
    ...uni,
    emoji: COUNTRY_EMOJIS[uni.country] ?? '🎓',
    color: COUNTRY_COLORS[uni.country] ?? '#1a3a6c',
    tags: deriveTags(uni),
    rank,
    location: uni.country,
    rating: uni.match_score != null ? Math.round((uni.match_score / 100) * 50) / 10 : 4.5,
    reviews: 0,
    description: uni.specific_insight ?? uni.strengths ?? '',
    stats: {
      students: '—',
      staff: '—',
      campuses: uni.housing ?? '—',
    },
    requirements: reqs,
    reviewsData: [],
  };
}

// ── Provider ────────────────────────────────────────────────────────────

interface ProviderProps {
  children: ReactNode;
  initialUniversities: ExplorerUniversity[];
  initialShortlist: number[];
  initialApplications: ApplicationEntry[];
  isLoggedIn: boolean;
}

export function UniversityExplorerProvider({
  children,
  initialUniversities,
  initialShortlist,
  initialApplications,
  isLoggedIn,
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
