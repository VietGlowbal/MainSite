'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { SavedNavLink } from '@/components/saved-nav-link';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  MARKETING_NAV_ITEMS,
} from '@/features/marketing/ui';
import {
  isCourseUrl,
  optionsForGroup,
  type ProgramChoices,
} from '@/features/universities/domain';
import { createClient } from '@/lib/supabase/client';
import {
  Button,
  Container,
  Footer,
  ICONS,
  Input,
  KitIcon,
  MobileNav,
  MultiSelect,
  TopNav,
  type MultiSelectOption,
} from '@/shared/ui';

/**
 * "Chọn lại ngành" — Figma 375:13546, the dialog at 375:13683 (704×1064).
 *
 * The frame, top to bottom: heading, a search field, a scrolling list of schools
 * with a Reset / Select-all footer, a second scrolling list of subjects with the
 * same footer, then "Nếu không tìm thấy ngành mong muốn thì paste link" over a
 * link field, and one full-width primary button.
 *
 * BOTH LISTS ARE `MultiSelect`, which is that exact kit component — Untitled UI's
 * `_Multi-select menu item` list with the kit's menu footer, already built from
 * 375:11536 for the onboarding questions. It is used in `single` mode, a
 * capability that shipped in that component with a note saying it had no caller
 * yet and that the next single-answer list would want it. This is that list.
 *
 * Where this departs from the frame, and why:
 *
 *  1. SINGLE ANSWER, SO NO "SELECT ALL". The frame's footers carry Reset +
 *     Select all, inherited from the multi-select instance. A saved university
 *     stores ONE subject — the card prints one, the column holds one — so
 *     "select all" has nothing to mean. `single` hides it and keeps Reset.
 *
 *  2. THE SCHOOL LIST ONLY APPEARS FOR A UNIVERSITY THAT HAS SCHOOLS. The frame
 *     draws schools with a specialization count over subjects with a duration —
 *     a course catalogue. There is exactly one in the repo (VinUni's, in
 *     src/lib/vinuni-content.ts) and no table behind the other 96, so for those
 *     the school list is not rendered at all rather than drawn empty. See
 *     features/universities/domain/programs.ts, which makes that call once.
 *
 *  3. NO PROGRESS BAR, AND NO "Reflection" PAGE BEHIND A SCRIM. Those belong to
 *     the AI-strategy questionnaire; the designer reused that screen as a
 *     backdrop. Reproducing a 1/3 stepper on a one-step choice would claim this
 *     is part of a flow it is not.
 */

export function ProgramPicker({
  savedId,
  universityName,
  universityLogoUrl,
  choices,
  initialProgram,
  initialProgramUrl,
}: {
  /** `user_universities.id` — the row this choice is written to. */
  savedId: number;
  universityName: string;
  universityLogoUrl: string | null;
  choices: ProgramChoices;
  initialProgram: string | null;
  initialProgramUrl: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [group, setGroup] = useState<string | null>(null);
  const [program, setProgram] = useState<string | null>(initialProgram);
  const [url, setUrl] = useState(initialProgramUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupOptions: MultiSelectOption[] = useMemo(
    () =>
      choices.groups.map((candidate) => ({
        value: candidate.name,
        label: candidate.name,
        // The frame's "4 specializations". A real count, so it is safe to print.
        description: `${candidate.options.length} ${
          candidate.options.length === 1 ? 'programme' : 'programmes'
        }`,
      })),
    [choices.groups],
  );

  const subjectOptions: MultiSelectOption[] = useMemo(
    () =>
      optionsForGroup(choices, group).map((option) => {
        /*
         * The frame puts the course length on this line. The catalogue almost
         * never has one (null on 400 of 404 rows), but it does have the degree
         * level — and that is the more useful discriminator anyway, because the
         * same subject is catalogued as both a bachelor's and a master's. Both
         * are shown when both exist, neither is invented when they do not.
         *
         * Each part is its own <span>, so each is a whole text node the static
         * dictionary can translate. This route has no machine fallback, and
         * "Bachelor · 4 years" as one string could never be a dictionary hit.
         */
        const parts: React.ReactNode[] = [];
        if (option.degree) parts.push(<span key="degree">{option.degree}</span>);
        if (option.durationYears != null) {
          // Built as ONE string, not `{n} {'years'}` — that produces separate
          // child nodes and the dictionary keys the whole node ("4 years").
          const years = `${option.durationYears} ${option.durationYears === 1 ? 'year' : 'years'}`;
          parts.push(<span key="duration">{years}</span>);
        }

        return {
          value: option.name,
          label: option.name,
          ...(parts.length > 0
            ? {
                description: (
                  <>
                    {parts[0]}
                    {parts.length > 1 ? ' · ' : null}
                    {parts[1]}
                  </>
                ),
              }
            : {}),
        };
      }),
    [choices, group],
  );

  const urlProvided = url.trim().length > 0;
  const urlValid = !urlProvided || isCourseUrl(url);
  /* Nothing chosen is not an error, but it is not a submission either. */
  const canSave = (program != null || urlProvided) && urlValid && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('user_universities')
      .update({ program, program_url: urlProvided ? url.trim() : null })
      .eq('id', savedId);

    if (updateError) {
      setSaving(false);
      /*
       * Name the failure. The likely one on a project where
       * supabase-saved-program.sql has not been run is a missing column, and a
       * generic "please try again" would send someone retrying a write that can
       * never succeed.
       *
       * Matched on the CODE, verified against the live API rather than guessed:
       * PostgREST answers an unknown column with PGRST204 and the message
       * "Could not find the 'program' column of 'user_universities' in the schema
       * cache" — note the word "column" comes AFTER the column name, which an
       * obvious /column .*program/ pattern misses. 42703 is Postgres's own
       * undefined_column, in case the request ever reaches it directly.
       */
      const code = (updateError as { code?: string }).code ?? '';
      const missingColumn =
        code === 'PGRST204' || code === '42703' || /'program(_url)?' column/i.test(updateError.message);
      setError(
        missingColumn
          ? 'Saving a subject is not switched on in this environment yet — the user_universities.program column has not been added. Nothing was changed.'
          : 'We could not save that. Please try again.',
      );
      return;
    }

    router.push('/my-universities');
    router.refresh();
  }

  const primaryAction = { href: '/universities', label: 'Search universities' };

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <TopNav
        tone="light"
        logo={<GlowbalLogo height={28} />}
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        utility={<SavedNavLink />}
      />
      <MobileNav
        logo={
          <Link href="/" aria-label="GlowBal home" className="inline-flex items-center">
            <GlowbalLogo height={28} />
          </Link>
        }
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        /* Always the profile link: this page is behind the auth gate, so there is
           no signed-out state to offer "Sign in" for. */
        secondaryAction={{ href: '/profile', label: 'Profile' }}
        utility={<SavedNavLink variant="row" />}
        openLabel="Menu"
        closeLabel="Close menu"
      />

      <main className="min-h-screen py-gb-6xl">
        <Container>
          {/* 375:13683 — the frame's 704px card, centred on its own page. */}
          <div className="mx-auto flex w-full max-w-[704px] flex-col gap-gb-3xl rounded-gb-2xl border border-line bg-surface p-gb-4xl shadow-gb-lg">
            <div className="flex items-start justify-between gap-gb-xl">
              <div className="flex min-w-0 items-center gap-gb-xl">
                {universityLogoUrl ? (
                  /* Crests come from arbitrary hosts, so a plain <img> as
                     everywhere else in this feature. */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={universityLogoUrl}
                    alt=""
                    loading="lazy"
                    className="size-gb-6xl shrink-0 object-contain"
                  />
                ) : null}
                <div className="flex min-w-0 flex-col gap-gb-xs">
                  <h1 className="text-gb-xl font-semibold text-fg">Select a subject</h1>
                  <p className="truncate text-gb-sm text-fg-tertiary">{universityName}</p>
                </div>
              </div>
              {/*
                375:13684 is an `x-close` instance. Shipped as a labelled back
                link instead, for two reasons that point the same way: this is a
                page rather than a dialog, so dismissing it is a navigation and
                should say where it goes; and there is no close glyph in `ICONS`
                (`ICONS.x` is the X/Twitter mark), so an X here would mean
                hand-drawing an icon, which docs/README.md rules out.
              */}
              <Link
                href="/my-universities"
                className="flex shrink-0 items-center gap-gb-xs rounded-gb-md px-gb-sm py-gb-xs text-gb-sm font-semibold text-fg-tertiary transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <KitIcon art={ICONS.arrowLeft} frame={20} />
                Back
              </Link>
            </div>

            {choices.options.length === 0 ? (
              /*
                9 of 106 rows have no `strengths`, and no catalogue either. A
                search box over an empty list looks broken, so say what is true
                and leave the link field as the way through.
              */
              <p className="rounded-gb-xl border border-line bg-surface-muted p-gb-xl text-gb-sm text-fg-tertiary">
                We do not have a subject list for this university yet. Paste a link to the course
                page below and it will show on your saved list.
              </p>
            ) : (
              <>
                {/* 375:13703 — schools. Only for a university that has them. */}
                {groupOptions.length > 0 ? (
                  <div className="flex flex-col gap-gb-md">
                    <h2 className="text-gb-sm font-semibold text-fg">School</h2>
                    <MultiSelect
                      name="program-school"
                      label="School"
                      placeholder="Search schools"
                      options={groupOptions}
                      value={group ? [group] : []}
                      single
                      onChange={(next) => {
                        const chosen = next[0] ?? null;
                        setGroup(chosen);
                        /*
                         * Narrowing to a school that does not contain the current
                         * subject would leave a chosen value invisible in the list
                         * below and still saved on submit.
                         */
                        if (
                          program != null &&
                          chosen != null &&
                          !(choices.groups.find((g) => g.name === chosen)?.options ?? []).some(
                            (option) => option.name === program,
                          )
                        ) {
                          setProgram(null);
                        }
                      }}
                    />
                  </div>
                ) : null}

                {/* 375:13716 — subjects. */}
                <div className="flex flex-col gap-gb-md">
                  <h2 className="text-gb-sm font-semibold text-fg">Subject</h2>
                  <MultiSelect
                    name="program-subject"
                    label="Subject"
                    placeholder="Search subjects"
                    options={subjectOptions}
                    value={program ? [program] : []}
                    single
                    maxVisible={6}
                    onChange={(next) => setProgram(next[0] ?? null)}
                  />
                </div>
              </>
            )}

            {/* 375:13729 — the paste-a-link fallback. */}
            <div className="flex flex-col gap-gb-lg border-t border-line pt-gb-3xl">
              <h2 className="text-gb-md font-semibold text-fg">
                Cannot find the subject you want? Paste a link to it
              </h2>
              <Input
                name="programUrl"
                label="Course page"
                placeholder="https://university.edu/programmes/..."
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                {...(urlValid
                  ? { hint: 'Optional. It shows as a link on your saved list.' }
                  : {
                      error:
                        'That does not look like a course page link — it needs to start with http:// or https://',
                    })}
              />
            </div>

            {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}

            {/* 375:13742 — one full-width primary. */}
            <Button size="lg" className="w-full" disabled={!canSave} onClick={save}>
              {saving ? 'Saving...' : 'Save subject'}
            </Button>
            {!canSave && !saving ? (
              <p className="text-center text-gb-sm text-fg-muted">
                Pick a subject or paste a course link to continue.
              </p>
            ) : null}
          </div>
        </Container>
      </main>

      <Footer
        logo={<GlowbalLogo height={28} />}
        tagline={FOOTER_TAGLINE}
        columns={FOOTER_COLUMNS}
        social={FOOTER_SOCIAL}
        copyright={FOOTER_COPYRIGHT}
        ratings={FOOTER_RATINGS}
      />
    </div>
  );
}
