import { fireEvent, render, screen, within } from '@testing-library/react';
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

  // CHARACTERIZATION (Part 5.1): the board is a projection — it must render
  // cards in the order the caller supplies and never reorder them itself.
  // Part 5.3's responsive rework has to keep this property for both layouts.
  it('renders cards within a column in the order given — ordering belongs to the caller', () => {
    render(
      <PlannerBoard
        applicationId="app-1"
        recommendations={[
          rec({ id: 'first', title: 'First task', status: 'in_progress' }),
          rec({ id: 'second', title: 'Second task', status: 'in_progress' }),
        ]}
        onStatusChange={vi.fn()}
      />,
    );

    const column = screen.getByText('In progress').closest('section')!;
    const first = within(column).getByText('First task');
    const second = within(column).getByText('Second task');

    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // CHARACTERIZATION (Part 5.1): all five statuses stay reachable as columns,
  // each shows its count, and an empty column still offers its drop target —
  // a mobile redesign may replace the grid but not lose any of these.
  it('keeps every status reachable with counts, and an empty column keeps its drop target', () => {
    render(
      <PlannerBoard
        applicationId="app-1"
        recommendations={[rec({ status: 'blocked', title: 'Stuck on transcript' })]}
        onStatusChange={vi.fn()}
      />,
    );

    for (const label of ['To do', 'In progress', 'Review', 'Done', 'Blocked']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    const blocked = screen.getByText('Blocked').closest('section')!;
    expect(within(blocked).getByText('1')).toBeInTheDocument();

    const todo = screen.getByText('To do').closest('section')!;
    expect(within(todo).getByText('0')).toBeInTheDocument();
    expect(within(todo).getByText('Drop a task here')).toBeInTheDocument();
  });

  // CHARACTERIZATION (Part 5.1): tasks seeded by the F8 roadmap
  // (`generateRoadmapTasks` writes category `strategy-roadmap`) are ordinary
  // recommendations to every view — same card, same detail link, no special
  // casing that a rework could accidentally drop.
  it('renders a roadmap-generated task like any other card, linking to its detail page', () => {
    render(
      <PlannerBoard
        applicationId="app-9"
        recommendations={[
          rec({
            id: 'roadmap-1',
            category: 'strategy-roadmap',
            title: 'Request official transcripts',
          }),
        ]}
        onStatusChange={vi.fn()}
      />,
    );

    const card = screen.getByText('Request official transcripts').closest('article')!;
    const link = card.querySelector('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute(
      'href',
      '/ai-strategy/app-9/strategy/recommendations/roadmap-1',
    );
  });
});
