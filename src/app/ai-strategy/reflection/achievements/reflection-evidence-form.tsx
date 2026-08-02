'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ACHIEVEMENT_CATEGORIES,
  ACTIVITY_CATEGORIES,
  reflectionStep,
  type AchievementValues,
  type ActivityValues,
} from '@/features/apply/domain';
import { ACCEPTED_DOCUMENT_TYPES, useDocumentUpload } from '@/features/apply/hooks';
import { ReflectionShell } from '@/features/apply/ui';
import {
  Button,
  DocumentRow,
  FileDropzone,
  Input,
  RepeatableFieldset,
  Select,
  Textarea,
} from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

/**
 * Reflection step 2 of 2 — achievements and activities.
 *
 * THE CV IS STORAGE, NOT PREFILL. The frame's Vietnamese line read "Nếu chưa có
 * CV có thể nhập thông tin ở dưới" — if you have no CV, type it in below —
 * which promises that uploading one saves you the typing. Nothing extracts a CV
 * today, so that sentence would have been a lie the first student found. The
 * copy now says what actually happens: the file is stored, and the form below
 * still needs filling in. Real prefill is a separate piece of work (extraction,
 * bilingual documents, classification into rows, confidence, duplicate
 * detection) and should be scoped as one.
 *
 * ONE DETAIL FIELD, NOT TWO. The frame drew "Bổ sung thông tin chi tiết" and
 * "Tell us more" on the same achievement, with the second carrying a template
 * ("I noticed that [who] were facing [problem]…") lifted from an unrelated
 * problem-discovery form. They overlap, and `achievementSchema` has one
 * `detail`. Merged into one field with a placeholder that asks for what the two
 * were circling.
 */

/*
 * A client-side id on creation, so `RepeatableFieldset` has the stable key it
 * documents as mandatory. Keying by array index makes React reuse the wrong
 * inputs when a middle row is removed — the classic form-state bug where
 * deleting entry 2 appears to clear entry 3.
 *
 * The API ignores these: it replaces the whole set on save, so the id is
 * identity for this render only.
 */
const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tmp-${Math.random().toString(36).slice(2)}`;

const emptyAchievement = (): AchievementValues => ({
  id: newId(),
  category: 'academic_award',
  title: '',
});

const emptyActivity = (): ActivityValues => ({
  id: newId(),
  category: 'community_project',
  title: '',
});

export function ReflectionEvidenceForm({
  initialAchievements,
  initialActivities,
}: {
  initialAchievements: AchievementValues[];
  initialActivities: ActivityValues[];
}) {
  const router = useRouter();
  /** See the matching note in reflection-about-form.tsx. */
  const returnTo = useSearchParams().get('return');
  const { items, upload, remove } = useDocumentUpload();

  const [achievements, setAchievements] = useState<AchievementValues[]>(
    initialAchievements.length > 0 ? initialAchievements : [emptyAchievement()],
  );
  const [activities, setActivities] = useState<ActivityValues[]>(
    initialActivities.length > 0 ? initialActivities : [emptyActivity()],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLoadingIndicator(saving, 'Saving your achievements');

  function patchAchievement(index: number, changes: Partial<AchievementValues>) {
    setAchievements((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    );
  }

  function patchActivity(index: number, changes: Partial<ActivityValues>) {
    setActivities((prev) => prev.map((item, i) => (i === index ? { ...item, ...changes } : item)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    // Drop the blank rows the form starts with, so an untouched card does not
    // become an achievement called "".
    const payload = {
      achievements: achievements.filter((a) => a.title.trim().length > 0),
      activities: activities.filter((a) => a.title.trim().length > 0),
    };

    try {
      const response = await fetch('/api/reflection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setError('We could not save that. Please try again.');
        setSaving(false);
        return;
      }

      router.push(returnTo || '/ai-strategy');
    } catch {
      setError('We could not save that. Please try again.');
      setSaving(false);
    }
  }

  return (
    <ReflectionShell step="evidence">
      <form onSubmit={handleSubmit} className="flex flex-col gap-gb-3xl">
        <section className="flex flex-col gap-gb-lg">
          <h2 className="text-gb-lg font-semibold text-fg-brand">
            Academic Achievements and Extracurricular Activities
          </h2>

          <FileDropzone
            onFiles={async (files) => {
              setSaving(true);
              await upload(files, 'cv');
              setSaving(false);
            }}
            accept={ACCEPTED_DOCUMENT_TYPES}
            disabled={saving}
            label="Upload your CV or drag it here"
            hint="PDF, DOC, DOCX, TXT or RTF (max 10MB)"
          />

          {items.length > 0 ? (
            <ul className="flex flex-col gap-gb-md">
              {items.map((item) => (
                <DocumentRow
                  key={item.key}
                  fileName={item.fileName}
                  total={item.size}
                  status={item.status}
                  {...(item.error ? { error: item.error } : {})}
                  onRemove={() => remove(item.key)}
                />
              ))}
            </ul>
          ) : null}

          {/* Says what the upload actually does. See the note at the top. */}
          <p className="text-center text-gb-sm text-fg-tertiary">
            Uploading saves your CV to your profile — add or check the details below as well.
          </p>
        </section>

        {/* No ReflectionSection wrapper here: RepeatableFieldset renders its own
            heading, and nesting the two put "Thành tích học thuật" on the page
            twice. The plate is kept, the second heading is not. */}
        <div className="rounded-gb-2xl bg-surface-muted p-gb-3xl">
          <RepeatableFieldset
            legend="Academic Achievements"
            entries={achievements}
            keyOf={(entry, index) => entry.id ?? `achievement-${index}`}
            entryLabel={(index) => `Achievement ${index + 1}`}
            addLabel="Add achievement"
            max={20}
            onAdd={() => setAchievements((prev) => [...prev, emptyAchievement()])}
            onRemove={(index) =>
              setAchievements((prev) => prev.filter((_, i) => i !== index))
            }
            renderEntry={(item, index) => (
              <div className="flex flex-col gap-gb-2xl">
                <div className="grid gap-gb-2xl sm:grid-cols-2">
                  <Select
                    name={`achievement-${index}-category`}
                    label="Achievement category"
                    value={item.category}
                    onChange={(e) =>
                      patchAchievement(index, {
                        category: e.target.value as AchievementValues['category'],
                      })
                    }
                  >
                    {ACHIEVEMENT_CATEGORIES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>

                  <Input
                    name={`achievement-${index}-title`}
                    label="Achievement title"
                    placeholder="First Prize, Hanoi City Maths Olympiad 2026"
                    value={item.title}
                    onChange={(e) => patchAchievement(index, { title: e.target.value })}
                  />

                  <Input
                    name={`achievement-${index}-competition`}
                    label="Competition / organisation name"
                    value={item.competition ?? ''}
                    onChange={(e) =>
                      patchAchievement(index, { competition: e.target.value || undefined })
                    }
                  />

                  <Input
                    name={`achievement-${index}-organisation`}
                    label="Organising body"
                    value={item.organisation ?? ''}
                    onChange={(e) =>
                      patchAchievement(index, { organisation: e.target.value || undefined })
                    }
                  />

                  <Input
                    name={`achievement-${index}-level`}
                    label="Level"
                    placeholder="City-level"
                    value={item.level ?? ''}
                    onChange={(e) => patchAchievement(index, { level: e.target.value || undefined })}
                  />

                  <Input
                    name={`achievement-${index}-year`}
                    type="number"
                    label="Year awarded"
                    placeholder="2026"
                    value={item.year != null ? String(item.year) : ''}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value, 10);
                      patchAchievement(index, {
                        year: Number.isFinite(parsed) ? parsed : undefined,
                      });
                    }}
                  />
                </div>

                {/* The one detail field. See the note at the top of this file. */}
                <Textarea
                  name={`achievement-${index}-detail`}
                  label="Detailed description"
                  rows={5}
                  placeholder="Describe the scale of the competition or programme, how competitive it was, the selection criteria, your role, what you achieved, and why it matters."
                  value={item.detail ?? ''}
                  onChange={(e) => patchAchievement(index, { detail: e.target.value || undefined })}
                />
              </div>
            )}
          />
        </div>

        <div className="rounded-gb-2xl bg-surface-muted p-gb-3xl">
          <RepeatableFieldset
            legend="Extracurricular Activities"
            entries={activities}
            keyOf={(entry, index) => entry.id ?? `activity-${index}`}
            entryLabel={(index) => `Activity ${index + 1}`}
            addLabel="Add activity"
            max={20}
            onAdd={() => setActivities((prev) => [...prev, emptyActivity()])}
            onRemove={(index) => setActivities((prev) => prev.filter((_, i) => i !== index))}
            renderEntry={(item, index) => (
              <div className="flex flex-col gap-gb-2xl">
                <div className="grid gap-gb-2xl sm:grid-cols-2">
                  <Select
                    name={`activity-${index}-category`}
                    label="Activity category"
                    value={item.category}
                    onChange={(e) =>
                      patchActivity(index, {
                        category: e.target.value as ActivityValues['category'],
                      })
                    }
                  >
                    {ACTIVITY_CATEGORIES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>

                  <Input
                    name={`activity-${index}-title`}
                    label="Title"
                    value={item.title}
                    onChange={(e) => patchActivity(index, { title: e.target.value })}
                  />

                  <Input
                    name={`activity-${index}-organisation`}
                    label="Name of Org / Project"
                    value={item.organisation ?? ''}
                    onChange={(e) =>
                      patchActivity(index, { organisation: e.target.value || undefined })
                    }
                  />

                  <Input
                    name={`activity-${index}-level`}
                    label="Level"
                    value={item.level ?? ''}
                    onChange={(e) => patchActivity(index, { level: e.target.value || undefined })}
                  />

                  <Input
                    name={`activity-${index}-period`}
                    label="Period"
                    placeholder="2024 – 2026"
                    value={item.period ?? ''}
                    onChange={(e) => patchActivity(index, { period: e.target.value || undefined })}
                  />
                </div>

                <Textarea
                  name={`activity-${index}-description`}
                  label="Detailed description"
                  rows={5}
                  placeholder="Why you got involved, your role, your main contributions, what you achieved, the impact, or why it mattered to you."
                  value={item.description ?? ''}
                  onChange={(e) =>
                    patchActivity(index, { description: e.target.value || undefined })
                  }
                />
              </div>
            )}
          />
        </div>

        {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}

        <div className="flex flex-wrap justify-center gap-gb-lg">
          <Button
            href={
              returnTo
                ? `${reflectionStep('about').path}?return=${encodeURIComponent(returnTo)}`
                : reflectionStep('about').path
            }
            variant="secondary"
            size="lg"
          >
            Back
          </Button>
          <Button type="submit" size="lg" disabled={saving} className="min-w-64">
            {saving ? 'Saving…' : 'Finish'}
          </Button>
        </div>
      </form>
    </ReflectionShell>
  );
}
