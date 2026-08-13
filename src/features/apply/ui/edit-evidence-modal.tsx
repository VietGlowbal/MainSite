'use client';

import { useState } from 'react';
import {
  LEVEL_SUGGESTIONS,
  type AchievementCategory,
  type AchievementValues,
  type ActivityCategory,
  type ActivityValues,
} from '../domain';
import { Button, Input, Modal, Select, Textarea } from '@/shared/ui';

/**
 * The edit/create surface for one achievement or activity — a clean modal,
 * never the giant inline form the previous page used for every entry.
 *
 * One component handling both kinds (via `kind`) rather than two near-copies:
 * the two share five of their six fields, and a shared implementation is what
 * keeps "add a level suggestion" or "resize this modal" a one-file change.
 *
 * ─── `period` STAYS ONE FIELD, NOT START/END ─────────────────────────────────
 *
 * `activitySchema.period` is deliberately free text ("2024 – 2026"), not two
 * dates — see the comment on it in `reflection.ts`: forcing two precise dates
 * would invent precision a student rarely has. Splitting this modal's input
 * into two boxes that get glued back into one string on save would fight that
 * decision for no real gain, so it stays the one field the schema already has.
 */

export type EvidenceDraft =
  | ({ kind: 'achievement' } & AchievementValues)
  | ({ kind: 'activity' } & ActivityValues);

const ACADEMIC_TYPES: ReadonlyArray<{ value: AchievementCategory; label: string }> = [
  { value: 'academic_award', label: 'Academic Award / Prize' },
  { value: 'competition', label: 'Competition' },
  { value: 'research', label: 'Publication / Research' },
  { value: 'certification', label: 'Certification' },
  { value: 'other', label: 'Other' },
];

const EXTRACURRICULAR_TYPES: ReadonlyArray<{ value: ActivityCategory; label: string }> = [
  { value: 'leadership', label: 'Leadership' },
  { value: 'community_project', label: 'Volunteering / Community Service' },
  { value: 'innovation', label: 'Project / Entrepreneurship' },
  { value: 'personal_growth', label: 'Personal Growth' },
  { value: 'mentoring', label: 'Mentoring' },
  { value: 'other', label: 'Other' },
];

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

  if (open && draft && local?.id !== draft.id) {
    // Keyed off `id` rather than a mount-effect: this is exactly the "reset
    // on a changed prop" case React's docs describe adjusting state during
    // render for, and it means opening a second item onto an already-open
    // modal (from the review-one-at-a-time flow) resets the form correctly.
    setLocal(draft);
  }

  if (!open || !draft || !local) return null;

  const isAchievement = local.kind === 'achievement';
  // A fresh entry from the type chooser has no title yet; everything else —
  // extracted or previously saved — is being edited, not created.
  const isNew = !draft.title.trim();
  const heading = isNew
    ? isAchievement
      ? t('Add achievement')
      : t('Add activity')
    : isAchievement
      ? t('Edit achievement')
      : t('Edit activity');

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

  return (
    <Modal open={open} onClose={onClose} label={heading} className="max-w-gb-width-sm p-gb-3xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!local.title.trim()) return;
          onSave(local);
        }}
        className="flex flex-col gap-gb-2xl"
      >
        <h2 className="text-gb-lg font-semibold text-fg">{heading}</h2>

        <div className="grid gap-gb-xl sm:grid-cols-2">
          <Select
            name="evidence-type"
            label={isAchievement ? t('Academic achievement type') : t('Extracurricular activity type')}
            value={local.category}
            onChange={(e) => patch({ category: e.target.value as never })}
          >
            {(isAchievement ? ACADEMIC_TYPES : EXTRACURRICULAR_TYPES).map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </Select>

          <Input
            name="evidence-title"
            label={isAchievement ? t('Achievement name') : t('Title')}
            value={local.title}
            onChange={(e) => patch({ title: e.target.value })}
            required
          />

          {isAchievement ? (
            <Input
              name="evidence-competition"
              label={t('Competition or organisation name')}
              value={(local as AchievementValues).competition ?? ''}
              onChange={(e) => patch({ competition: e.target.value || undefined })}
            />
          ) : null}

          <Input
            name="evidence-organisation"
            label={isAchievement ? t('Organising body') : t('Organisation / project')}
            value={local.organisation ?? ''}
            onChange={(e) => patch({ organisation: e.target.value || undefined })}
          />

          <Input
            name="evidence-level"
            label={t('Level')}
            list="evidence-level-suggestions"
            value={local.level ?? ''}
            onChange={(e) => patch({ level: e.target.value || undefined })}
          />
          <datalist id="evidence-level-suggestions">
            {LEVEL_SUGGESTIONS.map((level) => (
              <option key={level} value={t(level)} />
            ))}
          </datalist>

          {isAchievement ? (
            <Input
              name="evidence-year"
              type="number"
              label={t('Award year')}
              value={(local as AchievementValues).year != null ? String((local as AchievementValues).year) : ''}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                patch({ year: Number.isFinite(parsed) ? parsed : undefined });
              }}
            />
          ) : (
            <Input
              name="evidence-period"
              label={t('Period')}
              placeholder={t('2024 – 2026')}
              value={(local as ActivityValues).period ?? ''}
              onChange={(e) => patch({ period: e.target.value || undefined })}
            />
          )}
        </div>

        <Textarea
          name="evidence-description"
          label={t('Description')}
          rows={5}
          value={isAchievement ? ((local as AchievementValues).detail ?? '') : ((local as ActivityValues).description ?? '')}
          onChange={(e) =>
            patch(
              isAchievement
                ? { detail: e.target.value || undefined }
                : { description: e.target.value || undefined },
            )
          }
        />

        <div className="flex justify-end gap-gb-md">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button type="submit" disabled={!local.title.trim()}>
            {t('Save changes')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
