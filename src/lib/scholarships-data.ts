/**
 * Scholarships directory — server-side data fetch + transforms.
 *
 * Mirrors the universities directory pattern (src/app/universities/page.tsx):
 * the published scholarship list is identical for every visitor, so it's held
 * in Next's Data Cache (unstable_cache) and read with the service-role admin
 * client. Per-user personalization (matching saved universities/countries) is
 * computed in the page/client from the lists this module exposes — never baked
 * into the cached payload.
 *
 * DB: public.scholarships + public.scholarship_universities (supabase-scholarships.sql).
 * Types: src/lib/types.ts (Scholarship, ScholarshipScope, ...).
 */
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ScholarshipScope, ScholarshipStatus } from '@/lib/types';

export const SCHOLARSHIPS_REVALIDATE = 43200; // 12h — matches the universities page

/** Minimal university shape hydrated via the join (we only select what cards need). */
export type ScholarshipUniversityLite = {
  id: number;
  name: string;
  country: string | null;
  logo_url: string | null;
};

/** A published scholarship enriched with display helpers + personalization keys. */
export type DirectoryScholarship = {
  id: number;
  name: string;
  slug: string | null;
  scope: ScholarshipScope;
  country: string | null;
  countryFlag: string | null;
  provider: string | null;
  funding_type: string[];
  coverage: string | null;
  amount_min: number | null;
  amount_max: number | null;
  amount_currency: string | null;
  slots: number | null;
  slots_text: string | null;
  eligibility: string | null;
  applies_to_text: string | null;
  conditions: string | null;
  insight: string | null;
  deadline_date: string | null;
  deadline_text: string | null;
  source_url: string | null;
  source_lang: 'en' | 'vi' | 'mixed' | null;
  ranking_note: string | null;
  // Hydrated from the join:
  universities: ScholarshipUniversityLite[];
  universityIds: number[];
  universityCountries: string[];
  // Computed display helpers:
  amountLabel: string | null;
  deadlineLabel: string | null;
  deadlineSortValue: number; // epoch ms; Infinity when undated (sorts last)
};

// Compact country → flag map (the explorer's COUNTRY_EMOJIS is module-private,
// and the scholarship set spans more countries, so keep a local one here).
const COUNTRY_FLAGS: Record<string, string> = {
  'United States': '🇺🇸', 'United Kingdom': '🇬🇧', Canada: '🇨🇦', Australia: '🇦🇺',
  'New Zealand': '🇳🇿', Ireland: '🇮🇪', France: '🇫🇷', Germany: '🇩🇪', Netherlands: '🇳🇱',
  Belgium: '🇧🇪', Switzerland: '🇨🇭', Italy: '🇮🇹', Spain: '🇪🇸', Sweden: '🇸🇪',
  Japan: '🇯🇵', 'South Korea': '🇰🇷', China: '🇨🇳', 'Hong Kong': '🇭🇰',
  Singapore: '🇸🇬', Vietnam: '🇻🇳',
};

const NUM = new Intl.NumberFormat('en-US');

export function formatAmount(
  min: number | null,
  max: number | null,
  currency: string | null,
): string | null {
  if (min == null && max == null) return null;
  const cur = currency ? ` ${currency}` : '';
  if (min != null && max != null && max !== min) return `${NUM.format(min)}–${NUM.format(max)}${cur}`;
  const value = min ?? max;
  return value == null ? null : `${NUM.format(value)}${cur}`;
}

function formatDeadline(date: string | null, text: string | null): string | null {
  if (date) {
    const t = Date.parse(date);
    if (!Number.isNaN(t)) {
      return new Date(t).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  }
  return text ?? null;
}

// Shape returned by the nested select (loose — Supabase types aren't generated here).
export type ScholarshipRow = {
  id: number;
  name: string;
  slug: string | null;
  scope: ScholarshipScope;
  country: string | null;
  provider: string | null;
  funding_type: string[] | null;
  coverage: string | null;
  amount_min: number | null;
  amount_max: number | null;
  amount_currency: string | null;
  slots: number | null;
  slots_text: string | null;
  eligibility: string | null;
  applies_to_text: string | null;
  conditions: string | null;
  insight: string | null;
  deadline_date: string | null;
  deadline_text: string | null;
  source_url: string | null;
  source_lang: 'en' | 'vi' | 'mixed' | null;
  ranking_note: string | null;
  status: ScholarshipStatus;
  scholarship_universities: Array<{
    university_id: number;
    match_score: number | null;
    confirmed: boolean;
    universities: ScholarshipUniversityLite | null;
  }> | null;
};

export function toDirectoryScholarship(row: ScholarshipRow): DirectoryScholarship {
  const joins = row.scholarship_universities ?? [];
  const universities = joins
    .map((j) => j.universities)
    .filter((u): u is ScholarshipUniversityLite => u != null);
  const universityCountries = [
    ...new Set(universities.map((u) => u.country).filter((c): c is string => !!c)),
  ];

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    scope: row.scope,
    country: row.country,
    countryFlag: row.country ? (COUNTRY_FLAGS[row.country] ?? null) : null,
    provider: row.provider,
    funding_type: row.funding_type ?? [],
    coverage: row.coverage,
    amount_min: row.amount_min,
    amount_max: row.amount_max,
    amount_currency: row.amount_currency,
    slots: row.slots,
    slots_text: row.slots_text,
    eligibility: row.eligibility,
    applies_to_text: row.applies_to_text,
    conditions: row.conditions,
    insight: row.insight,
    deadline_date: row.deadline_date,
    deadline_text: row.deadline_text,
    source_url: row.source_url,
    source_lang: row.source_lang,
    ranking_note: row.ranking_note,
    universities,
    universityIds: joins.map((j) => j.university_id),
    universityCountries,
    amountLabel: formatAmount(row.amount_min, row.amount_max, row.amount_currency),
    deadlineLabel: formatDeadline(row.deadline_date, row.deadline_text),
    deadlineSortValue: row.deadline_date ? (Date.parse(row.deadline_date) || Infinity) : Infinity,
  };
}

// Supabase/PostgREST caps a single response at "Max rows" (default 1000), so the
// full published set (2877+ rows) must be paged in with .range() until exhausted —
// a bare .limit() can't exceed a server-side hard cap.
const SCHOLARSHIPS_PAGE_SIZE = 1000;
export const SCHOLARSHIPS_SELECT = `id, name, slug, scope, country, provider, funding_type, coverage,
   amount_min, amount_max, amount_currency, slots, slots_text,
   eligibility, applies_to_text, conditions, insight,
   deadline_date, deadline_text, source_url, source_lang, ranking_note, status,
   scholarship_universities (
     university_id, match_score, confirmed,
     universities ( id, name, country, logo_url )
   )`;

const getPublishedScholarshipsCached = unstable_cache(
  async (): Promise<DirectoryScholarship[]> => {
    const admin = createAdminClient();
    const rows: ScholarshipRow[] = [];
    for (let from = 0; ; from += SCHOLARSHIPS_PAGE_SIZE) {
      const { data, error } = await admin
        .from('scholarships')
        .select(SCHOLARSHIPS_SELECT)
        .eq('status', 'published')
        .order('name', { ascending: true })
        .order('id', { ascending: true }) // unique tiebreaker → stable paging across batches
        .range(from, from + SCHOLARSHIPS_PAGE_SIZE - 1);

      if (error) {
        console.error('getPublishedScholarships failed:', error.message);
        break; // return whatever was fetched so far rather than dropping everything
      }
      const batch = (data ?? []) as unknown as ScholarshipRow[];
      rows.push(...batch);
      if (batch.length < SCHOLARSHIPS_PAGE_SIZE) break; // last (short) batch → done
    }
    return rows.map(toDirectoryScholarship);
  },
  ['published-scholarships'],
  { revalidate: SCHOLARSHIPS_REVALIDATE, tags: ['scholarships'] },
);

/** All published scholarships, cached in Next's Data Cache (12h / tag 'scholarships'). */
export function getPublishedScholarships() {
  return getPublishedScholarshipsCached();
}

/**
 * Does this scholarship match the logged-in user's saved universities? Returns
 * the match reason so the UI can label "For you" cards and sort them first.
 */
export function scorePersonalMatch(
  s: DirectoryScholarship,
  savedUniversityIds: number[],
  savedCountries: string[],
): { matched: boolean; reason: 'university' | 'country' | null } {
  if (savedUniversityIds.length && s.universityIds.some((id) => savedUniversityIds.includes(id))) {
    return { matched: true, reason: 'university' };
  }
  if (savedCountries.length) {
    if (s.country && savedCountries.includes(s.country)) return { matched: true, reason: 'country' };
    if (s.universityCountries.some((c) => savedCountries.includes(c))) {
      return { matched: true, reason: 'country' };
    }
  }
  return { matched: false, reason: null };
}
