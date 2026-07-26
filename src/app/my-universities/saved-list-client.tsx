'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  MARKETING_NAV_ITEMS,
} from '@/features/marketing/ui';
import { formatDeadlineLabel, scholarshipCandidates } from '@/features/universities/domain';
import { createClient } from '@/lib/supabase/client';
import { TID, testId } from '@/shared/lib';
import {
  Badge,
  Button,
  Container,
  Footer,
  ICONS,
  KitIcon,
  MobileNav,
  Modal,
  TopNav,
} from '@/shared/ui';

/**
 * The saved list — Figma 223:8824 ("Danh sách đã lưu"), plus 223:13621 for the
 * selected / scholarship-attached state and 223:13022 for the picker dialog.
 *
 * Where this departs from the frames, and why:
 *
 *  1. NO SCHOLARSHIP CODE FIELD. The dialog (223:13022) leads with "Mã học
 *     bổng" + "ÁP DỤNG" — a redeem-a-code control. There is no code anywhere in
 *     the schema: no voucher table, no code column, no endpoint. Shipping the
 *     input would be a third dead control of the kind /auth just had two
 *     removed from. The rest of the dialog is real and is built: it lists the
 *     scholarships actually linked to the selected universities
 *     (scholarship_universities) and attaches the chosen one to the saved
 *     university (user_scholarships.university_id).
 *
 *  2. COUNTRY MOVES TO THE PIN. The frame's badge row is
 *     [QS rank][THE rank][country][institution type] and its details line is
 *     [pin "Remote"][clock deadline] — "Remote" being leftover text from the
 *     kit's job-post card this row is an instance of. There is no city column to
 *     put on a map pin, so country goes there (a pin means a place) and the
 *     badge row keeps the three facts that are not places. Same slots, no fact
 *     printed twice.
 *
 *  3. "Xóa" IS text-md, NOT text-xl. The frame's node is 20px, which would make
 *     the destructive link the largest text in the row — larger than the
 *     university name. The layer is named "Supporting text" and carries "92%" in
 *     the sibling "My application" frames, so its size is inherited from a
 *     repurposed layer rather than chosen.
 *
 *  4. NO MOBILE FRAME EXISTS for this page, so the row reflows here: the
 *     checkbox and Remove share a top line, then the cover, then the card.
 */

export type ScholarshipOption = {
  id: number;
  name: string;
  amountLabel: string | null;
  deadlineLabel: string | null;
  coverage: string | null;
};

export type SavedRow = {
  /** user_universities.id */
  id: number;
  universityId: number;
  name: string;
  country: string;
  type: string | null;
  qsRank: number | null;
  theRank: number | null;
  deadline: string | null;
  summary: string | null;
  imageUrl: string | null;
  /** Crest, shown beside each option in the picker (Figma 223:13022). */
  logoUrl: string | null;
  /** Resolved via features/universities/domain — null for most universities. */
  website: string | null;
  attached: Array<{ savedId: number; id: number; name: string; amountLabel: string | null }>;
  options: ScholarshipOption[];
};

const CHECKBOX =
  'size-gb-4xl shrink-0 cursor-pointer rounded-gb-sm border-2 border-line-strong accent-brand ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

function SavedRowItem({
  row,
  selected,
  onToggle,
  onRemove,
  removing,
}: {
  row: SavedRow;
  selected: boolean;
  onToggle: (universityId: number) => void;
  onRemove: (row: SavedRow) => void;
  removing: boolean;
}) {
  const deadline = formatDeadlineLabel(row.deadline);

  return (
    <li
      {...testId(TID.uniCard)}
      className={`flex flex-wrap items-center gap-gb-lg lg:gap-gb-3xl ${
        removing ? 'pointer-events-none opacity-50' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(row.universityId)}
        aria-label={`Select ${row.name}`}
        className={`order-1 ${CHECKBOX}`}
      />

      <button
        type="button"
        onClick={() => onRemove(row)}
        className="order-2 ml-auto rounded-gb-md px-gb-sm py-gb-xs text-gb-md font-medium text-fg-tertiary transition-colors hover:text-fg-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:order-4 lg:ml-0"
      >
        Remove
      </button>

      <div className="order-3 w-full overflow-hidden rounded-gb-2xl bg-surface-muted lg:order-2 lg:h-[188px] lg:w-[260px] lg:shrink-0">
        {row.imageUrl ? (
          /* Plain <img>, matching FadeInImage on /universities: cover images come
             from arbitrary hosts and next/image would reject anything not in
             next.config.ts's remotePatterns. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={row.imageUrl}
            alt=""
            loading="lazy"
            className="aspect-[260/188] w-full object-cover lg:h-full"
          />
        ) : (
          <div className="flex aspect-[260/188] w-full items-center justify-center lg:h-full">
            <span className="font-display text-gb-display-sm text-fg-muted">
              {row.name.slice(0, 1)}
            </span>
          </div>
        )}
      </div>

      {/*
        `lg:min-h-[188px]` is the cover's height, and it is load-bearing rather
        than decorative: every row in the frame is exactly 188px because the
        mockup's cards all carry the same four fields. Real rows do not — a
        university with no ranking, summary or type collapses to two lines, and
        without the floor the cover sticks out above and below a card half its
        height. With it, `justify-between` drops the details line to the bottom
        and the row keeps the design's geometry.
      */}
      <article className="order-4 flex w-full flex-col justify-between gap-gb-2xl rounded-gb-2xl border border-line bg-surface p-gb-3xl lg:order-3 lg:min-h-[188px] lg:min-w-0 lg:flex-1">
        <div className="flex flex-col gap-gb-xl">
          <div className="flex flex-col gap-gb-md">
            <h2 className="text-gb-md font-semibold text-fg">{row.name}</h2>
            <div className="flex flex-wrap gap-gb-lg">
              {row.qsRank != null ? (
                <Badge variant="brand-subtle">#{row.qsRank} QS World Ranking</Badge>
              ) : null}
              {row.theRank != null ? (
                <Badge variant="brand-subtle">#{row.theRank} THE Ranking</Badge>
              ) : null}
              {row.type ? <Badge variant="neutral">{row.type}</Badge> : null}
            </div>
          </div>
          {row.summary ? (
            <p className="line-clamp-2 text-gb-md text-fg-tertiary">{row.summary}</p>
          ) : null}
          {row.attached.length > 0 ? (
            <ul className="flex flex-wrap gap-gb-md">
              {row.attached.map((s) => (
                <li key={s.savedId}>
                  <Badge variant="brand-subtle">
                    {s.amountLabel ? `${s.name} · ${s.amountLabel}` : s.name}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-gb-lg">
          <div className="flex flex-wrap items-center gap-gb-xl">
            <span className="flex items-center gap-gb-sm text-gb-sm font-semibold text-fg-tertiary">
              <KitIcon art={ICONS.markerPin02} frame={20} className="text-fg-muted" />
              {row.country}
            </span>
            {deadline ? (
              <span className="flex items-center gap-gb-sm text-gb-sm font-semibold text-fg-tertiary">
                <KitIcon art={ICONS.clock} frame={20} className="text-fg-muted" />
                Deadline: {deadline}
              </span>
            ) : null}
          </div>
          {row.website ? (
            <a
              href={row.website}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-gb-xs text-gb-sm font-semibold text-brand hover:text-brand-hover"
            >
              Official site
              <KitIcon art={ICONS.arrowUpRight} frame={20} />
            </a>
          ) : (
            /* No website in the lookup — a link labelled "Official site" that
               points at a guess would be worse than one that points somewhere
               real, so it points at the in-app profile instead. */
            <Link
              href={`/universities?u=${row.universityId}`}
              className="flex items-center gap-gb-xs text-gb-sm font-semibold text-brand hover:text-brand-hover"
            >
              View profile
              <KitIcon art={ICONS.arrowRight} frame={20} />
            </Link>
          )}
        </div>
      </article>
    </li>
  );
}

/** Figma 223:13022, minus the code field — see note (1) at the top of this file. */
function ScholarshipPicker({
  open,
  onClose,
  candidates,
  onApply,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  /** Every scholarship linked to the selected universities, with its university. */
  candidates: Array<{
    option: ScholarshipOption;
    universityId: number;
    universityName: string;
    universityLogoUrl?: string | null;
  }>;
  onApply: (choice: { scholarshipId: number; universityId: number }) => void;
  busy: boolean;
}) {
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Apply a scholarship"
      className="max-w-[640px] p-gb-3xl"
    >
      <h2 className="text-gb-lg font-semibold text-fg">Apply a scholarship</h2>
      <p className="mt-gb-md text-gb-sm text-fg-tertiary">
        {candidates.length > 0
          ? 'Pick a scholarship to attach to your saved university. It will show on the university and in your plan.'
          : 'None of the universities you selected have a scholarship in our directory yet.'}
      </p>

      {candidates.length > 0 ? (
        <fieldset className="mt-gb-3xl flex max-h-[50vh] flex-col gap-gb-lg overflow-y-auto">
          <legend className="sr-only">Available scholarships</legend>
          {candidates.map(({ option, universityId, universityName, universityLogoUrl }) => {
            const value = `${universityId}:${option.id}`;
            return (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-gb-lg rounded-gb-xl border p-gb-xl transition-colors ${
                  chosen === value ? 'border-brand bg-brand-subtle' : 'border-line hover:bg-surface-hover'
                }`}
              >
                <input
                  type="radio"
                  name="scholarship-choice"
                  value={value}
                  checked={chosen === value}
                  onChange={() => setChosen(value)}
                  className="mt-gb-xxs size-gb-2xl shrink-0 cursor-pointer accent-brand"
                />
                {universityLogoUrl ? (
                  /* Same reason as the row cover: crests come from arbitrary
                     hosts, so a plain <img> rather than next/image. */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={universityLogoUrl}
                    alt=""
                    loading="lazy"
                    className="size-gb-6xl shrink-0 object-contain"
                  />
                ) : null}
                <span className="flex min-w-0 flex-col gap-gb-xs">
                  <span className="text-gb-sm font-semibold text-fg">{option.name}</span>
                  {/* Real scholarship names are frequently "<award> at <university>
                      <year>", so printing the university underneath would say it
                      twice. Shown only when the name does not already carry it. */}
                  {option.name.includes(universityName) ? null : (
                    <span className="text-gb-sm text-fg-tertiary">{universityName}</span>
                  )}
                  {/* `coverage` is free prose in the data and runs to several
                      lines ("...covers the following: | Tuition fees | Monthly
                      stipend | ..."), which would make one option taller than the
                      dialog. Clamped, on its own line rather than inline with the
                      short facts below. */}
                  {option.coverage ? (
                    <span className="line-clamp-2 text-gb-sm text-fg-muted">{option.coverage}</span>
                  ) : null}
                  <span className="flex flex-wrap items-center gap-gb-lg text-gb-sm text-fg-muted">
                    {option.amountLabel ? <span>{option.amountLabel}</span> : null}
                    {option.deadlineLabel ? (
                      <span className="flex items-center gap-gb-sm">
                        <KitIcon art={ICONS.clock} frame={20} />
                        {option.deadlineLabel}
                      </span>
                    ) : null}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
      ) : null}

      <div className="mt-gb-3xl flex items-center justify-end gap-gb-lg">
        <Button variant="secondary" size="lg" onClick={onClose}>
          Back
        </Button>
        <Button
          size="lg"
          disabled={!chosen || busy}
          onClick={() => {
            if (!chosen) return;
            const [uni, sch] = chosen.split(':');
            onApply({ universityId: Number(uni), scholarshipId: Number(sch) });
          }}
        >
          {busy ? 'Please wait...' : 'Apply scholarship'}
        </Button>
      </div>
    </Modal>
  );
}

export function SavedListClient({
  rows: initialRows,
  userName,
  userAvatarUrl,
}: {
  rows: SavedRow[];
  userName: string | null;
  userAvatarUrl: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [rows, setRows] = useState(initialRows);
  const [selected, setSelected] = useState<number[]>([]);
  const [removing, setRemoving] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const toggle = useCallback((universityId: number) => {
    setSelected((prev) =>
      prev.includes(universityId)
        ? prev.filter((id) => id !== universityId)
        : [...prev, universityId],
    );
  }, []);

  const remove = useCallback(
    async (row: SavedRow) => {
      setRemoving((prev) => [...prev, row.universityId]);
      const { error } = await supabase
        .from('user_universities')
        .delete()
        .eq('id', row.id);

      if (error) {
        setRemoving((prev) => prev.filter((id) => id !== row.universityId));
        showToast('Could not remove that university. Please try again.');
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setSelected((prev) => prev.filter((id) => id !== row.universityId));
      setRemoving((prev) => prev.filter((id) => id !== row.universityId));
      showToast(`Removed ${row.name}`);
    },
    [supabase, showToast],
  );

  /**
   * Every offerable scholarship on a ticked row, flattened for the picker. The
   * crest is joined on here rather than inside `scholarshipCandidates`, which
   * stays a pure selection rule with no display fields in it.
   */
  const candidates = useMemo(() => {
    const logos = new Map(rows.map((row) => [row.universityId, row.logoUrl]));
    return scholarshipCandidates(rows, selected).map((candidate) => ({
      ...candidate,
      universityLogoUrl: logos.get(candidate.universityId) ?? null,
    }));
  }, [rows, selected]);

  const applyScholarship = useCallback(
    async ({ scholarshipId, universityId }: { scholarshipId: number; universityId: number }) => {
      setApplying(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setApplying(false);
        showToast('Your session expired. Please sign in again.');
        return;
      }

      const { error } = await supabase.from('user_scholarships').upsert(
        { user_id: user.id, scholarship_id: scholarshipId, university_id: universityId },
        { onConflict: 'user_id,scholarship_id' },
      );
      setApplying(false);

      if (error) {
        showToast('Could not attach that scholarship. Please try again.');
        return;
      }
      setPickerOpen(false);
      showToast('Scholarship added to your plan');
      // The row's badge list is server-derived, so re-read rather than guess at
      // the label the server would have produced.
      router.refresh();
    },
    [supabase, showToast, router],
  );

  const attachedCount = rows.reduce((sum, row) => sum + row.attached.length, 0);
  const isSignedIn = !!userName;
  const primaryAction = { href: '/universities', label: 'Search universities' };

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <TopNav
        tone="light"
        logo={<GlowbalLogo height={28} />}
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        {...(isSignedIn && userName
          ? { user: { name: userName, avatarUrl: userAvatarUrl, href: '/profile' } }
          : { secondaryAction: { href: '/auth', label: 'Sign in' } })}
      />
      <MobileNav
        logo={
          <Link href="/" aria-label="GlowBal home" className="inline-flex items-center">
            <GlowbalLogo height={28} />
          </Link>
        }
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        secondaryAction={
          isSignedIn ? { href: '/profile', label: 'Profile' } : { href: '/auth', label: 'Sign in' }
        }
        openLabel="Menu"
        closeLabel="Close menu"
      />

      <main className="min-h-screen py-gb-6xl">
        <Container className="flex flex-col gap-gb-6xl">
          {/* Figma 223:8840 */}
          <div className="flex flex-col gap-gb-lg">
            <h1 className="font-display text-gb-display-xs font-medium tracking-gb-display-tight text-fg md:text-gb-display-md">
              Saved list
            </h1>
            <p className="max-w-gb-width-xl text-gb-xl text-fg-tertiary">
              {rows.length > 0
                ? 'The universities you have saved, with their deadlines and any scholarships you have attached.'
                : 'Nothing saved yet — the universities you save while browsing show up here.'}
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-col items-start gap-gb-xl rounded-gb-2xl border border-line bg-surface-muted p-gb-5xl">
              <p className="text-gb-md text-fg-tertiary">
                Save a university from the search page and it will appear here with its deadline and
                the scholarships attached to it.
              </p>
              <Button href="/universities" size="lg">
                Search universities
              </Button>
            </div>
          ) : (
            <ul {...testId(TID.uniResultsGrid)} className="flex flex-col gap-gb-5xl">
              {rows.map((row) => (
                <SavedRowItem
                  key={row.id}
                  row={row}
                  selected={selected.includes(row.universityId)}
                  onToggle={toggle}
                  onRemove={remove}
                  removing={removing.includes(row.universityId)}
                />
              ))}
            </ul>
          )}

          {/* Scholarship bar — Figma 223:9570. Its left-hand text is the one
              thing that changes between 223:8824 and 223:13621. */}
          {rows.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-gb-xl border-t border-line pt-gb-3xl">
              <div className="flex flex-wrap items-center gap-gb-5xl">
                <span className="flex items-center gap-gb-xl">
                  <KitIcon art={ICONS.gift01} frame={32} className="shrink-0 text-brand" />
                  <span className="text-gb-md font-semibold text-fg">
                    {attachedCount > 0
                      ? `${attachedCount} scholarship${attachedCount === 1 ? '' : 's'} attached`
                      : 'See all the scholarships you could apply for'}
                  </span>
                </span>
                <Link
                  href="/scholarships"
                  className="flex items-center gap-gb-xs text-gb-sm font-semibold text-brand hover:text-brand-hover"
                >
                  Find scholarships
                  <KitIcon art={ICONS.arrowUpRight} frame={20} />
                </Link>
              </div>
              <Button
                size="lg"
                disabled={selected.length === 0}
                onClick={() => setPickerOpen(true)}
              >
                Apply scholarship
              </Button>
            </div>
          ) : null}

          {/* The button above is disabled rather than hidden when nothing is
              ticked, so say what to do about it. */}
          {rows.length > 0 && selected.length === 0 ? (
            <p className="-mt-gb-4xl text-gb-sm text-fg-muted">
              Tick a university to attach a scholarship to it.
            </p>
          ) : null}
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

      <ScholarshipPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        candidates={candidates}
        onApply={applyScholarship}
        busy={applying}
      />

      {toast ? (
        <div
          {...testId(TID.toast)}
          role="status"
          className="fixed bottom-gb-4xl left-1/2 z-50 -translate-x-1/2 rounded-gb-md bg-surface-inverse-strong px-gb-xl py-gb-lg text-gb-sm font-medium text-white shadow-gb-lg"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
