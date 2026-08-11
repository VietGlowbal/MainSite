'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useT } from '@/lib/i18n';
import { Badge, Button, ICONS, KitIcon } from '@/shared/ui';
import {
  CV_LAYOUTS,
  applyLayoutOrder,
  countEntries,
  cvLayout,
  isEmphasised,
  sectionTitle,
  type CvLayoutKey,
  type LayoutRecommendation,
  type StructuredCv,
} from '../domain';
import { CvSteps } from './cv-steps';
import { StrategyPanel } from './panel';
import { ExportFailedState, ExportOutdatedState, GeneratingState, StateBlock } from './states';

/**
 * "Layout - PDF" — CV step 4. Choose a presentation, preview it, export it.
 *
 * SELECTION IS NEVER COMMUNICATED BY COLOUR ALONE. Each card carries a border
 * change, a check icon, AND the visible word "Selected". The requirement is
 * explicit and the reason is ordinary: a student who cannot separate rose from
 * grey, or who is looking at a washed-out laptop screen in daylight, still has to
 * know which of three cards is chosen.
 *
 * IT IS A REAL RADIOGROUP. `role="radiogroup"` with `role="radio"` children and
 * arrow-key navigation, rather than three buttons — so a screen reader announces
 * "2 of 3" and the whole group is one tab stop instead of three.
 */

export type CvLayoutWorkspaceProps = {
  applicationId: string;
  cv: StructuredCv | null;
  recommendation: LayoutRecommendation;
  /** From domain/staleness: the stored PDF is behind the current content. */
  exportOutdated: boolean;
  candidateName: string | null;
};

type ExportState =
  | { kind: 'idle' }
  | { kind: 'generating' }
  | { kind: 'ready'; url: string | null; fileName: string; contentVersion: number }
  | { kind: 'failed' };

export function CvLayoutWorkspace({
  applicationId,
  cv,
  recommendation,
  exportOutdated,
  candidateName,
}: CvLayoutWorkspaceProps) {
  const t = useT();
  const [selected, setSelected] = useState<CvLayoutKey | null>(cv?.selectedLayout ?? null);
  const [exportState, setExportState] = useState<ExportState>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);
  const radioRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const hasContent = cv != null && countEntries(cv.sections) > 0;
  /** Nothing chosen yet, so the preview shows what we would recommend. */
  const previewLayout = selected ?? recommendation.key;

  const selectLayout = useCallback(
    async (key: CvLayoutKey) => {
      setSelected(key);
      // A new layout invalidates a PDF built from the old one.
      setExportState({ kind: 'idle' });
      setSaving(true);
      try {
        await fetch(`/api/applications/${applicationId}/cv`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedLayout: key }),
        });
      } catch {
        // The selection stays applied locally. Export sends the layout explicitly,
        // so a failed persist costs the student nothing in this session.
      } finally {
        setSaving(false);
      }
    },
    [applicationId],
  );

  /** Arrow keys move between cards, which is what a radiogroup is expected to do. */
  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    if (!forward && !back) return;

    event.preventDefault();
    const next = (index + (forward ? 1 : -1) + CV_LAYOUTS.length) % CV_LAYOUTS.length;
    const target = CV_LAYOUTS[next];
    if (!target) return;
    radioRefs.current[next]?.focus();
    void selectLayout(target.key);
  }

  async function runExport() {
    setExportState({ kind: 'generating' });
    try {
      const response = await fetch(`/api/applications/${applicationId}/cv/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: previewLayout }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string | null;
        fileName?: string;
        contentVersion?: number;
      };

      if (!response.ok || !data.ok) {
        setExportState({ kind: 'failed' });
        return;
      }

      setExportState({
        kind: 'ready',
        url: data.url ?? null,
        fileName: data.fileName ?? 'CV.pdf',
        contentVersion: data.contentVersion ?? 0,
      });
    } catch {
      setExportState({ kind: 'failed' });
    }
  }

  return (
    <div className="flex flex-col gap-gb-3xl">
      <CvSteps applicationId={applicationId} current="layout" furthestReached="layout" />

      <header className="flex flex-col gap-gb-lg">
        <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
          Layout - PDF
        </h1>
        <p className="max-w-3xl text-gb-md text-fg-tertiary">
          {t('The same content, three different presentations. Each layout brings different sections forward and prints different levels of detail.')}
        </p>
      </header>

      {!hasContent ? (
        <StateBlock
          title={t('No CV content to export')}
          body={t('Enter CV content first, then return to choose a layout.')}
          action={{ label: t('Enter CV content'), href: `/ai-strategy/${applicationId}/cv/content` }}
        />
      ) : null}

      {hasContent ? (
        <>
          <div
            role="radiogroup"
            aria-label="CV layout"
            className="grid gap-gb-2xl md:grid-cols-3"
          >
            {CV_LAYOUTS.map((def, index) => {
              const isSelected = selected === def.key;
              const isRecommended = recommendation.key === def.key;

              return (
                <button
                  key={def.key}
                  ref={(node) => {
                    radioRefs.current[index] = node;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  /* One tab stop for the group: the selected card, or the first. */
                  tabIndex={isSelected || (!selected && index === 0) ? 0 : -1}
                  onClick={() => void selectLayout(def.key)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  className={`flex flex-col gap-gb-lg rounded-gb-2xl border bg-surface p-gb-2xl text-left transition-colors hover:border-line-strong hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    isSelected ? 'border-brand' : 'border-line'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-gb-md">
                    <span className="text-gb-md font-semibold text-fg">{t(def.label)}</span>
                    {isRecommended ? <Badge variant="brand-chip">AI recommended</Badge> : null}
                  </div>

                  <p className="text-gb-sm text-fg-tertiary">{t(def.blurb)}</p>

                  <LayoutShapePreview layoutKey={def.key} />

                  {/*
                    Border + icon + the word "Selected". Three independent signals,
                    because selection must not depend on colour alone.
                  */}
                  <span
                    className={`inline-flex items-center gap-gb-xs text-gb-xs font-semibold ${
                      isSelected ? 'text-fg-brand' : 'text-fg-muted'
                    }`}
                  >
                    <KitIcon
                      art={isSelected ? ICONS.checkCircle : ICONS.clock}
                      frame={14}
                    />
                    {t(isSelected ? 'Selected' : 'Not selected')}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Real strategy information, not model prose — deterministic, so it says
              the same thing every time the student looks. */}
          <div className="flex items-start gap-gb-md rounded-gb-xl border border-line bg-surface-muted p-gb-2xl">
            <span aria-hidden className="shrink-0 pt-gb-xxs text-fg-brand">
              <KitIcon art={ICONS.zapFast} frame={16} />
            </span>
            <p className="text-gb-sm text-fg-secondary">{recommendation.reason}</p>
          </div>

          {selected && recommendation.key !== selected ? (
            <p className="text-gb-xs text-fg-muted">
              {t('You selected')} {t(cvLayout(selected).label)}, {t('which differs from our recommendation. That is completely fine — you know your profile best.')}
            </p>
          ) : null}

          <CvPagePreview cv={cv} layout={previewLayout} candidateName={candidateName} />

          <StrategyPanel>
            <div className="flex flex-col gap-gb-lg">
              <div className="flex flex-col gap-gb-xs">
                <h2 className="text-gb-md font-semibold text-fg">{t('Export PDF')}</h2>
                <p className="text-gb-sm text-fg-tertiary">
                  {t('The PDF has selectable text and a reading order that works with automated CV filters.')}
                </p>
              </div>

              {exportState.kind === 'generating' ? (
                <GeneratingState title={t('Generating PDF')} body={t('Rendering your CV.')} />
              ) : null}

              {exportState.kind === 'failed' ? (
                <ExportFailedState onRetry={() => void runExport()} />
              ) : null}

              {exportOutdated && exportState.kind === 'idle' ? (
                <ExportOutdatedState onRetry={() => void runExport()} />
              ) : null}

              {exportState.kind === 'ready' ? (
                <div className="flex flex-col gap-gb-lg rounded-gb-xl border border-line bg-surface-muted p-gb-2xl">
                  <p className="flex items-center gap-gb-xs text-gb-sm font-semibold text-fg">
                    <span aria-hidden className="text-fg-verified">
                      <KitIcon art={ICONS.checkCircle} frame={14} />
                    </span>
                    {t('PDF ready')}
                  </p>
                  <div className="flex flex-wrap items-center gap-gb-lg">
                    {exportState.url ? (
                      <Button
                        size="sm"
                        href={exportState.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={exportState.fileName}
                      >
                        Download PDF
                      </Button>
                    ) : null}
                    {exportState.url ? (
                      <a
                        href={exportState.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-gb-md text-gb-sm font-medium text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg"
                      >
                        {t('Open to print')}
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void runExport()}
                      className="rounded-gb-md text-gb-sm font-medium text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {t('Generate again')}
                    </button>
                  </div>
                  <p className="text-gb-xs text-fg-muted">
                    {t('This download link expires after 10 minutes. Generate a new one anytime.')}
                  </p>
                </div>
              ) : null}

              {exportState.kind === 'idle' && !exportOutdated ? (
                <div className="flex flex-wrap items-center gap-gb-xl">
                  <Button size="lg" onClick={() => void runExport()} disabled={saving}>
                    {t('Create PDF')}
                  </Button>
                  <a
                    href={`/ai-strategy/${applicationId}/cv/content`}
                    className="rounded-gb-md text-gb-sm font-medium text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg"
                  >
                    {t('Edit content')}
                  </a>
                </div>
              ) : null}
            </div>
          </StrategyPanel>

          <div className="flex flex-wrap items-center gap-gb-xl">
            <Button size="lg" variant="secondary" href={`/ai-strategy/${applicationId}`}>
              {t('Back to Application Strategy')}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * A tiny abstract diagram of the layout's shape.
 *
 * Bars, not real text: at card size, real text is unreadable and would only
 * suggest the student can evaluate the content from here. What they can evaluate
 * is the structure — one column or two, and what sits at the top — which is
 * exactly what the bars show. `aria-hidden` because the blurb already says it in
 * words.
 */
function LayoutShapePreview({ layoutKey }: { layoutKey: CvLayoutKey }) {
  const def = cvLayout(layoutKey);
  const bars = def.order.slice(1, 6);

  return (
    <div aria-hidden className="flex flex-col gap-gb-xs rounded-gb-md border border-line bg-surface-muted p-gb-lg">
      <div className="h-gb-xs w-2/5 rounded-gb-xs bg-fg-muted" />
      {def.columns === 2 ? (
        <div className="flex gap-gb-md">
          <div className="flex flex-1 flex-col gap-gb-xs">
            {bars.slice(0, 3).map((kind) => (
              <div key={kind} className="flex flex-col gap-gb-xxs">
                <div
                  className={`h-gb-xxs rounded-gb-xs ${isEmphasised(layoutKey, kind) ? 'w-1/2 bg-brand' : 'w-1/3 bg-line-strong'}`}
                />
                <div className="h-gb-xxs w-full rounded-gb-xs bg-line" />
                {isEmphasised(layoutKey, kind) ? (
                  <div className="h-gb-xxs w-4/5 rounded-gb-xs bg-line" />
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex w-1/3 flex-col gap-gb-xs border-l border-line pl-gb-md">
            {bars.slice(3).map((kind) => (
              <div key={kind} className="flex flex-col gap-gb-xxs">
                <div className="h-gb-xxs w-2/3 rounded-gb-xs bg-line-strong" />
                <div className="h-gb-xxs w-full rounded-gb-xs bg-line" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-gb-xs">
          {bars.map((kind) => (
            <div key={kind} className="flex flex-col gap-gb-xxs">
              <div
                className={`h-gb-xxs rounded-gb-xs ${isEmphasised(layoutKey, kind) ? 'w-2/5 bg-brand' : 'w-1/4 bg-line-strong'}`}
              />
              <div className="h-gb-xxs w-full rounded-gb-xs bg-line" />
              {isEmphasised(layoutKey, kind) ? (
                <div className="h-gb-xxs w-11/12 rounded-gb-xs bg-line" />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * An A4-proportioned preview of the real content, in the selected layout.
 *
 * Honest about what it is: it shares the section order and the emphasis rules with
 * the PDF renderer, because both read the same layout definition, but it does not
 * claim to be pixel-identical. Chasing that would mean reimplementing the PDF's
 * line breaking in CSS, and a preview that is 95% right and honest beats one that
 * is 98% right and presented as exact.
 */
function CvPagePreview({
  cv,
  layout,
  candidateName,
}: {
  cv: StructuredCv | null;
  layout: CvLayoutKey;
  candidateName: string | null;
}) {
  const t = useT();
  const [zoom, setZoom] = useState(1);

  const ordered = useMemo(
    () => (cv ? applyLayoutOrder(cv.sections, layout).filter((s) => s.entries.length > 0) : []),
    [cv, layout],
  );

  if (!cv || ordered.length === 0) return null;

  const contact = ordered.find((s) => s.kind === 'contact');
  const body = ordered.filter((s) => s.kind !== 'contact');
  const def = cvLayout(layout);
  const main = def.columns === 2 ? body.filter((s) => isEmphasised(layout, s.kind)) : body;
  const side = def.columns === 2 ? body.filter((s) => !isEmphasised(layout, s.kind)) : [];

  return (
    <StrategyPanel>
      <div className="flex flex-wrap items-center justify-between gap-gb-lg">
        <h2 className="text-gb-md font-semibold text-fg">{t('Preview')} — {t(def.label)}</h2>
        <div className="flex items-center gap-gb-md">
          <span className="text-gb-xs text-fg-muted">{t('Zoom')}</span>
          <div className="flex items-center gap-gb-xs">
            <button
              type="button"
              aria-label={t('Zoom out')}
              onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.2) * 10) / 10))}
              disabled={zoom <= 0.6}
              className="flex size-gb-4xl items-center justify-center rounded-gb-md border border-line-strong bg-surface text-gb-sm text-fg-secondary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"
            >
              −
            </button>
            <span className="w-gb-6xl text-center text-gb-xs text-fg-tertiary">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label={t('Zoom in')}
              onClick={() => setZoom((z) => Math.min(1.4, Math.round((z + 0.2) * 10) / 10))}
              disabled={zoom >= 1.4}
              className="flex size-gb-4xl items-center justify-center rounded-gb-md border border-line-strong bg-surface text-gb-sm text-fg-secondary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div
          /* A4 is 1:1.414. Fixing the aspect ratio is what makes the preview show
             the student roughly how much of a page they are using. */
          className="mx-auto aspect-[1/1.414] w-full max-w-[640px] origin-top border border-line bg-surface p-gb-3xl"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
        >
          <div className="mb-gb-xl">
            <p className="font-display text-gb-lg font-semibold text-fg">
              {candidateName || t('Curriculum Vitae')}
            </p>
            {contact ? (
              <p className="text-gb-xs text-fg-tertiary">
                {contact.entries
                  .map((e) => e.organization)
                  .filter((v): v is string => Boolean(v?.trim()))
                  .join(' · ')}
              </p>
            ) : null}
          </div>

          <div className={def.columns === 2 ? 'flex gap-gb-2xl' : ''}>
            <div className={def.columns === 2 ? 'flex-1' : ''}>
              {main.map((section) => (
                <PreviewSection key={section.id} section={section} emphasised layout={layout} />
              ))}
            </div>
            {side.length > 0 ? (
              <div className="w-1/3 border-l border-line pl-gb-xl">
                {side.map((section) => (
                  <PreviewSection key={section.id} section={section} layout={layout} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <p className="text-gb-xs text-fg-muted">
        {t('The preview uses the same section order and emphasis as the PDF. Page breaks in the PDF may differ slightly.')}
      </p>
    </StrategyPanel>
  );
}

function PreviewSection({
  section,
  emphasised,
  layout,
}: {
  section: StructuredCv['sections'][number];
  emphasised?: boolean;
  layout: CvLayoutKey;
}) {
  const detailed = emphasised && isEmphasised(layout, section.kind);
  const inline = section.kind === 'skills' || section.kind === 'interests';

  return (
    <div className="mb-gb-lg">
      <h3
        className={`mb-gb-xs border-b pb-gb-xxs text-gb-xxs font-semibold tracking-wide uppercase ${
          detailed ? 'border-brand text-fg' : 'border-line-strong text-fg-secondary'
        }`}
      >
        {sectionTitle(section)}
      </h3>

      {inline ? (
        <p className="text-gb-xxs text-fg-tertiary">
          {section.entries
            .flatMap((e) => e.bullets.filter((b) => b.trim().length > 0))
            .join(' · ')}
        </p>
      ) : (
        section.entries.map((entry) => (
          <div key={entry.id} className="mb-gb-xs">
            <p className="text-gb-xxs font-semibold text-fg">
              {[entry.role, entry.organization].filter(Boolean).join(' — ') || '—'}
              {[entry.startDate, entry.current ? 'Present' : entry.endDate].filter(Boolean).length >
              0
                ? ` (${[entry.startDate, entry.current ? 'Present' : entry.endDate].filter(Boolean).join(' – ')})`
                : ''}
            </p>
            {detailed
              ? entry.bullets
                  .filter((b) => b.trim().length > 0)
                  .map((bullet, index) => (
                    <p key={`${entry.id}-${index}`} className="text-gb-xxs text-fg-tertiary">
                      • {bullet}
                    </p>
                  ))
              : null}
          </div>
        ))
      )}
    </div>
  );
}
