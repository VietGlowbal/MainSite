import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RangeHistogram } from './range-histogram';
import { RepeatableFieldset } from './repeatable-fieldset';

type Entry = { id: string; title: string };

function renderList(entries: Entry[], handlers: Partial<{ onAdd: () => void; onRemove: (i: number) => void }> = {}) {
  return render(
    <RepeatableFieldset
      legend="Academic achievements"
      entries={entries}
      keyOf={(entry) => entry.id}
      entryLabel={(i) => `Achievement ${i + 1}`}
      addLabel="Add another achievement"
      onAdd={handlers.onAdd ?? (() => {})}
      onRemove={handlers.onRemove ?? (() => {})}
      renderEntry={(entry) => <input defaultValue={entry.title} aria-label={`Title ${entry.id}`} />}
      emptyState="Nothing added yet."
    />,
  );
}

describe('RepeatableFieldset', () => {
  it('numbers entries from one, for humans not arrays', () => {
    renderList([
      { id: 'a', title: 'Olympiad' },
      { id: 'b', title: 'Paper' },
    ]);
    expect(screen.getByText('Achievement 1')).toBeInTheDocument();
    expect(screen.getByText('Achievement 2')).toBeInTheDocument();
  });

  it('names each remove control after what it removes', () => {
    // A page of identical "Remove" buttons is unusable with a screen reader.
    renderList([
      { id: 'a', title: 'Olympiad' },
      { id: 'b', title: 'Paper' },
    ]);
    expect(screen.getByRole('button', { name: 'Remove Achievement 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Achievement 2' })).toBeInTheDocument();
  });

  it('reports the index that was removed', () => {
    const onRemove = vi.fn();
    renderList([{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }], { onRemove });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Achievement 2' }));
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('keys entries by identity, so removing one does not shuffle the rest', () => {
    // The classic form-list bug: with index keys, React reuses DOM nodes and
    // the third entry's uncommitted input value lands in the second's box.
    const { rerender, container } = renderList([
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
      { id: 'c', title: 'C' },
    ]);

    const inputs = () => [...container.querySelectorAll('input')];
    // Type into the third entry without committing it to the parent's state.
    fireEvent.change(inputs()[2]!, { target: { value: 'typed into C' } });

    rerender(
      <RepeatableFieldset
        legend="Academic achievements"
        entries={[
          { id: 'a', title: 'A' },
          { id: 'c', title: 'C' },
        ]}
        keyOf={(entry) => entry.id}
        entryLabel={(i) => `Achievement ${i + 1}`}
        addLabel="Add another achievement"
        onAdd={() => {}}
        onRemove={() => {}}
        renderEntry={(entry) => (
          <input defaultValue={entry.title} aria-label={`Title ${entry.id}`} />
        )}
      />,
    );

    // C keeps its typed value and has not inherited B's box.
    expect(screen.getByLabelText('Title c')).toHaveValue('typed into C');
    expect(screen.queryByLabelText('Title b')).toBeNull();
  });

  it('shows the empty state instead of a bare add button', () => {
    renderList([]);
    expect(screen.getByText('Nothing added yet.')).toBeInTheDocument();
  });

  it('replaces the add control with an explanation at the cap', () => {
    const onAdd = vi.fn();
    render(
      <RepeatableFieldset
        legend="Achievements"
        entries={[{ id: 'a', title: 'A' }]}
        keyOf={(e) => e.id}
        entryLabel={(i) => `Achievement ${i + 1}`}
        addLabel="Add another"
        onAdd={onAdd}
        onRemove={() => {}}
        renderEntry={() => null}
        max={1}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Add another' })).toBeNull();
    expect(screen.getByText(/Remove one to add another/)).toBeInTheDocument();
  });
});

describe('RangeHistogram', () => {
  const props = {
    min: 0,
    max: 100,
    step: 5,
    distribution: [1, 3, 7, 4, 2],
    label: 'Total budget',
    formatValue: (low: number, high: number) => `${low}–${high}`,
  };

  it('exposes both bounds as separately labelled sliders', () => {
    render(<RangeHistogram {...props} low={20} high={80} onChange={() => {}} />);
    expect(screen.getByRole('slider', { name: /lower bound/ })).toHaveValue('20');
    expect(screen.getByRole('slider', { name: /upper bound/ })).toHaveValue('80');
  });

  it('clamps the lower handle at the upper rather than swapping them', () => {
    // Swapping mid-drag moves the handle out from under the finger.
    const onChange = vi.fn();
    render(<RangeHistogram {...props} low={20} high={50} onChange={onChange} />);

    fireEvent.change(screen.getByRole('slider', { name: /lower bound/ }), {
      target: { value: '90' },
    });
    expect(onChange).toHaveBeenCalledWith({ low: 50, high: 50 });
  });

  it('clamps the upper handle at the lower', () => {
    const onChange = vi.fn();
    render(<RangeHistogram {...props} low={40} high={80} onChange={onChange} />);

    fireEvent.change(screen.getByRole('slider', { name: /upper bound/ }), {
      target: { value: '10' },
    });
    expect(onChange).toHaveBeenCalledWith({ low: 40, high: 40 });
  });

  it('hides the bars from assistive tech', () => {
    // They illustrate; the sliders carry the values. Announcing five unlabelled
    // bars would be noise.
    const { container } = render(
      <RangeHistogram {...props} low={0} high={100} onChange={() => {}} />,
    );
    const bars = container.querySelector('[aria-hidden="true"]');
    expect(bars?.children).toHaveLength(props.distribution.length);
  });

  it('renders the caption through the caller’s formatter', () => {
    render(<RangeHistogram {...props} low={25} high={75} onChange={() => {}} />);
    expect(screen.getByText('25–75')).toBeInTheDocument();
  });

  it('survives an all-zero distribution without dividing by zero', () => {
    render(
      <RangeHistogram {...props} distribution={[0, 0, 0]} low={0} high={100} onChange={() => {}} />,
    );
    expect(screen.getByRole('slider', { name: /lower bound/ })).toBeInTheDocument();
  });
});
