'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { Select } from '@/shared/ui';
import type { BlockInputProps } from './registry';
import { SaveStatus } from './save-status';

/**
 * single_select — one deterministic planning decision the AI asks the student
 * to make ("deepen the major or broaden with a minor?"). Moved verbatim from
 * content-block.tsx.
 *
 * SAVES BY OPTION VALUE, never by label: the label is copy the AI may reword
 * between regenerations, while `option.value` is the stable key the saved
 * `ContentBlockValue` and the analytics both rely on. An empty choice is a
 * deliberate no-save (the placeholder option is not an answer).
 *
 * `schema.semanticKey` is deliberately never read here — it is an AI-side
 * correlation key (see its doc comment in match-insights) and must never
 * reach the DOM nor influence which options render.
 */
export function SingleSelectInput({ schema, value, onSave }: BlockInputProps<'single_select'>) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(value?.value ?? '');
  const [saving, setSaving] = useState(false);
  async function change(next: string) {
    setSelected(next);
    if (!next) return;
    setSaving(true);
    await onSave({ type: 'single_select', value: next });
    setSaving(false);
  }
  // A native <select> under the kit's styling — keyboard operation, mobile
  // pickers and screen-reader semantics come for free; the chosen option is
  // always readable as text, so the selection state is never colour-only.
  return (
    <div className="flex flex-col gap-gb-md">
      <p className="text-gb-sm text-fg-tertiary">{schema.prompt}</p>
      <Select
        name="content-single-select"
        aria-label={schema.prompt}
        value={selected}
        onChange={(event) => void change(event.target.value)}
      >
        <option value="">{t('Select an option')}</option>
        {schema.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <SaveStatus saving={saving} />
    </div>
  );
}
