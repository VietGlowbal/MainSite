import type { ApplicationTask } from '@/lib/apply-types';

/**
 * Heuristic: does this application task relate to a personal statement / SOP,
 * so we should offer the AI statement-feedback tool on it?
 */
export function isStatementTask(task: Pick<ApplicationTask, 'title' | 'description'>): boolean {
  const haystack = `${task.title ?? ''} ${task.description ?? ''}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  return (
    haystack.includes('personal statement') ||
    haystack.includes('statement of purpose') ||
    haystack.includes('bai luan') ||
    /\bsop\b/.test(haystack) ||
    (haystack.includes('statement') &&
      (haystack.includes('feedback') ||
        haystack.includes('write') ||
        haystack.includes('draft') ||
        haystack.includes('review')))
  );
}
