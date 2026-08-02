'use client';

import { useState } from 'react';
import { Button, ICONS, KitIcon } from '@/shared/ui';
import {
  CV_SUGGESTION_ACTIONS,
  sectionFields,
  type CvEntry,
  type CvEntryField,
  type CvSectionKind,
  type CvSuggestionAction,
} from '../domain';
import { SuggestionCard } from './suggestion-card';
import { GeneratingState, StateBlock } from './states';

/**
 * One CV entry: collapsed to a summary line, expanded to only the fields its
 * section actually uses.
 *
 * WHY COLLAPSED BY DEFAULT, AND ONE AT A TIME. A CV with five sections and
 * fifteen entries, every field rendered, is a page of about two hundred inputs.
 * Nobody edits that; they scroll past it. Collapsed rows make the document
 * scannable, and expanding one at a time keeps the open form near the top of the
 * viewport instead of somewhere below three other open forms.
 *
 * WHY REORDER IS BUTTONS. Drag-and-drop is unreachable by keyboard, awkward at
 * 375px, and forbidden by this feature's design rules. Move-up/move-down with
 * accessible names is the only option that satisfies keyboard, touch and the rule.
 */

const FIELD_LABEL: Record<CvEntryField, string> = {
  organization: 'Organisation',
  role: 'Role or title',
  location: 'Location',
  startDate: 'Start',
  endDate: 'End',
  current: 'Still here',
  bullets: 'Details',
  evidence: 'Evidence or metrics',
  linkedProfileItem: 'Linked profile item',
};

/** Contact entries are label/value pairs, so the generic labels would mislead. */
const CONTACT_FIELD_LABEL: Partial<Record<CvEntryField, string>> = {
  role: 'Label (e.g. Email)',
  organization: 'Value',
};

export type EntrySuggestion = {
  entryId: string;
  bulletIndex: number;
  original: string;
  suggested: string;
  note: string;
  unchanged: boolean;
};

export function CvEntryEditor({
  entry,
  sectionKind,
  expanded,
  onToggle,
  onChange,
  onRemove,
  suggestion,
  suggesting,
  suggestionError,
  onRequestSuggestion,
  onAcceptSuggestion,
  onDismissSuggestion,
}: {
  entry: CvEntry;
  sectionKind: CvSectionKind;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<CvEntry>) => void;
  onRemove: () => void;
  suggestion: EntrySuggestion | null;
  /** `entryId:bulletIndex` of an in-flight request. */
  suggesting: string | null;
  suggestionError: string | null;
  onRequestSuggestion: (bulletIndex: number, line: string, action: CvSuggestionAction) => void;
  onAcceptSuggestion: (text: string) => void;
  onDismissSuggestion: () => void;
}) {
  const fields = sectionFields(sectionKind);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const summary = entry.role || entry.organization || 'Nội dung mới';
  const detail =
    [entry.organization, entry.startDate, entry.current ? 'present' : entry.endDate]
      .filter((value) => value && String(value).trim().length > 0)
      .join(' · ') || 'Chưa có thông tin';

  const inputFields = fields.filter((field) => field !== 'bullets' && field !== 'linkedProfileItem');

  return (
    <div className="rounded-gb-xl border border-line bg-surface-muted p-gb-xl">
      <div className="flex items-start justify-between gap-gb-lg">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 flex-col items-start gap-gb-xxs rounded-gb-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span className="text-gb-sm font-semibold text-fg">{summary}</span>
          <span className="truncate text-gb-xs text-fg-muted">{detail}</span>
        </button>
        <span aria-hidden className="shrink-0 pt-gb-xxs text-fg-muted">
          <KitIcon
            art={ICONS.chevronDown}
            frame={16}
            className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'}
          />
        </span>
      </div>

      {expanded ? (
        <div className="mt-gb-xl flex flex-col gap-gb-xl border-t border-line pt-gb-xl">
          {inputFields.length > 0 ? (
            <div className="grid gap-gb-lg sm:grid-cols-2">
              {inputFields.map((field) => {
                const inputId = `${entry.id}-${field}`;
                const label =
                  (sectionKind === 'contact' ? CONTACT_FIELD_LABEL[field] : undefined) ??
                  FIELD_LABEL[field];

                if (field === 'current') {
                  return (
                    <label
                      key={field}
                      htmlFor={inputId}
                      className="flex items-center gap-gb-md self-end py-gb-md text-gb-sm text-fg-secondary"
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={entry.current ?? false}
                        onChange={(event) => onChange({ current: event.target.checked })}
                        className="size-gb-xl rounded-gb-xs border-line-strong text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      />
                      {label}
                    </label>
                  );
                }

                return (
                  <label key={field} htmlFor={inputId} className="flex flex-col gap-gb-xs">
                    <span className="text-gb-xs font-medium text-fg-secondary">{label}</span>
                    <input
                      id={inputId}
                      name={inputId}
                      value={(entry[field] as string | null | undefined) ?? ''}
                      onChange={(event) => onChange({ [field]: event.target.value })}
                      className="w-full rounded-gb-md border border-line-strong bg-surface px-gb-xl py-gb-md text-gb-sm text-fg focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
                    />
                  </label>
                );
              })}
            </div>
          ) : null}

          {fields.includes('bullets') ? (
            <div className="flex flex-col gap-gb-md">
              <span className="text-gb-xs font-medium text-fg-secondary">
                {sectionKind === 'skills' || sectionKind === 'interests' ? 'Danh sách' : 'Chi tiết'}
              </span>

              {entry.bullets.map((bullet, index) => {
                const key = `${entry.id}:${index}`;
                const busy = suggesting === key;
                const showSuggestion =
                  suggestion?.entryId === entry.id && suggestion.bulletIndex === index;

                return (
                  <div key={`${entry.id}-bullet-${index}`} className="flex flex-col gap-gb-md">
                    <div className="flex items-start gap-gb-md">
                      <textarea
                        rows={2}
                        value={bullet}
                        aria-label={`Detail line ${index + 1}`}
                        onChange={(event) =>
                          onChange({
                            bullets: entry.bullets.map((b, j) => (j === index ? event.target.value : b)),
                          })
                        }
                        className="w-full resize-y rounded-gb-md border border-line-strong bg-surface px-gb-xl py-gb-lg text-gb-sm text-fg focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
                      />
                      {entry.bullets.length > 1 ? (
                        <button
                          type="button"
                          aria-label={`Remove detail line ${index + 1}`}
                          onClick={() =>
                            onChange({ bullets: entry.bullets.filter((_, j) => j !== index) })
                          }
                          className="flex size-gb-5xl shrink-0 items-center justify-center rounded-gb-md border border-line-strong bg-surface text-fg-tertiary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          <KitIcon art={ICONS.trash} frame={14} />
                        </button>
                      ) : null}
                    </div>

                    {bullet.trim().length > 2 ? (
                      <div className="flex flex-wrap gap-gb-md">
                        {CV_SUGGESTION_ACTIONS.map((action) => (
                          <button
                            key={action.key}
                            type="button"
                            disabled={busy}
                            onClick={() => onRequestSuggestion(index, bullet, action.key)}
                            className="inline-flex items-center gap-gb-xs rounded-gb-full border border-line-strong bg-surface px-gb-lg py-gb-xs text-gb-xs font-medium text-fg-secondary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
                          >
                            <KitIcon art={ICONS.zapFast} frame={12} />
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {busy ? <GeneratingState title="Đang tạo đề xuất" /> : null}

                    {showSuggestion && suggestion.unchanged ? (
                      <StateBlock
                        title="Không có đề xuất thay đổi"
                        body={
                          suggestion.note ||
                          'Dòng này đã ổn, hoặc chúng tôi không có thông tin đã xác nhận để thêm vào.'
                        }
                        action={{ label: 'Đóng', onClick: onDismissSuggestion }}
                      />
                    ) : null}

                    {showSuggestion && !suggestion.unchanged ? (
                      <div className="flex flex-col gap-gb-md">
                        {suggestion.note ? (
                          <p className="text-gb-xs text-fg-muted">{suggestion.note}</p>
                        ) : null}
                        <SuggestionCard
                          original={suggestion.original}
                          suggested={suggestion.suggested}
                          onAccept={onAcceptSuggestion}
                          onDismiss={onDismissSuggestion}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => onChange({ bullets: [...entry.bullets, ''] })}
                className="self-start rounded-gb-md text-gb-xs font-medium text-fg-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                + Thêm dòng
              </button>
            </div>
          ) : null}

          {suggestionError ? (
            <StateBlock
              tone="error"
              title="Không tạo được đề xuất"
              body={suggestionError}
              action={{ label: 'Đóng', onClick: onDismissSuggestion }}
            />
          ) : null}

          {entry.linkedProfileItemId ? (
            <p className="text-gb-xs text-fg-muted">
              Liên kết với một mục trong hồ sơ Glowbal của bạn.
            </p>
          ) : null}

          {confirmRemove ? (
            <div className="flex flex-wrap items-center gap-gb-lg rounded-gb-md border border-line-error bg-surface-error p-gb-lg">
              <span className="text-gb-sm text-fg-error">Xoá nội dung này?</span>
              <Button size="sm" variant="secondary-destructive" onClick={onRemove}>
                Xoá
              </Button>
              <button
                type="button"
                onClick={() => setConfirmRemove(false)}
                className="rounded-gb-md text-gb-sm font-medium text-fg-tertiary hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Giữ lại
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="self-start rounded-gb-md text-gb-xs font-medium text-fg-error hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Xoá nội dung này
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
