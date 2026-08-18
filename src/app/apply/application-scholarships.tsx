'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parseCoveragePercent, scholarshipLabel } from '@/features/universities/domain';
import { SCHOLARSHIP_SCOPE_LABELS } from '@/lib/scholarship-constants';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { ICONS, KitIcon } from '@/shared/ui/icons';
import { Modal } from '@/shared/ui/modal';

/**
 * The scholarship drawer on an application row — /apply, "My application".
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * An application row is the end of a three-step flow: save a university, attach
 * the scholarships you want at it, press "Plan my application". The first and
 * third steps were visible on the row; the middle one was not. A student who had
 * chosen three awards saw a card that mentioned none of them, and the only place
 * their choice showed was the saved list further down the page — i.e. the step
 * before the one they are now on. Reported by the owner 18/08.
 *
 * Modelled on the gift/voucher block an e-commerce cart nests under a line item
 * (the owner's reference was a Shopee cart row): the product stays the headline,
 * and what has been attached to it sits underneath in its own tinted band, each
 * item a small ticket with its value on a stub, and one control to change the
 * selection. That is the shape used here — see `VoucherCard`.
 *
 * ─── WHAT IT IS ATTACHED TO, HONESTLY ────────────────────────────────────────
 *
 * `user_scholarships` is keyed `(user_id, scholarship_id)` with a
 * `university_id` — there is no application_id on it and this component does
 * NOT invent one. So the drawer shows the awards saved for THIS ROW'S
 * UNIVERSITY, which is also what the saved list shows for the same university.
 * Two consequences, both stated in the UI rather than hidden:
 *
 *   - two applications at one university (the "Add another course" path) show
 *     the same awards, because the award is offered by the university, not by
 *     the course;
 *   - ticking or removing here changes the same row the saved list reads, so
 *     the picker says so out loud.
 *
 * A row whose `university_id` is null (a pasted course URL that never matched
 * the directory) renders nothing at all — there is no university to look
 * scholarships up against, and an empty drawer promising some would be a lie.
 * `MyApplicationSection` makes that call before mounting this.
 *
 * ─── WHY IT WRITES FROM THE BROWSER ──────────────────────────────────────────
 *
 * Straight to Supabase with the user's own session, exactly as the saved list's
 * `applyScholarship` and `remove` already do on this page. RLS on
 * `user_scholarships` is `auth.uid() = user_id` for all four verbs
 * (supabase-saved-scholarships.sql), so a route handler would add a hop and a
 * second copy of the same authorisation rule. `router.refresh()` afterwards, so
 * the server-derived halves of the page (the saved list's badges and its net
 * tuition) are re-read rather than guessed at.
 *
 * ─── EVERY STRING IS A DICTIONARY KEY ────────────────────────────────────────
 *
 * /apply is in `PII_ROUTE_PREFIXES` (src/lib/dom-translate.tsx), so whole-page
 * machine translation is OFF here and anything missing from
 * `src/lib/i18n-dictionary.ts` sits in English on a Vietnamese page forever.
 * Hence the split between labels and values throughout — the count, the
 * percentage and the money are their own text nodes, so the words beside them
 * can be static keys. Same rule the scholarship bar below documents at length.
 */

/** One award, in the shape both halves of this drawer render. */
export type ApplicationScholarship = {
  id: number;
  name: string;
  /** `scholarships.scope`, mapped through SCHOLARSHIP_SCOPE_LABELS for display. */
  scope: string | null;
  amountLabel: string | null;
  deadlineLabel: string | null;
  /** Free prose; read for the "Covers up to N%" badge and shown in the picker. */
  coverage: string | null;
  fundingType: string[] | null;
  sourceUrl: string | null;
};

export type UniversityScholarships = {
  /** Saved under this university by this student — `user_scholarships`. */
  chosen: ApplicationScholarship[];
  /** Everything the directory links to this university, chosen or not. */
  options: ApplicationScholarship[];
};

function scopeLabel(scope: string): string {
  return (SCHOLARSHIP_SCOPE_LABELS as Record<string, string | undefined>)[scope] ?? scope;
}

/**
 * The best percentage any chosen award states.
 *
 * Null when none of them states one — plenty are cash sums, and a sum is not a
 * proportion of a bill this component has no figure for. The header then falls
 * back to the count, which is always true. Mirrors `bestCoveragePercent` on the
 * saved list, scoped to one university's chosen awards.
 */
function bestCoverage(chosen: ApplicationScholarship[]): number | null {
  let best: number | null = null;
  for (const s of chosen) {
    const pct = parseCoveragePercent(s.coverage, s.fundingType);
    if (pct != null && (best == null || pct > best)) best = pct;
  }
  return best;
}

/**
 * One award as a ticket: value on a stub, details on the body, a dashed
 * perforation between them.
 *
 * The stub is the reason the layout is not just another list row. It puts the
 * one number the student is comparing in the same place on every card, and it
 * is what makes the block read as "things attached to this application" rather
 * than as more of the application itself. Awards with no published value keep
 * the stub and show the gift mark, so the cards still line up.
 *
 * NAME TRUNCATES, MONEY DOES NOT — the same priority the saved list's badge row
 * sets, and for the same measured reason: real award names run to ~100
 * characters and carry their university in them ("… at University of Amsterdam
 * 2026 (Fully Funded)"). `scholarshipLabel` drops the part this card's own
 * application row already says, and `min-w-0` at every level lets what is left
 * ellipsize instead of pushing the card wide. The untouched name stays on
 * `title`.
 */
function VoucherCard({
  scholarship,
  universityName,
  onRemove,
  busy,
}: {
  scholarship: ApplicationScholarship;
  universityName: string;
  onRemove: () => void;
  busy: boolean;
}) {
  return (
    <li className="group/voucher flex min-w-0 flex-col gap-gb-lg rounded-gb-lg border border-gb-brand-100 bg-surface p-gb-lg transition-colors duration-200 hover:border-gb-brand-300 sm:flex-row sm:items-center">
      {/* The stub. `border-b` stacked / `border-r` side-by-side, dashed, so the
          card reads as a coupon at both widths. */}
      <div className="flex shrink-0 items-center gap-gb-md border-b border-dashed border-gb-brand-300 pb-gb-lg sm:w-[132px] sm:flex-col sm:items-start sm:gap-gb-xxs sm:border-b-0 sm:border-r sm:pb-0 sm:pr-gb-xl">
        {scholarship.amountLabel ? (
          <span className="text-gb-md font-semibold text-brand">{scholarship.amountLabel}</span>
        ) : (
          /* Roughly half the directory publishes no figure. The stub still has
             to hold the column, so it keeps the gift mark and says why it is
             empty — one type step down, so an award with no number never shouts
             louder than one with a real one beside it. */
          <span className="flex items-center gap-gb-sm text-gb-xs text-fg-tertiary">
            <KitIcon art={ICONS.gift01} frame={16} className="shrink-0 text-brand" />
            Value not published
          </span>
        )}
        {scholarship.scope ? (
          <span className="text-gb-xs font-medium text-fg-muted">
            {scopeLabel(scholarship.scope)}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-gb-xs sm:pl-gb-xl">
        <span className="flex min-w-0 items-center gap-gb-md">
          {/* The "Quà Tặng" tag in the reference — what kind of thing this row
              is, so the ticket is legible without reading the name. */}
          <Badge variant="brand-chip" className="shrink-0">
            Scholarship
          </Badge>
          <span className="min-w-0 truncate text-gb-sm font-semibold text-fg" title={scholarship.name}>
            {scholarshipLabel(scholarship.name, universityName)}
          </span>
        </span>
        {scholarship.deadlineLabel ? (
          <span
            className="flex min-w-0 items-center gap-gb-sm text-gb-xs text-fg-tertiary"
            title={scholarship.deadlineLabel}
          >
            <KitIcon art={ICONS.clock} frame={16} className="shrink-0 text-fg-muted" />
            {/* `deadline_text` is free prose and some rows run to a paragraph,
                so it is clamped here and unclamped in the picker. */}
            <span className="shrink-0">Deadline:</span>
            <span className="truncate">{scholarship.deadlineLabel}</span>
          </span>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-gb-lg sm:pl-gb-lg">
        {scholarship.sourceUrl ? (
          <a
            href={scholarship.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-gb-xs rounded-gb-sm text-gb-xs font-semibold text-brand hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Official site
            <KitIcon art={ICONS.arrowUpRight} frame={16} />
          </a>
        ) : null}
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          /* Interpolated, so it cannot be a dictionary hit — the same
             acknowledged gap the saved list's checkbox labels have. The visible
             control is a word, not an icon, so this only affects screen readers
             reading the button out of context. */
          aria-label={`Remove ${scholarship.name}`}
          className="rounded-gb-sm text-gb-xs font-semibold text-fg-tertiary transition-colors hover:text-fg-error disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Remove
        </button>
      </div>
    </li>
  );
}

/**
 * The picker — tick what you are applying for at this university.
 *
 * CHECKBOXES, NOT THE SAVED LIST'S RADIO. That dialog attaches one award at a
 * time because it can be pointed at several universities at once; this one is
 * already scoped to a single university, and the table it writes to has always
 * allowed several rows per university (measured live 18/08: 84 saved awards,
 * four of them under one university for one student). A radio here would have
 * made removing an award impossible and re-picking a one-at-a-time chore.
 *
 * The list is the union of what the directory links to this university and what
 * the student has already chosen. Those are not the same set: 39 of the 84 live
 * saved rows point at a scholarship that is NOT linked to the university it was
 * saved under, and building the list from the directory alone would silently
 * drop their own choice out of a dialog that claims to show it.
 */
function ScholarshipChoiceDialog({
  open,
  onClose,
  universityName,
  candidates,
  chosenIds,
  onSave,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  universityName: string;
  candidates: ApplicationScholarship[];
  chosenIds: number[];
  onSave: (ids: number[]) => void;
  busy: boolean;
}) {
  const [ticked, setTicked] = useState<number[]>(chosenIds);
  /* Re-seed from the server's answer whenever the dialog is reopened or the
     saved set changes underneath it. Adjusting state during render rather than
     from an effect — the pattern the saved list's `focusedRow` guard uses. */
  const key = `${open ? 'open' : 'shut'}:${chosenIds.join(',')}`;
  const [seed, setSeed] = useState(key);
  if (key !== seed) {
    setSeed(key);
    setTicked(chosenIds);
  }

  const toggle = (id: number) =>
    setTicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Choose scholarships"
      /* The LIST scrolls, not the dialog. Scrolling the whole panel pushed Save
         below the fold on a university with four awards, which is most of them
         — the same shape the saved list's picker settled on. */
      className="max-w-[680px] p-gb-3xl"
    >
      <div className="flex flex-col gap-gb-xl">
        <div className="flex flex-col gap-gb-md">
          <h2 className="text-gb-lg font-semibold text-fg">Choose scholarships</h2>
          {/* The university on its own line rather than inside the sentence:
              an interpolated heading could never be a dictionary hit here. */}
          <p className="text-gb-md font-semibold text-fg-tertiary">{universityName}</p>
          <p className="text-gb-sm text-fg-tertiary">
            Tick the scholarships you want to apply for with this application.
          </p>
          <p className="text-gb-sm text-fg-muted">
            These are saved against the university, so the same choice shows on your saved list.
          </p>
        </div>

        {candidates.length === 0 ? (
          <p className="rounded-gb-lg border border-line bg-surface-muted p-gb-xl text-gb-sm text-fg-tertiary">
            No scholarships are listed for this university yet.
          </p>
        ) : (
          <fieldset className="flex max-h-[52vh] min-w-0 flex-col gap-gb-lg overflow-y-auto">
            <legend className="sr-only">Available scholarships</legend>
            {candidates.map((option) => {
              const checked = ticked.includes(option.id);
              return (
                <label
                  key={option.id}
                  className={`flex min-w-0 cursor-pointer items-start gap-gb-xl rounded-gb-xl border p-gb-xl transition-colors ${
                    checked ? 'border-brand bg-brand-subtle' : 'border-line hover:border-gb-brand-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(option.id)}
                    aria-label={`Choose ${option.name}`}
                    className="mt-gb-xxs size-gb-2xl shrink-0 cursor-pointer accent-brand"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-gb-md">
                    {option.scope ? (
                      <span className="flex">
                        <Badge variant="brand-subtle">{scopeLabel(option.scope)}</Badge>
                      </span>
                    ) : null}
                    {/* The dialog names the university two lines above, and
                        award names carry it ("… at Massachusetts Institute of
                        Technology (MIT) 2026"). Trimmed for display, whole on
                        `title` and in the checkbox's accessible name. */}
                    <span className="text-gb-sm font-semibold text-fg" title={option.name}>
                      {scholarshipLabel(option.name, universityName)}
                    </span>
                    {option.amountLabel ? (
                      <span className="text-gb-xl font-semibold text-brand">{option.amountLabel}</span>
                    ) : (
                      <span className="text-gb-sm text-fg-tertiary">Value not published</span>
                    )}
                    {option.coverage ? (
                      <span className="line-clamp-2 text-gb-sm text-fg-tertiary">{option.coverage}</span>
                    ) : null}
                    <span className="flex min-w-0 flex-wrap items-center justify-between gap-gb-lg">
                      {option.deadlineLabel ? (
                        <span
                          className="flex min-w-0 flex-1 items-center gap-gb-sm text-gb-sm text-fg-tertiary"
                          title={option.deadlineLabel}
                        >
                          <KitIcon art={ICONS.clock} frame={20} className="shrink-0" />
                          <span className="shrink-0">Deadline:</span>
                          <span className="truncate">{option.deadlineLabel}</span>
                        </span>
                      ) : (
                        <span />
                      )}
                      {option.sourceUrl ? (
                        /* An <a> inside a <label> is activated by clicking the
                           label, which would tick the box on the way to a new
                           tab. `stopPropagation` keeps the two apart — the same
                           trap the saved list's "See details" button documents. */
                        <a
                          href={option.sourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          onClick={(event) => event.stopPropagation()}
                          className="flex shrink-0 items-center gap-gb-xs rounded-gb-sm text-gb-sm font-semibold text-brand hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          Open the official page
                          <KitIcon art={ICONS.arrowUpRight} frame={20} />
                        </a>
                      ) : null}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        )}

        <div className="flex flex-wrap items-center justify-end gap-gb-lg">
          <Button variant="secondary" size="lg" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="lg" onClick={() => onSave(ticked)} disabled={busy || candidates.length === 0}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function ApplicationScholarships({
  universityId,
  universityName,
  chosen,
  options,
}: {
  universityId: number;
  universityName: string;
  chosen: ApplicationScholarship[];
  options: ApplicationScholarship[];
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * The chosen ids, mirrored locally so a tick or a Remove shows immediately
   * instead of after the server round trip. Re-seeded from props whenever the
   * server's answer changes — again the "adjust state during render" pattern,
   * so an optimistic change is not left standing after `router.refresh()`.
   */
  const serverIds = chosen.map((s) => s.id);
  const serverKey = serverIds.join(',');
  const [seed, setSeed] = useState(serverKey);
  const [chosenIds, setChosenIds] = useState<number[]>(serverIds);
  if (serverKey !== seed) {
    setSeed(serverKey);
    setChosenIds(serverIds);
  }

  /* Chosen awards are NOT always in `options` — see the note on the dialog. */
  const byId = new Map<number, ApplicationScholarship>();
  for (const s of [...options, ...chosen]) byId.set(s.id, s);
  const candidates = [...byId.values()];
  const visible = chosenIds.flatMap((id) => {
    const found = byId.get(id);
    return found ? [found] : [];
  });

  /* Open on arrival when there is something to see — the whole complaint was
     that the choice was invisible, and a collapsed drawer would keep it that
     way. Empty ones stay shut so a list of applications is not a wall of
     invitations. */
  const [open, setOpen] = useState(visible.length > 0);

  const coverage = bestCoverage(visible);
  const remaining = candidates.length - chosenIds.length;

  async function save(nextIds: number[]) {
    const add = nextIds.filter((id) => !chosenIds.includes(id));
    const remove = chosenIds.filter((id) => !nextIds.includes(id));
    if (add.length === 0 && remove.length === 0) {
      setPickerOpen(false);
      return;
    }

    setBusy(true);
    setError(null);
    const previous = chosenIds;
    setChosenIds(nextIds);

    const supabase = await import('@/lib/supabase/client')
      .then(({ createClient }) => createClient())
      .catch(() => null);
    if (!supabase) {
      setChosenIds(previous);
      setBusy(false);
      setError('Could not update your scholarships. Please try again.');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setChosenIds(previous);
      setBusy(false);
      setError('Your session expired. Please sign in again.');
      return;
    }

    /* One statement each way. `onConflict` matches the table's own
       `unique (user_id, scholarship_id)`, so re-ticking something saved under
       another university moves it here rather than failing. */
    const addResult = add.length
      ? await supabase.from('user_scholarships').upsert(
          add.map((scholarshipId) => ({
            user_id: user.id,
            scholarship_id: scholarshipId,
            university_id: universityId,
          })),
          { onConflict: 'user_id,scholarship_id' },
        )
      : null;
    const removeResult = remove.length
      ? await supabase
          .from('user_scholarships')
          .delete()
          .eq('user_id', user.id)
          .eq('university_id', universityId)
          .in('scholarship_id', remove)
      : null;

    setBusy(false);
    if (addResult?.error || removeResult?.error) {
      setChosenIds(previous);
      setError('Could not update your scholarships. Please try again.');
      return;
    }

    setPickerOpen(false);
    setOpen(true);
    // The saved list's badges and its net tuition are derived server-side from
    // this same table, so re-read rather than guess at what changed down there.
    router.refresh();
  }

  return (
    <div className="rounded-gb-xl border border-gb-brand-100 bg-brand-subtle">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-gb-lg rounded-gb-xl px-gb-xl py-gb-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <KitIcon art={ICONS.gift01} frame={24} className="shrink-0 text-brand" />

        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-gb-lg gap-y-gb-xs">
          <span className="text-gb-sm font-semibold text-fg">Scholarships you are applying for</span>

          {visible.length > 0 ? (
            /* Number and noun as separate text nodes — see the header. */
            <span className="rounded-gb-full bg-brand px-gb-lg py-gb-xxs text-gb-xs font-semibold text-on-brand">
              {visible.length} <span>chosen</span>
            </span>
          ) : (
            <span className="text-gb-xs font-medium text-fg-tertiary">Nothing chosen yet</span>
          )}

          {coverage != null ? (
            <span className="text-gb-xs font-semibold text-brand">
              <span>Covers up to</span> {coverage}%
            </span>
          ) : null}

          {visible.length === 0 && candidates.length > 0 ? (
            <span className="text-gb-xs font-medium text-fg-muted">
              {candidates.length} <span>available at this university</span>
            </span>
          ) : null}
        </span>

        <KitIcon
          art={ICONS.chevronDown}
          frame={20}
          className={`shrink-0 text-fg-tertiary transition-transform duration-200 motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/*
        The 0fr → 1fr grid trick rather than a height animation: the drawer's
        height depends on how many awards are in it and on how far the names
        wrap, so there is no fixed number to animate to.
      */}
      <div
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        {/* `inert` while collapsed: `opacity-0` inside a 0fr row hides the
            drawer from sight but leaves its Remove buttons and links in the tab
            order, so a keyboard user would tab into a strip they cannot see. */}
        <div className="overflow-hidden" inert={!open}>
          <div className="flex flex-col gap-gb-lg px-gb-xl pb-gb-xl">
            {visible.length > 0 ? (
              <ul className="flex min-w-0 flex-col gap-gb-md">
                {visible.map((scholarship) => (
                  <VoucherCard
                    key={scholarship.id}
                    scholarship={scholarship}
                    universityName={universityName}
                    busy={busy}
                    onRemove={() => void save(chosenIds.filter((id) => id !== scholarship.id))}
                  />
                ))}
              </ul>
            ) : candidates.length > 0 ? (
              <p className="text-gb-sm text-fg-tertiary">
                Pick the funding you want to go after with this application — it will show here and
                on your saved list.
              </p>
            ) : (
              <p className="text-gb-sm text-fg-tertiary">
                No scholarships are listed for this university yet.
              </p>
            )}

            {error ? (
              <p role="alert" className="text-gb-sm font-medium text-fg-error">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-gb-lg">
              {candidates.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  disabled={busy}
                  className="flex items-center gap-gb-xs rounded-gb-sm text-gb-sm font-semibold text-brand hover:text-brand-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <KitIcon art={ICONS.plus} frame={20} className="shrink-0" />
                  {visible.length > 0 ? 'Change scholarships' : 'Choose scholarships'}
                </button>
              ) : null}

              {remaining > 0 && visible.length > 0 ? (
                <span className="text-gb-xs font-medium text-fg-muted">
                  {remaining} <span>more available at this university</span>
                </span>
              ) : null}

              {candidates.length === 0 ? (
                <Link
                  href="/scholarships"
                  className="flex items-center gap-gb-xs rounded-gb-sm text-gb-sm font-semibold text-brand hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  Search Scholarships
                  <KitIcon art={ICONS.arrowUpRight} frame={20} />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <ScholarshipChoiceDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        universityName={universityName}
        candidates={candidates}
        chosenIds={chosenIds}
        onSave={(ids) => void save(ids)}
        busy={busy}
      />
    </div>
  );
}
