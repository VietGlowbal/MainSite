'use client';

import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  imagePlugin,
  InsertImage,
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
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';

type VisualMarkdownEditorProps = {
  markdown: string;
  onChange: (markdown: string) => void;
  onImageUpload: ImageUploadHandler;
  onError: (message: string) => void;
};

/**
 * A deliberately small, visual-only Markdown surface. MDXEditor keeps the
 * persisted representation compatible with the existing public renderer, but
 * source mode, JSX, HTML and code plugins are intentionally not registered.
 */
export function VisualMarkdownEditor({ markdown, onChange, onImageUpload, onError }: VisualMarkdownEditorProps) {
  return (
    <div className="overflow-hidden rounded-gb-lg border border-line bg-surface">
      <MDXEditor
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
          imagePlugin({ imageUploadHandler: onImageUpload, disableImageResize: true }),
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
                <InsertImage />
                <InsertTable />
                <Separator />
                <UndoRedo />
              </>
            ),
          }),
        ]}
      />
    </div>
  );
}
