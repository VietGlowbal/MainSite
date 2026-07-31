'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
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
        setError('We could not save that. Please try again.');
        setSaving(false);
        return;
      }

      router.push('/ai-strategy');
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
            Thành tích học thuật và hoạt động phi học thuật
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
                  setError(body?.error ?? 'Không thể đọc tài liệu. Vui lòng thử lại.');
                  return;
                }
                const parsed = evidenceExtractionResponseSchema.safeParse(body);
                if (!parsed.success) {
                  setError('Kết quả trích xuất không hợp lệ. Vui lòng thử lại.');
                  return;
                }
                setExtractionResult(parsed.data);
              } catch {
                setError('Không thể đọc tài liệu. Vui lòng thử lại.');
              } finally {
                setExtracting(false);
              }
            }}
            accept=".pdf,application/pdf"
            disabled={saving || extracting}
            label={extracting ? 'Đang đọc PDF…' : 'Tải CV hoặc chứng nhận PDF'}
            hint="Có thể chọn nhiều PDF, mỗi file tối đa 10MB"
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
            Hệ thống chỉ điền dữ liệu có đoạn nguồn trong PDF; bạn luôn được kiểm tra trước khi lưu.
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
            legend="Thành tích học thuật"
            entries={achievements}
            keyOf={(entry, index) => entry.id ?? `achievement-${index}`}
            entryLabel={(index) => `Thành tích ${index + 1}`}
            addLabel="Thêm thành tích"
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
                    label="Loại thành tích học thuật"
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
                    label="Tên thành tích"
                    placeholder="Giải Nhất cuộc thi Olympic Toán Thành Phố Hà Nội năm 2026"
                    value={item.title}
                    onChange={(e) => patchAchievement(index, { title: e.target.value })}
                  />

                  <Input
                    name={`achievement-${index}-competition`}
                    label="Tên cuộc thi / tên tổ chức"
                    value={item.competition ?? ''}
                    onChange={(e) =>
                      patchAchievement(index, { competition: e.target.value || undefined })
                    }
                  />

                  <Input
                    name={`achievement-${index}-organisation`}
                    label="Đơn vị tổ chức"
                    value={item.organisation ?? ''}
                    onChange={(e) =>
                      patchAchievement(index, { organisation: e.target.value || undefined })
                    }
                  />

                  <Input
                    name={`achievement-${index}-level`}
                    label="Cấp độ"
                    placeholder="Cấp thành phố"
                    value={item.level ?? ''}
                    onChange={(e) => patchAchievement(index, { level: e.target.value || undefined })}
                  />

                  <Input
                    name={`achievement-${index}-year`}
                    type="number"
                    label="Năm cấp"
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
                  label="Mô tả chi tiết"
                  rows={5}
                  placeholder="Nêu quy mô cuộc thi hoặc chương trình, mức độ cạnh tranh, tiêu chí xét chọn, vai trò của bạn, kết quả đạt được và ý nghĩa của thành tích."
                  value={item.detail ?? ''}
                  onChange={(e) => patchAchievement(index, { detail: e.target.value || undefined })}
                />
              </div>
            )}
          />
        </div>

        <div className="rounded-gb-2xl bg-surface-muted p-gb-3xl">
          <RepeatableFieldset
            legend="Hoạt động phi học thuật"
            entries={activities}
            keyOf={(entry, index) => entry.id ?? `activity-${index}`}
            entryLabel={(index) => `Hoạt động ${index + 1}`}
            addLabel="Thêm hoạt động"
            max={20}
            onAdd={() => setActivities((prev) => [...prev, emptyActivity()])}
            onRemove={(index) => setActivities((prev) => prev.filter((_, i) => i !== index))}
            renderEntry={(item, index) => (
              <div className="flex flex-col gap-gb-2xl">
                <div className="grid gap-gb-2xl sm:grid-cols-2">
                  <Select
                    name={`activity-${index}-category`}
                    label="Loại hoạt động phi học thuật"
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
                  label="Mô tả chi tiết"
                  rows={5}
                  placeholder="Lí do tham gia, vai trò, đóng góp chính, kết quả đạt được, tác động hoặc điều khiến hoạt động này có ý nghĩa với bạn."
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
            Quay lại
          </Button>
          <Button type="submit" size="lg" disabled={saving || extracting} className="min-w-64">
            {saving ? 'Đang lưu…' : 'Hoàn tất'}
          </Button>
        </div>
      </form>
    </ReflectionShell>
  );
}
