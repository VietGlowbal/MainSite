import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApplicationTask } from '@/lib/apply-types';
import { TaskItem } from './TaskItem';

const task: ApplicationTask = {
  id: 'task-1',
  applicationId: 'app-1',
  title: 'Review your CV',
  description: 'Improve structure and clarity',
  taskType: 'document',
  status: 'not_started',
  priority: 'high',
  confidence: 1,
  sortOrder: 1,
  createdBy: 'system',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('TaskItem', () => {
  it('offers the AI review action for CV tasks', async () => {
    const onAiFeedback = vi.fn();
    render(
      <TaskItem
        task={task}
        onToggle={vi.fn()}
        onAction={vi.fn()}
        onStatementFeedback={onAiFeedback}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Get AI feedback' }));
    expect(onAiFeedback).toHaveBeenCalledWith(task);
  });

  it('offers the AI review action for LOR tasks', async () => {
    const lorTask = { ...task, title: 'Request a letter of recommendation' };
    const onAiFeedback = vi.fn();
    render(
      <TaskItem
        task={lorTask}
        onToggle={vi.fn()}
        onAction={vi.fn()}
        onStatementFeedback={onAiFeedback}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Get AI feedback' }));
    expect(onAiFeedback).toHaveBeenCalledWith(lorTask);
  });
});
