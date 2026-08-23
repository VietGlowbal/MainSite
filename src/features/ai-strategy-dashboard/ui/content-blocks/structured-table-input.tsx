'use client';

import { useRef, useState } from 'react';
import type { ContentBlockColumn } from '@/lib/match-insights';
import { useLanguage } from '@/lib/i18n';
import { ICONS, Input, KitIcon, Select } from '@/shared/ui';
import { useMediaQuery } from '../use-media-query';
import type { BlockInputProps } from './registry';
import { SaveStatus } from './save-status';

type TableRow = { id: string; cells: Record<string, string> };

let tableRowSeq = 0;
function nextRowId(): string {
  tableRowSeq += 1;
  return `row-${tableRowSeq}`;
}

/**
 * "Provide detailed academic history" — repeatable rows over the schema's
 * columns. (Moved from content-block.tsx, behaviour preserved.)
 *
 * ─── ONE DOMAIN, TWO PRESENTATIONS (§6.5, planner-board's pattern) ───────────
 *
 * ≥768px renders the real `<table>` from the reference design, pixel-for-pixel
 * as before. Below that the wide grid cannot fit without horizontal scrolling
 * (the desktop tree keeps `min-w-[40rem]` for exactly that reason), so a
 * narrow viewport renders one card per row instead: every column becomes a
 * labelled field, and each card carries its own clearly-labelled remove
 * control. DESKTOP IS THE HYDRATION DEFAULT (`useMediaQuery` seeds `true` on
 * the server), so the markup that hydrates is always the table and the card
 * list is an ordinary post-hydration update — never a mismatch.
 *
 * Both presentations read the same `rows` state and call the same mutators;
 * neither owns data. Row identity stays client-id based (`nextRowId`), never
 * array index — removing row 2 of 3 must not leave row 3's uncommitted edits
 * sitting in row 2's cells. Save semantics are unchanged on both surfaces:
 * cells PATCH on blur, removing a row PATCHes immediately.
 */
export function StructuredTableInput({ schema, value, onSave }: BlockInputProps<'structured_table'>) {
  const { t } = useLanguage();
  const isDesktop = useMediaQuery('(min-width: 768px)', true);

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
    await onSave({
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

  /** The one control per column, shared by both presentations. The
      `${label}, row N` aria-label is the stable handle tests and screen
      readers use on either surface. */
  function renderCell(row: TableRow, column: ContentBlockColumn, index: number) {
    if (column.type === 'select') {
      return (
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
      );
    }
    return (
      <Input
        name={`${row.id}-${column.key}`}
        aria-label={`${column.label}, row ${index + 1}`}
        type={column.type === 'date' ? 'date' : column.type === 'number' ? 'number' : 'text'}
        value={row.cells[column.key] ?? ''}
        onChange={(event) => updateCell(row.id, column.key, event.target.value)}
        onBlur={() => void persist(rowsRef.current)}
        placeholder={column.label}
      />
    );
  }

  const footer = (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-gb-xs self-start rounded-gb-full border border-line-strong px-gb-xl py-gb-sm text-gb-sm font-semibold text-fg-secondary hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <KitIcon art={ICONS.plus} frame={16} className="shrink-0" />
        {t('Add item')}
      </button>
      <SaveStatus saving={saving} />
    </div>
  );

  if (isDesktop) {
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
                  <span className="sr-only">{t('Remove row')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className="border-b border-line last:border-b-0">
                  {schema.columns.map((column) => (
                    <td key={column.key} className="p-gb-sm align-top">
                      {renderCell(row, column, index)}
                    </td>
                  ))}
                  <td className="p-gb-sm align-top">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      aria-label={t('Remove row {n}', { n: index + 1 })}
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
        {footer}
      </div>
    );
  }

  // Narrow viewport — one card per row. No fixed widths anywhere in this
  // tree: every field is `w-full` via the kit's CONTROL_BASE, so nothing can
  // overflow the viewport. Each control is named by a visible column label
  // AND keeps the same `label, row N` aria-label as its desktop twin, and the
  // remove control is a real button with visible text and a ≥44px hit area
  // (min-h/min-w), reachable by keyboard like any native button.
  return (
    <div className="flex flex-col gap-gb-lg">
      <div className="flex flex-col gap-gb-md">
        {rows.map((row, index) => (
          <fieldset
            key={row.id}
            className="flex flex-col gap-gb-md rounded-gb-lg border border-line p-gb-lg"
          >
            <legend className="px-gb-xs text-gb-xs font-semibold uppercase tracking-wide text-fg-tertiary">
              {t('Row {n}', { n: index + 1 })}
            </legend>
            {schema.columns.map((column) => (
              <div key={column.key} className="flex flex-col gap-gb-xs">
                <span className="text-gb-xs font-semibold uppercase tracking-wide text-fg-tertiary">
                  {column.label}
                </span>
                {renderCell(row, column, index)}
              </div>
            ))}
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-gb-xs self-start rounded-gb-sm border border-line px-gb-lg py-gb-sm text-gb-sm font-semibold text-fg-secondary hover:border-line-error hover:text-fg-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <KitIcon art={ICONS.trash} frame={16} className="shrink-0" />
              {t('Remove row {n}', { n: index + 1 })}
            </button>
          </fieldset>
        ))}
      </div>
      {footer}
    </div>
  );
}
