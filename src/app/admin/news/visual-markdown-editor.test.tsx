import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mdxeditor/editor', () => {
  const plugin = (name: string) => (options: Record<string, unknown> = {}) => ({ name, ...options });
  return {
    MDXEditor: ({ markdown, onChange, plugins }: { markdown: string; onChange: (value: string) => void; plugins: Array<Record<string, unknown>> }) => {
      const toolbar = plugins.find((item) => item.name === 'toolbar')?.toolbarContents as (() => React.ReactNode) | undefined;
      return (
        <div data-testid="visual-editor">
          <div>{toolbar?.()}</div>
          <textarea aria-label="visual canvas" value={markdown} onChange={(event) => onChange(event.target.value)} />
        </div>
      );
    },
    BlockTypeSelect: () => <button type="button">Heading</button>,
    BoldItalicUnderlineToggles: ({ options }: { options: string[] }) => <>{options.map((option) => <button type="button" key={option}>{option}</button>)}</>,
    CreateLink: () => <button type="button">Link</button>,
    InsertImage: () => <button type="button">Insert image</button>,
    InsertTable: () => <button type="button">Insert table</button>,
    ListsToggle: ({ options }: { options: string[] }) => <>{options.map((option) => <button type="button" key={option}>{`${option} list`}</button>)}</>,
    Separator: () => <span aria-hidden="true" />,
    UndoRedo: () => <><button type="button">Undo</button><button type="button">Redo</button></>,
    imagePlugin: plugin('image'),
    headingsPlugin: plugin('headings'),
    linkDialogPlugin: plugin('link-dialog'),
    linkPlugin: plugin('link'),
    listsPlugin: plugin('lists'),
    quotePlugin: plugin('quote'),
    tablePlugin: plugin('table'),
    thematicBreakPlugin: plugin('divider'),
    toolbarPlugin: plugin('toolbar'),
  };
});

import { VisualMarkdownEditor } from './visual-markdown-editor';

describe('VisualMarkdownEditor', () => {
  it('exposes the visual toolbar without a source-mode control and round-trips legacy Markdown', () => {
    const onChange = vi.fn();
    const legacy = '## Heading\n\n- List item\n\n[Link](/news/other)\n\n![Campus](/news-images/campus.webp)';

    render(<VisualMarkdownEditor markdown={legacy} onChange={onChange} onImageUpload={vi.fn()} onError={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Heading' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'bullet list' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'number list' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert image' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert table' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /source|markdown|html/i })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'visual canvas' })).toHaveValue(legacy);

    fireEvent.change(screen.getByRole('textbox', { name: 'visual canvas' }), { target: { value: `${legacy}\n\nNew paragraph` } });
    expect(onChange).toHaveBeenCalledWith(`${legacy}\n\nNew paragraph`);
  });
});
