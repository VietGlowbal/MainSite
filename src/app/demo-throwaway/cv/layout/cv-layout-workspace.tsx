'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ICONS, KitIcon } from '@/shared/ui';
import type { CvLayoutKey } from '@/features/application-strategy/domain';
import { CvSteps, Panel, PanelHeader, StateBlock } from '../../demo-ui';
import {
  DEMO_LAYOUTS,
  FAKE_EXPORT_MS,
  SECTION_LABELS,
  makeStructuredCv,
  recommendLayout,
  type Scenario,
} from '../../fixtures';

/**
 * THROWAWAY DEMO — "Layout - PDF". Delete with the folder.
 *
 * Two things worth pointing at while demoing:
 *
 *  - Selection is a real radiogroup, and "Selected" is conveyed by border AND a
 *    check icon AND the visible word. Colour alone would fail for anyone who
 *    cannot distinguish the border tint, and the spec calls this out explicitly.
 *  - The three layouts differ in section ORDER, not in label. Switching between
 *    them visibly rearranges the preview, which is the test of whether the three
 *    options are genuinely different or just three names for one template.
 */
export function CvLayoutWorkspace({ scenario }: { scenario: Scenario }) {
  const cv = makeStructuredCv(scenario);
  const recommendation = recommendLayout();

  const [selected, setSelected] = useState<CvLayoutKey | null>(cv?.selectedLayout ?? null);
  const [exportState, setExportState] = useState<
    'none' | 'generating' | 'ready' | 'failed' | 'outdated'
  >(() => {
    if (!cv || cv.lastExportedVersion === null) return 'none';
    return cv.lastExportedVersion === cv.contentVersion ? 'ready' : 'outdated';
  });
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);

  const layout = DEMO_LAYOUTS.find((l) => l.key === selected) ?? null;

  function exportPdf(fail = false) {
    setExportState('generating');
    setTimeout(() => setExportState(fail ? 'failed' : 'ready'), FAKE_EXPORT_MS);
  }

  return (
    <div className="flex flex-col gap-gb-3xl">
      <CvSteps current="layout" />

      <header className="flex flex-col gap-gb-md">
        <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
          Layout và PDF
        </h1>
        <p className="max-w-3xl text-gb-md text-fg-tertiary">
          Ba layout khác nhau ở thứ tự các mục, không chỉ ở kiểu chữ. Chọn một layout để xem
          trước, sau đó xuất PDF.
        </p>
      </header>

      {/* ── Layout cards ── */}

      <div role="radiogroup" aria-label="CV layout" className="grid gap-gb-2xl md:grid-cols-3">
        {DEMO_LAYOUTS.map((option) => {
          const isSelected = selected === option.key;
          const isRecommended = recommendation.key === option.key;

          return (
            <div
              key={option.key}
              role="radio"
              tabIndex={0}
              aria-checked={isSelected}
              onClick={() => setSelected(option.key)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setSelected(option.key);
                }
              }}
              className={`flex cursor-pointer flex-col gap-gb-lg rounded-gb-2xl border-2 p-gb-2xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                isSelected
                  ? 'border-brand bg-brand-subtle'
                  : 'border-line bg-surface hover:border-line-strong hover:bg-surface-hover'
              }`}
            >
              <div className="flex items-start justify-between gap-gb-md">
                <span className="text-gb-md font-semibold text-fg">{option.label}</span>
                {/* Border + icon + word. All three, deliberately. */}
                {isSelected ? (
                  <span className="inline-flex shrink-0 items-center gap-gb-xs text-gb-xs font-semibold text-fg-brand">
                    <KitIcon art={ICONS.checkCircle} frame={14} />
                    Selected
                  </span>
                ) : null}
              </div>

              {isRecommended ? (
                <span className="inline-flex w-fit items-center gap-gb-xs rounded-gb-full bg-surface px-gb-lg py-gb-xxs text-gb-xs font-semibold text-fg-brand">
                  <KitIcon art={ICONS.zapFast} frame={12} />
                  AI recommended
                </span>
              ) : null}

              <p className="text-gb-sm text-fg-tertiary">{option.summary}</p>

              <ol className="flex flex-col gap-gb-xxs text-gb-xs text-fg-muted">
                {option.order.slice(0, 5).map((kind, i) => (
                  <li key={kind}>
                    {i + 1}. {SECTION_LABELS[kind]}
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>

      {/* One short sentence, built from real target profile content. */}
      <p className="rounded-gb-xl border border-line bg-surface-muted p-gb-2xl text-gb-sm text-fg-secondary">
        <strong className="font-semibold text-fg">Vì sao đề xuất {
          DEMO_LAYOUTS.find((l) => l.key === recommendation.key)?.label
        }: </strong>
        {recommendation.reason}
      </p>

      {selected === null ? (
        <StateBlock
          title="Chưa chọn layout"
          body="Chọn một layout ở trên để xem trước và xuất PDF."
        />
      ) : null}

      {/* ── Preview ── */}

      {layout ? (
        <Panel>
          <PanelHeader
            title="Xem trước"
            description={`A4 · ${layout.columns === 2 ? 'hai cột' : 'một cột'} · 2 trang`}
            aside={
              <div className="flex items-center gap-gb-md">
                <button
                  type="button"
                  aria-label="Zoom out"
                  onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
                  className="flex size-gb-5xl items-center justify-center rounded-gb-md border border-line-strong bg-surface text-gb-sm text-fg-secondary hover:bg-surface-hover"
                >
                  −
                </button>
                <span className="w-12 text-center text-gb-xs text-fg-muted">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  aria-label="Zoom in"
                  onClick={() => setZoom((z) => Math.min(1.4, z + 0.2))}
                  className="flex size-gb-5xl items-center justify-center rounded-gb-md border border-line-strong bg-surface text-gb-sm text-fg-secondary hover:bg-surface-hover"
                >
                  +
                </button>
              </div>
            }
          />

          <div className="overflow-x-auto rounded-gb-xl bg-surface-muted p-gb-2xl">
            <div
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              className="mx-auto w-[520px] rounded-gb-sm border border-line bg-surface p-gb-3xl shadow-none"
            >
              <p className="mb-gb-lg border-b border-line pb-gb-md text-gb-md font-semibold text-fg">
                Nguyễn Minh Anh
              </p>

              <div className={layout.columns === 2 ? 'grid grid-cols-2 gap-gb-2xl' : ''}>
                {layout.order
                  .filter((kind) => cv?.sections.some((s) => s.kind === kind))
                  .map((kind) => {
                    const section = cv?.sections.find((s) => s.kind === kind);
                    if (!section || kind === 'contact') return null;
                    const emphasised = layout.emphasise.includes(kind);

                    return (
                      <div key={kind} className="mb-gb-xl break-inside-avoid">
                        <p
                          className={`mb-gb-xs text-gb-xs tracking-wide uppercase ${
                            emphasised ? 'font-bold text-fg' : 'font-semibold text-fg-tertiary'
                          }`}
                        >
                          {SECTION_LABELS[kind]}
                        </p>
                        {section.entries.map((entry) => (
                          <div key={entry.id} className="mb-gb-md">
                            <p className="text-gb-xs font-semibold text-fg-secondary">
                              {entry.role || entry.organization}
                            </p>
                            {entry.bullets.slice(0, emphasised ? 3 : 1).map((b, i) => (
                              <p key={i} className="text-gb-xs leading-snug text-fg-muted">
                                • {b}
                              </p>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="mt-gb-xl flex items-center justify-center gap-gb-lg">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-gb-md border border-line-strong bg-surface px-gb-lg py-gb-md text-gb-xs font-semibold text-fg-secondary hover:bg-surface-hover disabled:opacity-40"
            >
              Trang trước
            </button>
            <span className="text-gb-xs text-fg-muted">Trang {page} / 2</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(2, p + 1))}
              disabled={page === 2}
              className="rounded-gb-md border border-line-strong bg-surface px-gb-lg py-gb-md text-gb-xs font-semibold text-fg-secondary hover:bg-surface-hover disabled:opacity-40"
            >
              Trang sau
            </button>
          </div>
        </Panel>
      ) : null}

      {/* ── Export states ── */}

      {exportState === 'generating' ? (
        <StateBlock title="Generating PDF" body="Đang dựng file theo layout bạn chọn." busy />
      ) : null}

      {exportState === 'outdated' ? (
        <StateBlock
          tone="attention"
          title="Export outdated"
          body={`Bản PDF gần nhất dựng từ phiên bản ${cv?.lastExportedVersion}, CV hiện tại là phiên bản ${cv?.contentVersion}.`}
          action={{ label: 'Xuất lại PDF', onClick: () => exportPdf(false) }}
          secondary={{ label: 'Tải bản cũ', onClick: () => undefined }}
        />
      ) : null}

      {exportState === 'failed' ? (
        <StateBlock
          tone="error"
          title="Không xuất được PDF"
          body="Nội dung CV của bạn vẫn được lưu nguyên."
          action={{ label: 'Retry export', onClick: () => exportPdf(false) }}
          secondary={{ label: 'Return to Content', onClick: () => undefined }}
        />
      ) : null}

      {exportState === 'ready' ? (
        <StateBlock
          title="PDF ready"
          body={`CV-NguyenMinhAnh-${layout?.key ?? 'technical'}-v${cv?.contentVersion ?? 1}.pdf`}
          action={{ label: 'Download PDF', onClick: () => undefined }}
          secondary={{ label: 'Print CV', onClick: () => undefined }}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-gb-xl">
        {exportState === 'none' && selected !== null ? (
          <button
            type="button"
            onClick={() => exportPdf(false)}
            className="rounded-gb-md bg-brand px-gb-3xl py-gb-lg text-gb-sm font-semibold text-on-brand hover:bg-brand-hover"
          >
            Xuất PDF
          </button>
        ) : null}

        <Link
          href={`/demo-throwaway/statement?scenario=${scenario}`}
          className="rounded-gb-md border border-line-strong bg-surface px-gb-xl py-gb-lg text-gb-sm font-semibold text-fg-secondary hover:bg-surface-hover"
        >
          Tiếp tục sang Personal Statement
        </Link>

        <button
          type="button"
          onClick={() => exportPdf(true)}
          className="text-gb-xs text-fg-muted underline decoration-line underline-offset-4 hover:text-fg-tertiary"
        >
          Demo: lỗi xuất PDF
        </button>
      </div>
    </div>
  );
}
