/**
 * F7 Personalized Strategy → PDF.
 *
 * Own renderer, own stylesheet, own path/filename helpers — see
 * `strategy-document.tsx`'s header on why this is not shared with
 * `lib/cv-pdf`.
 */
export { StrategyDocument } from './strategy-document';
export type { StrategyPdfProps } from './strategy-document';
export { renderStrategyPdf, strategyExportFileName, strategyExportPath } from './render';
export { PDF_COLORS, PDF_TYPE, pdfStyles } from './styles';
