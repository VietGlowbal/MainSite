'use client';

import { useState } from 'react';
import { Checkbox } from '@/shared/ui';
import type { BlockInputProps } from './registry';
import { SaveStatus } from './save-status';

/**
 * "Request official transcripts" — discrete steps, ticked off rather than
 * written. Saves immediately on toggle: there's no draft state to debounce,
 * a checkbox click is already the finished edit. (Moved verbatim from
 * content-block.tsx.)
 *
 * MUST SURVIVE SCHEMA REGENERATION. The AI can re-run and reword
 * `schema.items` while the saved `value.checkedItems` still holds the OLD
 * texts. Ticks are keyed by exact item text, so:
 *
 * - rendering derives each checkbox from `checkedItems.has(item)` over the
 *   CURRENT schema — an entry whose text no longer matches any item is never
 *   consulted, never rendered, and silently inert inside the Set. No stale
 *   row can appear and nothing can crash on unknown texts;
 * - an item whose text survived the rewrite keeps its tick, because the same
 *   string is found again — including across a full remount, where the state
 *   is re-seeded from the saved value.
 */
export function ChecklistInput({ schema, value, onSave }: BlockInputProps<'checklist'>) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(
    () => new Set(value?.checkedItems ?? []),
  );
  const [saving, setSaving] = useState(false);

  async function toggle(item: string) {
    const next = new Set(checkedItems);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setCheckedItems(next);
    setSaving(true);
    await onSave({
      type: 'checklist',
      checkedItems: [...next],
    });
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-gb-lg">
      <div className="flex flex-col gap-gb-md">
        {schema.items.map((item) => (
          <Checkbox
            key={item}
            name="content-checklist"
            value={item}
            label={item}
            checked={checkedItems.has(item)}
            onChange={() => void toggle(item)}
            className={checkedItems.has(item) ? 'opacity-60' : undefined}
          />
        ))}
      </div>
      <SaveStatus saving={saving} />
    </div>
  );
}
