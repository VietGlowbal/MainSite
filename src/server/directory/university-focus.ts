import { getUniversityQueries } from '@/features/universities/api';

export function getPublicUniversityFocus(id: number) {
  return getUniversityQueries().getById(id);
}
