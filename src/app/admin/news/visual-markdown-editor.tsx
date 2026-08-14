'use client';

import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  imagePlugin,
  InsertTable,
  linkDialogPlugin,
  linkPlugin,
  ListsToggle,
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  Separator,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
  type ImageUploadHandler,
  type MDXEditorMethods,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { useNewsCopy } from './news-copy';

const INLINE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const INLINE_IMAGE_ACCEPT = INLINE_IMAGE_TYPES.join(',');
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type VisualMarkdownEditorProps = {
  markdown: string;
  onChange: (markdown: string) => void;
  onImageUpload: ImageUploadHandler;
  onError: (message: string) => void;
};

function imageMarkdown(url: string, altText: string) {
  const escapedAlt = altText.replace(/\\/g, '\\\\').replace(/]/g, '\\]');
  return `![${escapedAlt}](${url})`;
}

/**
 * A deliberately small, visual-only Markdown surface. MDXEditor keeps the
 * persisted representation compatible with the existing public renderer, but
 * source mode, JSX, HTML and code plugins are intentionally not registered.
 */
export function VisualMarkdownEditor({ markdown, onChange, onImageUpload, onError }: VisualMarkdownEditorProps) {
  const t = useNewsCopy();
  const editorRef = useRef<MDXEditorMethods>(null);
  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const dialogTitleId = useId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const closeDialog = useCallback(() => {
    if (uploading) return;
    setDialogOpen(false);
    setFile(null);
    setAltText('');
    setUploadError(null);
    uploadButtonRef.current?.focus();
  }, [uploading]);

  useEffect(() => {
    if (!dialogOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDialog();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [closeDialog, dialogOpen]);

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setUploadError(null);
    if (!nextFile) return setFile(null);
    if (!INLINE_IMAGE_TYPES.includes(nextFile.type)) {
      setFile(null);
      return setUploadError(t('Choose a JPG, PNG, WebP or AVIF image.'));
    }
    if (nextFile.size > MAX_IMAGE_BYTES) {
      setFile(null);
      return setUploadError(t('The image must be 10 MB or smaller.'));
    }
    setFile(nextFile);
  };

  const insertUploadedImage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !altText.trim() || !onImageUpload) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await onImageUpload(file);
      editorRef.current?.focus(() => editorRef.current?.insertMarkdown(imageMarkdown(url, altText.trim())));
      setDialogOpen(false);
      setFile(null);
      setAltText('');
      uploadButtonRef.current?.focus();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('Image upload failed');
      setUploadError(message);
      onError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-gb-lg border border-line bg-surface">
      <MDXEditor
        ref={editorRef}
        markdown={markdown}
        onChange={onChange}
        onError={({ error }) => onError(error)}
        suppressHtmlProcessing
        spellCheck
        contentEditableClassName="min-h-[420px] px-gb-2xl py-gb-xl text-gb-md leading-8 text-fg outline-none md:min-h-[520px]"
        className="gb-news-mdx-editor"
        plugins={[
          headingsPlugin({ allowedHeadingLevels: [2, 3] }),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          imagePlugin({ imageUploadHandler: onImageUpload, disableImageResize: true, disableImageSettingsButton: true }),
          tablePlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <BlockTypeSelect />
                <Separator />
                <BoldItalicUnderlineToggles options={['Bold', 'Italic']} />
                <Separator />
                <ListsToggle options={['bullet', 'number']} />
                <CreateLink />
                <button
                  ref={uploadButtonRef}
                  type="button"
                  aria-label={t('Upload image')}
                  onClick={() => setDialogOpen(true)}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-gb-sm border border-brand-surface bg-brand-subtle px-2.5 text-xs font-semibold text-fg-brand transition hover:border-brand hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="m3 16 5-5 4 4 3-3 6 6M12 8h.01" />
                  </svg>
                  <span>{t('Upload image')}</span>
                </button>
                <InsertTable />
                <Separator />
                <UndoRedo />
              </>
            ),
          }),
        ]}
      />
      {dialogOpen && createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-gb-lg backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            onSubmit={insertUploadedImage}
            className="w-full max-w-md rounded-gb-xl border border-line bg-surface p-gb-2xl shadow-2xl"
          >
            <div className="flex items-start justify-between gap-gb-lg">
              <div>
                <h2 id={dialogTitleId} className="text-gb-lg font-semibold text-fg">{t('Upload an image')}</h2>
                <p className="mt-gb-xs text-gb-sm text-fg-secondary">{t('Choose a file from your device. Image URLs are not accepted.')}</p>
              </div>
              <button type="button" onClick={closeDialog} disabled={uploading} aria-label={t('Close')} className="rounded-gb-sm px-gb-sm py-gb-xs text-gb-lg leading-none text-fg-muted hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-brand">×</button>
            </div>

            <div className="mt-gb-xl">
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                accept={INLINE_IMAGE_ACCEPT}
                aria-label={t('Choose image')}
                className="sr-only"
                onChange={chooseFile}
              />
              <button
                type="button"
                autoFocus
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-28 w-full flex-col items-center justify-center rounded-gb-lg border border-dashed border-brand-surface bg-brand-subtle px-gb-xl py-gb-lg text-center text-gb-sm font-semibold text-fg-brand transition hover:border-brand hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="mb-gb-sm size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4m0 0L7 9m5-5 5 5" />
                  <path d="M5 14v5h14v-5" />
                </svg>
                {file ? file.name : t('Choose image')}
                <span className="mt-gb-xs text-gb-xs font-normal text-fg-secondary">{t('JPG, PNG, WebP or AVIF, up to 10 MB')}</span>
              </button>
            </div>

            <label htmlFor={`${fileInputId}-alt`} className="mt-gb-xl block text-gb-sm font-semibold text-fg">{t('Image alt text')}</label>
            <input
              id={`${fileInputId}-alt`}
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
              disabled={uploading}
              required
              placeholder={t('Describe what the image shows')}
              className="mt-gb-sm min-h-11 w-full rounded-gb-md border border-line bg-surface px-gb-md text-gb-sm text-fg outline-none transition placeholder:text-fg-muted focus:border-brand focus:ring-2 focus:ring-brand-subtle"
            />
            <p className="mt-gb-xs text-gb-xs text-fg-muted">{t('Required for accessibility and publishing.')}</p>

            {uploadError ? <p role="alert" className="mt-gb-md text-gb-sm text-red-600">{uploadError}</p> : null}

            <div className="mt-gb-xl flex justify-end gap-gb-sm">
              <button type="button" onClick={closeDialog} disabled={uploading} className="min-h-10 rounded-gb-md border border-line bg-surface px-gb-lg text-gb-sm font-semibold text-fg-secondary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50">{t('Cancel')}</button>
              <button type="submit" disabled={!file || !altText.trim() || uploading} className="min-h-10 rounded-gb-md bg-brand px-gb-lg text-gb-sm font-semibold text-on-brand shadow-gb-xs transition hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50">{uploading ? t('Uploading…') : t('Insert image')}</button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </div>
  );
}
