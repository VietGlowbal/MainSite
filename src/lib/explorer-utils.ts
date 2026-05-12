// Pure utility functions for the university explorer — no client-only APIs,
// safe to import from both Server and Client Components.

import type { University } from '@/lib/types';
import type { MatchBreakdown } from '@/lib/matching';

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
  match_breakdown: MatchBreakdown | null;
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
  image_url: string;
  stats: { students: string; staff: string; campuses: string };
  requirements: string[];
  reviewsData: { name: string; stars: number; text: string }[];
}

// ── Country mappings ────────────────────────────────────────────────────

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

// ── Tag derivation ──────────────────────────────────────────────────────

function deriveTags(uni: University & { match_score: number | null; match_breakdown?: MatchBreakdown | null }): string[] {
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

function buildUniversityImageUrl(uni: University) {
  const query = encodeURIComponent(`${uni.name} university campus`);
  return `https://source.unsplash.com/1200x800/?${query}`;
}

// ── Main converter ──────────────────────────────────────────────────────

export function toExplorerUniversity(
  uni: University & { match_score: number | null; match_breakdown?: MatchBreakdown | null; is_saved: boolean },
): ExplorerUniversity {
  const rank = uni.qs_rank ? `#${uni.qs_rank} QS` : uni.the_rank ? `#${uni.the_rank} THE` : '';

  const reqs: string[] = [];
  if (uni.gpa_range) reqs.push(`GPA: ${uni.gpa_range}`);
  if (uni.english_requirement) reqs.push(uni.english_requirement);
  if (uni.standardized_test) reqs.push(uni.standardized_test);
  if (uni.admission_difficulty) reqs.push(`Difficulty: ${uni.admission_difficulty}`);
  if (reqs.length === 0) reqs.push('See university website for requirements');

  return {
    ...uni,
    match_breakdown: uni.match_breakdown ?? null,
    emoji: COUNTRY_EMOJIS[uni.country] ?? '🎓',
    color: COUNTRY_COLORS[uni.country] ?? '#1a3a6c',
    tags: deriveTags(uni),
    rank,
    location: uni.country,
    rating: uni.match_score != null ? Math.round((uni.match_score / 100) * 50) / 10 : 4.5,
    reviews: 0,
    description: uni.specific_insight ?? uni.strengths ?? '',
    image_url: buildUniversityImageUrl(uni),
    stats: {
      students: '—',
      staff: '—',
      campuses: uni.housing ?? '—',
    },
    requirements: reqs,
    reviewsData: [],
  };
}
