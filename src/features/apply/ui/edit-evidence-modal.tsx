'use client';

import { useCallback, useState } from 'react';
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_CATEGORY_ICON,
  ACTIVITY_CATEGORIES,
  ACTIVITY_CATEGORY_ICON,
  LEVEL_SUGGESTIONS,
  type AchievementCategory,
  type AchievementValues,
  type ActivityCategory,
  type ActivityValues,
} from '../domain';
import { Button, ICONS, KitIcon, Modal, Select } from '@/shared/ui';
import { controlClasses } from '@/shared/ui/form-field';
import { questionIcon } from './question-chrome';

/**
 * The edit/create surface for one achievement or activity — a large, two-
 * column editing workspace, replacing the old cramped six-field popup.
 * Owner-approved design (`docs/plans` has no frame for this — no Figma
 * source, a workspace decision recorded here the same way `panel.tsx` and
 * `ProgressBar` record theirs).
 *
 * One component handling both kinds (via `kind`) rather than two near-copies:
 * the two share most of their fields, and a shared implementation is what
 * keeps "add a field" or "resize this modal" a one-file change.
 *
 * ─── `period` STAYS ONE FIELD, NOT START/END ─────────────────────────────────
 *
 * `activitySchema.period` is deliberately free text ("2024 – 2026"), not two
 * dates — see the comment on it in `reflection.ts`: forcing two precise dates
 * would invent precision a student rarely has. The approved design's own
 * screenshot only shows the academic achievement editor, not the activity
 * one, so this keeps the one field the schema already has rather than
 * reopening a decision the mockup does not actually contradict.
 *
 * ─── SAVE IS LOCAL, NOT A PER-ITEM NETWORK CALL ──────────────────────────────
 *
 * There is no `PATCH /api/candidate/achievements/:id` in this codebase —
 * achievements and activities are saved as a whole replaced list from
 * `reflection-evidence-form.tsx`'s own "Review & Confirm" action
 * (`PATCH /api/reflection`), which already returns a `423 PROFILE_LOCKED`
 * once the profile is confirmed. This modal's "Save changes" commits to the
 * parent page's in-memory list (which is what makes the card update
 * immediately, with no reload) rather than adding a second, duplicate save
 * path the spec itself says not to invent.
 */

export type EvidenceDraft =
  | ({ kind: 'achievement' } & AchievementValues)
  | ({ kind: 'activity' } & ActivityValues);

// Reuse the SAME canonical labels the cards/tabs/`ExperienceCategoryChooser`
// show elsewhere — these used to be a locally duplicated list with drifted
// wording ("Academic Award / Prize" vs. the canonical "Academic Awards &
// Prizes", etc.), so a student could pick a category here and see different
// copy for it everywhere else on the page.
const ACADEMIC_TYPES: ReadonlyArray<{ value: AchievementCategory; label: string }> = ACHIEVEMENT_CATEGORIES;
const EXTRACURRICULAR_TYPES: ReadonlyArray<{ value: ActivityCategory; label: string }> = ACTIVITY_CATEGORIES;

/**
 * `LEVEL_SUGGESTIONS`, worded as the design's "International level" style
 * options. A `Record`, not a parallel array, so a suggestion added there
 * without a label here is a compile error rather than a dropdown entry that
 * silently renders blank.
 */
const LEVEL_OPTION_LABEL: Record<(typeof LEVEL_SUGGESTIONS)[number], string> = {
  School: 'School level',
  'City / Local': 'Local / City level',
  Regional: 'Regional level',
  National: 'National level',
  International: 'International level',
  University: 'University level',
  Community: 'Community level',
  Organisation: 'Organisation level',
};
const LEVEL_OPTIONS: ReadonlyArray<{ value: string; label: string }> = LEVEL_SUGGESTIONS.map((value) => ({
  value,
  label: LEVEL_OPTION_LABEL[value],
}));

const LEVEL_OTHER = '__other__';

const DESCRIPTION_MAX = 1500;

/**
 * AI extraction occasionally writes the literal word "N/A" into an optional
 * field it could not find a value for. Opening Edit on that record must not
 * show "N/A" as if it were the student's own answer — item 16 of the spec is
 * explicit that a missing value should read as blank, not as that string.
 */
function blankIfPlaceholder(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalised = value.trim().toLowerCase();
  return normalised === 'n/a' || normalised === 'na' || normalised === 'not applicable'
    ? undefined
    : value;
}

function cleanDraft(draft: EvidenceDraft): EvidenceDraft {
  if (draft.kind === 'achievement') {
    return {
      ...draft,
      competition: blankIfPlaceholder(draft.competition),
      organisation: blankIfPlaceholder(draft.organisation),
      level: blankIfPlaceholder(draft.level),
      detail: blankIfPlaceholder(draft.detail),
    };
  }
  return {
    ...draft,
    organisation: blankIfPlaceholder(draft.organisation),
    level: blankIfPlaceholder(draft.level),
    description: blankIfPlaceholder(draft.description),
  };
}

function isDirty(a: EvidenceDraft | null, b: EvidenceDraft | null): boolean {
  if (!a || !b) return false;
  return JSON.stringify(a) !== JSON.stringify(b);
}

type FieldErrors = { title?: string; year?: string; description?: string };

/**
 * `errors` from this, shown inline through `aria-invalid`/`aria-describedby`,
 * is the ONLY validation this modal has — the required title/year/
 * description fields deliberately do NOT also carry the native HTML
 * `required` attribute. A `required` field inside a `<form>` makes the
 * browser's own constraint validation intercept a submit-button click and
 * show its own tooltip instead, which both silently prevents this function
 * from ever running and is exactly the "browser alert" the spec says not to
 * use in place of an inline message. `aria-required="true"` still tells
 * assistive tech the field is required; it just doesn't block submission.
 */
function validate(local: EvidenceDraft, t: (key: string) => string): FieldErrors {
  const errors: FieldErrors = {};
  const isAchievement = local.kind === 'achievement';

  if (!local.title.trim()) {
    errors.title = isAchievement ? t('Enter an achievement name.') : t('Enter an activity title.');
  }

  const description = isAchievement
    ? (local as AchievementValues).detail
    : (local as ActivityValues).description;
  if (!description || !description.trim()) {
    errors.description = t('Add a short description.');
  }

  if (isAchievement && (local as AchievementValues).year == null) {
    errors.year = t('Choose the year you received this award.');
  }

  return errors;
}

export function EditEvidenceModal({
  open,
  draft,
  onClose,
  onSave,
  t,
}: {
  open: boolean;
  /** `null` while closed; the modal reads its title from `draft` when open. */
  draft: EvidenceDraft | null;
  onClose: () => void;
  onSave: (next: EvidenceDraft) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  // A local copy, so a cancel is a true cancel — nothing about the card
  // updates until Save is pressed, however many fields were touched first.
  const [local, setLocal] = useState<EvidenceDraft | null>(null);
  // The dirty-check baseline. State, not a ref: React explicitly sanctions
  // adjusting state during render for the "reset on a changed prop" case
  // below, but not mutating a ref there — see the react-hooks/refs rule.
  const [initial, setInitial] = useState<EvidenceDraft | null>(null);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  if (open && draft && local?.id !== draft.id) {
    // Keyed off `id` rather than a mount-effect: this is exactly the "reset
    // on a changed prop" case React's docs describe adjusting state during
    // render for, and it means opening a second item onto an already-open
    // modal (from the review-one-at-a-time flow) resets the form correctly.
    const cleaned = cleanDraft(draft);
    setLocal(cleaned);
    setInitial(cleaned);
    setAttemptedSave(false);
    setConfirmDiscard(false);
  }

  const dirty = isDirty(initial, local);

  // Memoized, not a plain function, and declared before the early return
  // below (hooks cannot be called conditionally): this is `Modal`'s own
  // `onClose` prop, and `Modal`'s focus-management effect re-runs whenever
  // that reference changes. A fresh function every render — which every
  // keystroke would produce, since `dirty` and `confirmDiscard` are read
  // from render-local state — reran that effect on every keystroke and
  // yanked focus back to the panel's first focusable control mid-type.
  const requestClose = useCallback(() => {
    // A second Escape/backdrop click while the discard prompt is already up
    // must not also close the editor underneath it — this is the only close
    // trigger, so every one of them (X, Cancel, Escape, backdrop) goes
    // through here and gets the same "unsaved changes" protection.
    if (confirmDiscard) return;
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }, [confirmDiscard, dirty, onClose]);

  if (!open || !draft || !local) return null;

  // Captured once, narrowed: `local`'s own type still includes `null` inside
  // a closure declared below (React state is mutable from TypeScript's point
  // of view), but `current` never does, so `handleSave` can read it without
  // re-deriving the same null check.
  const current = local;

  const isAchievement = local.kind === 'achievement';
  // A fresh entry from the type chooser has no title yet; everything else —
  // extracted or previously saved — is being edited, not created.
  const isNew = !draft.title.trim();
  const heading = isNew
    ? isAchievement
      ? t('Add academic achievement')
      : t('Add extracurricular activity')
    : isAchievement
      ? t('Edit academic achievement')
      : t('Edit extracurricular activity');
  const subtitle = isNew
    ? isAchievement
      ? t('Add a new academic achievement to your profile.')
      : t('Add a new extracurricular activity to your profile.')
    : t('Update the details of this achievement. All changes will be saved to your profile.');
  const headerIcon = isAchievement
    ? ACHIEVEMENT_CATEGORY_ICON[local.category as AchievementCategory]
    : ACTIVITY_CATEGORY_ICON[local.category as ActivityCategory];

  /*
   * A plain merge rather than a keyed setter: `EvidenceDraft` is a
   * discriminated union, so `keyof EvidenceDraft` only admits the handful of
   * fields both branches share, and `competition`/`year`/`period`/`detail` are
   * exactly the fields that differ between them. The cast is confined to this
   * one function rather than at every call site.
   */
  function patch(changes: Partial<AchievementValues & ActivityValues>) {
    setLocal((prev) => (prev ? ({ ...prev, ...changes } as EvidenceDraft) : prev));
  }

  const errors = attemptedSave ? validate(local, t) : {};

  function handleSave() {
    const nextErrors = validate(current, t);
    if (Object.keys(nextErrors).length > 0) {
      setAttemptedSave(true);
      return;
    }
    onSave(current);
  }

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 36 }, (_, i) => currentYear + 5 - i);

  const levelValue =
    local.level === undefined
      ? ''
      : LEVEL_OPTIONS.some((option) => option.value === local.level)
        ? local.level
        : LEVEL_OTHER;
  const levelIsOther = levelValue === LEVEL_OTHER;

  const descriptionValue = isAchievement
    ? ((local as AchievementValues).detail ?? '')
    : ((local as ActivityValues).description ?? '');
  const descriptionHint = isAchievement
    ? t('Provide a brief description of your achievement and its significance.')
    : t('Describe what you did, your responsibilities and any impact or outcome.');

  return (
    <Modal
      open={open}
      onClose={requestClose}
      label={heading}
      className="flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden p-0 sm:h-auto sm:max-h-[min(900px,calc(100vh-64px))] sm:w-[min(1120px,calc(100vw-64px))]"
    >
      <div className="flex items-start justify-between gap-gb-xl border-b border-line px-gb-3xl py-gb-2xl">
        <div className="flex items-start gap-gb-lg">
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-gb-lg bg-brand-subtle text-fg-brand"
          >
            <KitIcon art={questionIcon(headerIcon)} frame={24} />
          </span>
          <div className="flex flex-col gap-gb-xxs">
            <h2 className="text-gb-xl font-semibold text-fg sm:text-gb-display-xs">{heading}</h2>
            <p className="text-gb-sm text-fg-tertiary">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={requestClose}
          aria-label={t('Close editor')}
          className="shrink-0 rounded-gb-md p-gb-sm text-fg-tertiary transition-colors hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <KitIcon art={ICONS.close} frame={20} />
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex-1 overflow-y-auto px-gb-3xl py-gb-2xl">
          <div className="grid gap-gb-xl sm:grid-cols-2 sm:gap-x-gb-4xl">
            <Select
              name="evidence-type"
              label={isAchievement ? t('Academic achievement type') : t('Extracurricular activity type')}
              hint={
                isAchievement
                  ? t('Select the category that best describes this achievement.')
                  : t('Select the category that best describes this activity.')
              }
              required
              value={local.category}
              onChange={(e) => patch({ category: e.target.value as never })}
            >
              {(isAchievement ? ACADEMIC_TYPES : EXTRACURRICULAR_TYPES).map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </Select>

            <div className="flex flex-col gap-gb-xs">
              <label htmlFor="evidence-title" className="text-gb-sm font-medium text-fg-secondary">
                {isAchievement ? t('Achievement name') : t('Activity title')}
                <span className="text-fg-error" aria-hidden="true">
                  {' *'}
                </span>
              </label>
              <input
                id="evidence-title"
                name="evidence-title"
                aria-required="true"
                aria-invalid={errors.title ? true : undefined}
                aria-describedby="evidence-title-message"
                value={local.title}
                onChange={(e) => patch({ title: e.target.value })}
                className={controlClasses(Boolean(errors.title))}
              />
              <p
                id="evidence-title-message"
                className={errors.title ? 'text-gb-sm text-fg-error' : 'text-gb-sm text-fg-muted'}
              >
                {errors.title ??
                  (isAchievement
                    ? t('Enter the full name of your achievement.')
                    : t('Enter the full name of your activity.'))}
              </p>
            </div>

            {isAchievement ? (
              <div className="flex flex-col gap-gb-xs">
                <label htmlFor="evidence-competition" className="text-gb-sm font-medium text-fg-secondary">
                  {t('Competition or organisation name')}
                </label>
                <input
                  id="evidence-competition"
                  name="evidence-competition"
                  value={(local as AchievementValues).competition ?? ''}
                  onChange={(e) => patch({ competition: e.target.value || undefined })}
                  className={controlClasses(false)}
                />
                <p className="text-gb-sm text-fg-muted">
                  {t('Name of the competition, program or organisation.')}
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-gb-xs">
              <label htmlFor="evidence-organisation" className="text-gb-sm font-medium text-fg-secondary">
                {isAchievement ? t('Organising body') : t('Organisation / project')}
              </label>
              <input
                id="evidence-organisation"
                name="evidence-organisation"
                value={local.organisation ?? ''}
                onChange={(e) => patch({ organisation: e.target.value || undefined })}
                className={controlClasses(false)}
              />
              <p className="text-gb-sm text-fg-muted">
                {isAchievement
                  ? t('The body or institution that organised this achievement.')
                  : t('Name of the club, school or organisation, if any.')}
              </p>
            </div>

            <Select
              name="evidence-level"
              label={t('Level')}
              hint={t('Choose the level of this achievement.')}
              value={levelValue}
              placeholder={t('Select a level')}
              onChange={(e) => {
                const next = e.target.value;
                if (next === LEVEL_OTHER) {
                  patch({ level: '' });
                  return;
                }
                patch({ level: next || undefined });
              }}
            >
              {LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
              <option value="Not applicable">{t('Not applicable')}</option>
              <option value={LEVEL_OTHER}>{t('Other')}</option>
            </Select>

            {levelIsOther ? (
              <div className="flex flex-col gap-gb-xs sm:col-start-2">
                <label htmlFor="evidence-level-other" className="text-gb-sm font-medium text-fg-secondary">
                  {t('Describe the level')}
                </label>
                <input
                  id="evidence-level-other"
                  name="evidence-level-other"
                  value={local.level ?? ''}
                  onChange={(e) => patch({ level: e.target.value || undefined })}
                  className={controlClasses(false)}
                />
              </div>
            ) : null}

            {isAchievement ? (
              <Select
                name="evidence-year"
                label={t('Award year')}
                hint={t('Year you received or achieved this award.')}
                aria-required="true"
                aria-invalid={errors.year ? true : undefined}
                value={
                  (local as AchievementValues).year != null ? String((local as AchievementValues).year) : ''
                }
                placeholder={t('Select a year')}
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10);
                  patch({ year: Number.isFinite(parsed) ? parsed : undefined });
                }}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="flex flex-col gap-gb-xs sm:col-span-2">
                <label htmlFor="evidence-period" className="text-gb-sm font-medium text-fg-secondary">
                  {t('Period')}
                </label>
                <input
                  id="evidence-period"
                  name="evidence-period"
                  placeholder={t('e.g. Sep 2024 – Present')}
                  value={(local as ActivityValues).period ?? ''}
                  onChange={(e) => patch({ period: e.target.value || undefined })}
                  className={controlClasses(false)}
                />
                <p className="text-gb-sm text-fg-muted">
                  {t('When this activity started, and ended if it has — "Present" for ongoing.')}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-gb-xs sm:col-span-2">
              <label htmlFor="evidence-description" className="text-gb-sm font-medium text-fg-secondary">
                {t('Description')}
                <span className="text-fg-error" aria-hidden="true">
                  {' *'}
                </span>
              </label>
              <textarea
                id="evidence-description"
                name="evidence-description"
                aria-required="true"
                aria-invalid={errors.description ? true : undefined}
                aria-describedby="evidence-description-message"
                rows={5}
                maxLength={DESCRIPTION_MAX}
                value={descriptionValue}
                onChange={(e) =>
                  patch(
                    isAchievement
                      ? { detail: e.target.value || undefined }
                      : { description: e.target.value || undefined },
                  )
                }
                className={controlClasses(Boolean(errors.description), 'min-h-[130px] resize-y')}
              />
              <div className="flex items-start justify-between gap-gb-md">
                <p
                  id="evidence-description-message"
                  className={errors.description ? 'text-gb-sm text-fg-error' : 'text-gb-sm text-fg-muted'}
                >
                  {errors.description ?? descriptionHint}
                </p>
                <span className="shrink-0 text-gb-xs text-fg-muted">
                  {descriptionValue.length} / {DESCRIPTION_MAX}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-gb-md border-t border-line bg-surface px-gb-3xl py-gb-xl">
          <Button type="button" variant="secondary" onClick={requestClose}>
            {t('Cancel')}
          </Button>
          <Button type="submit">
            {isNew ? (isAchievement ? t('Add achievement') : t('Add activity')) : t('Save changes')}
          </Button>
        </div>
      </form>

      {confirmDiscard ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={t('Discard changes?')}
          className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-scrim p-gb-xl"
        >
          <div className="w-full max-w-gb-width-sm rounded-gb-xl border border-line bg-surface p-gb-2xl shadow-gb-lg">
            <h3 className="text-gb-lg font-semibold text-fg">{t('Discard changes?')}</h3>
            <p className="mt-gb-xs text-gb-sm text-fg-tertiary">{t('You have unsaved changes.')}</p>
            <div className="mt-gb-xl flex justify-end gap-gb-md">
              <Button type="button" variant="secondary" onClick={() => setConfirmDiscard(false)}>
                {t('Keep editing')}
              </Button>
              <Button
                type="button"
                variant="secondary-destructive"
                onClick={() => {
                  setConfirmDiscard(false);
                  onClose();
                }}
              >
                {t('Discard')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
