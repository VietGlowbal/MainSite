import type { DirectoryScholarship } from '@/lib/scholarships-data';

/**
 * Return the reason a scholarship matches a user's saved universities or
 * countries. This is deliberately kept in the pure domain layer so the
 * client-side directory never imports the server-only scholarship repository.
 */
export function scorePersonalMatch(
  scholarship: DirectoryScholarship,
  savedUniversityIds: number[],
  savedCountries: string[],
): { matched: boolean; reason: 'university' | 'country' | null } {
  if (
    savedUniversityIds.length > 0 &&
    scholarship.universityIds.some((id) => savedUniversityIds.includes(id))
  ) {
    return { matched: true, reason: 'university' };
  }

  if (savedCountries.length > 0) {
    if (scholarship.country && savedCountries.includes(scholarship.country)) {
      return { matched: true, reason: 'country' };
    }
    if (scholarship.universityCountries.some((country) => savedCountries.includes(country))) {
      return { matched: true, reason: 'country' };
    }
  }

  return { matched: false, reason: null };
}
