'use client';

import { useEffect, useState } from 'react';
import { ICONS, KitIcon } from '@/shared/ui';
import type { CvSection } from '@/features/application-strategy/domain';
import { Panel, StateBlock } from '../../demo-ui';
import { SECTION_LABELS, makeStructuredCv } from '../../fixtures';

/**
 * THROWAWAY DEMO — CV import and extraction confirmation. Delete with the folder.
 *
 * Two behaviours here are the reason this flow exists as its own screen rather
 * than a modal over the editor:
 *
 *  - The parsing states are tied to real phases (uploading, reading, organizing)
 *    and there is no fabricated percentage. A bar that creeps to 90% and stalls
 *    teaches students to distrust every later bar.
 *  - Import returns a DRAFT. Nothing is written until "Start with this content"
 *    is pressed, so cancelling genuinely leaves existing content untouched.
 *
 * The unreadable-PDF path is reachable from the picker — worth showing, since it
 * is the failure students actually hit and the one most likely to be handled as
 * a generic error.
 */

type Phase =
  | 'picking'
  | 'uploading'
  | 'reading'
  | 'organizing'
  | 'confirming'
  | 'unreadable'
  | 'pasting';

const PHASE_COPY: Record<'uploading' | 'reading' | 'organizing', string> = {
  uploading: 'Uploading',
  reading: 'Reading document',
  organizing: 'Organizing content',
};

/** Fields the extractor was not confident about, flagged "Please check". */
const UNCERTAIN = new Set(['e-edu-1:location', 'e-proj-2:endDate']);

export function ImportFlow({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (sections: CvSection[]) => void;
}) {
  const [phase, setPhase] = useState<Phase>('picking');
  const [pasted, setPasted] = useState('');

  const draft = makeStructuredCv('partial')?.sections ?? [];

  // Walk the parsing phases on a timer, one phase per step.
  useEffect(() => {
    if (phase === 'uploading') {
      const t = setTimeout(() => setPhase('reading'), 900);
      return () => clearTimeout(t);
    }
    if (phase === 'reading') {
      const t = setTimeout(() => setPhase('organizing'), 1100);
      return () => clearTimeout(t);
    }
    if (phase === 'organizing') {
      const t = setTimeout(() => setPhase('confirming'), 1400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [phase]);

  return (
    <div className="flex flex-col gap-gb-3xl">
      <header className="flex flex-col gap-gb-md">
        <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
          Nhập nội dung từ CV
        </h1>
        <p className="max-w-3xl text-gb-md text-fg-tertiary">
          Nội dung sẽ được tách thành từng mục để bạn kiểm tra trước khi lưu. Chưa có gì
          được ghi vào CV của bạn cho đến khi bạn xác nhận.
        </p>
      </header>

      {phase === 'picking' ? (
        <Panel>
          <div className="flex flex-col gap-gb-xl">
            <div className="flex flex-wrap items-center justify-between gap-gb-lg rounded-gb-xl border border-line bg-surface-muted p-gb-xl">
              <div className="flex items-center gap-gb-lg">
                <span aria-hidden className="text-fg-muted">
                  <KitIcon art={ICONS.uploadCloud} frame={20} />
                </span>
                <div className="flex flex-col">
                  <span className="text-gb-sm font-semibold text-fg">
                    MinhAnh-CV-2026.pdf
                  </span>
                  <span className="text-gb-xs text-fg-muted">
                    Đã tải lên 24 thg 7, 2026 · 214 KB
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPhase('uploading')}
                className="rounded-gb-md bg-brand px-gb-xl py-gb-md text-gb-sm font-semibold text-on-brand hover:bg-brand-hover"
              >
                Nhập từ file này
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-gb-xl">
              <button
                type="button"
                onClick={() => setPhase('unreadable')}
                className="text-gb-sm font-medium text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg"
              >
                Demo: file không đọc được
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="text-gb-sm font-medium text-fg-tertiary hover:text-fg"
              >
                Huỷ
              </button>
            </div>
          </div>
        </Panel>
      ) : null}

      {phase === 'uploading' || phase === 'reading' || phase === 'organizing' ? (
        <StateBlock title={PHASE_COPY[phase]} busy />
      ) : null}

      {phase === 'unreadable' ? (
        <StateBlock
          tone="attention"
          /* Copy pinned by the spec. Never a generic error. */
          title="We saved your file, but we could not read its text."
          body="Ảnh scan và PDF xuất từ ảnh không có lớp văn bản. Bạn có thể dán nội dung CV vào đây thay vì tải lại."
          action={{ label: 'Paste CV text', onClick: () => setPhase('pasting') }}
          secondary={{ label: 'Nhập thủ công', onClick: onCancel }}
        />
      ) : null}

      {phase === 'pasting' ? (
        <Panel>
          <div className="flex flex-col gap-gb-lg">
            <label htmlFor="paste-cv" className="text-gb-sm font-semibold text-fg">
              Dán nội dung CV
            </label>
            <textarea
              id="paste-cv"
              rows={10}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="Dán toàn bộ nội dung CV vào đây..."
              className="w-full resize-y rounded-gb-md border border-line-strong bg-surface px-gb-xl py-gb-lg text-gb-sm text-fg placeholder:text-fg-placeholder focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
            />
            <div className="flex flex-wrap items-center gap-gb-xl">
              <button
                type="button"
                onClick={() => setPhase('organizing')}
                className="rounded-gb-md bg-brand px-gb-xl py-gb-md text-gb-sm font-semibold text-on-brand hover:bg-brand-hover"
              >
                Tách thành từng mục
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="text-gb-sm font-medium text-fg-tertiary hover:text-fg"
              >
                Huỷ
              </button>
            </div>
          </div>
        </Panel>
      ) : null}

      {phase === 'confirming' ? (
        <>
          <StateBlock
            title="Ready to review"
            body="Kiểm tra các mục dưới đây. Những chỗ AI không chắc được đánh dấu Please check."
          />

          {draft.map((section) => (
            <Panel key={section.id}>
              <h2 className="mb-gb-lg text-gb-md font-semibold text-fg">
                {SECTION_LABELS[section.kind]}
              </h2>
              <div className="flex flex-col gap-gb-lg">
                {section.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-gb-xl border border-line bg-surface-muted p-gb-xl"
                  >
                    <div className="flex flex-wrap items-center gap-gb-md">
                      <span className="text-gb-sm font-semibold text-fg">
                        {entry.role || entry.organization || '—'}
                      </span>
                      {UNCERTAIN.has(`${entry.id}:location`) ||
                      UNCERTAIN.has(`${entry.id}:endDate`) ? (
                        <span className="rounded-gb-full bg-brand-subtle px-gb-md py-gb-xxs text-gb-xs font-semibold text-fg-brand">
                          Please check
                        </span>
                      ) : null}
                    </div>
                    {entry.bullets.length > 0 ? (
                      <ul className="mt-gb-md flex list-disc flex-col gap-gb-xs pl-gb-2xl text-gb-sm text-fg-tertiary">
                        {entry.bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </Panel>
          ))}

          <div className="flex flex-wrap items-center gap-gb-xl">
            <button
              type="button"
              onClick={() => onConfirm(draft)}
              className="rounded-gb-md bg-brand px-gb-3xl py-gb-lg text-gb-sm font-semibold text-on-brand hover:bg-brand-hover"
            >
              Start with this content
            </button>
            <button
              type="button"
              onClick={() => onConfirm(draft)}
              className="rounded-gb-md border border-line-strong bg-surface px-gb-xl py-gb-lg text-gb-sm font-semibold text-fg-secondary hover:bg-surface-hover"
            >
              Confirm all
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-gb-sm font-medium text-fg-tertiary hover:text-fg"
            >
              Cancel import
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
