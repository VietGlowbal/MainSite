'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_CATEGORY_ICON,
  ACTIVITY_CATEGORIES,
  ACTIVITY_CATEGORY_ICON,
  DIMENSION_LABELS,
  EXPERIENCE_CATEGORIES,
  EXPERIENCE_CATEGORY_META,
  REFLECTION_DIMENSIONS,
  activityReflectionAnsweredCount,
  activityReflectionSchema,
  evidenceCandidateToItem,
  evidenceExtractionResponseSchema,
  experienceCategoryFor,
  firstUnansweredDimension,
  isReflectionCardEmpty,
  mergeDuplicate,
  reflectionStep,
  type AchievementValues,
  type ActivityValues,
  type EvidenceDuplicate,
  type ReflectionCardValues,
  type TopLevelExperienceCategory,
  applyEvidenceCandidates as applyEvidenceCandidatesRaw,
} from '@/features/apply/domain';
import { useDocumentUpload, useEvidenceDocuments, type EvidenceDocument } from '@/features/apply/hooks';
import {
  AchievementCard,
  ActivityCard,
  ActivityReflectionModal,
  ExperienceCategoryChooser,
  DocumentPanel,
  DocumentPreviewDrawer,
  DuplicatePrompt,
  EditEvidenceModal,
  EvidenceEmptyState,
  EvidenceGrid,
  EvidenceSortSelect,
  EvidenceTabs,
  ReflectionBreadcrumb,
  ReflectionCardError,
  ReflectionCardLoading,
  ReflectionCardView,
  RemoveConfirmDialog,
  ReflectionShell,
  ReviewFlowDrawer,
  questionIcon,
  type EvidenceDraft,
  type EvidenceSort,
  type EvidenceTabKey,
  type ProcessingState,
  type ReflectionBreadcrumbItem,
} from '@/features/apply/ui';
import { useT } from '@/lib/i18n';
import { Button, Input, KitIcon, Modal } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

type EvidenceKind = 'achievement' | 'activity';

function categoryLabelFor(kind: EvidenceKind, category: string): string {
  const list = kind === 'achievement' ? ACHIEVEMENT_CATEGORIES : ACTIVITY_CATEGORIES;
  return list.find((entry) => entry.value === category)?.label ?? category;
}

function experienceCategoryForKind(kind: EvidenceKind, category: string) {
  return kind === 'achievement'
    ? experienceCategoryFor('achievement', category as AchievementValues['category'])
    : experienceCategoryFor('activity', category as ActivityValues['category']);
}

/**
 * Reflection step 2 of 2 — achievements and activities.
 *
 * ─── UPLOAD → AI EXTRACTS → CARDS APPEAR → REVIEW/EDIT → FINISH ──────────────
 *
 * The previous version of this page was one long form: every achievement and
 * activity, extracted or typed, rendered as the same six-field block the
 * student had to fill in or correct by hand. This version treats a PDF as the
 * primary way in — an uploaded CV or certificate is read, and what comes back
 * appears as review-ready cards, tagged with exactly where each fact came
 * from. The giant form still exists, in miniature, as the edit modal a card
 * opens — it is never the first thing the page shows.
 *
 * ─── SCOPE NOTES (documented, not hidden) ────────────────────────────────────
 *
 * Extraction stays a synchronous request/response (the existing
 * `/api/reflection/extract-evidence` route, unchanged), not a background job
 * with polling or realtime — the inline "Finding achievements…" status covers
 * the same ground without a new processing architecture. Document preview
 * opens the browser's own PDF viewer in an iframe rather than a hand-built
 * page/zoom control set. Duplicate detection matches on title, extending the
 * comparison `applyEvidenceCandidates` already made rather than a general
 * fuzzy/AI merge across documents.
 */

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tmp-${Math.random().toString(36).slice(2)}`;

/** "Other" only ever holds legacy rows — it gets a plain label, not a card in `EXPERIENCE_CATEGORY_META`. */
function ExperienceCategorySectionHeading({
  category,
  count,
  t,
}: {
  category: TopLevelExperienceCategory | 'other';
  count: number;
  t: (s: string, vars?: Record<string, string | number>) => string;
}) {
  const meta = category === 'other' ? undefined : EXPERIENCE_CATEGORY_META[category];
  return (
    <div className="flex items-center gap-gb-sm">
      {meta ? (
        <span
          aria-hidden="true"
          className="flex size-6 items-center justify-center rounded-gb-full bg-brand-subtle text-fg-brand"
        >
          <KitIcon art={questionIcon(meta.icon)} frame={14} />
        </span>
      ) : null}
      <h3 className="text-gb-sm font-semibold uppercase tracking-wide text-fg-tertiary">
        {meta ? t(meta.label) : t('Other')}
        <span className="ml-gb-sm font-normal normal-case text-fg-muted">({count})</span>
      </h3>
    </div>
  );
}

type RemoveTarget = {
  title: string;
  description: string;
  onConfirm: () => void;
};

/** A stable sort — ties keep their current relative order. */
function sortByRecency<T>(items: T[], sort: EvidenceSort, fields: {
  category: (item: T) => string;
  needsReview: (item: T) => boolean;
}): T[] {
  const arr = [...items];
  switch (sort) {
    case 'recent':
      return arr.reverse();
    case 'oldest':
      return arr;
    case 'type':
      return arr.sort((a, b) => fields.category(a).localeCompare(fields.category(b)));
    case 'reviewed_first':
      return arr.sort((a, b) => Number(fields.needsReview(a)) - Number(fields.needsReview(b)));
    case 'needs_review_first':
      return arr.sort((a, b) => Number(fields.needsReview(b)) - Number(fields.needsReview(a)));
  }
}

const SORT_OPTION_KEYS: EvidenceSort[] = [
  'recent',
  'oldest',
  'type',
  'reviewed_first',
  'needs_review_first',
];

/**
 * Groups a sorted list of cards under the four approved top-level
 * categories (spec: "activity list overview should visually group by A/B/C/D"),
 * in the same fixed `EXPERIENCE_CATEGORIES` order every time — legacy
 * `category: 'other'` rows (never pickable going forward, but still
 * possible on old rows) collect into a trailing "Other" group instead of
 * being dropped. Sort order within each group is preserved from `items`.
 */
function groupByExperienceCategory<T>(
  items: T[],
  categoryOf: (item: T) => TopLevelExperienceCategory | 'other',
): Array<{ category: TopLevelExperienceCategory | 'other'; items: T[] }> {
  const groups = new Map<TopLevelExperienceCategory | 'other', T[]>();
  for (const item of items) {
    const category = categoryOf(item);
    const bucket = groups.get(category);
    if (bucket) bucket.push(item);
    else groups.set(category, [item]);
  }
  return [...EXPERIENCE_CATEGORIES, 'other' as const]
    .filter((category) => groups.has(category))
    .map((category) => ({ category, items: groups.get(category)! }));
}

export function ReflectionEvidenceForm({
  initialAchievements,
  initialActivities,
  initialDocuments,
  applicationId,
  applicationLabel,
}: {
  initialAchievements: AchievementValues[];
  initialActivities: ActivityValues[];
  initialDocuments: EvidenceDocument[];
  applicationId?: string | undefined;
  /** e.g. "Cambridge · Computer Science" — drives the in-page breadcrumb. */
  applicationLabel?: string | undefined;
}) {
  const t = useT();
  const router = useRouter();
  const returnTo = useSearchParams().get('return');
  const { upload } = useDocumentUpload();
  const { documents, addUploaded, rename, remove: removeDocument, signedUrl } =
    useEvidenceDocuments(initialDocuments);

  const [achievements, setAchievements] = useState<AchievementValues[]>(initialAchievements);
  const [activities, setActivities] = useState<ActivityValues[]>(initialActivities);
  const [documentNames, setDocumentNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialDocuments.map((doc) => [doc.id, doc.fileName])),
  );
  const [duplicates, setDuplicates] = useState<EvidenceDuplicate[]>([]);

  const [activeTab, setActiveTab] = useState<EvidenceTabKey>('academic');
  const [sort, setSort] = useState<EvidenceSort>('recent');
  const [processing, setProcessing] = useState<ProcessingState>({ kind: 'idle' });

  const [editingDraft, setEditingDraft] = useState<EvidenceDraft | null>(null);
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  const [renameTarget, setRenameTarget] = useState<EvidenceDocument | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [preview, setPreview] = useState<{ document: EvidenceDocument; url: string | null } | null>(
    null,
  );

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [resumeReviewAfterEdit, setResumeReviewAfterEdit] = useState(false);
  const [finishWarningShown, setFinishWarningShown] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reflectTarget, setReflectTarget] = useState<{ kind: EvidenceKind; id: string } | null>(null);
  const [dimensionIndex, setDimensionIndex] = useState(0);
  const [categoryChooserOpen, setCategoryChooserOpen] = useState(false);
  const [cardTarget, setCardTarget] = useState<{ kind: EvidenceKind; id: string } | null>(null);
  const [cardState, setCardState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [cardError, setCardError] = useState<string | null>(null);

  useLoadingIndicator(saving, t('Saving your achievements'));

  function findItem(kind: EvidenceKind, id: string): AchievementValues | ActivityValues | undefined {
    return kind === 'achievement'
      ? achievements.find((item) => item.id === id)
      : activities.find((item) => item.id === id);
  }

  function updateItem(
    kind: EvidenceKind,
    id: string,
    patch: Partial<AchievementValues> & Partial<ActivityValues>,
  ) {
    if (kind === 'achievement') {
      setAchievements((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    } else {
      setActivities((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    }
  }

  /**
   * Persists the whole current lists — the same request `handleSubmit` sends
   * — before calling the AI so a network failure generating the card never
   * costs the student their raw reflection answers (spec: "Persist raw
   * answers before calling AI").
   */
  async function persistEvidence() {
    await fetch('/api/reflection', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        achievements: achievements.filter((a) => a.title.trim().length > 0),
        activities: activities.filter((a) => a.title.trim().length > 0),
        ...(applicationId ? { applicationId } : {}),
      }),
    });
  }

  async function generateCard(kind: EvidenceKind, id: string) {
    const item = findItem(kind, id);
    if (!item?.reflection) return;

    setCardTarget({ kind, id });
    setCardState('loading');
    setCardError(null);
    await persistEvidence();

    try {
      const response = await fetch('/api/reflection/reflection-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          organisation: ('competition' in item ? item.competition : undefined) ?? item.organisation,
          categoryLabel: categoryLabelFor(kind, item.category),
          reflection: item.reflection,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setCardState('error');
        setCardError(
          body?.error ?? t('We saved your reflection, but couldn’t create the summary.'),
        );
        return;
      }
      const card = body.card as ReflectionCardValues;
      updateItem(kind, id, { reflectionCard: card });
      setCardState('ready');
    } catch {
      setCardState('error');
      setCardError(t('We saved your reflection, but couldn’t create the summary.'));
    }
  }

  function saveCard(kind: EvidenceKind, id: string, next: ReflectionCardValues) {
    updateItem(kind, id, { reflectionCard: next });
    void persistEvidence();
  }

  /** Opens the reflection dialog for `item`, resuming at its first unanswered dimension — not always Context. */
  function openReflection(kind: EvidenceKind, id: string) {
    const item = findItem(kind, id);
    const resumeIndex = REFLECTION_DIMENSIONS.indexOf(firstUnansweredDimension(item?.reflection));
    setDimensionIndex(resumeIndex === -1 ? 0 : resumeIndex);
    setReflectTarget({ kind, id });
  }

  /** Reopens an already-generated Reflection Card for review without re-calling the AI. */
  function viewCard(kind: EvidenceKind, id: string) {
    setCardTarget({ kind, id });
    setCardState('ready');
    setCardError(null);
  }

  /**
   * The one status label the spec's card vocabulary maps onto: not started →
   * in progress · N/7 → complete → generating → review the card → confirmed.
   * A card already generated always takes the student to `viewCard` (read
   * the card) rather than back into the dimension-by-dimension editor.
   */
  function reflectActionFor(kind: EvidenceKind, item: AchievementValues | ActivityValues) {
    if (!item.id) return undefined;
    const id = item.id;
    const hasCard = !isReflectionCardEmpty(item.reflectionCard);
    const generating = cardTarget?.kind === kind && cardTarget.id === id && cardState === 'loading';
    const confirmed = item.reflectionCard?.status === 'confirmed';

    if (generating) {
      return { label: t('Generating Reflection Card…'), hasCard: true, onClick: () => {} };
    }
    if (hasCard) {
      return {
        label: confirmed ? t('Confirmed') : t('Review Reflection Card'),
        hasCard: true,
        onClick: () => viewCard(kind, id),
      };
    }

    const answered = activityReflectionAnsweredCount(item.reflection);
    const label =
      answered === 0
        ? t('Reflection not started')
        : answered === REFLECTION_DIMENSIONS.length
          ? t('Reflection complete')
          : t('Reflection in progress · {answered}/{total}', { answered, total: REFLECTION_DIMENSIONS.length });
    return { label, hasCard: false, onClick: () => openReflection(kind, id) };
  }

  function confirmCard(kind: EvidenceKind, id: string) {
    const item = findItem(kind, id);
    if (!item?.reflectionCard) return;
    updateItem(kind, id, { reflectionCard: { ...item.reflectionCard, status: 'confirmed' } });
    void persistEvidence();
    setCardTarget(null);
  }

  const reviewQueue: EvidenceDraft[] = [
    ...achievements
      .filter((a) => a.reviewStatus === 'needs_review')
      .map((a): EvidenceDraft => ({ kind: 'achievement', ...a })),
    ...activities
      .filter((a) => a.reviewStatus === 'needs_review')
      .map((a): EvidenceDraft => ({ kind: 'activity', ...a })),
  ];

  function applyExtractedCandidates(
    candidates: Parameters<typeof applyEvidenceCandidatesRaw>[2],
    names: Record<string, string>,
  ) {
    const result = applyEvidenceCandidatesRaw(achievements, activities, candidates, names);
    setAchievements(result.achievements);
    setActivities(result.activities);
    if (result.duplicates.length > 0) setDuplicates((prev) => [...prev, ...result.duplicates]);
    return result;
  }

  async function runExtraction(documentIds: string[]) {
    setProcessing({ kind: 'analysing' });
    setError(null);
    try {
      const response = await fetch('/api/reflection/extract-evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setProcessing({
          kind: 'error',
          message: body?.error ?? t('Could not read the document. Please try again.'),
        });
        return;
      }
      const parsed = evidenceExtractionResponseSchema.safeParse(body);
      if (!parsed.success) {
        setProcessing({ kind: 'error', message: t('The extraction result is invalid. Please try again.') });
        return;
      }

      const names = Object.fromEntries(parsed.data.documents.map((d) => [d.documentId, d.fileName]));
      setDocumentNames((prev) => ({ ...prev, ...names }));

      const result = applyExtractedCandidates(parsed.data.candidates, { ...documentNames, ...names });
      const addedCount = parsed.data.candidates.length - result.duplicates.length;

      if (parsed.data.candidates.length === 0) {
        setProcessing({ kind: 'no_results' });
      } else {
        setProcessing({ kind: 'complete', achievementCount: addedCount });
      }
    } catch {
      setProcessing({ kind: 'error', message: t('Could not read the document. Please try again.') });
    }
  }

  async function handleFiles(files: File[]) {
    setProcessing({ kind: 'uploading', fileName: files[0]?.name ?? '' });
    setError(null);
    const uploaded = await upload(files, 'other');
    addUploaded(uploaded);

    const failed = uploaded.filter((item) => item.status === 'error');
    const documentIds = uploaded.flatMap((item) =>
      item.status === 'complete' && item.documentId ? [item.documentId] : [],
    );

    if (documentIds.length === 0) {
      setProcessing({
        kind: 'error',
        message: failed[0]?.error ?? t('We could not upload that file. Please try again.'),
      });
      return;
    }

    await runExtraction(documentIds);
  }

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

  function saveDraft(draft: EvidenceDraft) {
    if (!draft.title.trim()) return;

    // Branch on `kind` before spreading: pulling a `rest` out of the union
    // first would widen `category` to the union of both kinds' categories,
    // which is not assignable back to either `AchievementValues` or
    // `ActivityValues`. `kind` itself rides along harmlessly in the spread —
    // TypeScript does not excess-property-check fields that arrive via `...`.
    if (draft.kind === 'achievement') {
      const item: AchievementValues = {
        ...draft,
        reviewStatus: 'reviewed',
        sourceType: draft.sourceType ?? 'manual',
      };
      setAchievements((prev) =>
        prev.some((a) => a.id === item.id) ? prev.map((a) => (a.id === item.id ? item : a)) : [...prev, item],
      );
    } else {
      const item: ActivityValues = {
        ...draft,
        reviewStatus: 'reviewed',
        sourceType: draft.sourceType ?? 'manual',
      };
      setActivities((prev) =>
        prev.some((a) => a.id === item.id) ? prev.map((a) => (a.id === item.id ? item : a)) : [...prev, item],
      );
    }
    setEditingDraft(null);
    if (resumeReviewAfterEdit) {
      setResumeReviewAfterEdit(false);
      setReviewOpen(true);
    }
  }

  function closeEdit() {
    setEditingDraft(null);
    if (resumeReviewAfterEdit) {
      setResumeReviewAfterEdit(false);
      setReviewOpen(true);
    }
  }

  function openEdit(draft: EvidenceDraft, fromReview: boolean) {
    if (fromReview) {
      setReviewOpen(false);
      setResumeReviewAfterEdit(true);
    }
    setEditingDraft(draft);
  }

  function removeItem(kind: 'achievement' | 'activity', id: string | undefined) {
    if (kind === 'achievement') setAchievements((prev) => prev.filter((a) => a.id !== id));
    else setActivities((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    const payload = {
      achievements: achievements.filter((a) => a.title.trim().length > 0),
      activities: activities.filter((a) => a.title.trim().length > 0),
      ...(applicationId ? { applicationId } : {}),
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

      // The step used to hand off straight to `returnTo` (normally the
      // analysis gate) or the standalone report page. It now always goes
      // through Personal Reflection next, then Review & Confirm — carrying
      // the same eventual destination through as `return` so each step
      // sends the student on to exactly where this step used to.
      const confirmReturn = returnTo || '/ai-strategy/report';
      router.push(`/ai-strategy/reflection/personal?return=${encodeURIComponent(confirmReturn)}`);
    } catch {
      setError(t('We could not save that. Please try again.'));
      setSaving(false);
    }
  }

  function sortLabel(value: EvidenceSort): string {
    switch (value) {
      case 'recent':
        return t('Most recent');
      case 'oldest':
        return t('Oldest');
      case 'type':
        return t('Achievement type');
      case 'reviewed_first':
        return t('Reviewed first');
      case 'needs_review_first':
        return t('Needs review first');
    }
  }

  const sortOptions = SORT_OPTION_KEYS.map((value) => ({ value, label: sortLabel(value) }));

  const sortedAchievements = sortByRecency(achievements, sort, {
    category: (a) => a.category,
    needsReview: (a) => a.reviewStatus === 'needs_review',
  });
  const sortedActivities = sortByRecency(activities, sort, {
    category: (a) => a.category,
    needsReview: (a) => a.reviewStatus === 'needs_review',
  });

  const cardLabels = {
    edit: (title: string) => t('Edit {title}', { title }),
    remove: (title: string) => t('Remove {title}', { title }),
    extractedFrom: (fileName: string) => t('Extracted from {fileName}', { fileName }),
    addedManually: t('Added manually'),
    needsReview: t('Please check this'),
    reviewed: t('Reviewed'),
    possibleDuplicate: t('Possible duplicate'),
  };

  const hasExistingEvidence = achievements.length > 0 || activities.length > 0;

  const activeReflectItem = reflectTarget ? findItem(reflectTarget.kind, reflectTarget.id) : undefined;
  const activeCardItem = cardTarget ? findItem(cardTarget.kind, cardTarget.id) : undefined;
  const activeDimension = REFLECTION_DIMENSIONS[dimensionIndex] ?? 'context';

  const breadcrumbItems: ReflectionBreadcrumbItem[] = [
    ...(applicationLabel ? [{ label: applicationLabel, onClick: returnTo ? () => router.push(returnTo) : undefined }] : []),
    reflectTarget || cardTarget
      ? { label: t('Experiences'), onClick: () => (reflectTarget ? setReflectTarget(null) : setCardTarget(null)) }
      : { label: t('Experiences') },
    ...(reflectTarget && activeReflectItem
      ? [
          { label: activeReflectItem.title, onClick: () => setReflectTarget(null) },
          { label: t(DIMENSION_LABELS[activeDimension]) },
        ]
      : []),
    ...(cardTarget && activeCardItem
      ? [
          { label: activeCardItem.title, onClick: () => setCardTarget(null) },
          { label: t('Reflection Card') },
        ]
      : []),
  ];

  const mobileBreadcrumb = reflectTarget && activeReflectItem
    ? {
        backLabel: activeReflectItem.title,
        onBack: () => setReflectTarget(null),
        title: t(DIMENSION_LABELS[activeDimension]),
        meta: t('{current} of {total}', { current: dimensionIndex + 1, total: REFLECTION_DIMENSIONS.length }),
      }
    : cardTarget && activeCardItem
      ? {
          backLabel: activeCardItem.title,
          onBack: () => setCardTarget(null),
          title: t('Reflection Card'),
        }
      : undefined;

  return (
    <ReflectionShell step="evidence">
      <div className="flex flex-col gap-gb-3xl">
        <ReflectionBreadcrumb items={breadcrumbItems} mobile={mobileBreadcrumb} />

        {hasExistingEvidence && reviewQueue.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-gb-lg rounded-gb-xl border border-line bg-surface-muted px-gb-xl py-gb-lg">
            <p className="text-gb-sm text-fg-secondary">
              {t('Your achievements and activities are already filled in from your profile.')}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => void handleSubmit()}
            >
              {t('Skip — my achievements are still correct')}
            </Button>
          </div>
        ) : null}

        <DocumentPanel
          onFiles={(files) => void handleFiles(files)}
          disabled={processing.kind === 'uploading' || processing.kind === 'analysing'}
          accept=".pdf,.doc,.docx"
          dropzoneLabel={t('Upload a CV or certificate PDF')}
          dropzoneHint={t('or drag and drop')}
          heading={t('Upload your achievements')}
          description={t(
            'Upload your CV or certificate PDFs and we’ll automatically extract your achievements.',
          )}
          documents={documents}
          processing={processing}
          onPreview={(document) => {
            setPreview({ document, url: null });
            void signedUrl(document.storageKey).then((url) => setPreview({ document, url }));
          }}
          onRename={(document) => {
            setRenameTarget(document);
            setRenameValue(document.fileName);
          }}
          onReprocess={(document) => void runExtraction([document.id])}
          onRemove={(document) =>
            setRemoveTarget({
              title: t('Remove this document?'),
              description: t(
                'Achievements already saved to your profile will remain.',
              ),
              onConfirm: () => void removeDocument(document.id),
            })
          }
          onAddManually={() => setCategoryChooserOpen(true)}
          labels={{
            recentlyUploaded: t('Recently uploaded'),
            noDocuments: t('You can upload multiple PDFs. Each file up to 10MB.'),
            preview: t('Preview'),
            rename: t('Rename'),
            reprocess: t('Reprocess'),
            remove: t('Remove'),
            menu: t('More options'),
            uploading: (fileName: string) => t('Uploading {fileName}', { fileName }),
            analysing: t('Finding achievements…'),
            complete: (count: number) => t('{count} achievements found', { count }),
            completeHint: t('We’ve extracted achievements from your document.'),
            noResults: t('We couldn’t find any clear achievements in this document.'),
            addManually: t('Add one manually'),
            error: t('We couldn’t read that document. Try uploading another copy.'),
          }}
        />

        <DuplicatePrompt duplicates={duplicates} onMerge={resolveMerge} onKeepBoth={resolveKeepBoth} t={t} />

        <div className="flex flex-wrap items-center justify-between gap-gb-lg">
          <EvidenceTabs
            active={activeTab}
            onSelect={setActiveTab}
            academicLabel={t('Academic achievements')}
            extracurricularLabel={t('Extracurricular activities')}
            academicCount={achievements.length}
            extracurricularCount={activities.length}
          />
          <div className="flex items-center gap-gb-lg">
            {reviewQueue.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setReviewTotal(reviewQueue.length);
                  setReviewOpen(true);
                }}
              >
                {t('Review achievements ({count})', { count: reviewQueue.length })}
              </Button>
            ) : null}
            <EvidenceSortSelect value={sort} onChange={setSort} label={t('Sort by:')} options={sortOptions} />
          </div>
        </div>

        {activeTab === 'academic' ? (
          sortedAchievements.length === 0 ? (
            <EvidenceEmptyState
              icon="graduationCap"
              heading={t('No academic achievements yet')}
              hint={t('Upload a CV or certificate, or add one manually.')}
              addLabel={t('Add achievement')}
              onAdd={() => setCategoryChooserOpen(true)}
            />
          ) : (
            <div className="flex flex-col gap-gb-2xl">
              {groupByExperienceCategory(sortedAchievements, (item) =>
                experienceCategoryFor('achievement', item.category),
              ).map((group) => (
                <div key={group.category} className="flex flex-col gap-gb-lg">
                  <ExperienceCategorySectionHeading category={group.category} count={group.items.length} t={t} />
                  <EvidenceGrid>
                    {group.items.map((item) => (
                      <AchievementCard
                        key={item.id}
                        item={item}
                        icon={ACHIEVEMENT_CATEGORY_ICON[item.category]}
                        labels={cardLabels}
                        onEdit={() => openEdit({ kind: 'achievement', ...item }, false)}
                        onRemove={() =>
                          setRemoveTarget({
                            title: t('Remove this achievement?'),
                            description: t(
                              'This will remove it from your GlowBal profile, but not from your uploaded document.',
                            ),
                            onConfirm: () => removeItem('achievement', item.id),
                          })
                        }
                        reflect={reflectActionFor('achievement', item)}
                      />
                    ))}
                  </EvidenceGrid>
                </div>
              ))}
            </div>
          )
        ) : sortedActivities.length === 0 ? (
          <EvidenceEmptyState
            icon="usersTwo"
            heading={t('No extracurricular activities yet')}
            hint={t('Upload a document or add an activity manually.')}
            addLabel={t('Add activity')}
            onAdd={() => setCategoryChooserOpen(true)}
          />
        ) : (
          <div className="flex flex-col gap-gb-2xl">
            {groupByExperienceCategory(sortedActivities, (item) => experienceCategoryFor('activity', item.category)).map(
              (group) => (
                <div key={group.category} className="flex flex-col gap-gb-lg">
                  <ExperienceCategorySectionHeading category={group.category} count={group.items.length} t={t} />
                  <EvidenceGrid>
                    {group.items.map((item) => (
                      <ActivityCard
                        key={item.id}
                        item={item}
                        icon={ACTIVITY_CATEGORY_ICON[item.category]}
                        labels={cardLabels}
                        onEdit={() => openEdit({ kind: 'activity', ...item }, false)}
                        onRemove={() =>
                          setRemoveTarget({
                            title: t('Remove this activity?'),
                            description: t(
                              'This will remove it from your GlowBal profile, but not from your uploaded document.',
                            ),
                            onConfirm: () => removeItem('activity', item.id),
                          })
                        }
                        reflect={reflectActionFor('activity', item)}
                      />
                    ))}
                  </EvidenceGrid>
                </div>
              ),
            )}
          </div>
        )}

        <p className="self-start">
          <button
            type="button"
            onClick={() => setCategoryChooserOpen(true)}
            className="text-gb-sm font-semibold text-fg-brand hover:underline"
          >
            + {activeTab === 'academic' ? t('Add achievement') : t('Add activity')}
          </button>
        </p>

        {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}

        {finishWarningShown ? (
          <div className="flex flex-wrap items-center justify-between gap-gb-lg rounded-gb-xl border border-line bg-surface-muted p-gb-xl">
            <p className="text-gb-sm text-fg-secondary">
              {t('You still have {count} extracted achievements to review.', {
                count: reviewQueue.length,
              })}
            </p>
            <div className="flex gap-gb-md">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setFinishWarningShown(false);
                  setReviewTotal(reviewQueue.length);
                  setReviewOpen(true);
                }}
              >
                {t('Review first')}
              </Button>
              <Button type="button" onClick={() => void handleSubmit()}>
                {t('Continue anyway')}
              </Button>
            </div>
          </div>
        ) : (
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
              {t('Back')}
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={saving}
              className="min-w-64"
              onClick={() => {
                if (reviewQueue.length > 0) {
                  setFinishWarningShown(true);
                  return;
                }
                void handleSubmit();
              }}
            >
              {saving ? t('Saving…') : t('Review & Confirm')}
            </Button>
          </div>
        )}
      </div>

      <EditEvidenceModal
        open={editingDraft !== null}
        draft={editingDraft}
        onClose={closeEdit}
        onSave={saveDraft}
        t={t}
      />

      <ExperienceCategoryChooser
        open={categoryChooserOpen}
        onClose={() => setCategoryChooserOpen(false)}
        onChoose={(subtype) => {
          setCategoryChooserOpen(false);
          setEditingDraft(
            subtype.kind === 'achievement'
              ? { kind: 'achievement', id: newId(), category: subtype.category as AchievementValues['category'], title: '' }
              : { kind: 'activity', id: newId(), category: subtype.category as ActivityValues['category'], title: '' },
          );
        }}
        t={t}
      />

      <RemoveConfirmDialog
        open={removeTarget !== null}
        title={removeTarget?.title ?? ''}
        description={removeTarget?.description ?? ''}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          removeTarget?.onConfirm();
          setRemoveTarget(null);
        }}
        t={t}
      />

      <ReviewFlowDrawer
        open={reviewOpen}
        queue={reviewQueue}
        total={reviewTotal}
        onKeep={(item) => {
          if (item.kind === 'achievement') {
            setAchievements((prev) =>
              prev.map((a) => (a.id === item.id ? { ...a, reviewStatus: 'reviewed' } : a)),
            );
          } else {
            setActivities((prev) =>
              prev.map((a) => (a.id === item.id ? { ...a, reviewStatus: 'reviewed' } : a)),
            );
          }
        }}
        onEdit={(item) => openEdit(item, true)}
        onRemove={(item) => removeItem(item.kind, item.id)}
        onClose={() => setReviewOpen(false)}
        t={t}
      />

      <DocumentPreviewDrawer
        open={preview !== null}
        onClose={() => setPreview(null)}
        fileName={preview?.document.fileName ?? ''}
        url={preview?.url ?? null}
        closeLabel={t('Close')}
      />

      <Modal
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        label={t('Rename')}
        className="max-w-gb-width-sm p-gb-3xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!renameTarget) return;
            void rename(renameTarget.id, renameValue).then((ok) => {
              if (ok) setRenameTarget(null);
            });
          }}
          className="flex flex-col gap-gb-xl"
        >
          <h2 className="text-gb-lg font-semibold text-fg">{t('Rename')}</h2>
          <Input
            name="rename-file"
            label={t('File name')}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            required
          />
          <div className="flex justify-end gap-gb-md">
            <Button type="button" variant="secondary" onClick={() => setRenameTarget(null)}>
              {t('Cancel')}
            </Button>
            <Button type="submit" disabled={!renameValue.trim()}>
              {t('Save changes')}
            </Button>
          </div>
        </form>
      </Modal>

      {reflectTarget
        ? (() => {
            const item = findItem(reflectTarget.kind, reflectTarget.id);
            if (!item) return null;
            const category = experienceCategoryForKind(reflectTarget.kind, item.category);
            return (
              <ActivityReflectionModal
                open
                onClose={() => setReflectTarget(null)}
                category={category}
                activityTitle={item.title}
                value={item.reflection ?? activityReflectionSchema.parse({})}
                onChange={(next) => updateItem(reflectTarget.kind, reflectTarget.id, { reflection: next })}
                dimensionIndex={dimensionIndex}
                onDimensionIndexChange={setDimensionIndex}
                onAutosave={persistEvidence}
                onRequestCard={() => {
                  const { kind, id } = reflectTarget;
                  setReflectTarget(null);
                  void generateCard(kind, id);
                }}
                t={t}
              />
            );
          })()
        : null}

      <Modal
        open={cardTarget !== null}
        onClose={() => (cardState === 'loading' ? undefined : setCardTarget(null))}
        label={t('Reflection Card')}
        className="max-w-gb-width-md p-gb-3xl"
      >
        {cardTarget && cardState === 'loading' ? <ReflectionCardLoading t={t} /> : null}
        {cardTarget && cardState === 'error' ? (
          <ReflectionCardError
            message={cardError ?? ''}
            onRetry={() => void generateCard(cardTarget.kind, cardTarget.id)}
            t={t}
          />
        ) : null}
        {cardTarget && cardState === 'ready'
          ? (() => {
              const item = findItem(cardTarget.kind, cardTarget.id);
              if (!item?.reflectionCard) return null;
              return (
                <ReflectionCardView
                  card={item.reflectionCard}
                  editable
                  onSave={(next) => saveCard(cardTarget.kind, cardTarget.id, next)}
                  onRegenerate={() => void generateCard(cardTarget.kind, cardTarget.id)}
                  onConfirm={() => confirmCard(cardTarget.kind, cardTarget.id)}
                  t={t}
                />
              );
            })()
          : null}
      </Modal>
    </ReflectionShell>
  );
}
