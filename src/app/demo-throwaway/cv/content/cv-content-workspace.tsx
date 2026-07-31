'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ICONS, KitIcon } from '@/shared/ui';
import type { CvEntry, CvSection, CvSectionKind } from '@/features/application-strategy/domain';
import {
  AutosaveStatus,
  CvSteps,
  Panel,
  StateBlock,
  SuggestionCard,
  useFakeAutosave,
} from '../../demo-ui';
import {
  FAKE_AI_MS,
  OPTIONAL_SECTIONS,
  SECTION_FIELDS,
  SECTION_LABELS,
  makeStructuredCv,
  type Scenario,
} from '../../fixtures';
import { ImportFlow } from './import-flow';

/**
 * THROWAWAY DEMO — "Nội dung CV". Delete with the folder.
 *
 * Reads as a document rather than a dashboard, which is the spec's framing. Two
 * things here are load-bearing and worth demoing deliberately:
 *
 *  - Reorder is move-up / move-down buttons with accessible names, not
 *    drag-and-drop. Drag is unreachable by keyboard and awkward at 375px.
 *  - Entries collapse and expand one at a time, because a CV with every entry
 *    open is a page nobody can navigate.
 */

const AI_ACTIONS = [
  { key: 'clearer', label: 'Make clearer' },
  { key: 'concise', label: 'Make concise' },
  { key: 'impact', label: 'Highlight impact' },
  { key: 'evidence', label: 'Add confirmed evidence' },
  { key: 'tailor', label: 'Tailor to this course' },
] as const;

type AiActionKey = (typeof AI_ACTIONS)[number]['key'];

/** Canned rewrites. The real route returns `{ original, suggested }` too. */
function fakeSuggest(action: AiActionKey, original: string): string {
  switch (action) {
    case 'clearer':
      return original.replace(/roughly |about /gi, '').replace(/^/, 'Built and shipped: ');
    case 'concise':
      return original.split(',')[0]?.trim().replace(/\.$/, '') + '.';
    case 'impact':
      return `${original.replace(/\.$/, '')} — reducing average wait-time guesswork from 15 minutes to under 4.`;
    case 'evidence':
      return `${original.replace(/\.$/, '')} (GitHub repository, 41 stars; usage confirmed in your Glowbal profile).`;
    case 'tailor':
      return `${original.replace(/\.$/, '')}, the kind of production system this programme states it wants graduates to be able to build.`;
  }
}

type Suggestion = { entryId: string; bulletIndex: number; original: string; suggested: string };

export function CvContentWorkspace({ scenario }: { scenario: Scenario }) {
  const fixture = makeStructuredCv(scenario);

  const [sections, setSections] = useState<CvSection[]>(fixture?.sections ?? []);
  const [expanded, setExpanded] = useState<string | null>(
    fixture?.sections[1]?.entries[0]?.id ?? null,
  );
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const idCounter = useRef(0);
  const autosave = useFakeAutosave(fixture?.contentVersion ?? 1);

  const entryCount = sections.reduce((n, s) => n + s.entries.length, 0);

  function mutate(next: CvSection[]) {
    setSections(next);
    autosave.save();
  }

  function moveSection(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(target, 0, moved);
    mutate(next);
  }

  function removeSection(id: string) {
    mutate(sections.filter((s) => s.id !== id));
  }

  /* A counter rather than Date.now(): the React compiler treats a clock read in
     render scope as impure, and a monotonic id is more stable anyway. */
  function nextId(prefix: string) {
    idCounter.current += 1;
    return `${prefix}-${idCounter.current}`;
  }

  function addSection(kind: CvSectionKind) {
    mutate([...sections, { id: nextId(`s-${kind}`), kind, entries: [] }]);
  }

  function addEntry(sectionId: string) {
    const id = nextId('e');
    mutate(
      sections.map((s) =>
        s.id === sectionId
          ? { ...s, entries: [...s.entries, { id, bullets: [''], collapsed: false }] }
          : s,
      ),
    );
    setExpanded(id);
  }

  function updateEntry(sectionId: string, entryId: string, patch: Partial<CvEntry>) {
    mutate(
      sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              entries: s.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
            }
          : s,
      ),
    );
  }

  function removeEntry(sectionId: string, entryId: string) {
    mutate(
      sections.map((s) =>
        s.id === sectionId ? { ...s, entries: s.entries.filter((e) => e.id !== entryId) } : s,
      ),
    );
  }

  function requestSuggestion(entryId: string, bulletIndex: number, original: string, action: AiActionKey) {
    setSuggesting(`${entryId}-${bulletIndex}`);
    setTimeout(() => {
      setSuggestion({ entryId, bulletIndex, original, suggested: fakeSuggest(action, original) });
      setSuggesting(null);
    }, FAKE_AI_MS);
  }

  function acceptSuggestion() {
    if (!suggestion) return;
    mutate(
      sections.map((s) => ({
        ...s,
        entries: s.entries.map((e) =>
          e.id === suggestion.entryId
            ? {
                ...e,
                bullets: e.bullets.map((b, i) =>
                  i === suggestion.bulletIndex ? suggestion.suggested : b,
                ),
              }
            : e,
        ),
      })),
    );
    setSuggestion(null);
  }

  const unusedSections = (Object.keys(SECTION_LABELS) as CvSectionKind[]).filter(
    (k) => k !== 'custom' && !sections.some((s) => s.kind === k),
  );

  if (importing) {
    return (
      <ImportFlow
        onCancel={() => setImporting(false)}
        onConfirm={(imported) => {
          mutate(imported);
          setImporting(false);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-gb-3xl">
      <CvSteps current="content" />

      <header className="flex flex-col gap-gb-lg">
        <div className="flex flex-wrap items-start justify-between gap-gb-lg">
          <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
            Nội dung CV
          </h1>
          <AutosaveStatus status={autosave.status} version={autosave.version} />
        </div>
        <p className="max-w-3xl text-gb-md text-fg-tertiary">
          Nhập nội dung theo từng mục. Bạn có thể sắp xếp lại thứ tự, thêm hoặc bớt mục, và
          nhờ AI viết lại từng dòng. AI chỉ đề xuất — không tự thay đổi nội dung của bạn.
        </p>
      </header>

      {sections.length === 0 ? (
        <Panel>
          <div className="flex flex-col gap-gb-xl">
            <div className="flex flex-col gap-gb-md">
              <h2 className="text-gb-lg font-semibold text-fg">Bắt đầu từ đâu</h2>
              <p className="max-w-2xl text-gb-md text-fg-tertiary">
                Bạn đã tải lên một CV. Nhập từ CV đó là cách nhanh nhất.
              </p>
            </div>
            <div className="flex flex-wrap gap-gb-lg">
              <button
                type="button"
                onClick={() => setImporting(true)}
                className="inline-flex items-center gap-gb-xs rounded-gb-md bg-brand px-gb-3xl py-gb-lg text-gb-sm font-semibold text-on-brand hover:bg-brand-hover"
              >
                <KitIcon art={ICONS.uploadCloud} frame={16} />
                Nhập từ CV đã tải lên
              </button>
              <button
                type="button"
                onClick={() => {
                  const seeded = makeStructuredCv('partial');
                  if (seeded) mutate(seeded.sections);
                }}
                className="rounded-gb-md border border-line-strong bg-surface px-gb-xl py-gb-lg text-gb-sm font-semibold text-fg-secondary hover:bg-surface-hover"
              >
                Tạo từ hồ sơ Glowbal
              </button>
              <button
                type="button"
                onClick={() => addSection('education')}
                className="rounded-gb-md px-gb-xl py-gb-lg text-gb-sm font-semibold text-fg-tertiary hover:bg-surface-hover"
              >
                Nhập thủ công
              </button>
            </div>
          </div>
        </Panel>
      ) : null}

      {sections.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-gb-lg rounded-gb-xl border border-line bg-surface-muted px-gb-2xl py-gb-lg">
          <span className="text-gb-sm text-fg-tertiary">
            {sections.length} mục · {entryCount} nội dung
          </span>
          <button
            type="button"
            onClick={() => setImporting(true)}
            className="inline-flex items-center gap-gb-xs text-gb-sm font-medium text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg"
          >
            <KitIcon art={ICONS.uploadCloud} frame={14} />
            Nhập lại từ CV khác
          </button>
        </div>
      ) : null}

      {sections.map((section, index) => (
        <Panel key={section.id}>
          <header className="mb-gb-xl flex flex-wrap items-center justify-between gap-gb-lg">
            <h2 className="text-gb-md font-semibold text-fg">
              {section.kind === 'custom' ? (section.title ?? 'Mục tuỳ chỉnh') : SECTION_LABELS[section.kind]}
            </h2>

            <div className="flex items-center gap-gb-xs">
              <IconButton
                label={`Move ${SECTION_LABELS[section.kind]} up`}
                disabled={index === 0}
                onClick={() => moveSection(index, -1)}
              >
                ↑
              </IconButton>
              <IconButton
                label={`Move ${SECTION_LABELS[section.kind]} down`}
                disabled={index === sections.length - 1}
                onClick={() => moveSection(index, 1)}
              >
                ↓
              </IconButton>
              {OPTIONAL_SECTIONS.includes(section.kind) ? (
                <IconButton
                  label={`Remove ${SECTION_LABELS[section.kind]} section`}
                  onClick={() => removeSection(section.id)}
                >
                  <KitIcon art={ICONS.trash} frame={14} />
                </IconButton>
              ) : null}
            </div>
          </header>

          <div className="flex flex-col gap-gb-lg">
            {section.entries.map((entry) => {
              const open = expanded === entry.id;
              const key = `${entry.id}-0`;

              return (
                <div
                  key={entry.id}
                  className="rounded-gb-xl border border-line bg-surface-muted p-gb-xl"
                >
                  <div className="flex items-start justify-between gap-gb-lg">
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : entry.id)}
                      aria-expanded={open}
                      className="flex min-w-0 flex-1 flex-col items-start gap-gb-xxs text-left"
                    >
                      <span className="text-gb-sm font-semibold text-fg">
                        {entry.role || entry.organization || 'Nội dung mới'}
                      </span>
                      <span className="truncate text-gb-xs text-fg-muted">
                        {[entry.organization, entry.startDate, entry.endDate]
                          .filter(Boolean)
                          .join(' · ') || 'Chưa có thông tin'}
                      </span>
                    </button>
                    <span aria-hidden className="shrink-0 pt-gb-xxs text-fg-muted">
                      <KitIcon
                        art={ICONS.chevronDown}
                        frame={16}
                        className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
                      />
                    </span>
                  </div>

                  {open ? (
                    <div className="mt-gb-xl flex flex-col gap-gb-lg border-t border-line pt-gb-xl">
                      {/* Only the fields this section kind actually uses. */}
                      <div className="grid gap-gb-lg sm:grid-cols-2">
                        {SECTION_FIELDS[section.kind].map((field) => (
                          <label key={field} className="flex flex-col gap-gb-xs">
                            <span className="text-gb-xs font-medium text-fg-secondary capitalize">
                              {field.replace(/([A-Z])/g, ' $1')}
                            </span>
                            <input
                              value={(entry[field] as string | null | undefined) ?? ''}
                              onChange={(e) =>
                                updateEntry(section.id, entry.id, { [field]: e.target.value })
                              }
                              className="w-full rounded-gb-md border border-line-strong bg-surface px-gb-xl py-gb-md text-gb-sm text-fg focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
                            />
                          </label>
                        ))}
                      </div>

                      <div className="flex flex-col gap-gb-md">
                        <span className="text-gb-xs font-medium text-fg-secondary">
                          Chi tiết
                        </span>
                        {entry.bullets.map((bullet, i) => (
                          <div key={i} className="flex flex-col gap-gb-md">
                            <textarea
                              rows={2}
                              value={bullet}
                              onChange={(e) =>
                                updateEntry(section.id, entry.id, {
                                  bullets: entry.bullets.map((b, j) =>
                                    j === i ? e.target.value : b,
                                  ),
                                })
                              }
                              className="w-full resize-y rounded-gb-md border border-line-strong bg-surface px-gb-xl py-gb-lg text-gb-sm text-fg focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
                            />

                            {i === 0 ? (
                              <div className="flex flex-wrap gap-gb-md">
                                {AI_ACTIONS.map((action) => (
                                  <button
                                    key={action.key}
                                    type="button"
                                    disabled={suggesting === key}
                                    onClick={() =>
                                      requestSuggestion(entry.id, i, bullet, action.key)
                                    }
                                    className="inline-flex items-center gap-gb-xs rounded-gb-full border border-line-strong bg-surface px-gb-lg py-gb-xs text-gb-xs font-medium text-fg-secondary hover:bg-surface-hover disabled:opacity-50"
                                  >
                                    <KitIcon art={ICONS.zapFast} frame={12} />
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}

                            {suggesting === key && i === 0 ? (
                              <StateBlock title="Đang tạo đề xuất" busy />
                            ) : null}

                            {suggestion &&
                            suggestion.entryId === entry.id &&
                            suggestion.bulletIndex === i ? (
                              <SuggestionCard
                                original={suggestion.original}
                                suggested={suggestion.suggested}
                                onAccept={acceptSuggestion}
                                onDismiss={() => setSuggestion(null)}
                                onEdit={() => setSuggestion(null)}
                              />
                            ) : null}
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() =>
                            updateEntry(section.id, entry.id, {
                              bullets: [...entry.bullets, ''],
                            })
                          }
                          className="self-start text-gb-xs font-medium text-fg-brand hover:underline"
                        >
                          + Thêm dòng
                        </button>
                      </div>

                      {entry.evidence ? (
                        <p className="text-gb-xs text-fg-muted">
                          Bằng chứng đã xác nhận: {entry.evidence}
                        </p>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => removeEntry(section.id, entry.id)}
                        className="self-start text-gb-xs font-medium text-fg-error hover:underline"
                      >
                        Xoá nội dung này
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => addEntry(section.id)}
              className="inline-flex w-fit items-center gap-gb-xs rounded-gb-md border border-line-strong border-dashed bg-surface px-gb-xl py-gb-md text-gb-sm font-medium text-fg-tertiary hover:bg-surface-hover"
            >
              <KitIcon art={ICONS.plus} frame={14} />
              Thêm nội dung
            </button>
          </div>
        </Panel>
      ))}

      {sections.length > 0 && unusedSections.length > 0 ? (
        <Panel>
          <p className="mb-gb-lg text-gb-sm font-semibold text-fg">Thêm mục</p>
          <div className="flex flex-wrap gap-gb-md">
            {unusedSections.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => addSection(kind)}
                className="rounded-gb-full border border-line-strong bg-surface px-gb-lg py-gb-xs text-gb-xs font-medium text-fg-secondary hover:bg-surface-hover"
              >
                + {SECTION_LABELS[kind]}
              </button>
            ))}
          </div>
        </Panel>
      ) : null}

      {sections.length > 0 ? (
        <div className="flex flex-wrap items-center gap-gb-xl">
          <Link
            href={`/demo-throwaway/cv/review?scenario=${scenario}`}
            className="rounded-gb-md bg-brand px-gb-3xl py-gb-lg text-gb-sm font-semibold text-on-brand hover:bg-brand-hover"
          >
            Review my CV
          </Link>
          {!sections.some((s) => s.kind === 'experience') ? (
            <p className="text-gb-xs text-fg-muted">
              Chưa có mục Experience. Bạn vẫn có thể tiếp tục.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      /* size-gb-5xl keeps this at a touch-sized target rather than a 20px hit
         area, which is what the spec's mobile rule is about. */
      className="flex size-gb-5xl items-center justify-center rounded-gb-md border border-line-strong bg-surface text-gb-sm text-fg-secondary hover:bg-surface-hover disabled:opacity-40"
    >
      {children}
    </button>
  );
}
