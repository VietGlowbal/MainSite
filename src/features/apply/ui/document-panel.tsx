'use client';

import { useEffect, useRef, useState } from 'react';
import { ICONS, KitIcon } from '@/shared/ui';
import { formatBytes } from '@/shared/ui/document-row';
import type { EvidenceDocument } from '../hooks';

export type ProcessingState =
  | { kind: 'idle' }
  | { kind: 'uploading'; fileName: string }
  | { kind: 'analysing' }
  | { kind: 'complete'; achievementCount: number }
  | { kind: 'no_results' }
  | { kind: 'error'; message: string };

function OverflowMenu({
  label,
  items,
}: {
  label: string;
  items: ReadonlyArray<{ label: string; onClick: () => void; danger?: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className="rounded-gb-sm p-1 text-fg-muted hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span aria-hidden="true" className="text-base leading-none">
          ⋮
        </span>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-10 mt-1 min-w-40 rounded-gb-lg border border-line bg-surface py-1 shadow-gb-lg">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`block w-full px-3 py-1.5 text-left text-gb-sm hover:bg-surface-muted ${
                item.danger ? 'text-fg-error' : 'text-fg'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DocumentEntry({
  document,
  onPreview,
  onRename,
  onReprocess,
  onRemove,
  labels,
}: {
  document: EvidenceDocument;
  onPreview: () => void;
  onRename: () => void;
  onReprocess: () => void;
  onRemove: () => void;
  labels: { preview: string; rename: string; reprocess: string; remove: string; menu: string; extracted?: string };
}) {
  const dot = document.fileName.lastIndexOf('.');
  const ext =
    dot > 0 && dot < document.fileName.length - 1
      ? document.fileName.slice(dot + 1).toUpperCase().slice(0, 4)
      : 'PDF';

  const isPdf = ext === 'PDF';

  return (
    <li className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Red PDF Icon Badge */}
          <span
            aria-hidden="true"
            className={`flex size-8 shrink-0 items-center justify-center rounded text-[0.625rem] font-bold tracking-wider ${
              isPdf
                ? 'bg-fg-error text-white'
                : 'border border-line bg-surface-muted text-fg-tertiary'
            }`}
          >
            {ext}
          </span>

          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-gb-sm font-medium text-fg-secondary">{document.fileName}</p>
            <div className="flex flex-wrap items-center gap-2 text-gb-xs text-fg-secondary">
              <span>{document.size != null ? `${formatBytes(document.size)} of ${formatBytes(document.size)}` : '200 KB'}</span>
              <span className="text-fg-muted">|</span>
              <span className="inline-flex items-center gap-1 text-on-tier-safe font-medium">
                <KitIcon art={ICONS.checkCircle} frame={12} />
                {labels.extracted ?? 'Đã trích xuất'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onRemove}
            aria-label={labels.remove}
            className="p-1 text-fg-muted hover:text-fg-error transition-colors rounded"
          >
            <KitIcon art={ICONS.trash} frame={16} />
          </button>

          <OverflowMenu
            label={labels.menu}
            items={[
              { label: labels.preview, onClick: onPreview },
              { label: labels.rename, onClick: onRename },
              { label: labels.reprocess, onClick: onReprocess },
            ]}
          />
        </div>
      </div>

      {/* Full-width Red Progress Bar with 100% */}
      <div className="flex items-center gap-3 pt-1">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full w-full rounded-full bg-brand transition-all duration-300" />
        </div>
        <span className="text-[0.6875rem] font-semibold text-fg-secondary">100%</span>
      </div>
    </li>
  );
}

function ProcessingStatus({
  state,
  labels,
  onAddManually,
}: {
  state: ProcessingState;
  labels: {
    uploading: (fileName: string) => string;
    analysing: string;
    complete: (count: number) => string;
    completeHint: string;
    noResults: string;
    addManually: string;
    error: string;
  };
  onAddManually: () => void;
}) {
  if (state.kind === 'idle') return null;

  if (state.kind === 'uploading') {
    return (
      <p className="flex items-center justify-center gap-gb-sm text-gb-sm text-fg-tertiary py-2">
        <span className="size-2 animate-pulse rounded-full bg-brand" aria-hidden="true" />
        {state.fileName ? labels.uploading(state.fileName) : labels.analysing}
      </p>
    );
  }

  if (state.kind === 'analysing') {
    return (
      <p className="flex items-center justify-center gap-gb-sm text-gb-sm text-fg-tertiary py-2">
        <span className="size-2 animate-pulse rounded-full bg-brand" aria-hidden="true" />
        {labels.analysing}
      </p>
    );
  }

  if (state.kind === 'error') {
    return <p className="text-center text-gb-sm text-fg-error py-2">{labels.error}</p>;
  }

  if (state.kind === 'no_results') {
    return (
      <div className="flex flex-col items-center gap-gb-sm rounded-xl bg-surface-muted p-4 text-center">
        <p className="text-gb-sm text-fg-secondary">{labels.noResults}</p>
        <button
          type="button"
          onClick={onAddManually}
          className="text-gb-sm font-semibold text-fg-brand hover:underline"
        >
          {labels.addManually}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-tier-safe/10 border border-line p-3 text-center">
      <p className="flex items-center gap-1.5 text-gb-sm font-semibold text-on-tier-safe">
        <KitIcon art={ICONS.checkCircle} frame={16} />
        {labels.complete(state.achievementCount)}
      </p>
      <p className="text-gb-xs text-fg-tertiary">{labels.completeHint}</p>
    </div>
  );
}

export function DocumentPanel({
  onFiles,
  disabled,
  accept,
  dropzoneLabel,
  dropzoneHint,
  documents,
  processing,
  onPreview,
  onRename,
  onReprocess,
  onRemove,
  onAddManually,
  labels,
}: {
  onFiles: (files: File[]) => void;
  disabled: boolean;
  accept: string;
  dropzoneLabel: string;
  dropzoneHint: string;
  heading?: string;
  description?: string;
  documents: EvidenceDocument[];
  processing: ProcessingState;
  onPreview: (document: EvidenceDocument) => void;
  onRename: (document: EvidenceDocument) => void;
  onReprocess: (document: EvidenceDocument) => void;
  onRemove: (document: EvidenceDocument) => void;
  onAddManually: () => void;
  labels: {
    recentlyUploaded: string;
    noDocuments: string;
    preview: string;
    rename: string;
    reprocess: string;
    remove: string;
    menu: string;
    uploading: (fileName: string) => string;
    analysing: string;
    complete: (count: number) => string;
    completeHint: string;
    noResults: string;
    addManually: string;
    error: string;
    extracted?: string;
  };
}) {
  const hasDocs = documents.length > 0;

  return (
    <div className="w-full flex flex-col rounded-2xl border border-line bg-surface shadow-xs overflow-hidden">
      {/* Top Dropzone Area */}
      <label
        className={`flex flex-col items-center justify-center gap-2 px-6 py-8 sm:py-10 text-center transition-colors hover:bg-surface-muted ${
          disabled ? 'pointer-events-none opacity-60' : 'cursor-pointer'
        }`}
      >
        <input
          type="file"
          multiple
          accept={accept}
          disabled={disabled}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length > 0) onFiles(files);
          }}
          className="sr-only"
        />
        {/* Upload Icon in Rounded Square Box */}
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-lg border border-line bg-surface text-fg-secondary shadow-xs"
        >
          <KitIcon art={ICONS.uploadCloud} frame={20} />
        </span>
        <span className="text-gb-sm sm:text-gb-base font-semibold text-fg-brand">
          {dropzoneLabel}
        </span>
        <span className="text-gb-xs text-fg-secondary">{dropzoneHint}</span>
      </label>

      {/* Processing Status Banner (if active) */}
      {processing.kind !== 'idle' ? (
        <div className="px-6 pb-4">
          <ProcessingStatus state={processing} labels={labels} onAddManually={onAddManually} />
        </div>
      ) : null}

      {/* Bottom Uploaded Documents List */}
      {hasDocs ? (
        <div className="border-t border-line p-4 sm:p-6 bg-surface">
          <ul className="flex flex-col gap-3">
            {documents
              .slice()
              .reverse()
              .map((document) => (
                <DocumentEntry
                  key={document.id}
                  document={document}
                  onPreview={() => onPreview(document)}
                  onRename={() => onRename(document)}
                  onReprocess={() => onReprocess(document)}
                  onRemove={() => onRemove(document)}
                  labels={labels}
                />
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
