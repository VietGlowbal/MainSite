'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ACHIEVEMENT_CATEGORIES,
  ACTIVITY_CATEGORIES,
  applyEvidenceCandidates,
  evidenceExtractionResponseSchema,
  reflectionStep,
  type AchievementValues,
  type ActivityValues,
  type EvidenceExtractionResponse,
} from '@/features/apply/domain';
import { useDocumentUpload } from '@/features/apply/hooks';
import { EvidenceExtractionPreview, ReflectionShell } from '@/features/apply/ui';
import { useT } from '@/lib/i18n';
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
 * Uploaded PDFs are parsed into a reviewable draft. The student chooses which
 * evidence-bound candidates are copied into the editable rows below; extraction
 * never writes final reflection data by itself.
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
  const t = useT();
  const router = useRouter();
  /*
   * Carried forward from step 1's own `?return=` (see the note in
   * `reflection-about-form.tsx`) — reaching this page from an application's
   * Overview means finishing here should land back at that application's
   * analysis gate, not the old per-student `/ai-strategy/report`. Absent for
   * every other entry point into this page, which keeps that fallback.
   */
  const returnTo = useSearchParams().get('return');
  const { items, upload, remove } = useDocumentUpload();

  const [achievements, setAchievements] = useState<AchievementValues[]>(
    initialAchievements.length > 0 ? initialAchievements : [emptyAchievement()],
  );
  const [activities, setActivities] = useState<ActivityValues[]>(
    initialActivities.length > 0 ? initialActivities : [emptyActivity()],
  );
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionResult, setExtractionResult] =
    useState<EvidenceExtractionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLoadingIndicator(
    saving || extracting,
    extracting ? 'AI đang đọc tài liệu' : 'Saving your achievements',
  );

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
        setError(t('We could not save that. Please try again.'));
        setSaving(false);
        return;
      }

      router.push(returnTo || '/ai-strategy/report');
    } catch {
      setError(t('We could not save that. Please try again.'));
      setSaving(false);
    }
  }

  return (
    <ReflectionShell step="evidence">
      <form onSubmit={handleSubmit} className="flex flex-col gap-gb-3xl">
        <section className="flex flex-col gap-gb-lg">
          <h2 className="text-gb-lg font-semibold text-fg-brand">
            {t('Academic achievements and extracurricular activities')}
          </h2>

          <FileDropzone
            onFiles={async (files) => {
              setExtracting(true);
              setExtractionResult(null);
              setError(null);
              try {
                const uploaded = await upload(files, 'other');
                const documentIds = uploaded.flatMap((item) =>
                  item.status === 'complete' && item.documentId ? [item.documentId] : [],
                );
                if (documentIds.length === 0) return;

                const response = await fetch('/api/reflection/extract-evidence', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ documentIds }),
                });
                const body = await response.json().catch(() => null);
                if (!response.ok) {
                  setError(body?.error ?? t('Could not read the document. Please try again.'));
                  return;
                }
                const parsed = evidenceExtractionResponseSchema.safeParse(body);
                if (!parsed.success) {
                  setError(t('The extraction result is invalid. Please try again.'));
                  return;
                }
                setExtractionResult(parsed.data);
              } catch {
                setError(t('Could not read the document. Please try again.'));
              } finally {
                setExtracting(false);
              }
            }}
            accept=".pdf,application/pdf"
            disabled={saving || extracting}
            label={extracting ? t('Reading PDF…') : t('Upload a CV or certificate PDF')}
            hint={t('You can choose multiple PDFs; each file can be up to 10MB')}
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

          <p className="text-center text-gb-sm text-fg-tertiary">
            {t('The system only fills data with a source excerpt in the PDF; you review everything before saving.')}
          </p>
        </section>

        {extractionResult ? (
          <EvidenceExtractionPreview
            key={extractionResult.documents.map(({ documentId }) => documentId).join(':')}
            result={extractionResult}
            onApply={(candidates) => {
              const next = applyEvidenceCandidates(achievements, activities, candidates);
              setAchievements(next.achievements);
              setActivities(next.activities);
              setExtractionResult(null);
            }}
            onDismiss={() => setExtractionResult(null)}
          />
        ) : null}

        {/* No ReflectionSection wrapper here: RepeatableFieldset renders its own
            heading, and nesting the two put "Thành tích học thuật" on the page
            twice. The plate is kept, the second heading is not. */}
        <div className="rounded-gb-2xl bg-surface-muted p-gb-3xl">
          <RepeatableFieldset
            legend={t('Academic achievements')}
            entries={achievements}
            keyOf={(entry, index) => entry.id ?? `achievement-${index}`}
            entryLabel={(index) => t('Achievement {number}', { number: index + 1 })}
            addLabel={t('Add achievement')}
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
                    label={t('Academic achievement type')}
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
                    label={t('Achievement name')}
                    placeholder={t('For example: First prize in the Hanoi City Mathematics Olympiad 2026')}
                    value={item.title}
                    onChange={(e) => patchAchievement(index, { title: e.target.value })}
                  />

                  <Input
                    name={`achievement-${index}-competition`}
                    label={t('Competition or organisation name')}
                    value={item.competition ?? ''}
                    onChange={(e) =>
                      patchAchievement(index, { competition: e.target.value || undefined })
                    }
                  />

                  <Input
                    name={`achievement-${index}-organisation`}
                    label={t('Organising body')}
                    value={item.organisation ?? ''}
                    onChange={(e) =>
                      patchAchievement(index, { organisation: e.target.value || undefined })
                    }
                  />

                  <Input
                    name={`achievement-${index}-level`}
                    label={t('Level')}
                    placeholder={t('City level')}
                    value={item.level ?? ''}
                    onChange={(e) => patchAchievement(index, { level: e.target.value || undefined })}
                  />

                  <Input
                    name={`achievement-${index}-year`}
                    type="number"
                    label={t('Award year')}
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
                  label={t('Detailed description')}
                  rows={5}
                  placeholder={t('Describe the scale, competitiveness, selection criteria, your role, the result, and why this achievement matters.')}
                  value={item.detail ?? ''}
                  onChange={(e) => patchAchievement(index, { detail: e.target.value || undefined })}
                />
              </div>
            )}
          />
        </div>

        <div className="rounded-gb-2xl bg-surface-muted p-gb-3xl">
          <RepeatableFieldset
            legend={t('Extracurricular activities')}
            entries={activities}
            keyOf={(entry, index) => entry.id ?? `activity-${index}`}
            entryLabel={(index) => t('Activity {number}', { number: index + 1 })}
            addLabel={t('Add activity')}
            max={20}
            onAdd={() => setActivities((prev) => [...prev, emptyActivity()])}
            onRemove={(index) => setActivities((prev) => prev.filter((_, i) => i !== index))}
            renderEntry={(item, index) => (
              <div className="flex flex-col gap-gb-2xl">
                <div className="grid gap-gb-2xl sm:grid-cols-2">
                  <Select
                    name={`activity-${index}-category`}
                    label={t('Extracurricular activity type')}
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
                  label={t('Detailed description')}
                  rows={5}
                  placeholder={t('Describe why you joined, your role, key contributions, results, impact, or what made this activity meaningful.')}
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
          <Button href={reflectionStep('about').path} variant="secondary" size="lg">
            {t('Back')}
          </Button>
          <Button type="submit" size="lg" disabled={saving || extracting} className="min-w-64">
            {saving ? t('Saving…') : t('Finish')}
          </Button>
        </div>
      </form>
    </ReflectionShell>
  );
}
