'use client';

import { ICONS, KitIcon } from './icons';
import { ProgressBar } from './progress-bar';

/**
 * DocumentRow — one file in the upload list, per the Submit Audit frame:
 * a type badge, the name, "200 KB of 200 KB", a status, a progress bar and a
 * delete control.
 *
 * WHY THE SIZE READS "x of y". It is the one part of the frame that carries
 * information a spinner cannot: it says how far through a slow upload is on a
 * connection where that matters. It is also why `uploaded` and `total` are
 * separate props rather than a single percentage — the percentage is derived
 * here so the two can never disagree in the same row.
 */

export type DocumentStatus = 'uploading' | 'complete' | 'error';

/**
 * Bytes, in the frame's shorthand.
 *
 * Binary units (1024) because that is what every file manager the student will
 * compare against reports, whatever the SI pedantry says.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

/** The coloured extension badge — "PDF" on a rose plate in the frame. */
function FileBadge({ fileName }: { fileName: string }) {
  const dot = fileName.lastIndexOf('.');
  const ext = dot > 0 && dot < fileName.length - 1 ? fileName.slice(dot + 1).toUpperCase() : 'FILE';

  return (
    <span
      aria-hidden="true"
      className="flex size-gb-6xl shrink-0 items-center justify-center rounded-gb-md border border-line bg-surface-muted text-[0.5625rem] font-bold tracking-wide text-fg-tertiary"
    >
      {/* Four characters is the widest that fits the plate; "DOCX" just does. */}
      {ext.slice(0, 4)}
    </span>
  );
}

export function DocumentRow({
  fileName,
  total,
  uploaded,
  status = 'complete',
  error,
  onRemove,
  removeLabel,
  completeLabel = 'Complete',
  uploadingLabel = 'Uploading…',
}: {
  fileName: string;
  /** Total size in bytes. Omit when unknown (a stored document, not an upload). */
  total?: number | undefined;
  /** Bytes transferred so far. Defaults to `total` for an already-stored file. */
  uploaded?: number | undefined;
  status?: DocumentStatus;
  /** Shown in place of the status line when `status` is 'error'. */
  error?: string | undefined;
  /** Omit to render a row that cannot be removed. */
  onRemove?: (() => void) | undefined;
  removeLabel?: string | undefined;
  /** Localisable status labels for embedded translated flows. */
  completeLabel?: string | undefined;
  uploadingLabel?: string | undefined;
}) {
  const done = uploaded ?? total;
  const percent =
    total && total > 0 && done != null ? Math.min(100, Math.round((done / total) * 100)) : null;

  return (
    <li className="flex flex-col gap-gb-md rounded-gb-xl border border-line p-gb-xl">
      <div className="flex items-start gap-gb-lg">
        <FileBadge fileName={fileName} />

        <div className="flex min-w-0 flex-1 flex-col gap-gb-xxs">
          <p className="truncate text-gb-sm font-medium text-fg">{fileName}</p>

          <p className="flex flex-wrap items-center gap-gb-sm text-gb-xs text-fg-tertiary">
            {total != null ? (
              <span>
                {done != null && status === 'uploading'
                  ? `${formatBytes(done)} of ${formatBytes(total)}`
                  : formatBytes(total)}
              </span>
            ) : null}

            {total != null ? <span aria-hidden="true">·</span> : null}

            {status === 'error' ? (
              <span className="font-medium text-fg-error">{error ?? 'Upload failed'}</span>
            ) : status === 'uploading' ? (
              <span>{uploadingLabel}</span>
            ) : (
              <span className="flex items-center gap-gb-xs font-medium text-tier-safe">
                <KitIcon art={ICONS.checkCircle} frame={14} className="shrink-0" />
                {completeLabel}
              </span>
            )}
          </p>
        </div>

        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeLabel ?? `Remove ${fileName}`}
            className="shrink-0 rounded-gb-sm p-gb-xs text-fg-muted hover:text-fg-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <KitIcon art={ICONS.trash} frame={16} />
          </button>
        ) : null}
      </div>

      {/* Only while it means something. A permanent 100% bar under every stored
          document is decoration, and the frame draws it during transfer. */}
      {status === 'uploading' && percent !== null ? (
        <div className="flex items-center gap-gb-lg">
          <ProgressBar value={percent} label={`Uploading ${fileName}`} size="sm" />
          <span className="shrink-0 text-gb-xs font-medium tabular-nums text-fg-tertiary">
            {percent}%
          </span>
        </div>
      ) : null}
    </li>
  );
}
