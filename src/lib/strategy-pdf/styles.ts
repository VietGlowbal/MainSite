import { StyleSheet } from '@react-pdf/renderer';

/**
 * The Personalized Strategy PDF stylesheet.
 *
 * Its own file, deliberately not shared with `lib/cv-pdf/styles.ts` — same
 * reasoning as that file's own header: `@react-pdf/renderer` cannot read a
 * CSS custom property, so the token values are copied here from
 * `src/styles/tokens.css` with the token name beside each one. A strategy
 * report and a CV are different documents (a report reads top-to-bottom in
 * prose sections; a CV is dense and columnar) and sharing one stylesheet
 * would mean every future change to one has to be checked against the other.
 */

export const PDF_COLORS = {
  /** --color-gb-neutral-950 */
  text: '#171717',
  /** --color-gb-neutral-700 */
  textSecondary: '#404040',
  /** --color-gb-neutral-600 */
  textTertiary: '#525252',
  /** --color-gb-neutral-200 */
  line: '#e5e5e5',
  /** --color-gb-neutral-300 */
  lineStrong: '#d4d4d4',
  /** --color-gb-neutral-50 */
  surfaceMuted: '#fafafa',
  /** --color-gb-brand-600 (Rose 600). The single accent. */
  brand: '#e11d48',
  white: '#ffffff',
} as const;

export const PDF_TYPE = {
  title: 22,
  meta: 9,
  sectionHeading: 13,
  cardHeading: 10.5,
  body: 10,
  small: 8.5,
} as const;

export const pdfStyles = StyleSheet.create({
  page: {
    backgroundColor: PDF_COLORS.white,
    color: PDF_COLORS.text,
    fontFamily: 'Helvetica',
    fontSize: PDF_TYPE.body,
    lineHeight: 1.45,
    paddingTop: 44,
    paddingBottom: 48,
    paddingHorizontal: 48,
  },

  header: { marginBottom: 20 },
  title: {
    fontSize: PDF_TYPE.title,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  meta: { fontSize: PDF_TYPE.meta, color: PDF_COLORS.textTertiary },

  section: { marginBottom: 18 },
  sectionHeading: {
    fontSize: PDF_TYPE.sectionHeading,
    fontFamily: 'Helvetica-Bold',
    paddingBottom: 4,
    marginBottom: 9,
    borderBottomWidth: 1.5,
    borderBottomColor: PDF_COLORS.brand,
  },
  subHeading: {
    fontSize: PDF_TYPE.cardHeading,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  body: { fontSize: PDF_TYPE.body, color: PDF_COLORS.textSecondary },
  bodyMuted: { fontSize: PDF_TYPE.small, color: PDF_COLORS.textTertiary },

  card: {
    borderWidth: 1,
    borderColor: PDF_COLORS.line,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  cardChosen: {
    borderWidth: 1.5,
    borderColor: PDF_COLORS.brand,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  cardHeading: { fontSize: PDF_TYPE.cardHeading, fontFamily: 'Helvetica-Bold', flexShrink: 1 },
  tag: {
    fontSize: PDF_TYPE.small,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.brand,
    backgroundColor: PDF_COLORS.surfaceMuted,
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginLeft: 8,
  },

  dimensionGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  dimensionCell: { width: '50%', marginBottom: 3 },
  dimensionLabel: { fontSize: PDF_TYPE.small, color: PDF_COLORS.textTertiary },
  dimensionValue: { fontSize: PDF_TYPE.body, fontFamily: 'Helvetica-Bold' },

  bulletRow: { flexDirection: 'row', marginBottom: 3 },
  bulletMark: { width: 10, color: PDF_COLORS.brand, fontFamily: 'Helvetica-Bold' },
  bulletText: { flex: 1, fontSize: PDF_TYPE.body, color: PDF_COLORS.textSecondary },

  pageNumber: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    textAlign: 'center',
    fontSize: 8,
    color: PDF_COLORS.textTertiary,
  },
});
