'use client';

import { useCallback, useId, useState } from 'react';
import { ICONS, KitIcon } from './icons';

/**
 * FileDropzone — the click-or-drag upload target from the CV and Submit Audit
 * frames.
 *
 * WHAT IT REPLACES. Three separate upload surfaces, none of which looked like
 * the others: a bare `<input type="file">` styled with `.glow-input` on
 * /profile/documents, a hand-rolled drag handler in the onboarding wizard, and
 * nothing at all on the apply workspace, which linked out to the profile page
 * instead. The first two also used class names from the CSS quarantine list in
 * CLAUDE.md, so they were inheriting from 5,672 lines of unlayered legacy CSS.
 *
 * ACCESSIBILITY. This is the part a dropzone usually gets wrong. Drag-and-drop
 * is unreachable by keyboard and invisible to a screen reader, so it can only
 * ever be an enhancement — the real control is a genuine `<input type="file">`
 * that is visually hidden but still in the tab order and still labelled. The
 * visible box is a `<label>` pointing at it, which is what makes clicking
 * anywhere in the box work without a click handler that steals focus. Dropping
 * is layered on top for the people who have a mouse.
 *
 * The input is NOT `display: none` and NOT `hidden` — either removes it from
 * the accessibility tree along with the tab order. `sr-only` keeps both.
 */
export function FileDropzone({
  onFiles,
  accept,
  multiple = false,
  label = 'Click to upload',
  secondaryLabel = 'or drag and drop',
  hint,
  disabled = false,
  className,
}: {
  /** Called with everything the user chose or dropped, already filtered. */
  onFiles: (files: File[]) => void;
  /** An `accept` attribute, e.g. ".pdf,.doc,.docx". Also filters drops. */
  accept?: string | undefined;
  multiple?: boolean;
  /** The rose call to action. "or drag and drop" is appended. */
  label?: string;
  /** Localisable text that follows the primary upload action. */
  secondaryLabel?: string;
  /** The small print under it — formats and size limit. */
  hint?: string | undefined;
  disabled?: boolean;
  className?: string | undefined;
}) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  /**
   * A drop bypasses the input's `accept`, which the browser only enforces in
   * its own picker. Without this the one path a user is most likely to take
   * with the wrong file is also the only unvalidated one.
   */
  const acceptable = useCallback(
    (file: File): boolean => {
      if (!accept) return true;
      const patterns = accept.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
      if (patterns.length === 0) return true;

      const name = file.name.toLowerCase();
      const mime = file.type.toLowerCase();

      return patterns.some((pattern) => {
        if (pattern.startsWith('.')) return name.endsWith(pattern);
        if (pattern.endsWith('/*')) return mime.startsWith(pattern.slice(0, -1));
        return mime === pattern;
      });
    },
    [accept],
  );

  const emit = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const files = Array.from(list).filter(acceptable);
      if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
    },
    [acceptable, multiple, onFiles],
  );

  return (
    <div className={className}>
      {/* The visible box is the input's label, not a button: clicking anywhere
          in it opens the picker with no click handler, and the association is
          what a screen reader announces. */}
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(false);
          emit(event.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center gap-gb-lg rounded-gb-xl border px-gb-3xl py-gb-4xl text-center transition-colors ${
          dragging ? 'border-brand bg-brand-subtle' : 'border-line bg-surface hover:border-line-strong'
        } ${disabled ? 'pointer-events-none opacity-60' : ''} focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand`}
      >
        <span className="flex size-gb-6xl items-center justify-center rounded-gb-md border border-line bg-surface text-fg-tertiary">
          <KitIcon art={ICONS.uploadCloud} frame={20} />
        </span>

        <span className="flex flex-col gap-gb-xxs">
          <span className="text-gb-sm text-fg-tertiary">
            <span className="font-semibold text-brand">{label}</span> {secondaryLabel}
          </span>
          {hint ? <span className="text-gb-xs text-fg-muted">{hint}</span> : null}
        </span>
      </label>

      <input
        id={inputId}
        type="file"
        className="sr-only"
        multiple={multiple}
        disabled={disabled}
        {...(accept ? { accept } : {})}
        onChange={(event) => {
          emit(event.target.files);
          // Let the same file be chosen twice in a row — after a failed upload
          // the obvious next action is picking it again, and without this the
          // change event never fires.
          event.target.value = '';
        }}
      />
    </div>
  );
}
