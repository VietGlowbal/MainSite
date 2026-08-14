'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ACHIEVEMENT_CATEGORY_ICON,
  ACTIVITY_CATEGORY_ICON,
  evidenceCandidateToItem,
  evidenceExtractionResponseSchema,
  mergeDuplicate,
  reflectionStep,
  type AchievementValues,
  type ActivityValues,
  type EvidenceDuplicate,
  applyEvidenceCandidates as applyEvidenceCandidatesRaw,
} from '@/features/apply/domain';
import { useDocumentUpload, useEvidenceDocuments, type EvidenceDocument } from '@/features/apply/hooks';
import {
  AchievementCard,
  ActivityCard,
  AddTypeChooser,
  DocumentPanel,
  DocumentPreviewDrawer,
  DuplicatePrompt,
  EditEvidenceModal,
  EvidenceEmptyState,
  EvidenceGrid,
  EvidenceSortSelect,
  EvidenceTabs,
  RemoveConfirmDialog,
  ReflectionShell,
  ReviewFlowDrawer,
  type EvidenceDraft,
  type EvidenceSort,
  type EvidenceTabKey,
  type ProcessingState,
} from '@/features/apply/ui';
import { useT } from '@/lib/i18n';
import { Button, Input, Modal } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

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
  const [addChooserOpen, setAddChooserOpen] = useState(false);
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

  useLoadingIndicator(saving, t('Saving your achievements'));

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
      // through Review & Confirm first — the checkpoint that locks candidate
      // information before reports are generated — carrying the same
      // eventual destination through as `return` so confirming sends the
      // student on to exactly where this step used to.
      const confirmReturn = returnTo || '/ai-strategy/report';
      router.push(`/ai-strategy/reflection/confirm?return=${encodeURIComponent(confirmReturn)}`);
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

  return (
    <ReflectionShell step="evidence">
      <div className="flex flex-col gap-gb-3xl">
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
          onAddManually={() => setAddChooserOpen(true)}
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
              onAdd={() => setAddChooserOpen(true)}
            />
          ) : (
            <EvidenceGrid>
              {sortedAchievements.map((item) => (
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
                />
              ))}
            </EvidenceGrid>
          )
        ) : sortedActivities.length === 0 ? (
          <EvidenceEmptyState
            icon="usersTwo"
            heading={t('No extracurricular activities yet')}
            hint={t('Upload a document or add an activity manually.')}
            addLabel={t('Add activity')}
            onAdd={() => setAddChooserOpen(true)}
          />
        ) : (
          <EvidenceGrid>
            {sortedActivities.map((item) => (
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
              />
            ))}
          </EvidenceGrid>
        )}

        <p className="self-start">
          <button
            type="button"
            onClick={() => setAddChooserOpen(true)}
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

      <AddTypeChooser
        open={addChooserOpen}
        onClose={() => setAddChooserOpen(false)}
        onChooseAcademic={() => {
          setAddChooserOpen(false);
          setEditingDraft({ kind: 'achievement', id: newId(), category: 'academic_award', title: '' });
        }}
        onChooseExtracurricular={() => {
          setAddChooserOpen(false);
          setEditingDraft({ kind: 'activity', id: newId(), category: 'community_project', title: '' });
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
    </ReflectionShell>
  );
}
