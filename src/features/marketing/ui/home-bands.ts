/**
 * The class for Home's `<main>`, which holds the page's colour bands.
 *
 * Every band after the first is pulled up 1px so it overlaps the band above.
 * Without it the seams showed a 1px hairline darker than both neighbours —
 * measured 2026-09-29 at 1440px: rgb(118,8,40) between two rows of
 * rgb(140,10,48), and rgb(214,214,214) between two white bands. Section edges
 * land on fractional pixels (the content above has fractional line heights),
 * each band anti-aliases its own edge, and the two partial coverages leave a
 * sliver of the page wrapper's black showing through the shared row. With the
 * overlap that row is always fully covered by an opaque band, and because
 * each band ends on the colour the next one starts on (tokens.css,
 * `--gb-home-band-*`), the 1px it hides is invisible.
 *
 * Shared by "/" (and "/vi") and the /dev/home preview so the two cannot drift.
 */
export const HOME_BANDS_CLASS = '[&>section+section]:-mt-px';
