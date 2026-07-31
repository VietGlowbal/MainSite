import { describe, expect, it } from 'vitest';
import type { ApplicationTask } from '@/lib/apply-types';
import { taskFeedbackPath } from './task-feedback-path';

const task = (title: string): ApplicationTask => ({
  id: 'task-1',
  applicationId: 'app-1',
  title,
  taskType: 'document',
  status: 'not_started',
  priority: 'medium',
  confidence: 1,
  sortOrder: 1,
  createdBy: 'system',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

describe('taskFeedbackPath', () => {
  it.each([
    ['Request a recommendation letter', '/apply/app-1/lor-feedback'],
    ['Review your CV', '/apply/app-1/cv'],
    ['Draft your personal statement', '/apply/app-1/statement-feedback'],
  ])('routes %s to its feedback workspace', (title, path) => {
    expect(taskFeedbackPath(task(title))).toBe(path);
  });

  it('ignores tasks without an AI document reviewer', () => {
    expect(taskFeedbackPath(task('Submit application'))).toBeNull();
  });
});
