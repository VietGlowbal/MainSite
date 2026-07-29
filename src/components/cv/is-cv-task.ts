import type { ApplicationTask } from '@/lib/apply-types';

export function isCvTask(task: Pick<ApplicationTask, 'title' | 'description'>): boolean {
  const text = `${task.title ?? ''} ${task.description ?? ''}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  return /\b(cv|resume|curriculum vitae)\b/i.test(text);
}
