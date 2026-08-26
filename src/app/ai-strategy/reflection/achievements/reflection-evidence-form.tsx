'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  applyEvidenceCandidates as applyEvidenceCandidatesRaw,
  evidenceCandidateToItem,
  evidenceExtractionResponseSchema,
  mergeDuplicate,
  type AchievementCategory,
  type AchievementValues,
  type ActivityCategory,
  type ActivityValues,
  type EvidenceDuplicate,
} from '@/features/apply/domain';
import { useDocumentUpload, useEvidenceDocuments, type EvidenceDocument } from '@/features/apply/hooks';
import {
  AddCircularButton,
  ClearableInput,
  ClearableSelect,
  CVHeroUpload,
  DuplicatePrompt,
  FloatingHelpButton,
  MultiSelectCombobox,
  ReflectionShell,
  RemoveCircularButton,
  type ComboboxOption,
  type UploadedFileItem,
} from '@/features/apply/ui';
import { useT } from '@/lib/i18n';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tmp-${Math.random().toString(36).slice(2)}`;

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 15 }, (_, i) => {
  const y = CURRENT_YEAR - i;
  return { value: y, label: String(y) };
});

const LEVEL_OPTIONS = [
  { value: 'National', label: 'Toàn quốc / Quốc gia' },
  { value: 'International', label: 'Quốc tế' },
  { value: 'City / Local', label: 'Tỉnh / Thành phố' },
  { value: 'School', label: 'Trường' },
  { value: 'Regional', label: 'Khu vực' },
  { value: 'University', label: 'Đại học' },
  { value: 'Community', label: 'Cộng đồng' },
  { value: 'Organisation', label: 'Tổ chức' },
  { value: 'Other', label: 'Khác' },
];

const ACADEMIC_CATEGORY_OPTIONS: ComboboxOption[] = [
  {
    value: 'academic_award',
    label: 'Giải thưởng học thuật',
  },
  {
    value: 'competition',
    label: 'Học bổng',
  },
  {
    value: 'research',
    label: 'Nghiên cứu khoa học / Bài báo được xuất bản',
  },
  {
    value: 'certification',
    label: 'Bằng khen / Giấy khen',
  },
];

const ACTIVITY_CATEGORY_OPTIONS: ComboboxOption[] = [
  {
    value: 'community_project',
    label: 'Hoạt động tình nguyện / Dự án cộng đồng (vai trò cốt lõi, tác động đo lường được)',
  },
  {
    value: 'leadership',
    label: 'Lãnh đạo CLB / Đội nhóm (Chủ tịch, Trưởng ban, Founder dự án... từ 6 tháng trở lên)',
  },
  {
    value: 'innovation',
    label: 'Dự án cá nhân / Khởi nghiệp / Sáng kiến xã hội (tạo ra sản phẩm, dịch vụ hoặc phong trào cụ thể)',
  },
  {
    value: 'personal_growth',
    label: 'Thực tập / Dự án tại Doanh nghiệp / Tổ chức phi chính phủ (tối thiểu 1-2 tháng)',
  },
  {
    value: 'mentoring',
    label: 'Cố vấn / Dạy kèm học sinh (ít nhất 3-6 tháng)',
  },
  {
    value: 'other',
    label: 'Khác',
  },
];

function mapToAcademicCategory(labelOrVal: string): AchievementCategory {
  const match = ACADEMIC_CATEGORY_OPTIONS.find(
    (opt) => opt.value === labelOrVal || opt.label === labelOrVal,
  );
  if (match) {
    return match.value as AchievementCategory;
  }
  return 'academic_award';
}

function mapToActivityCategory(labelOrVal: string): ActivityCategory {
  const match = ACTIVITY_CATEGORY_OPTIONS.find(
    (opt) => opt.value === labelOrVal || opt.label === labelOrVal,
  );
  if (match) return match.value as ActivityCategory;
  return 'community_project';
}

export function ReflectionEvidenceForm({
  initialAchievements,
  initialActivities,
  initialDocuments,
  applicationId,
}: {
  initialAchievements: AchievementValues[];
  initialActivities: ActivityValues[];
  initialDocuments: EvidenceDocument[];
  applicationId?: string | undefined;
  applicationLabel?: string | undefined;
}) {
  const t = useT();
  const router = useRouter();
  const returnTo = useSearchParams().get('return');
  const { upload } = useDocumentUpload();
  const { documents, addUploaded, remove: removeDocument } = useEvidenceDocuments(initialDocuments);

  const [achievements, setAchievements] = useState<AchievementValues[]>(() =>
    initialAchievements.length > 0
      ? initialAchievements
      : [
          {
            id: newId(),
            category: 'competition',
            title: '',
            competition: '',
            organisation: '',
            year: CURRENT_YEAR,
            level: 'National',
            detail: '',
          },
        ],
  );

  const [activities, setActivities] = useState<ActivityValues[]>(() =>
    initialActivities.length > 0
      ? initialActivities
      : [
          {
            id: newId(),
            category: 'community_project',
            title: '',
            organisation: '',
            level: '',
            period: '',
            description: '',
          },
        ],
  );

  const [documentNames, setDocumentNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialDocuments.map((doc) => [doc.id, doc.fileName])),
  );
  const [duplicates, setDuplicates] = useState<EvidenceDuplicate[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLoadingIndicator(saving, t('Saving your achievements'));

  // ── Achievement Handlers ──────────────────────────────────────────────────

  function updateAchievement(index: number, patch: Partial<AchievementValues>) {
    setAchievements((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], ...patch };
      }
      return next;
    });
  }

  function handleAddAchievement() {
    setAchievements((prev) => [
      ...prev,
      {
        id: newId(),
        category: 'academic_award',
        title: '',
        competition: '',
        organisation: '',
        year: CURRENT_YEAR,
        level: 'National',
        detail: '',
      },
    ]);
  }

  function handleRemoveAchievement(index: number) {
    setAchievements((prev) => {
      if (prev.length <= 1) {
        return [
          {
            id: newId(),
            category: 'academic_award',
            title: '',
            competition: '',
            organisation: '',
            year: CURRENT_YEAR,
            level: 'National',
            detail: '',
          },
        ];
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  // ── Activity Handlers ────────────────────────────────────────────────────

  function updateActivity(index: number, patch: Partial<ActivityValues>) {
    setActivities((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], ...patch };
      }
      return next;
    });
  }

  function handleAddActivity() {
    setActivities((prev) => [
      ...prev,
      {
        id: newId(),
        category: 'community_project',
        title: '',
        organisation: '',
        level: '',
        period: '',
        description: '',
      },
    ]);
  }

  function handleRemoveActivity(index: number) {
    setActivities((prev) => {
      if (prev.length <= 1) {
        return [
          {
            id: newId(),
            category: 'community_project',
            title: '',
            organisation: '',
            level: '',
            period: '',
            description: '',
          },
        ];
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  // ── File Upload & AI Extraction ──────────────────────────────────────────

  function applyExtractedCandidates(
    candidates: Parameters<typeof applyEvidenceCandidatesRaw>[2],
    names: Record<string, string>,
  ) {
    const result = applyEvidenceCandidatesRaw(
      achievements.filter((a) => a.title.trim().length > 0),
      activities.filter((a) => a.title.trim().length > 0),
      candidates,
      names,
    );
    setAchievements(result.achievements.length > 0 ? result.achievements : achievements);
    setActivities(result.activities.length > 0 ? result.activities : activities);
    if (result.duplicates.length > 0) setDuplicates((prev) => [...prev, ...result.duplicates]);
    return result;
  }

  async function runExtraction(documentIds: string[]) {
    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await fetch('/api/reflection/extract-evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? t('Could not read the document. Please try again.'));
        setIsAnalyzing(false);
        return;
      }
      const parsed = evidenceExtractionResponseSchema.safeParse(body);
      if (!parsed.success) {
        setError(t('The extraction result is invalid. Please try again.'));
        setIsAnalyzing(false);
        return;
      }

      const names = Object.fromEntries(parsed.data.documents.map((d) => [d.documentId, d.fileName]));
      setDocumentNames((prev) => ({ ...prev, ...names }));
      applyExtractedCandidates(parsed.data.candidates, { ...documentNames, ...names });
    } catch {
      setError(t('Could not read the document. Please try again.'));
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleCVUpload(files: File[]) {
    setError(null);
    setIsAnalyzing(true);
    const uploaded = await upload(files, 'other');
    addUploaded(uploaded);

    const documentIds = uploaded.flatMap((item) =>
      item.status === 'complete' && item.documentId ? [item.documentId] : [],
    );

    if (documentIds.length === 0) {
      const failed = uploaded.find((item) => item.status === 'error');
      setError(failed?.error ?? t('Upload failed. Please try again.'));
      setIsAnalyzing(false);
      return;
    }

    await runExtraction(documentIds);
  }

  // ── Duplicate Resolution ─────────────────────────────────────────────────

  function resolveMerge(duplicate: EvidenceDuplicate) {
    const incoming = evidenceCandidateToItem(duplicate.candidate, documentNames);
    if (duplicate.candidate.kind === 'achievement') {
      setAchievements((prev) =>
        prev.map((item) =>
          item.id === duplicate.existingId ? mergeDuplicate(item, incoming as AchievementValues) : item,
        ),
      );
    } else {
      setActivities((prev) =>
        prev.map((item) =>
          item.id === duplicate.existingId ? mergeDuplicate(item, incoming as ActivityValues) : item,
        ),
      );
    }
    setDuplicates((prev) => prev.filter((d) => d.candidate.candidateId !== duplicate.candidate.candidateId));
  }

  function resolveKeepBoth(duplicate: EvidenceDuplicate) {
    const incoming = evidenceCandidateToItem(duplicate.candidate, documentNames);
    if (duplicate.candidate.kind === 'achievement') {
      setAchievements((prev) => [...prev, incoming as AchievementValues]);
    } else {
      setActivities((prev) => [...prev, incoming as ActivityValues]);
    }
    setDuplicates((prev) => prev.filter((d) => d.candidate.candidateId !== duplicate.candidate.candidateId));
  }

  // ── Form Submission ──────────────────────────────────────────────────────

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    const validAchievements = achievements.filter((a) => a.title && a.title.trim().length > 0);
    const validActivities = activities.filter((a) => a.title && a.title.trim().length > 0);

    const payload = {
      achievements: validAchievements,
      activities: validActivities,
      ...(applicationId ? { applicationId } : {}),
    };

    try {
      const response = await fetch('/api/reflection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setError(t('Could not save achievements. Please try again.'));
        setSaving(false);
        return;
      }

      const confirmReturn = returnTo || '/ai-strategy/report';
      router.push(`/ai-strategy/reflection/personal?return=${encodeURIComponent(confirmReturn)}`);
    } catch {
      setError(t('Could not save achievements. Please try again.'));
      setSaving(false);
    }
  }

  const uploadedFileList: UploadedFileItem[] = documents.map((doc) => ({
    id: doc.id,
    name: doc.fileName,
    size: '2.4 MB',
    status: 'completed',
    progress: 100,
  }));

  return (
    <ReflectionShell step="evidence">
      <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-16">
        {/* Main Page Title */}
        <h2 className="text-xl sm:text-2xl font-bold text-[#E11D48] text-center mt-2 mb-4 tracking-tight">
          {t('Thành tích học thuật và hoạt động phi học thuật')}
        </h2>

        {/* Hero CV Upload Area */}
        <CVHeroUpload
          uploadedFiles={uploadedFileList}
          onUpload={(files) => void handleCVUpload(files)}
          onRemove={(id) => void removeDocument(id)}
          isAnalyzing={isAnalyzing}
        />

        {/* Duplicate Prompt */}
        <DuplicatePrompt duplicates={duplicates} onMerge={resolveMerge} onKeepBoth={resolveKeepBoth} t={t} />

        {/* ── Section 1: Academic Achievements ───────────────────────────── */}
        <section className="flex flex-col gap-5 mt-6">
          <h3 className="text-xl sm:text-2xl font-bold text-[#E11D48] text-center tracking-tight">
            {t('Thành tích học thuật')}
          </h3>

          <div className="flex flex-col gap-6">
            {achievements.map((item, idx) => {
              const cardId = item.id || `ach-${idx}`;
              const categoryMatch = ACADEMIC_CATEGORY_OPTIONS.find((opt) => opt.value === item.category);
              const selectedCategoryLabel = categoryMatch ? categoryMatch.label : item.category;

              return (
                <div
                  key={cardId}
                  className="bg-[#FAFAFA] border border-neutral-200/90 rounded-2xl p-6 sm:p-8 shadow-sm transition-all relative flex flex-col gap-5"
                >
                  {/* Card Title */}
                  <h4 className="text-center font-bold text-neutral-900 text-base sm:text-lg mb-1">
                    {t('Thành tích {index}', { index: idx + 1 })}
                  </h4>

                  {/* 1. Loại thành tích học thuật */}
                  <MultiSelectCombobox
                    label="Loại thành tích học thuật"
                    value={selectedCategoryLabel}
                    options={ACADEMIC_CATEGORY_OPTIONS}
                    placeholder="Search or select..."
                    onChange={(selectedLabel) => {
                      const cat = mapToAcademicCategory(selectedLabel);
                      updateAchievement(idx, { category: cat });
                    }}
                  />

                  {/* 2. Tên thành tích * */}
                  <ClearableInput
                    label="Tên thành tích"
                    required
                    value={item.title}
                    onChange={(val) => updateAchievement(idx, { title: val })}
                    placeholder="vd: Giải nhất Kì thi Olympic Toán học Sinh viên toàn quốc 2024"
                  />

                  {/* 3. Tên cuộc thi / Giải thưởng & Đơn vị tổ chức */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <ClearableInput
                      label="Tên cuộc thi / Giải thưởng"
                      value={item.competition ?? ''}
                      onChange={(val) => updateAchievement(idx, { competition: val })}
                      placeholder="vd: Olympic Toán học Toàn quốc"
                    />
                    <ClearableInput
                      label="Đơn vị tổ chức"
                      value={item.organisation ?? ''}
                      onChange={(val) => updateAchievement(idx, { organisation: val })}
                      placeholder="vd: Hội Toán học Việt Nam / ĐHQG"
                    />
                  </div>

                  {/* 4. Năm đạt & Cấp độ */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <ClearableSelect
                      label="Năm đạt"
                      value={item.year ?? CURRENT_YEAR}
                      onChange={(val) => updateAchievement(idx, { year: Number(val) || CURRENT_YEAR })}
                      options={YEAR_OPTIONS}
                    />
                    <ClearableSelect
                      label="Cấp độ"
                      value={item.level ?? 'National'}
                      onChange={(val) => updateAchievement(idx, { level: val })}
                      options={LEVEL_OPTIONS}
                    />
                  </div>

                  {/* 5. Bổ sung thông tin chi tiết */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="text-sm font-medium text-neutral-800">
                      {t('Bổ sung thông tin chi tiết')}
                    </label>
                    <textarea
                      value={item.detail ?? ''}
                      onChange={(e) => updateAchievement(idx, { detail: e.target.value })}
                      placeholder={t('Describe your scores, ranks, scope, or key contributions...')}
                      rows={3}
                      className="w-full bg-white border border-neutral-200 rounded-xl p-4 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#E11D48] focus:ring-1 focus:ring-[#E11D48] transition-all resize-y"
                    />
                  </div>

                  {/* 6. Remove Card Button */}
                  <RemoveCircularButton onClick={() => handleRemoveAchievement(idx)} />
                </div>
              );
            })}
          </div>

          {/* Add Achievement Circular Button */}
          <AddCircularButton onClick={handleAddAchievement} />
        </section>

        {/* ── Section 2: Non-Academic Activities ─────────────────────────── */}
        <section className="flex flex-col gap-5 mt-4">
          <h3 className="text-xl sm:text-2xl font-bold text-[#E11D48] text-center tracking-tight">
            {t('Hoạt động phi học thuật')}
          </h3>

          <div className="flex flex-col gap-6">
            {activities.map((item, idx) => {
              const cardId = item.id || `act-${idx}`;
              const categoryMatch = ACTIVITY_CATEGORY_OPTIONS.find((opt) => opt.value === item.category);
              const selectedCategoryLabel = categoryMatch ? categoryMatch.label : item.category;

              return (
                <div
                  key={cardId}
                  className="bg-[#FAFAFA] border border-neutral-200/90 rounded-2xl p-6 sm:p-8 shadow-sm transition-all relative flex flex-col gap-5"
                >
                  {/* Card Title */}
                  <h4 className="text-center font-bold text-neutral-900 text-base sm:text-lg mb-1">
                    {t('Hoạt động {index}', { index: idx + 1 })}
                  </h4>

                  {/* 1. Loại hoạt động phi học thuật */}
                  <MultiSelectCombobox
                    label="Loại hoạt động phi học thuật"
                    value={selectedCategoryLabel}
                    options={ACTIVITY_CATEGORY_OPTIONS}
                    placeholder="Search or select..."
                    warningNote="Hoạt động chỉ tham gia đơn thuần (thành viên thông thường) có thể ghi ngắn gọn hoặc không đưa vào để ưu tiên các hoạt động có vai trò nổi bật."
                    onChange={(selectedLabel) => {
                      const cat = mapToActivityCategory(selectedLabel);
                      updateActivity(idx, { category: cat });
                    }}
                  />

                  {/* 2. Tên hoạt động * & Vai trò / Vị trí */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <ClearableInput
                      label="Tên hoạt động"
                      required
                      value={item.title}
                      onChange={(val) => updateActivity(idx, { title: val })}
                      placeholder="vd: Chiến dịch Mùa hè xanh"
                    />
                    <ClearableInput
                      label="Vị trí"
                      value={item.level ?? ''}
                      onChange={(val) => updateActivity(idx, { level: val })}
                      placeholder="vd: Trưởng ban Tổ chức"
                    />
                  </div>

                  {/* 3. Tổ chức / Đơn vị & Thời gian */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <ClearableInput
                      label="Tên tổ chức/Dự án"
                      value={item.organisation ?? ''}
                      onChange={(val) => updateActivity(idx, { organisation: val })}
                      placeholder="vd: Đoàn trường THPT"
                    />
                    <ClearableInput
                      label="Thời gian"
                      value={item.period ?? ''}
                      onChange={(val) => updateActivity(idx, { period: val })}
                      placeholder="vd: 06/2024 - 08/2024"
                    />
                  </div>

                  {/* 4. Mô tả chi tiết */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="text-sm font-medium text-neutral-800">
                      {t('Mô tả chi tiết')}
                    </label>
                    <textarea
                      value={item.description ?? ''}
                      onChange={(e) => updateActivity(idx, { description: e.target.value })}
                      placeholder={t('Describe your role, responsibilities, project outcomes, or community impact...')}
                      rows={3}
                      className="w-full bg-white border border-neutral-200 rounded-xl p-4 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#E11D48] focus:ring-1 focus:ring-[#E11D48] transition-all resize-y"
                    />
                  </div>

                  {/* 5. Remove Card Button */}
                  <RemoveCircularButton onClick={() => handleRemoveActivity(idx)} />
                </div>
              );
            })}
          </div>

          {/* Add Activity Circular Button */}
          <AddCircularButton onClick={handleAddActivity} />
        </section>

        {/* Error message if any */}
        {error && (
          <p className="text-center text-sm font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3 my-2">
            {error}
          </p>
        )}

        {/* ── Bottom Submit CTA ──────────────────────────────────────────── */}
        <div className="flex justify-center mt-8 mb-4">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
            className="bg-[#E11D48] hover:bg-[#BE123C] active:scale-[0.99] text-white font-bold text-base py-3.5 px-16 rounded-xl shadow-lg shadow-rose-600/20 hover:shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t('Saving…') : t('Tiếp tục')}
          </button>
        </div>

        {/* Floating Help Button */}
        <FloatingHelpButton />
      </div>
    </ReflectionShell>
  );
}
