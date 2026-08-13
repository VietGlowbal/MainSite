'use client';

import { useEffect, useRef, useState } from 'react';
import { ICONS, KitIcon } from '@/shared/ui';
import { formatBytes } from '@/shared/ui/document-row';
import type { EvidenceDocument } from '../hooks';

/**
 * The upload section — a dropzone on the left, the document library with its
 * processing status on the right. Two columns on desktop, stacked below `sm`.
 */

export type ProcessingState =
  | { kind: 'idle' }
  | { kind: 'uploading'; fileName: string }
  | { kind: 'analysing' }
  | { kind: 'complete'; achievementCount: number }
  | { kind: 'no_results' }
  | { kind: 'error'; message: string };

/** A small disclosure — not an ARIA menu, see the note on `NavDropdown`. */
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
        className="rounded-gb-sm p-gb-xs text-fg-muted hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span aria-hidden="true" className="text-gb-lg leading-none">
          ⋮
        </span>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-10 mt-gb-xs min-w-40 rounded-gb-lg border border-line bg-surface py-gb-xs shadow-gb-lg">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`block w-full px-gb-lg py-gb-sm text-left text-gb-sm hover:bg-surface-muted ${
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
  labels: { preview: string; rename: string; reprocess: string; remove: string; menu: string };
}) {
  const dot = document.fileName.lastIndexOf('.');
  const ext =
    dot > 0 && dot < document.fileName.length - 1
      ? document.fileName.slice(dot + 1).toUpperCase().slice(0, 4)
      : 'FILE';

  return (
    <li className="flex items-start gap-gb-lg rounded-gb-xl border border-line p-gb-lg">
      <span
        aria-hidden="true"
        className="flex size-gb-6xl shrink-0 items-center justify-center rounded-gb-md border border-line bg-surface-muted text-[0.5625rem] font-bold tracking-wide text-fg-tertiary"
      >
        {ext}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-gb-xxs">
        <p className="truncate text-gb-sm font-medium text-fg">{document.fileName}</p>
        <p className="text-gb-xs text-fg-tertiary">
          {document.size != null ? `${formatBytes(document.size)} · ` : ''}
          {new Date(document.uploadedAt).toLocaleDateString()}
        </p>
        <button
          type="button"
          onClick={onPreview}
          className="mt-gb-xxs self-start text-gb-xs font-medium text-fg-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {labels.preview}
        </button>
      </div>

      <OverflowMenu
        label={labels.menu}
        items={[
          { label: labels.rename, onClick: onRename },
          { label: labels.reprocess, onClick: onReprocess },
          { label: labels.remove, onClick: onRemove, danger: true },
        ]}
      />
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
      <p className="flex items-center gap-gb-sm text-gb-sm text-fg-tertiary">
        <span className="size-2 animate-pulse rounded-gb-full bg-brand" aria-hidden="true" />
        {state.fileName ? labels.uploading(state.fileName) : labels.analysing}
      </p>
    );
  }

  if (state.kind === 'analysing') {
    return (
      <p className="flex items-center gap-gb-sm text-gb-sm text-fg-tertiary">
        <span className="size-2 animate-pulse rounded-gb-full bg-brand" aria-hidden="true" />
        {labels.analysing}
      </p>
    );
  }

  if (state.kind === 'error') {
    return <p className="text-gb-sm text-fg-error">{labels.error}</p>;
  }

  if (state.kind === 'no_results') {
    return (
      <div className="flex flex-col gap-gb-md rounded-gb-lg bg-surface-muted p-gb-lg">
        <p className="text-gb-sm text-fg-secondary">{labels.noResults}</p>
        <button
          type="button"
          onClick={onAddManually}
          className="self-start text-gb-sm font-semibold text-fg-brand hover:underline"
        >
          {labels.addManually}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-gb-xs rounded-gb-lg bg-tier-safe/10 p-gb-lg">
      <p className="flex items-center gap-gb-sm text-gb-sm font-semibold text-on-tier-safe">
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
  heading,
  description,
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
  heading: string;
  description: string;
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
  };
}) {
  return (
    <div className="grid gap-gb-2xl rounded-gb-xl border border-line bg-surface p-gb-2xl shadow-gb-xs lg:grid-cols-2">
      <div className="flex flex-col gap-gb-lg">
        <div className="flex flex-col gap-gb-xxs">
          <h2 className="text-gb-md font-semibold text-fg">{heading}</h2>
          <p className="text-gb-sm text-fg-tertiary">{description}</p>
        </div>

        <label
          className={`flex flex-col items-center gap-gb-sm rounded-gb-xl border border-dashed border-line bg-surface-muted px-gb-xl py-gb-4xl text-center transition-colors hover:border-brand ${
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
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-gb-full bg-brand-subtle text-fg-brand"
          >
            <KitIcon art={ICONS.uploadCloud} frame={20} />
          </span>
          <span className="text-gb-sm font-semibold text-fg-brand">{dropzoneLabel}</span>
          <span className="text-gb-xs text-fg-tertiary">{dropzoneHint}</span>
        </label>

        <ProcessingStatus state={processing} labels={labels} onAddManually={onAddManually} />
      </div>

      <div className="flex flex-col gap-gb-md">
        <h3 className="text-gb-sm font-semibold text-fg">{labels.recentlyUploaded}</h3>
        {documents.length === 0 ? (
          <p className="text-gb-sm text-fg-tertiary">{labels.noDocuments}</p>
        ) : (
          <ul className="flex flex-col gap-gb-md">
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
        )}
      </div>
    </div>
  );
}
