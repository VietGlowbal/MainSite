import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Recommendation } from '../domain';
import { PlannerList } from './planner-list';

function rec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 'r1',
    applicationId: 'app-1',
    category: 'academics',
    pillar: 'academic',
    title: 'Retake IELTS',
    reason: null,
    priority: 'high',
    status: 'not_started',
    estimatedImpact: 12,
    estimatedEffort: null,
    deadline: null,
    evidenceRequired: false,
    relatedRequirement: null,
    actionLabel: null,
    actionType: null,
    actionTarget: null,
    contentSchema: null,
    contentValue: null,
    submitChecklist: [],
    tips: [],
    suggestedQuestions: [],
    confidence: 0.8,
    isDismissed: false,
    sourceAnalysisId: null,
    archivedAt: null,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

const today = new Date('2026-08-10T00:00:00Z');

describe('PlannerList', () => {
  it('sets a deadline from the list, which is how a student adds a task to the calendar', async () => {
    const onDeadlineChange = vi.fn().mockResolvedValue(undefined);
    render(
      <PlannerList
        applicationId="app-1"
        recommendations={[rec()]}
        today={today}
        onDeadlineChange={onDeadlineChange}
        onStatusSaved={vi.fn()}
      />,
    );

    const input = screen.getByLabelText('Deadline for Retake IELTS');
    await userEvent.type(input, '2026-09-01');

    expect(onDeadlineChange).toHaveBeenCalledWith('r1', '2026-09-01');
  });

  it('clearing the deadline field unschedules the task', async () => {
    const onDeadlineChange = vi.fn().mockResolvedValue(undefined);
    render(
      <PlannerList
        applicationId="app-1"
        recommendations={[rec({ deadline: '2026-09-01' })]}
        today={today}
        onDeadlineChange={onDeadlineChange}
        onStatusSaved={vi.fn()}
      />,
    );

    const input = screen.getByLabelText('Deadline for Retake IELTS');
    // A native date input has no selectable text to delete, so the field is
    // cleared the way a browser's own "x" affordance does: an empty value.
    fireEvent.change(input, { target: { value: '' } });

    expect(onDeadlineChange).toHaveBeenCalledWith('r1', null);
  });

  it('folds a status the shared control already saved into the planner-wide state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const onStatusSaved = vi.fn();
    render(
      <PlannerList
        applicationId="app-1"
        recommendations={[rec()]}
        today={today}
        onDeadlineChange={vi.fn()}
        onStatusSaved={onStatusSaved}
      />,
    );

    await userEvent.selectOptions(
      screen.getByLabelText('Status for Retake IELTS'),
      'in_progress',
    );

    expect(onStatusSaved).toHaveBeenCalledWith('r1', 'in_progress');
    vi.unstubAllGlobals();
  });
});
