/**
 * The four universities the home-page roster studies at, and the crest each
 * card shows.
 *
 * ⚠️ THESE ARE THIRD-PARTY MARKS, SHOWN NOMINATIVELY. Every file under
 * `public/universities/` is the institution's own published logo, taken from
 * the source recorded beside it below, and it appears for exactly one reason:
 * to say where that team member studies. Nothing on the section claims a
 * partnership, an endorsement or an affiliation — which is the same line
 * ./partner-logos.ts draws, and the reason that section's heading had to
 * change. If an institution asks for its mark to come down, delete its entry:
 * `crestFor` returns `null` for an unknown key and the card falls back to the
 * university's name as plain text, so nothing breaks.
 *
 * ⚠️ THE ASPECT RATIOS ARE NOT UNIFORM, ON PURPOSE. Three of these are
 * horizontal lockups (crest plus wordmark) and VinUniversity's is a square
 * mark, because VinUniversity publishes its horizontal lockup in white only
 * (`VINUNI_LOGO-FULL-.png`), which is invisible on the light chip the card
 * uses. So the badge sizes by HEIGHT and lets the width run free
 * (`h-… w-auto object-contain` in home-team.tsx). Do not force a square box:
 * it would letterbox the three wordmarks down to something unreadable at
 * 20px.
 *
 * ⚠️ NAMES ARE NEVER TRANSLATED. `name` is alt text and an institution name,
 * so it stays in one language in both locales — the same i18n rule
 * PartnerLogo.name carries.
 */
export type UniversityCrest = {
  /** Full institution name. Alt text, and the text fallback if the file goes. */
  readonly name: string;
  readonly src: string;
  /** Intrinsic size of the file, which is what next/image needs. The badge
      overrides both in CSS — only the ratio survives to the screen. */
  readonly width: number;
  readonly height: number;
};

/** Keys used by the roster in home-team.tsx. */
export type UniversityKey = 'vinuniversity' | 'hust' | 'ftu' | 'birmingham';

const CRESTS: Record<UniversityKey, UniversityCrest> = {
  /* Source: vinuni.edu.vn site icon, the colour square mark
     (wp-content/uploads/2020/02/cropped-VINUNI_LOGO-FULL-…-Copy-2.png),
     downscaled to 160px. See the second ⚠️ for why this one is not a lockup. */
  vinuniversity: {
    name: 'VinUniversity',
    src: '/universities/vinuniversity.png',
    width: 160,
    height: 160,
  },
  /* Source: Wikimedia Commons, "Logo of HUST (English).svg" — public domain,
     credited to the university itself. The only one of the four with a freely
     licensed file, so it stays vector. */
  hust: {
    name: 'Hanoi University of Science and Technology',
    src: '/universities/hust.svg',
    width: 122,
    height: 24,
  },
  /* Source: ftu.edu.vn header logo (images/stories/joomlart/logo.png),
     downscaled to 96px tall. */
  ftu: {
    name: 'Foreign Trade University',
    src: '/universities/ftu.png',
    width: 436,
    height: 96,
  },
  /* Source: birmingham.ac.uk `uob-uk-logo-light.svg` (the dark-ink variant, for
     light backgrounds). Rasterised to a 96px-tall PNG on the way in: the
     official SVG is 131 KB of coat-of-arms paths, which is not a sane payload
     for a 20px badge. */
  birmingham: {
    name: 'University of Birmingham',
    src: '/universities/birmingham.png',
    width: 292,
    height: 96,
  },
};

/** The crest for a roster key, or `null` if that entry has been removed. */
export function crestFor(key: UniversityKey): UniversityCrest | null {
  return CRESTS[key] ?? null;
}
