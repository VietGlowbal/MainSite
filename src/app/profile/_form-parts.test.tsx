import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TagInput } from './_form-parts';

function TagInputHarness({
  label = 'Field',
  initialValues = [],
  suggestions,
  exclusiveValue,
}: {
  label?: string;
  initialValues?: string[];
  suggestions?: string[];
  exclusiveValue?: string;
}) {
  const [values, setValues] = useState(initialValues);
  const id = label.toLocaleLowerCase().replaceAll(' ', '-');

  return (
    <>
      <TagInput
        name={id}
        label={label}
        values={values}
        onChange={setValues}
        placeholder="Type a value"
        suggestions={suggestions}
        exclusiveValue={exclusiveValue}
      />
      <output data-testid={`${id}-values`}>{JSON.stringify(values)}</output>
    </>
  );
}

describe('TagInput', () => {
  it('filters suggestions as the user types, case-insensitively', async () => {
    const user = userEvent.setup();
    render(<TagInputHarness label="Subjects" suggestions={['Computer Science', 'History', 'Cloud Computing']} />);

    await user.type(screen.getByLabelText('Subjects'), 'COMP');

    expect(screen.getByRole('option', { name: 'Computer Science' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cloud Computing' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'History' })).not.toBeInTheDocument();
  });

  it('ranks prefix matches before substring matches', async () => {
    const user = userEvent.setup();
    render(
      <TagInputHarness
        label="Subjects"
        suggestions={['Biocomputing', 'Computer Science', 'Computer Engineering']}
      />,
    );

    await user.type(screen.getByLabelText('Subjects'), 'comp');

    const optionNames = within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.textContent);
    expect(optionNames).toEqual(['Computer Engineering', 'Computer Science', 'Biocomputing']);
  });

  it('adds a mouse-selected suggestion as a tag', async () => {
    const user = userEvent.setup();
    render(<TagInputHarness label="Countries" suggestions={['Japan']} />);

    await user.type(screen.getByLabelText('Countries'), 'jap');
    await user.click(screen.getByRole('option', { name: 'Japan' }));

    expect(screen.getByTestId('countries-values')).toHaveTextContent('["Japan"]');
    expect(screen.getByRole('button', { name: 'Remove Japan' })).toBeInTheDocument();
  });

  it('selects the highlighted option with Enter', async () => {
    const user = userEvent.setup();
    render(<TagInputHarness label="Countries" suggestions={['Japan']} />);

    await user.type(screen.getByLabelText('Countries'), 'jap');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(screen.getByTestId('countries-values')).toHaveTextContent('["Japan"]');
  });

  it('moves the active option with ArrowDown and ArrowUp', async () => {
    const user = userEvent.setup();
    render(<TagInputHarness label="Subjects" suggestions={['Computer Science', 'Computer Engineering']} />);

    await user.type(screen.getByLabelText('Subjects'), 'comp');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Computer Engineering' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Computer Science' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('option', { name: 'Computer Engineering' })).toHaveAttribute('aria-selected', 'true');
  });

  it('closes suggestions with Escape', async () => {
    const user = userEvent.setup();
    render(<TagInputHarness label="Countries" suggestions={['Japan']} />);

    await user.click(screen.getByLabelText('Countries'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Countries')).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not add a duplicate that differs only by case', async () => {
    const user = userEvent.setup();
    render(<TagInputHarness label="Subjects" initialValues={['Computer Science']} />);

    await user.type(screen.getByLabelText('Subjects'), 'computer science');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByTestId('subjects-values')).toHaveTextContent('["Computer Science"]');
  });

  it('does not show selected values in its suggestions', async () => {
    const user = userEvent.setup();
    render(<TagInputHarness label="Countries" initialValues={['Japan']} suggestions={['Japan', 'South Korea']} />);

    await user.click(screen.getByLabelText('Countries'));

    expect(screen.queryByRole('option', { name: 'Japan' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'South Korea' })).toBeInTheDocument();
  });

  it('keeps badge removal working', async () => {
    const user = userEvent.setup();
    render(<TagInputHarness label="Countries" initialValues={['Japan']} />);

    await user.click(screen.getByRole('button', { name: 'Remove Japan' }));

    expect(screen.getByTestId('countries-values')).toHaveTextContent('[]');
  });

  it('renders existing legacy values that are not in the suggestions', () => {
    render(<TagInputHarness label="Countries" initialValues={['Legacy country']} suggestions={['Japan']} />);

    expect(screen.getByText('Legacy country')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Legacy country' })).toBeInTheDocument();
  });

  it('continues to accept custom values when no suggestions are supplied', async () => {
    const user = userEvent.setup();
    render(<TagInputHarness label="Cities" suggestions={[]} />);

    await user.type(screen.getByLabelText('Cities'), 'Da Nang');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByTestId('cities-values')).toHaveTextContent('["Da Nang"]');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('makes an exclusive value replace existing selections', async () => {
    const user = userEvent.setup();
    render(
      <TagInputHarness
        label="Countries"
        initialValues={['Japan']}
        suggestions={['Open to ideas', 'Japan']}
        exclusiveValue="Open to ideas"
      />,
    );

    await user.click(screen.getByLabelText('Countries'));
    await user.click(screen.getByRole('option', { name: 'Open to ideas' }));

    expect(screen.getByTestId('countries-values')).toHaveTextContent('["Open to ideas"]');
  });

  it('replaces an exclusive value when the user chooses a country', async () => {
    const user = userEvent.setup();
    render(
      <TagInputHarness
        label="Countries"
        initialValues={['Open to ideas']}
        suggestions={['Open to ideas', 'Japan']}
        exclusiveValue="Open to ideas"
      />,
    );

    await user.click(screen.getByLabelText('Countries'));
    await user.click(screen.getByRole('option', { name: 'Japan' }));

    expect(screen.getByTestId('countries-values')).toHaveTextContent('["Japan"]');
  });
});
