export type UniversityDirectoryQueryState = {
  search: string;
  country: string;
  page: number;
};

export type UniversityRawSearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? '';

export function parseUniversitySearchParams(
  params: UniversityRawSearchParams,
): UniversityDirectoryQueryState {
  const parsedPage = Number.parseInt(first(params.page), 10);
  return {
    search: first(params.q).slice(0, 100),
    country: first(params.country).slice(0, 100),
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

export function universitySearchParams(
  current: UniversityDirectoryQueryState,
  patch: Partial<UniversityDirectoryQueryState>,
): URLSearchParams {
  const next = { ...current, ...patch };
  if ('search' in patch || 'country' in patch) next.page = 1;

  const params = new URLSearchParams();
  if (next.search) params.set('q', next.search.slice(0, 100));
  if (next.country) params.set('country', next.country.slice(0, 100));
  if (next.page > 1) params.set('page', String(next.page));
  return params;
}
