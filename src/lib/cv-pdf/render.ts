import { renderToBuffer } from '@react-pdf/renderer';
import type { CvLayoutKey, StructuredCv } from '@/features/application-strategy/domain';
import { CvDocument } from './cv-document';

/**
 * Render a CV to PDF bytes, server-side.
 *
 * WHY NOT `window.print()`. It produces no artefact. There would be nothing to
 * store, nothing to version, and therefore no way to answer "is your PDF older
 * than your CV?" — which is a state this feature has to report. It also puts the
 * browser's headers, footers and margin box on a document that goes to an
 * admissions office.
 *
 * WHY NOT HEADLESS CHROMIUM. A 300MB binary and a browser process per export, on a
 * serverless target where cold starts already matter. It buys pixel-identical
 * HTML, which is not worth that: this is a text document with rules and bullets.
 *
 * WHY A BUFFER RATHER THAN A STREAM. The caller uploads to storage and needs the
 * whole object anyway, and a CV is tens of kilobytes. Streaming would add a failure
 * mode — a half-written object in the bucket — for no measurable gain.
 */

export async function renderCvPdf(args: {
  layout: CvLayoutKey;
  cv: Pick<StructuredCv, 'sections'>;
  candidateName?: string | null | undefined;
}): Promise<Buffer> {
  return renderToBuffer(
    CvDocument({
      layout: args.layout,
      cv: args.cv,
      candidateName: args.candidateName ?? null,
    }),
  );
}

/**
 * Where an export lives in the bucket.
 *
 * The content version is IN THE OBJECT NAME, which is what makes two things true
 * at once: re-exporting the same version overwrites the same object and is
 * therefore idempotent, and `last_exported_version !== content_version` is exactly
 * "the PDF is stale" rather than a guess from timestamps.
 */
export function cvExportPath(args: {
  userId: string;
  strategyId: string;
  contentVersion: number;
}): string {
  return `${args.userId}/cv-exports/${args.strategyId}-v${args.contentVersion}.pdf`;
}

/** The name the student's browser saves it as. */
export function cvExportFileName(args: {
  candidateName?: string | null | undefined;
  courseName?: string | null | undefined;
}): string {
  const parts = [args.candidateName, 'CV', args.courseName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) =>
      part
        .trim()
        // Anything that would need escaping in a Content-Disposition header, or
        // that a filesystem would reject, becomes a hyphen.
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s+/g, '-')
        .slice(0, 60),
    );
  return `${parts.join('-') || 'CV'}.pdf`;
}
