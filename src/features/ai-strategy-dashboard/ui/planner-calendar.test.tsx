import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Recommendation } from '../domain';
import { PlannerCalendar } from './planner-calendar';

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

/** A minimal DataTransfer stand-in — jsdom does not implement the real one. */
function dataTransferStub() {
  const store = new Map<string, string>();
  return {
    setData: (format: string, value: string) => store.set(format, value),
    getData: (format: string) => store.get(format) ?? '',
    dropEffect: 'move',
    effectAllowed: 'move',
  };
}

const today = new Date('2026-08-10T00:00:00Z');

describe('PlannerCalendar', () => {
  it('schedules a dragged task onto the day it was dropped on', () => {
    const onDeadlineChange = vi.fn();
    render(
      <PlannerCalendar
        applicationId="app-1"
        recommendations={[rec()]}
        today={today}
        onDeadlineChange={onDeadlineChange}
      />,
    );

    const dataTransfer = dataTransferStub();
    const card = screen.getByText('Retake IELTS').closest('article')!;
    // The 12th of August 2026 is in-month and inside the fixed six-week grid.
    const targetDay = screen.getByText('12').closest('div')!;

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(targetDay, { dataTransfer });
    fireEvent.drop(targetDay, { dataTransfer });

    expect(onDeadlineChange).toHaveBeenCalledWith('r1', '2026-08-12');
  });

  it('dragging a scheduled task back into the tray clears its deadline', () => {
    const onDeadlineChange = vi.fn();
    render(
      <PlannerCalendar
        applicationId="app-1"
        recommendations={[rec({ deadline: '2026-08-12' })]}
        today={today}
        onDeadlineChange={onDeadlineChange}
      />,
    );

    const dataTransfer = dataTransferStub();
    const card = screen.getByText('Retake IELTS').closest('article')!;
    const tray = screen.getByText('Not scheduled').closest('aside')!;

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.drop(tray, { dataTransfer });

    expect(onDeadlineChange).toHaveBeenCalledWith('r1', null);
  });
});
