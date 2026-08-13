'use client';

import { useState } from 'react';
import {
  ACHIEVEMENT_CATEGORY_ICON,
  ACTIVITY_CATEGORY_ICON,
  type AchievementValues,
  type ActivityValues,
} from '@/features/apply/domain';
import { DocumentPreviewDrawer, EvidenceGrid, EvidenceTabs, questionIcon, type EvidenceTabKey } from '@/features/apply/ui';
import { useEvidenceDocuments, type EvidenceDocument } from '@/features/apply/hooks';
import { useT } from '@/lib/i18n';
import { ICONS, KitIcon } from '@/shared/ui';

/**
 * Achievements and Documents, after confirmation — read-only.
 *
 * A dedicated view, not the editable `AchievementCard`/`ActivityCard` with
 * their actions hidden: those own an edit/remove overflow menu as a load-
 * bearing part of their layout, and disabling it in place would be exactly
 * the "disabled copy of the original form" the spec explicitly asks not to
 * ship. This is a smaller, deliberately simpler card with no buttons at all.
 *
 * ─── DOCUMENTS FOLDED IN, NOT A SEVENTH ROUTE ────────────────────────────────
 *
 * The spec's screen 6 (Confirmed Supporting Documents) shares the same
 * breadcrumb (`My Portal > Reflections > Achievements`) as screen 5, and this
 * page already renders the document list for the editable case — so the
 * read-only document list lives here too, rather than a new route whose only
 * content is a list this page already has the data for.
 */

function ReadOnlyCard({
  icon,
  title,
  organisation,
  metadata,
  description,
  sourceLabel,
}: {
  icon: string;
  title: string;
  organisation?: string | undefined;
  metadata?: string | undefined;
  description?: string | undefined;
  sourceLabel?: string | undefined;
}) {
  return (
    <article className="flex flex-col gap-gb-lg rounded-gb-xl border border-line bg-surface p-gb-xl shadow-gb-xs">
      <div className="flex items-start gap-gb-lg">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-gb-full bg-brand-subtle text-fg-brand"
        >
          <KitIcon art={questionIcon(icon)} frame={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-gb-sm font-semibold text-fg">{title}</p>
          {organisation ? (
            <p className="mt-gb-xxs truncate text-gb-xs text-fg-tertiary">{organisation}</p>
          ) : null}
        </div>
      </div>

      {metadata ? <p className="text-gb-xs text-fg-muted">{metadata}</p> : null}
      {description ? <p className="text-gb-sm text-fg-secondary">{description}</p> : null}

      {sourceLabel ? (
        <span className="flex items-center gap-gb-xs pt-gb-xs text-gb-xs font-medium text-fg-tertiary">
          <KitIcon art={ICONS.checkCircle} frame={13} />
          {sourceLabel}
        </span>
      ) : null}
    </article>
  );
}

export function ConfirmedAchievementsView({
  achievements,
  activities,
  documents,
  confirmedAt,
}: {
  achievements: AchievementValues[];
  activities: ActivityValues[];
  documents: EvidenceDocument[];
  confirmedAt: string;
}) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<EvidenceTabKey>('academic');
  const [preview, setPreview] = useState<{ document: EvidenceDocument; url: string | null } | null>(null);
  const { signedUrl } = useEvidenceDocuments(documents);

  const confirmedDate = new Date(confirmedAt).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  function sourceLabelFor(item: {
    sourceType?: 'document' | 'manual' | undefined;
    sources?: ReadonlyArray<{ fileName: string }> | undefined;
  }) {
    if (item.sourceType === 'manual') return t('Added manually');
    const fileName = item.sources?.[0]?.fileName;
    return fileName ? t('Extracted from {fileName}', { fileName }) : t('Reviewed');
  }

  return (
    <div className="flex flex-col gap-gb-2xl">
      <div className="rounded-gb-xl border border-tier-safe bg-tier-safe/10 px-gb-xl py-gb-lg">
        <p className="flex items-center gap-gb-sm text-gb-sm font-semibold text-on-tier-safe">
          <span aria-hidden="true">✓</span> {t('Confirmed achievements')}
        </p>
        <p className="mt-gb-xxs text-gb-sm text-fg-secondary">
          {t(
            'These achievements were confirmed on {date} and were included in your reports.',
            { date: confirmedDate },
          )}
        </p>
      </div>

      <EvidenceTabs
        active={activeTab}
        onSelect={setActiveTab}
        academicLabel={t('Academic achievements')}
        extracurricularLabel={t('Extracurricular activities')}
        academicCount={achievements.length}
        extracurricularCount={activities.length}
      />

      {activeTab === 'academic' ? (
        <EvidenceGrid>
          {achievements.map((item) => (
            <ReadOnlyCard
              key={item.id}
              icon={ACHIEVEMENT_CATEGORY_ICON[item.category]}
              title={item.title}
              organisation={item.competition ?? item.organisation}
              metadata={[item.year ? String(item.year) : null, item.level ?? null]
                .filter(Boolean)
                .join(' · ')}
              description={item.detail}
              sourceLabel={sourceLabelFor(item)}
            />
          ))}
        </EvidenceGrid>
      ) : (
        <EvidenceGrid>
          {activities.map((item) => (
            <ReadOnlyCard
              key={item.id}
              icon={ACTIVITY_CATEGORY_ICON[item.category]}
              title={item.title}
              organisation={item.organisation}
              metadata={[item.period ?? null, item.level ?? null].filter(Boolean).join(' · ')}
              description={item.description}
              sourceLabel={sourceLabelFor(item)}
            />
          ))}
        </EvidenceGrid>
      )}

      <div className="rounded-gb-xl border border-tier-safe bg-tier-safe/10 px-gb-xl py-gb-lg">
        <p className="flex items-center gap-gb-sm text-gb-sm font-semibold text-on-tier-safe">
          <span aria-hidden="true">✓</span> {t('Confirmed supporting documents')}
        </p>
        <p className="mt-gb-xxs text-gb-sm text-fg-secondary">
          {t(
            'These documents supported your confirmed profile and were included in your report inputs.',
          )}
        </p>
      </div>

      {documents.length === 0 ? (
        <p className="text-gb-sm text-fg-tertiary">{t('No documents were uploaded.')}</p>
      ) : (
        <ul className="flex flex-col gap-gb-md">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex items-center gap-gb-lg rounded-gb-xl border border-line p-gb-lg"
            >
              <span
                aria-hidden="true"
                className="flex size-gb-6xl shrink-0 items-center justify-center rounded-gb-md border border-line bg-surface-muted text-[0.5625rem] font-bold tracking-wide text-fg-tertiary"
              >
                PDF
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-gb-sm font-medium text-fg">{document.fileName}</p>
                <p className="text-gb-xs text-fg-tertiary">
                  {new Date(document.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreview({ document, url: null });
                  void signedUrl(document.storageKey).then((url) => setPreview({ document, url }));
                }}
                className="shrink-0 text-gb-xs font-medium text-fg-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {t('Preview {fileName}', { fileName: document.fileName })}
              </button>
            </li>
          ))}
        </ul>
      )}

      <DocumentPreviewDrawer
        open={preview !== null}
        onClose={() => setPreview(null)}
        fileName={preview?.document.fileName ?? ''}
        url={preview?.url ?? null}
        closeLabel={t('Close')}
      />

      <p className="rounded-gb-lg bg-surface-muted px-gb-lg py-gb-md text-gb-sm text-fg-tertiary">
        {t('Need to make a change? Contact GlowBal Support if something in your confirmed information is incorrect.')}
      </p>
    </div>
  );
}
