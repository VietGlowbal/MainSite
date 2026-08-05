export const SCHOLARSHIP_MAJORS = ['all', 'business', 'stem', 'arts', 'health', 'law'] as const;
export type ScholarshipMajor = (typeof SCHOLARSHIP_MAJORS)[number];

export const SCHOLARSHIP_DEGREES = ['all', 'undergraduate', 'postgraduate', 'doctoral'] as const;
export type ScholarshipDegree = (typeof SCHOLARSHIP_DEGREES)[number];

export const SCHOLARSHIP_SORTS = ['relevance', 'deadline', 'name'] as const;
export type ScholarshipSort = (typeof SCHOLARSHIP_SORTS)[number];

export const SCHOLARSHIP_FUNDING = FUNDING_TYPES;
export type ScholarshipFunding = (typeof SCHOLARSHIP_FUNDING)[number];

export type ScholarshipQueryState = {
  search: string;
  universitySearch: string;
  major: ScholarshipMajor;
  degree: ScholarshipDegree;
  country: string;
  funding: ScholarshipFunding[];
  sort: ScholarshipSort;
  page: number;
  universityId: number | null;
  countryPage: number;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
const text = (value: string | string[] | undefined) => first(value).slice(0, 100);
const positiveInt = (value: string | string[] | undefined) => {
  const parsed = Number.parseInt(first(value), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
};
const member = <T extends string>(value: string, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

export function parseScholarshipSearchParams(params: RawSearchParams): ScholarshipQueryState {
  const funding = first(params.funding)
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is ScholarshipFunding =>
      SCHOLARSHIP_FUNDING.includes(value as ScholarshipFunding),
    );
  const universityId = Number.parseInt(first(params.university), 10);

  return {
    search: text(params.q),
    universitySearch: text(params.school),
    major: member(first(params.major), SCHOLARSHIP_MAJORS, 'all'),
    degree: member(first(params.degree), SCHOLARSHIP_DEGREES, 'all'),
    country: text(params.country) || 'all',
    funding: [...new Set(funding)].sort(),
    sort: member(first(params.sort), SCHOLARSHIP_SORTS, 'relevance'),
    page: positiveInt(params.page),
    universityId: Number.isSafeInteger(universityId) && universityId > 0 ? universityId : null,
    countryPage: positiveInt(params.countryPage),
  };
}

const FILTER_KEYS = new Set<keyof ScholarshipQueryState>([
  'search',
  'universitySearch',
  'major',
  'degree',
  'country',
  'funding',
  'sort',
  'universityId',
]);

export function scholarshipSearchParams(
  current: ScholarshipQueryState,
  patch: Partial<ScholarshipQueryState>,
): URLSearchParams {
  const next = { ...current, ...patch };
  if (Object.keys(patch).some((key) => FILTER_KEYS.has(key as keyof ScholarshipQueryState))) {
    next.page = 1;
    next.countryPage = 1;
  }

  const params = new URLSearchParams();
  if (next.search) params.set('q', next.search);
  if (next.universitySearch) params.set('school', next.universitySearch);
  if (next.major !== 'all') params.set('major', next.major);
  if (next.degree !== 'all') params.set('degree', next.degree);
  if (next.country !== 'all') params.set('country', next.country);
  if (next.funding.length > 0) {
    params.set('funding', [...new Set(next.funding)].sort().join(','));
  }
  if (next.sort !== 'relevance') params.set('sort', next.sort);
  if (next.page > 1) params.set('page', String(next.page));
  if (next.universityId != null) params.set('university', String(next.universityId));
  if (next.countryPage > 1) params.set('countryPage', String(next.countryPage));
  return params;
}
import { FUNDING_TYPES } from '@/lib/scholarships';
