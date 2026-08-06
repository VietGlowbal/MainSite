import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Recommendation } from '../domain';
import { PlannerBoard } from './planner-board';

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

describe('PlannerBoard', () => {
  it('reports the dropped column through onStatusChange — the drag that has to reach the list too', () => {
    const onStatusChange = vi.fn();
    render(
      <PlannerBoard
        applicationId="app-1"
        recommendations={[rec({ status: 'not_started' })]}
        onStatusChange={onStatusChange}
      />,
    );

    const dataTransfer = dataTransferStub();
    const card = screen.getByText('Retake IELTS').closest('article')!;
    const doneColumn = screen.getByText('Done').closest('section')!;

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(doneColumn, { dataTransfer });
    fireEvent.drop(doneColumn, { dataTransfer });

    expect(onStatusChange).toHaveBeenCalledWith('r1', 'completed');
  });
});
