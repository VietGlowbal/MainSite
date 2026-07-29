import { notFound } from 'next/navigation';
import { UploadGallery } from './upload-gallery';

/**
 * /dev/document-upload — the upload primitives on one page.
 *
 * Same reason as /dev/apply-workspace: the real surfaces are behind the auth
 * gate, and two of the states below cannot be produced on demand at all — an
 * upload caught mid-transfer, and one that failed.
 *
 * The gate stays in this server component. Putting `'use client'` on the route
 * itself moves the env read into the browser bundle, where a non-`NEXT_PUBLIC_`
 * variable is undefined and the page 404s regardless of the flag.
 *
 * All filenames in the gallery are obviously fictional per CLAUDE.md's rule
 * about demo data that could pass for a real student's.
 */
export default function DevDocumentUploadPage() {
  const enabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_ROUTES === '1';
  if (!enabled) notFound();

  return (
    <main className="min-h-screen bg-surface py-gb-5xl">
      <UploadGallery />
    </main>
  );
}
