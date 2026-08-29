import { canonicalizeUrl } from '@/lib/ingestion/url-utils';

export type CourseCatalogueCandidate = {
  id: string;
  course_name: string | null;
  course_url: string | null;
  canonical_url: string | null;
};

function comparableUrl(value: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    return canonicalizeUrl(value);
  } catch {
    return null;
  }
}

function comparableName(value: string | null): string {
  return value?.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ') ?? '';
}

/** Match a saved programme to the existing catalogue row without scraping it. */
export function resolveCourseId(
  candidates: readonly CourseCatalogueCandidate[],
  courseName: string,
  courseUrl: string | null,
): string | null {
  const requestedUrl = comparableUrl(courseUrl);
  if (requestedUrl) {
    const byUrl = candidates.find(
      (candidate) =>
        comparableUrl(candidate.course_url) === requestedUrl ||
        comparableUrl(candidate.canonical_url) === requestedUrl,
    );
    if (byUrl) return byUrl.id;
  }

  const requestedName = comparableName(courseName);
  if (!requestedName) return null;
  return (
    candidates.find((candidate) => comparableName(candidate.course_name) === requestedName)
      ?.id ?? null
  );
}
