import { renderToBuffer } from '@react-pdf/renderer';
import { StrategyDocument, type StrategyPdfProps } from './strategy-document';

/**
 * Render a Personalized Strategy report to PDF bytes, server-side.
 *
 * See `lib/cv-pdf/render.ts` for why this is `@react-pdf/renderer` and not
 * `window.print()` or headless Chromium — the same reasoning applies here.
 */
export async function renderStrategyPdf(args: StrategyPdfProps): Promise<Buffer> {
  return renderToBuffer(StrategyDocument(args));
}

/**
 * Where an export lives in the bucket.
 *
 * Keyed by the recommendation row's own id rather than a content-version
 * counter: `application_strategy_recommendations` is append-only (one row
 * per generation, see the migration), so every generation already has a
 * stable, unique id — re-exporting the SAME generation overwrites the same
 * object and is idempotent, and a fresh generation naturally gets a fresh
 * path rather than needing a separate staleness check.
 */
export function strategyExportPath(args: { userId: string; recommendationId: string }): string {
  return `${args.userId}/strategy-exports/${args.recommendationId}.pdf`;
}

/** The name the student's browser saves it as. */
export function strategyExportFileName(args: {
  candidateName?: string | null | undefined;
}): string {
  const name = (args.candidateName ?? '')
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return `${name ? `${name}-` : ''}Personalized-Strategy.pdf`;
}
