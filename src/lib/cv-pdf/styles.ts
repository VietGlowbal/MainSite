import { StyleSheet } from '@react-pdf/renderer';

/**
 * The PDF stylesheet, mirrored from the design tokens.
 *
 * WHY THE HEX VALUES ARE REPEATED HERE. `@react-pdf/renderer` does not run
 * Tailwind and cannot read a CSS custom property — it renders to a PDF, not to a
 * DOM. So the values are copied from `src/styles/tokens.css` with the token name
 * beside each one, which makes a drift visible in review rather than only in a
 * downloaded file nobody diffs.
 *
 * WHY THE PALETTE IS SO SMALL. This is a document an admissions officer prints or
 * skims. Every colour it does not need is a colour that can photocopy badly or
 * fail a contrast check. Rose appears once, on section rules, and everything else
 * is a grey from the same ramp as the site.
 *
 * CONTRAST. Body text is neutral-950 on white (about 18:1) and the lightest text
 * used is neutral-600 (about 7:1). Both clear WCAG AA for body text with room to
 * spare, which matters because this is the artefact that leaves the product and
 * gets read on someone else's screen.
 */

export const PDF_COLORS = {
  /** --color-gb-neutral-950 */
  text: '#171717',
  /** --color-gb-neutral-700 */
  textSecondary: '#404040',
  /** --color-gb-neutral-600 — the lightest text used anywhere in the document. */
  textTertiary: '#525252',
  /** --color-gb-neutral-200 */
  line: '#e5e5e5',
  /** --color-gb-neutral-300 */
  lineStrong: '#d4d4d4',
  /** --color-gb-brand-600 (Rose 600). The single accent. */
  brand: '#e11d48',
  white: '#ffffff',
} as const;

/**
 * Type sizes in points.
 *
 * Body at 9.5pt rather than the more usual 10pt: a CV that runs to a second page
 * for the sake of half a point is a worse document, and 9.5 is still comfortably
 * readable in print. Names are large because the first thing a reader needs is to
 * know whose CV they are holding.
 */
export const PDF_TYPE = {
  name: 20,
  contact: 9,
  sectionHeading: 10,
  entryTitle: 10,
  entryMeta: 8.5,
  body: 9.5,
  small: 8.5,
} as const;

export const pdfStyles = StyleSheet.create({
  page: {
    backgroundColor: PDF_COLORS.white,
    color: PDF_COLORS.text,
    // Helvetica is one of the three fonts built into the PDF spec, so it needs no
    // embedding, adds nothing to the file size, and renders identically in every
    // reader. A webfont here would mean shipping a binary and hoping.
    fontFamily: 'Helvetica',
    fontSize: PDF_TYPE.body,
    lineHeight: 1.4,
    paddingTop: 40,
    paddingBottom: 44,
    paddingHorizontal: 44,
  },

  // ── Header ──
  header: { marginBottom: 16 },
  name: {
    fontSize: PDF_TYPE.name,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    fontSize: PDF_TYPE.contact,
    color: PDF_COLORS.textTertiary,
  },
  contactItem: { marginRight: 10 },

  // ── Sections ──
  section: { marginBottom: 13 },
  sectionHeading: {
    fontSize: PDF_TYPE.sectionHeading,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    paddingBottom: 3,
    marginBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.brand,
  },
  /** De-emphasised sections get a grey rule, so the hierarchy is visible in print. */
  sectionHeadingMuted: {
    fontSize: PDF_TYPE.sectionHeading,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color: PDF_COLORS.textSecondary,
    paddingBottom: 3,
    marginBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.lineStrong,
  },

  // ── Entries ──
  entry: { marginBottom: 8 },
  entryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 1,
  },
  entryTitle: { fontSize: PDF_TYPE.entryTitle, fontFamily: 'Helvetica-Bold', flexShrink: 1 },
  entryDates: {
    fontSize: PDF_TYPE.entryMeta,
    color: PDF_COLORS.textTertiary,
    marginLeft: 10,
    flexShrink: 0,
  },
  entryMeta: { fontSize: PDF_TYPE.entryMeta, color: PDF_COLORS.textTertiary, marginBottom: 3 },

  bulletRow: { flexDirection: 'row', marginBottom: 2 },
  bulletMark: { width: 9, color: PDF_COLORS.textSecondary },
  bulletText: { flex: 1, color: PDF_COLORS.textSecondary },

  evidence: { fontSize: PDF_TYPE.small, color: PDF_COLORS.textTertiary, marginTop: 2 },

  /** A de-emphasised entry collapses to a single line. */
  compactLine: { fontSize: PDF_TYPE.body, color: PDF_COLORS.textSecondary, marginBottom: 3 },

  /** Skills and interests read as a comma list rather than as bullets. */
  inlineList: { color: PDF_COLORS.textSecondary },

  // ── Two-column ──
  columns: { flexDirection: 'row' },
  mainColumn: { flex: 1, paddingRight: 16 },
  sideColumn: {
    width: 150,
    borderLeftWidth: 1,
    borderLeftColor: PDF_COLORS.line,
    paddingLeft: 14,
  },

  pageNumber: {
    position: 'absolute',
    bottom: 22,
    left: 44,
    right: 44,
    textAlign: 'center',
    fontSize: 8,
    color: PDF_COLORS.textTertiary,
  },
});
