import Image from 'next/image';
import type { TeamMember } from '@/lib/team';
import { Button, ICONS, KitIcon, Section } from '@/shared/ui';
import { crestFor, type UniversityKey } from './university-crests';

/**
 * Home roster — Figma 903:10609, rebuilt as a staggered card deck.
 *
 * ─── WHAT CHANGED, AND WHY IT IS NOT JUST DECORATION ─────────────────────────
 *
 * The Figma frame is a flat 4-column grid of square photos with three lines of
 * text under each. It is legible and completely inert: eight identical tiles,
 * nothing to look at twice, and — on a platform whose entire pitch is "we help
 * you win scholarships" — no sign anywhere that the people building it have
 * won any. The owner asked for something more interesting and supplied the
 * roster sheet that makes it possible.
 *
 * So each tile became a card that carries three things the grid did not:
 *
 * 1. WHERE THEY STUDY, as that university's own crest, on a chip that
 *    overlaps the bottom edge of the portrait. See ./university-crests.ts for
 *    the sourcing, the nominative-use warning, and why the badge sizes by
 *    height rather than being boxed square.
 * 2. WHAT THEY STUDY — the programme line, straight from the sheet.
 * 3. WHAT THEY WON — the scholarship strip, for the three members who have
 *    one. This is the section's real argument, and it is why the strip is the
 *    only brand-coloured surface on the card: three of eight people building a
 *    scholarship product got here on scholarships themselves.
 *
 * ⚠️ EVERY ONE OF THOSE FACTS COMES FROM THE OWNER'S ROSTER SHEET
 * ("Organisation_Members | GlowBal.xlsx"), verbatim in substance. The five
 * members whose sheet rows have an empty scholarship column get no strip
 * rather than a softer-sounding stand-in — inventing an accolade on a page
 * about accolades is the one thing this section cannot do. Same rule as the
 * `photo_url = null` note in supabase-team-members-seed.sql.
 *
 * ─── WHY THE STAGGER IS `mt` AND NOT `translate-y` ───────────────────────────
 *
 * Columns 2 and 4 sit 64px lower than 1 and 3, which is what stops eight cards
 * of near-identical height from reading as a spreadsheet. `translate` was the
 * obvious way to do it and is wrong here: it moves the paint without moving
 * the layout box, so the lowered cards would overhang the section's bottom
 * padding and collide with the "Meet the GlowBal team" button. `mt` on the
 * odd-indexed cards moves the box itself, and the grid's own row sizing
 * absorbs it.
 *
 * The offset keys off `index % 2`, which lands on the same two columns at
 * `sm:` (2 across → every right-hand card) and at `lg:` (4 across → columns 2
 * and 4). It is deliberately not applied below `sm`, where the single column
 * would just gain a random 64px gap between every card.
 *
 * ─── STAYS A SERVER COMPONENT ────────────────────────────────────────────────
 *
 * Every interaction here is `group-hover`/`group-focus-within` in CSS: the
 * lift, the portrait's slow zoom, the rule that draws itself in under the
 * name. Nothing needs state, so this ships no JavaScript — unlike the About
 * page's carousel (about-team.tsx), which is a per-frame rAF loop because
 * its motion genuinely cannot be expressed in CSS.
 *
 * ⚠️ NOTHING IS HIDDEN BEHIND HOVER, AND NOTHING NEEDS IT EITHER. The
 * programme and the scholarship are both in the resting card. A
 * reveal-on-hover panel was the first sketch and got dropped: it puts the
 * most interesting content of the section out of reach of every touch
 * device, which is most of this audience. An earlier pass also held each
 * portrait back at 65% colour until hover/focus, matching the About page's
 * carousel tiles — dropped on the owner's explicit request: every photo
 * should read at its best without a pointer resting on the card. Hover now
 * only ever adds the zoom; it never gates colour or content.
 *
 * ─── NO SCHOLARSHIP TALLY, NO CARD NUMBERS ───────────────────────────────────
 *
 * Two things this deck tried and dropped, on the owner's call: a counted
 * "3/8 of us study on a scholarship" badge above the grid, and an editorial
 * `01`–`08` in each portrait's corner. Both read as filler once the crest,
 * programme and scholarship strip were already doing the section's actual
 * work — see `git log` on this file for what they looked like.
 *
 * ─── NO PERSONAL QUOTE EITHER (dropped 2026-08-17) ───────────────────────────
 *
 * Each card used to close with a one-line quote from the roster sheet (`bio`),
 * translated in src/lib/i18n-dictionary.ts. Removed on the owner's request, so
 * the card now ends on the scholarship strip. The field is gone from
 * `RosterMember` rather than left unrendered — `git show` this file's previous
 * revision for the eight lines and their Vietnamese.
 *
 * ─── PHOTOS STILL COME FROM SUPABASE ─────────────────────────────────────────
 *
 * Unchanged from the earlier build: the roster below is the display copy, and
 * `members` supplies the portraits by slug. `photoSlugs` is a list because a
 * couple of people are seeded under a longer legal name than the one they go
 * by here (see supabase-team-members-seed.sql), and the first slug that
 * resolves wins. A member with no stored photo falls back to their initials.
 */

type RosterMember = {
  readonly name: string;
  readonly role: string;
  readonly university: UniversityKey;
  /**
   * Course of study, as the roster sheet records it. `null` where the sheet
   * leaves the column empty — the card then shows the university's name in
   * text instead, so the line is never blank.
   */
  readonly programme: string | null;
  /** Scholarship / academic award, or `null`. See the ⚠️ in the header. */
  readonly scholarship: string | null;
  readonly photoSlugs: readonly string[];
};

const HOME_TEAM: readonly RosterMember[] = [
  {
    name: 'Nguyễn Khánh Linh',
    role: 'Founder & CEO',
    university: 'vinuniversity',
    programme: 'Business Administration · Marketing',
    scholarship: "80% merit scholarship · 4× Dean's List",
    photoSlugs: ['nguyen-khanh-linh'],
  },
  {
    name: 'Nguyễn Hoàng Linh',
    role: 'CO - Founder',
    university: 'vinuniversity',
    programme: 'Business Administration · Business Analytics',
    scholarship: null,
    photoSlugs: ['nguyen-hoang-linh'],
  },
  {
    name: 'Chu Tuấn Linh',
    role: 'Developer',
    university: 'hust',
    programme: 'Information Technology',
    scholarship: null,
    photoSlugs: ['chu-tuan-linh'],
  },
  {
    name: 'Phạm Quỳnh Chi',
    role: 'UX Research',
    university: 'vinuniversity',
    programme: 'Business Administration',
    scholarship: '90% merit scholarship · full ride at Lingnan',
    photoSlugs: ['pham-quynh-chi'],
  },
  {
    name: 'Nguyễn Huấn',
    role: 'Backend Developer',
    university: 'hust',
    programme: 'Computer Engineering',
    scholarship: null,
    photoSlugs: ['nguyen-van-huan'],
  },
  {
    name: 'Tạ Đức Hiển',
    role: 'Product Designer',
    university: 'hust',
    programme: 'Computer Engineering',
    scholarship: null,
    photoSlugs: ['ta-duc-hien'],
  },
  {
    name: 'Hương Phùng',
    role: 'UX Researcher',
    university: 'ftu',
    programme: 'International Political Economics',
    scholarship: '2× FTU academic encouragement scholarship',
    photoSlugs: ['phung-thi-huong'],
  },
  {
    name: 'James Lapslie',
    role: 'Product Manager',
    /* The sheet gives James a university but no course, so `programme` is null
       and his card shows "University of Birmingham" on that line instead. */
    university: 'birmingham',
    programme: null,
    scholarship: null,
    photoSlugs: ['james-lapslie', 'james-david-lapslie'],
  },
];

/** First + last initial, the same rule the avatar and the About page use. */
function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  const seed = `${first}${last}`.toUpperCase();
  return seed === '' ? '?' : seed;
}

export function HomeTeam({ members = [] }: { members?: readonly TeamMember[] }) {
  const storedPhotos = new Map<string, string>();
  for (const member of members) {
    if (member.photo_url) storedPhotos.set(member.slug, member.photo_url);
  }

  return (
    <Section
      padded={false}
      className="py-gb-6xl"
      containerClassName="flex flex-col gap-gb-6xl"
    >
      <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-gb-2xl text-center">
        <h2 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-brand md:text-gb-display-md">
          The team behind your journey.
        </h2>
        <p className="text-gb-md leading-relaxed text-fg-tertiary md:text-gb-xl">
          GlowBal is built by a team across technology, education, research and communication,
          including people who have experienced scholarship and study-abroad journeys themselves.
          We combine student insight, specialist knowledge and technology to turn fragmented
          advice into a clearer system.
        </p>
      </div>

      {/* `items-start` is load-bearing, not tidiness. A grid stretches its
          items to the tallest in the row by default, so a member whose
          scholarship strip wraps to two lines would hand every card beside
          them the same height and leave white space under the short ones,
          which now end on the programme line. Hugging the content
          is also what lets the stagger read as a deck rather than as a table
          with one row nudged down. */}
      <div className="grid grid-cols-1 items-start gap-gb-4xl sm:grid-cols-2 lg:grid-cols-4">
        {HOME_TEAM.map((member, index) => {
          const photoUrl = member.photoSlugs
            .map((slug) => storedPhotos.get(slug))
            .find((url): url is string => typeof url === 'string');
          const crest = crestFor(member.university);
          /* Columns 2 and 4 ride 64px lower — see the header for why this is a
             margin and not a transform, and why it starts at `sm:`. */
          const stagger = index % 2 === 1 ? 'sm:mt-gb-7xl' : '';

          return (
            <article
              key={member.name}
              className={`group relative flex flex-col overflow-hidden rounded-gb-xl border border-line bg-surface shadow-gb-xs transition duration-300 ease-out hover:-translate-y-gb-xs hover:shadow-gb-lg focus-within:-translate-y-gb-xs focus-within:shadow-gb-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${stagger}`}
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-surface-muted">
                {photoUrl ? (
                  <Image
                    src={photoUrl}
                    alt={member.name}
                    fill
                    sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) calc((100vw - 96px) / 2), 280px"
                    /* Full colour at rest — the owner wants every portrait
                       readable at its best without requiring a pointer, which
                       rules out both a resting desaturation and a hover-only
                       reveal. The zoom-on-hover stays as pure enrichment. */
                    className="object-cover transition duration-500 ease-out group-hover:scale-[1.04] group-focus-within:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="flex size-full items-center justify-center font-display text-gb-display-md font-semibold text-fg-muted"
                  >
                    {monogram(member.name)}
                  </div>
                )}

                {/* Crest chip, straddling the portrait's bottom edge. White
                    rather than frosted: three of the four marks carry their own
                    colour (rose, red, gold), and a translucent chip would let
                    whatever is behind them bleed through and shift those
                    colours. */}
                {crest ? (
                  <span className="absolute -bottom-gb-md right-gb-lg inline-flex h-[58px] items-center justify-center rounded-gb-md border border-line bg-surface px-gb-lg shadow-gb-xs">
                    {/* 30px tall, width free. Three of these are lockups whose
                        wordmark is set beside a crest — at the 20px this badge
                        started on, Foreign Trade University's two lines of type
                        collapsed into a grey smear. 30 (bumped up from the
                        original 24 per owner request) reads clearly at arm's
                        length without the chip growing into the portrait. */}
                    <Image
                      src={crest.src}
                      alt={crest.name}
                      width={crest.width}
                      height={crest.height}
                      className="h-[30px] w-auto max-w-[150px] object-contain"
                    />
                  </span>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col gap-gb-md p-gb-xl pt-gb-3xl">
                <h3 data-no-auto-translate className="text-gb-lg font-semibold text-fg">
                  {member.name}
                </h3>
                <p className="text-gb-md text-brand">{member.role}</p>

                {/* Underlines the role at 24px at rest and runs the full width
                    on hover — the card's one piece of pure motion. */}
                <span
                  aria-hidden="true"
                  className="h-px w-gb-3xl bg-brand transition-all duration-500 ease-out group-hover:w-full group-focus-within:w-full motion-reduce:transition-none"
                />

                <p className="flex items-start gap-gb-md text-gb-sm text-fg-tertiary">
                  <KitIcon
                    art={ICONS.graduationCap}
                    frame={20}
                    className="mt-gb-xxs shrink-0 text-fg-muted"
                  />
                  {/* The fallback is an institution name, so it carries the
                      no-translate flag the programme text does not need. */}
                  {member.programme === null ? (
                    <span data-no-auto-translate>{crest?.name ?? ''}</span>
                  ) : (
                    <span>{member.programme}</span>
                  )}
                </p>

                {member.scholarship === null ? null : (
                  <p className="rounded-gb-md bg-brand-subtle px-gb-lg py-gb-md text-gb-xs font-semibold text-fg-brand">
                    {member.scholarship}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <Button href="/about" size="xl" className="self-center">
        Meet the GlowBal team
      </Button>
    </Section>
  );
}
