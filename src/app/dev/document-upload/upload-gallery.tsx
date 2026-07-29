'use client';

import { Container, DocumentRow, FileDropzone } from '@/shared/ui';

/**
 * The interactive half of /dev/document-upload.
 *
 * Split from the route because the gate has to stay on the server: a
 * `'use client'` page reads `process.env.ENABLE_DEV_ROUTES` from the browser
 * bundle, where a non-`NEXT_PUBLIC_` variable is undefined — so the whole page
 * 404s in production even with the flag set.
 */
export function UploadGallery() {
  return (
    <Container className="flex max-w-2xl flex-col gap-gb-4xl">
      <h1 className="font-display text-gb-display-sm font-semibold text-fg">Document upload</h1>

      <section className="flex flex-col gap-gb-lg">
        <h2 className="text-gb-md font-semibold text-fg">Dropzone</h2>
        <FileDropzone
          onFiles={() => {}}
          accept=".pdf,.doc,.docx,.txt,.rtf"
          label="Click to upload CV"
          hint="PDF, DOC, DOCX, TXT or RTF (max. 10MB)"
        />
      </section>

      <section className="flex flex-col gap-gb-lg">
        <h2 className="text-gb-md font-semibold text-fg">Dropzone — disabled</h2>
        <FileDropzone
          onFiles={() => {}}
          disabled
          label="Click to upload"
          hint="Upload in progress"
        />
      </section>

      <section className="flex flex-col gap-gb-lg">
        <h2 className="text-gb-md font-semibold text-fg">Rows</h2>
        <ul className="flex flex-col gap-gb-md">
          <DocumentRow
            fileName="Example-essay.pdf"
            total={204800}
            uploaded={102400}
            status="uploading"
            onRemove={() => {}}
          />
          <DocumentRow fileName="Example-cv.docx" total={204800} onRemove={() => {}} />
          <DocumentRow
            fileName="Example-recommendation-letter.pdf"
            total={204800}
            status="error"
            error="That file is over 10MB."
            onRemove={() => {}}
          />
          {/* A stored document: no byte count, and nothing to remove here. */}
          <DocumentRow fileName="Example-transcript.pdf" />
        </ul>
      </section>
    </Container>
  );
}
