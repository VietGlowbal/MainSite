import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

/**
 * Mobile pattern (<768px): compact grid + day agenda.
 *
 * These pin the stub's `(min-width: 768px)` to false BEFORE rendering so the
 * mounted tree is the mobile one (the hook's hydration default is desktop);
 * the reset below stops a pinned viewport leaking into later tests.
 */
describe('PlannerCalendar — mobile (compact grid + day agenda)', () => {
  afterEach(() => {
    window.__resetMediaQueryMatches();
  });

  function renderMobile(recommendations: Recommendation[], onDeadlineChange = vi.fn()) {
    window.__setMediaQueryMatches('(min-width: 768px)', false);
    render(
      <PlannerCalendar
        applicationId="app-1"
        recommendations={recommendations}
        today={today}
        onDeadlineChange={onDeadlineChange}
      />,
    );
    return onDeadlineChange;
  }

  it('defaults the selection to today and highlights it without relying on colour alone', () => {
    renderMobile([rec({ id: 'r-today', title: 'Draft personal statement', deadline: '2026-08-10' })]);

    const todayCell = screen.getByRole('button', { current: 'date' });
    expect(todayCell).toHaveAttribute('aria-label', '10, 1 task');
    expect(todayCell).toHaveAttribute('aria-pressed', 'true');

    const agenda = screen.getByRole('region', { name: 'Day agenda' });
    expect(within(agenda).getByRole('heading', { name: /10 August 2026/ })).toBeInTheDocument();
    expect(within(agenda).getByText('Draft personal statement')).toBeInTheDocument();
  });

  it('lists exactly that day’s tasks — all of them, in the order given — when a day is selected', () => {
    renderMobile([
      rec({ id: 'a', title: 'Request transcript', deadline: '2026-08-12' }),
      rec({ id: 'b', title: 'Book IELTS test', deadline: '2026-08-12' }),
      rec({ id: 'c', title: 'Draft personal statement', deadline: '2026-08-14' }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: '12, 2 tasks' }));

    const agenda = screen.getByRole('region', { name: 'Day agenda' });
    expect(within(agenda).getByRole('heading', { name: /12 August 2026/ })).toBeInTheDocument();

    const cards = within(agenda).getAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(cards[0]?.textContent).toContain('Request transcript');
    expect(cards[1]?.textContent).toContain('Book IELTS test');
    expect(within(agenda).queryByText('Draft personal statement')).not.toBeInTheDocument();
  });

  it('shows an honest empty message when the selected day has no tasks', () => {
    renderMobile([rec({ title: 'Unscheduled work' })]);

    fireEvent.click(screen.getByRole('button', { name: '14, No tasks' }));

    const agenda = screen.getByRole('region', { name: 'Day agenda' });
    expect(within(agenda).getByRole('heading', { name: /14 August 2026/ })).toBeInTheDocument();
    expect(within(agenda).getByText('No tasks on this day')).toBeInTheDocument();
    expect(within(agenda).queryByRole('article')).not.toBeInTheDocument();
  });

  it('pages months from the mobile grid and keeps the Monday-first six-week grid correct', () => {
    renderMobile([]);

    /** The 42 tappable day cells (six fixed weeks), in DOM order. */
    function dayCellNames(): string[] {
      return screen
        .getAllByRole('button')
        .map((el) => el.getAttribute('aria-label') ?? '')
        .filter((label) => /^\d+, /.test(label));
    }

    // August 2026 fixture: the 1st is a Saturday, so the Monday-first grid
    // opens on Monday 27 July and always lays out six fixed weeks.
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeInTheDocument();
    expect(dayCellNames()).toHaveLength(42);
    expect(dayCellNames()[0]).toBe('27, No tasks');

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeInTheDocument();
    // September starts on a Tuesday, so its grid opens on Monday 31 August.
    expect(dayCellNames()[0]).toBe('31, No tasks');

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('heading', { name: 'July 2026' })).toBeInTheDocument();
    // July starts on a Wednesday, so its grid opens on Monday 29 June.
    expect(dayCellNames()[0]).toBe('29, No tasks');
  });

  it('keeps every day cell reachable by an accessible name carrying its day number and task count', () => {
    renderMobile([rec({ deadline: '2026-08-12' })]);

    expect(screen.getByRole('button', { name: '12, 1 task' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^13, No tasks$/ })).toBeInTheDocument();
    // The selected (today) cell is pressed; unselected days are not.
    expect(screen.getByRole('button', { name: '13, No tasks' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('keeps the unscheduled tray available under a disclosure and still clears a deadline dropped into it', () => {
    const onDeadlineChange = renderMobile([rec({ deadline: '2026-08-12' })]);

    // Collapsed first: no tray DOM until disclosed.
    expect(screen.queryByText('Not scheduled')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show unscheduled (0)' }));

    const tray = screen.getByText('Not scheduled').closest('aside')!;
    expect(tray).toBeInTheDocument();

    // The card only exists once its day is selected — the agenda shows the
    // selected day, not every day at once.
    fireEvent.click(screen.getByRole('button', { name: '12, 1 task' }));
    const dataTransfer = dataTransferStub();
    const card = screen.getByText('Retake IELTS').closest('article')!;
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.drop(tray, { dataTransfer });

    expect(onDeadlineChange).toHaveBeenCalledWith('r1', null);
  });
});

describe('PlannerCalendar — desktop viewport', () => {
  it('renders the desktop arrangement: no agenda, no disclosure, tray beside the grid', () => {
    render(
      <PlannerCalendar
        applicationId="app-1"
        recommendations={[rec()]}
        today={today}
        onDeadlineChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('region', { name: 'Day agenda' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /unscheduled/i })).not.toBeInTheDocument();
    expect(screen.getByText('Not scheduled')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeInTheDocument();
  });
});
