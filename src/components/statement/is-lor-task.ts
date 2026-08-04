import type { ApplicationTask } from '@/lib/apply-types';

export function isLorTask(task: Pick<ApplicationTask, 'title' | 'description'>): boolean {
  const text = `${task.title ?? ''} ${task.description ?? ''}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  return /\b(lor|letters? of recommendation|recommendation letters?|reference letters?|academic reference|professional reference|referee|recommender|thu gioi thieu)\b/i.test(
    text,
  );
}
