'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modal — the overlay shape the design uses for both dialogs in the file: the
 * universities login gate and the saved list's "Apply scholarship" picker
 * (Figma 223:13022). A scrim over the page, one centred panel, nothing else.
 *
 * What it owns beyond the markup, because every hand-rolled overlay in this
 * codebase forgot at least one of them:
 *   - Escape closes it.
 *   - The page behind it stops scrolling while it is open.
 *   - Focus moves into the panel on open and returns to whatever opened it on
 *     close, so a keyboard user is not dumped at the top of the document.
 *   - The backdrop closes it; a click inside the panel does not bubble out.
 *   - Rendered via React Portal to document.body so CSS transforms on parents
 *     cannot clip or distort the viewport overlay.
 */
export function Modal({
  open,
  onClose,
  label,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog. */
  label: string;
  /** Applied to the panel, e.g. to widen it past the default. */
  className?: string | undefined;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // `onClose` is almost never memoized by callers (most pass an inline
  // `() => setX(null)`, or — like a form with its own dirty-check — a
  // function whose identity depends on render-local state). Reading it
  // through a ref updated every render, rather than closing over the prop
  // directly, is what lets the effect below key ONLY on `open`: without
  // this, every caller whose `onClose` identity changes for any reason
  // re-ran the effect on every one of those renders, re-focusing the
  // panel's first focusable element — which yanked focus away from
  // whatever a user was actively typing into, mid-word.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement as HTMLElement | null;
    // Prefer the first focusable thing in the panel; fall back to the panel,
    // which is why it carries tabIndex={-1}.
    const target =
      panelRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ) ?? panelRef.current;
    target?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open]);

  if (!open || !mounted) return null;

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-4 sm:p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`relative my-auto w-full max-w-lg rounded-2xl border border-[#EDE9EE] bg-white p-6 sm:p-8 shadow-2xl ${
          className ?? ''
        }`}
      >
        {children}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
