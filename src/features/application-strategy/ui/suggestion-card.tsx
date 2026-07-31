'use client';

import { useId, useState } from 'react';
import { Button, ICONS, KitIcon, Textarea } from '@/shared/ui';

/**
 * The only route by which AI-written text reaches a student's document.
 *
 * WHY EVERY SUGGESTION GOES THROUGH ONE COMPONENT. "AI never silently overwrites
 * student content" is a promise the product makes, and a promise enforced by
 * every author remembering to render an Accept button is not enforced. This
 * component has exactly three ways out — Accept, Dismiss, Edit manually — and no
 * prop that applies `suggested` on mount, on render, or on a timer. A page cannot
 * accidentally auto-apply because there is no API for it.
 *
 * WHY "EDIT MANUALLY" IS A THIRD STATE AND NOT A LINK BACK TO THE FIELD. The
 * useful case is "the suggestion is 80% right" — the student wants to keep most
 * of it and change a phrase. Sending them back to the original field to retype it
 * from memory is how a good suggestion gets dismissed. So the textarea opens
 * pre-filled with the suggestion, and what they save is their text, not the
 * model's.
 *
 * The original is shown struck through rather than hidden: the student is
 * approving a replacement, and they cannot judge it without seeing what it
 * replaces.
 */
export function SuggestionCard({
  label,
  original,
  suggested,
  onAccept,
  onDismiss,
  busy,
}: {
  /** What produced this, e.g. "Make this more concise". Sets the student's expectation. */
  label?: string | undefined;
  original: string;
  suggested: string;
  /**
   * Receives the text to apply. Called with `suggested` verbatim from Accept, or
   * with the student's edit from Edit manually — the caller cannot tell the
   * difference, and does not need to.
   */
  onAccept: (text: string) => void;
  onDismiss: () => void;
  busy?: boolean | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(suggested);
  const editorId = useId();

  return (
    <div className="flex flex-col gap-gb-lg rounded-gb-xl border border-line bg-surface-muted p-gb-2xl">
      {label ? (
        <p className="text-gb-xs font-semibold tracking-wide text-fg-muted uppercase">{label}</p>
      ) : null}

      {original.trim().length > 0 ? (
        <div className="flex flex-col gap-gb-xs">
          <span className="text-gb-xs font-semibold tracking-wide text-fg-muted uppercase">
            Current
          </span>
          <p className="text-gb-sm text-fg-tertiary line-through decoration-line-strong">
            {original}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-gb-xs">
        <span className="text-gb-xs font-semibold tracking-wide text-fg-brand uppercase">
          Suggested
        </span>
        {editing ? (
          <Textarea
            id={editorId}
            name={editorId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            aria-label="Edit the suggestion before applying it"
          />
        ) : (
          <p className="text-gb-sm whitespace-pre-wrap text-fg">{suggested}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-gb-md">
        {editing ? (
          <>
            <Button
              size="sm"
              onClick={() => onAccept(draft)}
              disabled={busy || draft.trim().length === 0}
            >
              Apply my version
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setDraft(suggested);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={() => onAccept(suggested)} disabled={busy}>
              <KitIcon art={ICONS.checkCircle} frame={14} />
              Accept
            </Button>
            <Button size="sm" variant="secondary" onClick={onDismiss} disabled={busy}>
              Dismiss
            </Button>
            {/* Text rather than a third Button: three buttons of equal weight
                means no obvious primary action, and this is the least-used way
                out of the three. */}
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={busy}
              className="rounded-gb-md px-gb-md py-gb-md text-gb-sm font-semibold text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
            >
              Edit manually
            </button>
          </>
        )}
      </div>
    </div>
  );
}
