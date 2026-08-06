'use client';

import { useRef, useState } from 'react';
import type { ContentBlock, ContentBlockValue } from '@/lib/match-insights';
import { Checkbox, ICONS, Input, KitIcon, Select, Textarea } from '@/shared/ui';

/**
 * Content Block — the genUI body of a recommendation's detail page. One of
 * three fixed shapes, chosen by the AI at generation time (see `ContentBlock`
 * in `@/lib/match-insights`): a repeatable table, a single long-form answer,
 * or a checklist of steps. `null` — rendered by the caller, not here — means
 * the task is completed in another tool instead.
 *
 * EACH SUB-COMPONENT OWNS ITS OWN SAVE. There is no shared array of state to
 * keep in sync across views the way the planner's list/board/calendar do —
 * this page shows one task at a time — so each block PATCHes
 * `contentValue` directly, the same self-contained pattern `AiCoachPanel` and
 * `EvidenceUpload` already use for `applicationId`/`recommendationId`.
 */
export function ContentBlockInput({
  applicationId,
  recommendationId,
  schema,
  value,
}: {
  applicationId: string;
  recommendationId: string;
  schema: ContentBlock;
  value: ContentBlockValue | null;
}) {
  if (schema.type === 'structured_table') {
    return (
      <StructuredTableInput
        applicationId={applicationId}
        recommendationId={recommendationId}
        schema={schema}
        value={value?.type === 'structured_table' ? value : null}
      />
    );
  }
  if (schema.type === 'long_text') {
    return (
      <LongTextInput
        applicationId={applicationId}
        recommendationId={recommendationId}
        schema={schema}
        value={value?.type === 'long_text' ? value : null}
      />
    );
  }
  return (
    <ChecklistInput
      applicationId={applicationId}
      recommendationId={recommendationId}
      schema={schema}
      value={value?.type === 'checklist' ? value : null}
    />
  );
}

async function saveContentValue(
  applicationId: string,
  recommendationId: string,
  contentValue: ContentBlockValue,
): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/applications/${applicationId}/strategy/recommendations/${recommendationId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentValue }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

function SaveStatus({ saving }: { saving: boolean }) {
  return (
    <span aria-live="polite" className="text-gb-xs text-fg-muted">
      {saving ? 'Saving…' : ''}
    </span>
  );
}

/**
 * "Articulate personal motivation" — one narrative textarea, seeded from the
 * AI's `prompt`. Saves on blur, reading from `textRef` rather than the
 * `text` state closure directly: a `blur` fired in the same tick as the last
 * keystroke's `setState` must still see that keystroke, and a ref assigned
 * on every render is the simplest way to guarantee that without a debounce.
 */
function LongTextInput({
  applicationId,
  recommendationId,
  schema,
  value,
}: {
  applicationId: string;
  recommendationId: string;
  schema: Extract<ContentBlock, { type: 'long_text' }>;
  value: Extract<ContentBlockValue, { type: 'long_text' }> | null;
}) {
  const [text, setText] = useState(value?.text ?? '');
  const [saving, setSaving] = useState(false);
  const textRef = useRef(text);

  function handleChange(next: string) {
    textRef.current = next;
    setText(next);
  }

  async function handleBlur() {
    setSaving(true);
    await saveContentValue(applicationId, recommendationId, {
      type: 'long_text',
      text: textRef.current,
    });
    setSaving(false);
  }

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-col gap-gb-md">
      <p className="text-gb-sm text-fg-tertiary">{schema.prompt}</p>
      <Textarea
        name="content-long-text"
        aria-label={schema.prompt}
        value={text}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => void handleBlur()}
        rows={8}
        placeholder="Start writing…"
      />
      <div className="flex items-center justify-between">
        <span className="text-gb-xs text-fg-muted">
          {wordCount} word{wordCount === 1 ? '' : 's'}
          {schema.minWords ? ` · aim for at least ${schema.minWords}` : ''}
        </span>
        <SaveStatus saving={saving} />
      </div>
    </div>
  );
}

/**
 * "Request official transcripts" — discrete steps, ticked off rather than
 * written. Saves immediately on toggle: there's no draft state to debounce,
 * a checkbox click is already the finished edit.
 */
function ChecklistInput({
  applicationId,
  recommendationId,
  schema,
  value,
}: {
  applicationId: string;
  recommendationId: string;
  schema: Extract<ContentBlock, { type: 'checklist' }>;
  value: Extract<ContentBlockValue, { type: 'checklist' }> | null;
}) {
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
    await saveContentValue(applicationId, recommendationId, {
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

type TableRow = { id: string; cells: Record<string, string> };

let tableRowSeq = 0;
function nextRowId(): string {
  tableRowSeq += 1;
  return `row-${tableRowSeq}`;
}

/**
 * "Provide detailed academic history" — a real `<table>`, matching the
 * reference screenshot, not `RepeatableFieldset`'s per-entry cards: the
 * design shows column headers with one row per entry, not a stack of
 * mini-forms. Rows are keyed by a client-only id assigned on add/load, never
 * by array index — same reasoning as `RepeatableFieldset`'s own doc comment
 * on why: removing row 2 of 3 must not leave row 3's uncommitted edits sitting
 * in row 2's cells.
 */
function StructuredTableInput({
  applicationId,
  recommendationId,
  schema,
  value,
}: {
  applicationId: string;
  recommendationId: string;
  schema: Extract<ContentBlock, { type: 'structured_table' }>;
  value: Extract<ContentBlockValue, { type: 'structured_table' }> | null;
}) {
  const [rows, setRows] = useState<TableRow[]>(() => {
    const initial = value?.rows ?? [];
    return initial.length > 0
      ? initial.map((cells) => ({ id: nextRowId(), cells }))
      : [{ id: nextRowId(), cells: {} }];
  });
  const [saving, setSaving] = useState(false);
  const rowsRef = useRef(rows);

  async function persist(nextRows: TableRow[]) {
    setSaving(true);
    await saveContentValue(applicationId, recommendationId, {
      type: 'structured_table',
      rows: nextRows.map((r) => r.cells),
    });
    setSaving(false);
  }

  /** Every mutator computes `next` from the ref (always current — see below)
      and writes both the ref and the state from it, so `rowsRef.current` is
      never stale when a blur handler reads it a moment later. */
  function updateCell(rowId: string, key: string, cellValue: string) {
    const next = rowsRef.current.map((r) =>
      r.id === rowId ? { ...r, cells: { ...r.cells, [key]: cellValue } } : r,
    );
    rowsRef.current = next;
    setRows(next);
  }

  function addRow() {
    const next = [...rowsRef.current, { id: nextRowId(), cells: {} }];
    rowsRef.current = next;
    setRows(next);
  }

  function removeRow(rowId: string) {
    const next = rowsRef.current.filter((r) => r.id !== rowId);
    rowsRef.current = next;
    setRows(next);
    void persist(next);
  }

  return (
    <div className="flex flex-col gap-gb-lg">
      <div className="overflow-x-auto rounded-gb-lg border border-line">
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-surface-muted">
              {schema.columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="px-gb-lg py-gb-md text-gb-xs font-semibold uppercase tracking-wide text-fg-tertiary"
                >
                  {column.label}
                </th>
              ))}
              <th scope="col" className="px-gb-lg py-gb-md">
                <span className="sr-only">Remove row</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="border-b border-line last:border-b-0">
                {schema.columns.map((column) => (
                  <td key={column.key} className="p-gb-sm align-top">
                    {column.type === 'select' ? (
                      <Select
                        name={`${row.id}-${column.key}`}
                        aria-label={`${column.label}, row ${index + 1}`}
                        value={row.cells[column.key] ?? ''}
                        onChange={(event) => updateCell(row.id, column.key, event.target.value)}
                        onBlur={() => void persist(rowsRef.current)}
                        placeholder={column.label}
                      >
                        {(column.options ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        name={`${row.id}-${column.key}`}
                        aria-label={`${column.label}, row ${index + 1}`}
                        type={column.type === 'date' ? 'date' : column.type === 'number' ? 'number' : 'text'}
                        value={row.cells[column.key] ?? ''}
                        onChange={(event) => updateCell(row.id, column.key, event.target.value)}
                        onBlur={() => void persist(rowsRef.current)}
                        placeholder={column.label}
                      />
                    )}
                  </td>
                ))}
                <td className="p-gb-sm align-top">
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    aria-label={`Remove row ${index + 1}`}
                    className="flex items-center justify-center rounded-gb-sm p-gb-sm text-fg-tertiary hover:text-fg-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <KitIcon art={ICONS.trash} frame={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-gb-xs self-start rounded-gb-full border border-line-strong px-gb-xl py-gb-sm text-gb-sm font-semibold text-fg-secondary hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <KitIcon art={ICONS.plus} frame={16} className="shrink-0" />
          Add item
        </button>
        <SaveStatus saving={saving} />
      </div>
    </div>
  );
}
