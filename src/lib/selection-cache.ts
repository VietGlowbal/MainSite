/**
 * selection-cache — tiny localStorage-backed cache for cross-page selection
 * continuity. The app's explorer/scholarship state is otherwise per-page, so a
 * chosen university (which scopes the scholarships page) and the Compare list
 * are lost the moment the user navigates away. These helpers let those
 * selections survive client-side navigation.
 *
 * Mirrors the guarded-localStorage pattern already used for the onboarding
 * draft (see components/onboarding/onboarding-single-page.tsx). All access is
 * wrapped so it is safe to call during SSR (no-op) and never throws.
 */

const FOCUS_KEY = 'glowbal-focus-university';
const COMPARE_KEY = 'glowbal-compare-ids';

export type FocusUniversity = {
  id: number;
  name: string;
  country: string;
};

function readJSON<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full / disabled — non-fatal
  }
}

// ── Focused / chosen university ──────────────────────────────────────────

export function getFocusUniversity(): FocusUniversity | null {
  const v = readJSON<FocusUniversity>(FOCUS_KEY);
  if (!v || typeof v.id !== 'number' || !v.name) return null;
  return v;
}

export function setFocusUniversity(u: FocusUniversity): void {
  writeJSON(FOCUS_KEY, { id: u.id, name: u.name, country: u.country });
}

export function clearFocusUniversity(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(FOCUS_KEY);
  } catch {
    // non-fatal
  }
}

// ── Compare list ─────────────────────────────────────────────────────────

export function getCompareIds(): number[] {
  const v = readJSON<number[]>(COMPARE_KEY);
  return Array.isArray(v) ? v.filter((n) => typeof n === 'number') : [];
}

export function setCompareIds(ids: number[]): void {
  writeJSON(COMPARE_KEY, ids);
}
