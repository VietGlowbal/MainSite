import type { ApplicationTask } from '@/lib/apply-types';
import { isCvTask } from '@/components/cv/is-cv-task';
import { isLorTask } from '@/components/statement/is-lor-task';
import { isStatementTask } from '@/components/statement/is-statement-task';

export function taskFeedbackPath(task: ApplicationTask): string | null {
  const base = `/apply/${task.applicationId}`;
  if (isLorTask(task)) return `${base}/lor-feedback`;
  if (isCvTask(task)) return `${base}/cv`;
  if (isStatementTask(task)) return `${base}/statement-feedback`;
  return null;
}
