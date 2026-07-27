'use client';

import { useEffect, useRef } from 'react';

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
 *
 * NOT a focus trap. Tab can still walk out of the panel into the page behind.
 * That is a real gap for screen-reader users and wants `inert` on the page root
 * (or a portal plus a trap) to fix properly; it is called out here rather than
 * left to be discovered.
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
  const panelRef = useRef<HTMLDivElement | null>(null);

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
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-scrim p-gb-xl backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`relative my-auto w-full rounded-gb-xl border border-line bg-surface shadow-gb-lg ${
          className ?? 'max-w-gb-width-sm p-gb-5xl'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
