import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContentBlock, ContentBlockValue } from '@/lib/match-insights';
import { ContentBlockInput } from './content-block';

afterEach(() => {
  vi.unstubAllGlobals();
  // Media-query overrides outlive their test otherwise (see src/__tests__/setup.ts).
  window.__resetMediaQueryMatches();
});

function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function lastPatchBody(fetchMock: ReturnType<typeof vi.fn>): { contentValue: ContentBlockValue } {
  const call = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit];
  return JSON.parse(call[1].body as string) as { contentValue: ContentBlockValue };
}

describe('ContentBlockInput — long_text', () => {
  it('saves the typed answer on blur', async () => {
    const fetchMock = stubFetch();
    const schema: ContentBlock = { type: 'long_text', prompt: 'Why this course?', minWords: 50 };
    render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={schema}
        value={null}
      />,
    );

    const textarea = screen.getByLabelText('Why this course?');
    await userEvent.type(textarea, 'Because of the research opportunities.');
    fireEvent.blur(textarea);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/applications/app-1/strategy/recommendations/rec-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(lastPatchBody(fetchMock).contentValue).toEqual({
      type: 'long_text',
      text: 'Because of the research opportunities.',
    });
  });

  it('shows the minimum word count guidance and updates the live word count while typing', async () => {
    stubFetch();
    const schema: ContentBlock = { type: 'long_text', prompt: 'Why this course?', minWords: 50 };
    render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={schema}
        value={null}
      />,
    );

    expect(screen.getByText(/aim for at least 50/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Why this course?'), 'one two three');
    expect(screen.getByText('3 words · aim for at least 50')).toBeInTheDocument();
  });

  it('associates the word-count guidance line with the textarea via aria-describedby', () => {
    stubFetch();
    const schema: ContentBlock = { type: 'long_text', prompt: 'Why this course?', minWords: 50 };
    render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={schema}
        value={null}
      />,
    );

    const textarea = screen.getByLabelText('Why this course?');
    expect(textarea).toHaveAttribute('aria-label', 'Why this course?');
    const hintId = textarea.getAttribute('aria-describedby') ?? '';
    expect(hintId).not.toBe('');
    expect(document.getElementById(hintId)).toHaveTextContent(/aim for at least 50/);
  });
});

describe('ContentBlockInput — checklist', () => {
  it('saves the checked item immediately, no blur needed', async () => {
    const fetchMock = stubFetch();
    const schema: ContentBlock = {
      type: 'checklist',
      items: ['Email the registrar', 'Upload the scanned copy'],
    };
    render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={schema}
        value={null}
      />,
    );

    await userEvent.click(screen.getByLabelText('Email the registrar'));

    expect(lastPatchBody(fetchMock).contentValue).toEqual({
      type: 'checklist',
      checkedItems: ['Email the registrar'],
    });
  });

  it('unchecking removes the item from the saved list', async () => {
    const fetchMock = stubFetch();
    const schema: ContentBlock = { type: 'checklist', items: ['Email the registrar'] };
    render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={schema}
        value={{ type: 'checklist', checkedItems: ['Email the registrar'] }}
      />,
    );

    const checkbox = screen.getByLabelText('Email the registrar');
    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);

    expect(lastPatchBody(fetchMock).contentValue).toEqual({ type: 'checklist', checkedItems: [] });
  });

  it('survives an AI regeneration: stale checked texts are ignored silently and surviving items stay checked', async () => {
    const fetchMock = stubFetch();
    const originalSchema: ContentBlock = {
      type: 'checklist',
      items: ['Email the registrar', 'Upload the scanned copy'],
    };
    const savedBeforeRegeneration: ContentBlockValue = {
      type: 'checklist',
      checkedItems: ['Email the registrar', 'Upload the scanned copy'],
    };

    const { rerender, unmount } = render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={originalSchema}
        value={null}
      />,
    );
    await userEvent.click(screen.getByLabelText('Email the registrar'));
    await userEvent.click(screen.getByLabelText('Upload the scanned copy'));
    expect(lastPatchBody(fetchMock).contentValue).toEqual(savedBeforeRegeneration);

    // The AI regenerated the schema mid-task: the first item was reworded,
    // the second kept verbatim. The saved value still holds the OLD wording.
    const regeneratedSchema: ContentBlock = {
      type: 'checklist',
      items: ['Request transcripts by email', 'Upload the scanned copy'],
    };
    rerender(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={regeneratedSchema}
        value={savedBeforeRegeneration}
      />,
    );

    // No crash, no ghost row for the reworded item's old text, and the item
    // whose text survived stays ticked.
    expect(screen.getByLabelText('Upload the scanned copy')).toBeChecked();
    expect(screen.getByLabelText('Request transcripts by email')).not.toBeChecked();
    expect(screen.queryByLabelText('Email the registrar')).not.toBeInTheDocument();

    // Same story across a full remount seeded from the carried-over value.
    unmount();
    render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={regeneratedSchema}
        value={savedBeforeRegeneration}
      />,
    );
    expect(screen.getByLabelText('Upload the scanned copy')).toBeChecked();
    expect(screen.getByLabelText('Request transcripts by email')).not.toBeChecked();
    expect(screen.queryByLabelText('Email the registrar')).not.toBeInTheDocument();
  });
});

describe('ContentBlockInput — structured_table', () => {
  const schema: ContentBlock = {
    type: 'structured_table',
    columns: [
      { key: 'subject', label: 'Subject', type: 'text' },
      { key: 'grade', label: 'Grade', type: 'select', options: ['A*', 'A', 'B'] },
    ],
  };

  it('starts with one empty row when there is no saved value', () => {
    stubFetch();
    render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={schema}
        value={null}
      />,
    );
    expect(screen.getAllByLabelText(/Subject, row/)).toHaveLength(1);
  });

  it('saves a cell edit on blur, keyed by the column\'s declared key', async () => {
    const fetchMock = stubFetch();
    render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={schema}
        value={null}
      />,
    );

    const subjectInput = screen.getByLabelText('Subject, row 1');
    await userEvent.type(subjectInput, 'Mathematics');
    fireEvent.blur(subjectInput);

    expect(lastPatchBody(fetchMock).contentValue).toEqual({
      type: 'structured_table',
      rows: [{ subject: 'Mathematics' }],
    });
  });

  it('adding a row grows the table without disturbing the first row\'s typed value', async () => {
    stubFetch();
    render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={schema}
        value={null}
      />,
    );

    await userEvent.type(screen.getByLabelText('Subject, row 1'), 'Mathematics');
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }));

    expect(screen.getAllByLabelText(/Subject, row/)).toHaveLength(2);
    expect(screen.getByLabelText('Subject, row 1')).toHaveValue('Mathematics');
  });

  it('removing a row persists the remaining rows immediately', async () => {
    const fetchMock = stubFetch();
    render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={schema}
        value={{
          type: 'structured_table',
          rows: [{ subject: 'Mathematics' }, { subject: 'Physics' }],
        }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remove row 1' }));

    expect(screen.getAllByLabelText(/Subject, row/)).toHaveLength(1);
    expect(lastPatchBody(fetchMock).contentValue).toEqual({
      type: 'structured_table',
      rows: [{ subject: 'Physics' }],
    });
  });

  it('renders card-per-row below 768px and the real table at 768px and above', () => {
    stubFetch();

    window.__setMediaQueryMatches('(min-width: 768px)', false);
    const narrow = render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={schema}
        value={null}
      />,
    );
    expect(narrow.container.querySelector('table')).toBeNull();
    expect(screen.getAllByLabelText(/Subject, row/)).toHaveLength(1);
    expect(screen.getByLabelText('Subject, row 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Grade, row 1')).toBeInTheDocument();
    expect(screen.getByText('Remove row 1')).toBeInTheDocument();
    cleanup();

    // Reset to the default virtual desktop (1024×768): the wide grid returns.
    window.__resetMediaQueryMatches();
    render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={schema}
        value={null}
      />,
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Subject, row/)).toHaveLength(1);
  });

  it('mobile cards expose a labelled, keyboard-reachable remove control that persists the remaining rows', async () => {
    const fetchMock = stubFetch();
    window.__setMediaQueryMatches('(min-width: 768px)', false);
    render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={schema}
        value={{
          type: 'structured_table',
          rows: [{ subject: 'Mathematics' }, { subject: 'Physics' }],
        }}
      />,
    );

    const removeRow1 = screen.getByRole('button', { name: 'Remove row 1' });
    expect(removeRow1.tagName).toBe('BUTTON');
    removeRow1.focus();
    expect(removeRow1).toHaveFocus();

    await userEvent.click(removeRow1);

    expect(screen.getAllByLabelText(/Subject, row/)).toHaveLength(1);
    expect(screen.getByLabelText('Subject, row 1')).toHaveValue('Physics');
    expect(lastPatchBody(fetchMock).contentValue).toEqual({
      type: 'structured_table',
      rows: [{ subject: 'Physics' }],
    });
  });
});

describe('ContentBlockInput — single_select', () => {
  const schema: ContentBlock = {
    type: 'single_select',
    prompt: 'What should this semester focus on?',
    options: [
      { value: 'deepen', label: 'Deepen the major' },
      { value: 'broaden', label: 'Broaden with a minor' },
    ],
    semanticKey: 'focus.choice',
  };

  it('saves the chosen option immediately, keyed by its value not its label', async () => {
    const fetchMock = stubFetch();
    render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={schema}
        value={null}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText(schema.prompt), 'deepen');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/applications/app-1/strategy/recommendations/rec-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(lastPatchBody(fetchMock).contentValue).toEqual({ type: 'single_select', value: 'deepen' });
  });

  it('does not save while no option is chosen', async () => {
    const fetchMock = stubFetch();
    render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={schema}
        value={{ type: 'single_select', value: 'broaden' }}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText(schema.prompt), '');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never surfaces semanticKey or raw generator fields in the DOM', () => {
    stubFetch();
    render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={schema}
        value={null}
      />,
    );

    expect(document.body.textContent).not.toContain(schema.semanticKey);
  });
});

describe('ContentBlockInput — degraded schemas', () => {
  it('renders the honest fallback panel when the schema is null', () => {
    const fetchMock = stubFetch();
    render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={null}
        value={null}
      />,
    );

    expect(screen.getByRole('note')).toHaveTextContent('This task has no editable form right now.');
    expect(screen.getByText('Your saved progress is kept.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders the same fallback for an unknown block type instead of crashing or leaking JSON', () => {
    const fetchMock = stubFetch();
    const rogueSchema = {
      type: 'hologram',
      prompt: 'Describe your aura',
      payload: { generatorInternals: 'do-not-render' },
    } as unknown as ContentBlock;
    render(
      <ContentBlockInput
        applicationId="app-1"
        recommendationId="rec-1"
        schema={rogueSchema}
        value={null}
      />,
    );

    expect(screen.getByRole('note')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('do-not-render');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
