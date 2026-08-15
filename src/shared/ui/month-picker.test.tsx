import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonthPicker } from './month-picker';

/** A fixed "today" so the floor on the grid does not move with the suite. */
const NOW = new Date('2026-08-15T00:00:00Z');

function Harness({ initial = '', onChange }: { initial?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <MonthPicker
      name="target_intake"
      label="Target intake"
      value={value}
      now={NOW}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const trigger = () => screen.getByRole('button', { name: /target intake/i });

describe('MonthPicker', () => {
  it('shows the placeholder until a month is chosen, then the month', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(trigger()).toHaveTextContent('Select a month');

    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Next year' }));
    await user.click(screen.getByRole('radio', { name: 'September 2027' }));

    expect(trigger()).toHaveTextContent('Sep 2027');
  });

  it('writes the canonical token, not the label it draws', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(trigger());
    await user.click(screen.getByRole('radio', { name: 'September 2026' }));

    expect(onChange).toHaveBeenCalledWith('2026-09');
  });

  it('opens on the year of the stored answer, not on this one', async () => {
    const user = userEvent.setup();
    render(<Harness initial="2029-03" />);

    await user.click(trigger());
    expect(screen.getByRole('radio', { name: 'March 2029' })).toHaveAttribute('aria-checked', 'true');
  });

  it('refuses a month that has already gone', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());

    // "Today" is August 2026, so July is behind us and August is not.
    expect(screen.getByRole('radio', { name: 'July 2026' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'August 2026' })).toBeEnabled();
  });

  it('still offers a stored answer that is now in the past', async () => {
    const user = userEvent.setup();
    render(<Harness initial="2025-01" />);
    await user.click(trigger());

    // Nothing else in 2025 is selectable, but the student's own answer stays
    // visible and re-pickable rather than vanishing from the control.
    expect(screen.getByRole('radio', { name: 'January 2025' })).toBeEnabled();
    expect(screen.getByRole('radio', { name: 'February 2025' })).toBeDisabled();
  });

  it('steps the year without leaving the picker', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());

    await user.click(screen.getByRole('button', { name: 'Next year' }));
    expect(screen.getByRole('radio', { name: 'January 2027' })).toBeEnabled();

    // The floor year is the current one, so there is nothing before it.
    await user.click(screen.getByRole('button', { name: 'Previous year' }));
    expect(screen.getByRole('button', { name: 'Previous year' })).toBeDisabled();
  });

  it('moves through the grid with the arrow keys and picks with Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(trigger());
    // Focus lands on August 2026; one row down is November.
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('2026-11');
  });

  it('closes on Escape and gives focus back to the field', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(trigger());
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('closes when the click lands outside it', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Harness />
        <button type="button">Elsewhere</button>
      </div>,
    );

    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('empties the field on Clear', async () => {
    const user = userEvent.setup();
    render(<Harness initial="2027-09" />);

    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(trigger()).toHaveTextContent('Select a month');
  });

  it('carries the value in a hidden input, for a native form post', () => {
    const { container } = render(<Harness initial="2027-09" />);
    expect(container.querySelector('input[name="target_intake"]')).toHaveValue('2027-09');
  });
});
