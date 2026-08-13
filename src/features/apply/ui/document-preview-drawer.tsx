'use client';

import { Modal } from '@/shared/ui';

/**
 * The document preview — a right-side drawer over the browser's own PDF
 * renderer, not a custom-built page/zoom control set.
 *
 * ─── WHY AN `<iframe>` AND NOT A PDF.JS VIEWER ───────────────────────────────
 *
 * Every major browser already ships a full PDF viewer — page thumbnails, zoom,
 * text search, printing — and nothing in this codebase renders a PDF today.
 * Building a second one to get the spec's "zoom controls, page navigation"
 * would spend a lot of code re-implementing what `<iframe src="…#page=N">`
 * gets for free, correctly, on every platform this app already supports. The
 * `#page=N` fragment is honoured by Chrome, Firefox and Safari's built-in
 * viewers, which is what "open the preview directly to the relevant page"
 * needs.
 *
 * Reuses `Modal` for the escape-to-close / focus-in / focus-return / scroll-
 * lock behaviour every dialog in this codebase already gets from it; only the
 * panel's own class name makes it read as a right-side drawer instead of a
 * centred dialog.
 */
export function DocumentPreviewDrawer({
  open,
  onClose,
  fileName,
  url,
  page,
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  fileName: string;
  /** A signed URL, or `null` while one is being fetched. */
  url: string | null;
  /** Jump to this page on open, when the caller knows which one matters. */
  page?: number | undefined;
  closeLabel: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      label={fileName}
      className="ml-auto flex h-full max-w-2xl flex-col rounded-none border-l border-line p-0 sm:h-[calc(100%-2rem)] sm:max-h-[calc(100vh-2rem)] sm:rounded-gb-xl sm:border"
    >
      <div className="flex items-center justify-between gap-gb-lg border-b border-line px-gb-xl py-gb-lg">
        <p className="min-w-0 truncate text-gb-sm font-semibold text-fg">{fileName}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="shrink-0 rounded-gb-sm px-gb-md py-gb-xs text-gb-sm font-medium text-fg-tertiary hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {closeLabel}
        </button>
      </div>

      <div className="min-h-0 flex-1 bg-surface-muted">
        {url ? (
          <iframe
            title={fileName}
            src={page ? `${url}#page=${page}` : url}
            className="size-full"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-gb-sm text-fg-tertiary">
            …
          </div>
        )}
      </div>
    </Modal>
  );
}
