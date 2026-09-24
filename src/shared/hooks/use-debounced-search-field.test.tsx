import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useDebouncedSearchField,
  type DebouncedSearchField,
} from './use-debounced-search-field';

/**
 * Mirrors how the directories wire the field: `value` is the query the SERVER
 * has answered, so it only moves when a response lands — never on a keystroke.
 */
function Harness({
  value,
  onCommit,
  expose,
}: {
  value: string;
  onCommit: (next: string) => void;
  expose?: (field: DebouncedSearchField) => void;
}) {
  const field = useDebouncedSearchField({ value, onCommit });
  expose?.(field);
  return <input aria-label="search" {...field.inputProps} />;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedSearchField', () => {
  it('coalesces a burst of keystrokes into one committed, trimmed query', () => {
    const onCommit = vi.fn();
    render(<Harness value="" onCommit={onCommit} />);
    const input = screen.getByLabelText('search');

    fireEvent.change(input, { target: { value: 'h' } });
    fireEvent.change(input, { target: { value: 'ha' } });
    fireEvent.change(input, { target: { value: ' har ' } });

    act(() => vi.advanceTimersByTime(299));
    expect(onCommit).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onCommit.mock.calls).toEqual([['har']]);
  });

  it('keeps characters typed while the request they follow is still in flight', () => {
    // The reported bug. Typing "har" fires a request; the reader types "v"
    // before it answers; the response for "har" then arrived and reset the box
    // to "har", which read as the search jumping back to the previous result.
    const onCommit = vi.fn();
    const { rerender } = render(<Harness value="" onCommit={onCommit} />);
    const input = screen.getByLabelText<HTMLInputElement>('search');
    input.focus();

    fireEvent.change(input, { target: { value: 'har' } });
    act(() => vi.advanceTimersByTime(300));
    expect(onCommit).toHaveBeenLastCalledWith('har');

    fireEvent.change(input, { target: { value: 'harv' } }); // typed mid-flight
    rerender(<Harness value="har" onCommit={onCommit} />); // …then the response

    expect(input.value).toBe('harv');
    expect(document.activeElement).toBe(input);

    act(() => vi.advanceTimersByTime(300));
    expect(onCommit).toHaveBeenLastCalledWith('harv');
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('adopts a value the reader did not type — Back, clear filters, a deep link', () => {
    const onCommit = vi.fn();
    const { rerender } = render(<Harness value="oxford" onCommit={onCommit} />);
    const input = screen.getByLabelText<HTMLInputElement>('search');
    expect(input.value).toBe('oxford');

    fireEvent.change(input, { target: { value: 'oxf' } });
    rerender(<Harness value="" onCommit={onCommit} />);

    expect(input.value).toBe('');
    // The keystrokes that adoption discarded must not fire a late navigation.
    act(() => vi.advanceTimersByTime(300));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('hands a pending draft to a caller that navigates instead of it', () => {
    const onCommit = vi.fn();
    let field: DebouncedSearchField | undefined;
    render(
      <Harness
        value=""
        onCommit={onCommit}
        expose={(next) => {
          field = next;
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText('search'), { target: { value: ' mit ' } });
    expect(field?.takePending()).toBe('mit');

    // Taken, so the debounce must not navigate a second time behind the caller.
    act(() => vi.advanceTimersByTime(300));
    expect(onCommit).not.toHaveBeenCalled();
  });
});
