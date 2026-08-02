/**
 * CV → PDF.
 *
 * One renderer driven by the layout definitions in
 * `features/application-strategy/domain/cv-layouts.ts`, rather than one component
 * per layout. The layouts are already data — section order, emphasis set, column
 * count — so three components would be three copies of the same file whose only
 * lasting difference was the heading order.
 */
export { CvDocument } from './cv-document';
export type { CvPdfProps } from './cv-document';
export { cvExportFileName, cvExportPath, renderCvPdf } from './render';
export { PDF_COLORS, PDF_TYPE, pdfStyles } from './styles';
