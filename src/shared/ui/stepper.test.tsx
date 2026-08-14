import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Stepper, type StepperStep } from './stepper';

/** The AI strategy spine. Steps 4 and 5 sit behind the paywall. */
const AI_JOURNEY: StepperStep[] = [
  { key: 'reflection', label: 'Reflection' },
  { key: 'report', label: 'Output report' },
  { key: 'university', label: 'University Detail' },
  { key: 'strategy', label: 'Application Strategy', locked: true },
  { key: 'audit', label: 'Submit Audit', locked: true },
];

/** The per-course journey. The only one that carries due dates. */
const COURSE_JOURNEY: StepperStep[] = [
  { key: 'research', label: 'Research', meta: 'Due 14 Aug 2026' },
  { key: 'eligibility', label: 'Check eligibility', meta: 'Due 14 Sep 2026' },
  { key: 'documents', label: 'Prepare documents', meta: 'Due 14 Oct 2026' },
  { key: 'improve', label: 'Improve application' },
  { key: 'submit', label: 'Submit' },
];

const steps = () => within(screen.getByTestId('stepper')).getAllByRole('listitem');

describe('Stepper', () => {
  it('marks exactly one step as current', () => {
    render(<Stepper steps={COURSE_JOURNEY} currentIndex={2} />);
    const current = steps().filter((li) => li.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Prepare documents');
  });

  it('renders due dates when a journey supplies them', () => {
    render(<Stepper steps={COURSE_JOURNEY} currentIndex={0} />);
    expect(screen.getByText('Due 14 Aug 2026')).toBeInTheDocument();
    // The AI journey has no dates; nothing should invent one.
    expect(screen.queryByText(/Due .* 2027/)).toBeNull();
  });

  it('never marks a locked step as current, even when the index points at it', () => {
    // The student has paid for nothing yet but the URL says step 4. The wall
    // must hold rather than the step rendering as reached.
    render(<Stepper steps={AI_JOURNEY} currentIndex={3} />);
    const locked = steps()[3]!;
    expect(locked.getAttribute('aria-current')).toBeNull();
  });

  it('does not linkify a locked step', () => {
    const withHrefs = AI_JOURNEY.map((s) => ({ ...s, href: `/ai-strategy/${s.key}` }));
    render(<Stepper steps={withHrefs} currentIndex={2} />);

    expect(screen.getByRole('link', { name: /Reflection/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Application Strategy/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Submit Audit/ })).toBeNull();
  });

  it('leaves the connector unfilled across the paywall boundary', () => {
    const { container } = render(<Stepper steps={AI_JOURNEY} currentIndex={2} />);
    // Two halves per gap, four gaps, plus the two flat end spacers.
    const filled = container.querySelectorAll('.bg-brand');
    // Reached steps are 0, 1, 2 — so the runs into steps 1 and 2 are filled
    // (two halves each), and nothing beyond. Markers add their own fills, so
    // assert on the connectors specifically.
    const connectors = [...container.querySelectorAll('span[aria-hidden="true"]')].filter((el) =>
      el.className.includes('h-[2px]'),
    );
    const filledConnectors = connectors.filter((el) => el.className.includes('bg-brand'));
    expect(filledConnectors).toHaveLength(4);
    expect(filled.length).toBeGreaterThan(0);
  });

  it('fills every connector once the journey is finished', () => {
    const { container } = render(<Stepper steps={COURSE_JOURNEY} currentIndex={4} />);
    const connectors = [...container.querySelectorAll('span[aria-hidden="true"]')].filter((el) =>
      el.className.includes('h-[2px]'),
    );
    // Four gaps, two halves each.
    expect(connectors).toHaveLength(8);
    expect(connectors.every((el) => el.className.includes('bg-brand'))).toBe(true);
  });

  it('numbers only the steps that are neither done nor current', () => {
    render(<Stepper steps={COURSE_JOURNEY} currentIndex={2} />);
    const list = steps();

    // Assert on the marker directly — a whole-step text match would trip over
    // the due dates, whose digits are not step numbers. The marker is the only
    // round bordered element in the step; the other aria-hidden spans are the
    // flat connector halves.
    const marker = (li: HTMLElement) => li.querySelector('span[class*="rounded-gb-full"]');

    // Done: a tick, no digit.
    expect(marker(list[0]!)?.querySelector('svg')).not.toBeNull();
    expect(marker(list[0]!)?.textContent).toBe('');

    // Upcoming: their position in the sequence.
    expect(marker(list[3]!)?.textContent).toBe('4');
    expect(marker(list[4]!)?.textContent).toBe('5');
  });

  it('is a labelled navigation landmark', () => {
    render(<Stepper steps={COURSE_JOURNEY} currentIndex={0} label="Your application journey" />);
    expect(
      screen.getByRole('navigation', { name: 'Your application journey' }),
    ).toBeInTheDocument();
  });

  it('respects explicit completion state for editable journeys', () => {
    const editable = COURSE_JOURNEY.map((step, index) => ({
      ...step,
      complete: index === 0,
    }));

    render(<Stepper steps={editable} currentIndex={3} />);
    const list = steps();
    const marker = (li: HTMLElement) => li.querySelector('span[class*="rounded-gb-full"]');

    expect(marker(list[0]!)?.querySelector('svg')).not.toBeNull();
    expect(marker(list[1]!)?.querySelector('svg')).toBeNull();
    expect(marker(list[1]!)?.textContent).toBe('2');
  });

  it('supports client-managed step selection', () => {
    const selected: string[] = [];
    render(
      <Stepper
        steps={COURSE_JOURNEY}
        currentIndex={0}
        onStepSelect={(key) => selected.push(key)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Prepare documents/ }));
    expect(selected).toEqual(['documents']);
  });
});
