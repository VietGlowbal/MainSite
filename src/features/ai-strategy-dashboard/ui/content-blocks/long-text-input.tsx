'use client';

import { useId, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { controlClasses } from '@/shared/ui';
import type { BlockInputProps } from './registry';
import { SaveStatus } from './save-status';

/**
 * "Articulate personal motivation" — one narrative textarea, seeded from the
 * AI's `prompt`. Saves on blur, reading from `textRef` rather than the
 * `text` state closure directly: a `blur` fired in the same tick as the last
 * keystroke's `setState` must still see that keystroke, and a ref assigned
 * on every render is the simplest way to guarantee that without a debounce.
 * (Moved verbatim from content-block.tsx.)
 *
 * WHY A RAW CONTROL, NOT THE SHARED `Textarea`: the kit's Textarea hard-wires
 * `aria-describedby` to its own hint/error message slot, while this block's
 * description is the live word-count line that sits beside the save status.
 * The classes below are the kit's own (`controlClasses(false, 'resize-y')` —
 * the exact string Textarea applies in its idle state), so the rendered box
 * stays pixel-identical.
 */
export function LongTextInput({ schema, value, onSave }: BlockInputProps<'long_text'>) {
  const { t } = useLanguage();
  const [text, setText] = useState(value?.text ?? '');
  const [saving, setSaving] = useState(false);
  const textRef = useRef(text);
  // §6.6 — the word-count / minWords guidance is programmatically associated
  // with the textarea: screen-reader users hear "3 words · aim for at least
  // 50" as they land in the field instead of having to find the footnote.
  const countHintId = useId();

  function handleChange(next: string) {
    textRef.current = next;
    setText(next);
  }

  async function handleBlur() {
    setSaving(true);
    await onSave({
      type: 'long_text',
      text: textRef.current,
    });
    setSaving(false);
  }

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-col gap-gb-md">
      <p className="text-gb-sm text-fg-tertiary">{schema.prompt}</p>
      <textarea
        name="content-long-text"
        aria-label={schema.prompt}
        aria-describedby={countHintId}
        value={text}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => void handleBlur()}
        rows={8}
        placeholder={t('Start writing…')}
        className={controlClasses(false, 'resize-y')}
      />
      <div className="flex items-center justify-between">
        <span id={countHintId} className="text-gb-xs text-fg-muted">
          {wordCount === 1 ? t('1 word') : t('{count} words', { count: wordCount })}
          {schema.minWords ? ` · ${t('aim for at least {min}', { min: schema.minWords })}` : ''}
        </span>
        <SaveStatus saving={saving} />
      </div>
    </div>
  );
}
