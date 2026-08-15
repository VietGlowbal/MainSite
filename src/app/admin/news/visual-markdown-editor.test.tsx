import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const editorMethods = vi.hoisted(() => ({
  focus: vi.fn((callback?: () => void) => callback?.()),
  insertMarkdown: vi.fn(),
}));

vi.mock('@mdxeditor/editor', async () => {
  const React = await import('react');
  const plugin = (name: string) => (options: Record<string, unknown> = {}) => ({ name, ...options });
  const MockMDXEditor = React.forwardRef(({ markdown, onChange, plugins }: { markdown: string; onChange: (value: string) => void; plugins: Array<Record<string, unknown>> }, ref) => {
    React.useImperativeHandle(ref, () => editorMethods);
    const toolbar = plugins.find((item) => item.name === 'toolbar')?.toolbarContents as (() => React.ReactNode) | undefined;
    return (
      <div data-testid="visual-editor">
        <div>{toolbar?.()}</div>
        <textarea aria-label="visual canvas" value={markdown} onChange={(event) => onChange(event.target.value)} />
      </div>
    );
  });
  MockMDXEditor.displayName = 'MockMDXEditor';
  return {
    MDXEditor: MockMDXEditor,
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
  beforeEach(() => {
    editorMethods.focus.mockClear();
    editorMethods.insertMarkdown.mockClear();
  });

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
    expect(screen.getByRole('button', { name: 'Upload image' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert table' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /source|markdown|html/i })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'visual canvas' })).toHaveValue(legacy);

    fireEvent.change(screen.getByRole('textbox', { name: 'visual canvas' }), { target: { value: `${legacy}\n\nNew paragraph` } });
    expect(onChange).toHaveBeenCalledWith(`${legacy}\n\nNew paragraph`);
  });

  it('uploads a local image with required alt text and never offers a URL field', async () => {
    const onImageUpload = vi.fn().mockResolvedValue('/news-images/campus.webp');

    render(<VisualMarkdownEditor markdown="" onChange={vi.fn()} onImageUpload={onImageUpload} onError={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Upload image' }));

    expect(screen.getByRole('dialog', { name: 'Upload an image' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /url/i })).not.toBeInTheDocument();

    const fileInput = screen.getByLabelText('Choose image');
    expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp,image/avif');

    const file = new File(['image'], 'campus.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Image alt text' }), { target: { value: 'Students on campus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert image' }));

    await waitFor(() => expect(onImageUpload).toHaveBeenCalledWith(file));
    expect(editorMethods.focus).toHaveBeenCalled();
    expect(editorMethods.insertMarkdown).toHaveBeenCalledWith('![Students on campus](/news-images/campus.webp)');
    expect(screen.queryByRole('dialog', { name: 'Upload an image' })).not.toBeInTheDocument();
  });

  it('rejects non-image files before upload', () => {
    const onImageUpload = vi.fn();
    render(<VisualMarkdownEditor markdown="" onChange={vi.fn()} onImageUpload={onImageUpload} onError={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Upload image' }));
    fireEvent.change(screen.getByLabelText('Choose image'), {
      target: { files: [new File(['<svg/>'], 'graphic.svg', { type: 'image/svg+xml' })] },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Choose a JPG, PNG, WebP or AVIF image.');
    expect(screen.getByRole('button', { name: 'Insert image' })).toBeDisabled();
    expect(onImageUpload).not.toHaveBeenCalled();
  });
});
