'use client';

import { useCallback, useState } from 'react';
import { Button, ICONS, KitIcon } from '@/shared/ui';
import {
  CV_SECTION_KINDS,
  SECTION_LABEL,
  countEntries,
  emptyEntry,
  emptySection,
  essentialGaps,
  isOptionalSection,
  isRenameableSection,
  reorder,
  sectionTitle,
  type CvEntry,
  type CvImportDraft,
  type CvSection,
  type CvSectionKind,
  type CvSuggestionAction,
  type StructuredCv,
} from '../domain';
import { useAutosave } from '../hooks/use-autosave';
import { AutosaveStatus } from './autosave-status';
import { CvEntryEditor, type EntrySuggestion } from './cv-entry-editor';
import { CvImportFlow, type ExistingDocument } from './cv-import-flow';
import { CvSteps } from './cv-steps';
import { StrategyPanel } from './panel';
import { StateBlock } from './states';

/**
 * "Nội dung CV" — CV step 2. The largest surface in the feature and the one with
 * no approved design, so it is built from the conventions of the screens that do
 * have one.
 *
 * IT READS AS A DOCUMENT, NOT A DASHBOARD. Sections stack in one column in the
 * order they will print. There is no sidebar, no summary tiles, no completion
 * percentage. The student is editing a CV, and the page's job is to look like the
 * thing they are editing.
 *
 * THE WHOLE DOCUMENT LIVES IN ONE PIECE OF STATE and is PATCHed back whole. The
 * alternative — per-entry saves — means reconciling a deleted entry against an
 * array index on the server, which is far more moving parts than rewriting a
 * structure that is a few kilobytes at most.
 */

export type CvContentWorkspaceProps = {
  applicationId: string;
  initial: StructuredCv | null;
  documents: readonly ExistingDocument[];
  hasTargetProfile: boolean;
};

export function CvContentWorkspace({
  applicationId,
  initial,
  documents,
  hasTargetProfile,
}: CvContentWorkspaceProps) {
  const [sections, setSections] = useState<CvSection[]>(initial?.sections ?? []);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [suggestion, setSuggestion] = useState<EntrySuggestion | null>(null);
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const persist = useCallback(
    async (next: CvSection[]) => {
      const response = await fetch(`/api/applications/${applicationId}/cv`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: next }),
      });
      if (!response.ok) throw new Error('save failed');
      const data = (await response.json()) as { version?: number };
      return { version: data.version };
    },
    [applicationId],
  );

  const autosave = useAutosave(persist, { initialVersion: initial?.contentVersion });

  /** Every mutation goes through here, so nothing can change without saving. */
  const commit = useCallback(
    (next: CvSection[]) => {
      setSections(next);
      autosave.save(next);
    },
    [autosave],
  );

  const updateSection = useCallback(
    (sectionId: string, patch: Partial<CvSection>) => {
      setSections((current) => {
        const next = current.map((s) => (s.id === sectionId ? { ...s, ...patch } : s));
        autosave.save(next);
        return next;
      });
    },
    [autosave],
  );

  const updateEntry = useCallback(
    (sectionId: string, entryId: string, patch: Partial<CvEntry>) => {
      setSections((current) => {
        const next = current.map((s) =>
          s.id === sectionId
            ? { ...s, entries: s.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)) }
            : s,
        );
        autosave.save(next);
        return next;
      });
    },
    [autosave],
  );

  function moveSection(index: number, delta: number) {
    commit(reorder(sections, index, index + delta));
  }

  function moveEntry(sectionId: string, index: number, delta: number) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    updateSection(sectionId, { entries: reorder(section.entries, index, index + delta) });
  }

  function addSection(kind: CvSectionKind) {
    const section = emptySection(kind);
    commit([...sections, section]);
    if (section.entries[0]) setExpanded(section.entries[0].id);
  }

  function addEntry(sectionId: string) {
    const entry = emptyEntry();
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    updateSection(sectionId, { entries: [...section.entries, entry] });
    setExpanded(entry.id);
  }

  async function requestSuggestion(
    section: CvSection,
    entry: CvEntry,
    bulletIndex: number,
    line: string,
    action: CvSuggestionAction,
  ) {
    const key = `${entry.id}:${bulletIndex}`;
    setSuggesting(key);
    setSuggestion(null);
    setSuggestionError(null);

    try {
      const response = await fetch(`/api/applications/${applicationId}/cv/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          line,
          section: sectionTitle(section),
          role: entry.role ?? null,
          organization: entry.organization ?? null,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        original?: string;
        suggested?: string;
        note?: string;
        unchanged?: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok || typeof data.suggested !== 'string') {
        setSuggestionError(data.error ?? 'We could not generate a suggestion.');
        return;
      }

      setSuggestion({
        entryId: entry.id,
        bulletIndex,
        original: data.original ?? line,
        suggested: data.suggested,
        note: data.note ?? '',
        unchanged: data.unchanged ?? false,
      });
    } catch {
      setSuggestionError('We could not reach Glowbal. Check your connection and try again.');
    } finally {
      setSuggesting(null);
    }
  }

  /**
   * Accepting a suggestion is an ordinary edit. It replaces one bullet and flows
   * through the same autosave as typing — there is no separate "apply AI" path,
   * which is what keeps the never-silently-overwrite property structural.
   */
  function acceptSuggestion(sectionId: string, text: string) {
    if (!suggestion) return;
    const section = sections.find((s) => s.id === sectionId);
    const entry = section?.entries.find((e) => e.id === suggestion.entryId);
    if (!entry) return;

    updateEntry(sectionId, suggestion.entryId, {
      bullets: entry.bullets.map((b, i) => (i === suggestion.bulletIndex ? text : b)),
    });
    setSuggestion(null);
  }

  if (importing) {
    return (
      <CvImportFlow
        applicationId={applicationId}
        documents={documents}
        hasExistingContent={countEntries(sections) > 0}
        onCancel={() => setImporting(false)}
        onConfirm={(draft: CvImportDraft) => {
          commit(draft.sections);
          setImporting(false);
          setExpanded(draft.sections[0]?.entries[0]?.id ?? null);
        }}
      />
    );
  }

  const entryCount = countEntries(sections);
  const gaps = essentialGaps(sections);
  const unusedKinds = CV_SECTION_KINDS.filter(
    (kind) => kind !== 'custom' && !sections.some((s) => s.kind === kind),
  );

  return (
    <div className="flex flex-col gap-gb-3xl">
      <CvSteps applicationId={applicationId} current="content" furthestReached="content" />

      <header className="flex flex-col gap-gb-lg">
        <div className="flex flex-wrap items-start justify-between gap-gb-lg">
          <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
            Nội dung CV
          </h1>
          <AutosaveStatus
            status={autosave.status}
            version={autosave.version}
            onRetry={autosave.retry}
          />
        </div>
        <p className="max-w-3xl text-gb-md text-fg-tertiary">
          Nhập nội dung theo từng mục. Bạn có thể sắp xếp lại thứ tự, thêm hoặc bớt mục, và nhờ AI
          viết lại từng dòng. AI chỉ đề xuất — không tự thay đổi nội dung của bạn.
        </p>
      </header>

      {!hasTargetProfile ? (
        <StateBlock
          title="Bạn chưa tạo target profile"
          body="CV sẽ được đánh giá dựa trên target profile. Bạn vẫn có thể nhập nội dung trước."
          action={{
            label: 'Tạo target profile',
            href: `/ai-strategy/${applicationId}/cv/target-profile`,
          }}
        />
      ) : null}

      {sections.length === 0 ? (
        <StrategyPanel>
          <div className="flex flex-col gap-gb-xl">
            <div className="flex flex-col gap-gb-md">
              <h2 className="text-gb-lg font-semibold text-fg">Bắt đầu từ đâu</h2>
              <p className="max-w-2xl text-gb-md text-fg-tertiary">
                {documents.length > 0
                  ? 'Bạn đã tải lên một CV. Nhập từ CV đó là cách nhanh nhất.'
                  : 'Nhập từ CV có sẵn, tạo từ hồ sơ Glowbal, hoặc nhập thủ công.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-gb-lg">
              <Button size="lg" onClick={() => setImporting(true)}>
                <KitIcon art={ICONS.uploadCloud} frame={16} />
                {documents.length > 0 ? 'Nhập từ CV đã tải lên' : 'Nhập từ CV'}
              </Button>
              <Button size="lg" variant="secondary" onClick={() => commit(defaultStarter())}>
                Nhập thủ công
              </Button>
            </div>
          </div>
        </StrategyPanel>
      ) : null}

      {sections.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-gb-lg rounded-gb-xl border border-line bg-surface-muted px-gb-2xl py-gb-lg">
          <span className="text-gb-sm text-fg-tertiary">
            {sections.length} mục · {entryCount} nội dung
          </span>
          <button
            type="button"
            onClick={() => setImporting(true)}
            className="inline-flex items-center gap-gb-xs rounded-gb-md text-gb-sm font-medium text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <KitIcon art={ICONS.uploadCloud} frame={14} />
            Nhập lại từ CV khác
          </button>
        </div>
      ) : null}

      {sections.map((section, sectionIndex) => (
        <StrategyPanel key={section.id} padding="sm">
          <header className="flex flex-wrap items-center justify-between gap-gb-lg">
            {isRenameableSection(section.kind) ? (
              <input
                value={section.title ?? ''}
                placeholder="Tên mục"
                aria-label="Section name"
                onChange={(event) => updateSection(section.id, { title: event.target.value })}
                className="min-w-0 flex-1 rounded-gb-md border border-line-strong bg-surface px-gb-lg py-gb-xs text-gb-md font-semibold text-fg focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
              />
            ) : (
              <h2 className="text-gb-md font-semibold text-fg">{sectionTitle(section)}</h2>
            )}

            <div className="flex items-center gap-gb-xs">
              <IconButton
                label={`Move ${sectionTitle(section)} up`}
                disabled={sectionIndex === 0}
                onClick={() => moveSection(sectionIndex, -1)}
              >
                <KitIcon art={ICONS.arrowRight} frame={14} className="-rotate-90" />
              </IconButton>
              <IconButton
                label={`Move ${sectionTitle(section)} down`}
                disabled={sectionIndex === sections.length - 1}
                onClick={() => moveSection(sectionIndex, 1)}
              >
                <KitIcon art={ICONS.arrowRight} frame={14} className="rotate-90" />
              </IconButton>
              {isOptionalSection(section.kind) ? (
                <IconButton
                  label={`Remove the ${sectionTitle(section)} section`}
                  onClick={() => commit(sections.filter((s) => s.id !== section.id))}
                >
                  <KitIcon art={ICONS.trash} frame={14} />
                </IconButton>
              ) : null}
            </div>
          </header>

          <div className="flex flex-col gap-gb-lg">
            {section.entries.map((entry, entryIndex) => (
              <div key={entry.id} className="flex items-start gap-gb-md">
                <div className="min-w-0 flex-1">
                  <CvEntryEditor
                    entry={entry}
                    sectionKind={section.kind}
                    expanded={expanded === entry.id}
                    onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    onChange={(patch) => updateEntry(section.id, entry.id, patch)}
                    onRemove={() =>
                      updateSection(section.id, {
                        entries: section.entries.filter((e) => e.id !== entry.id),
                      })
                    }
                    suggestion={suggestion?.entryId === entry.id ? suggestion : null}
                    suggesting={suggesting}
                    suggestionError={
                      suggesting === null && suggestionError && expanded === entry.id
                        ? suggestionError
                        : null
                    }
                    onRequestSuggestion={(bulletIndex, line, action) =>
                      void requestSuggestion(section, entry, bulletIndex, line, action)
                    }
                    onAcceptSuggestion={(text) => acceptSuggestion(section.id, text)}
                    onDismissSuggestion={() => {
                      setSuggestion(null);
                      setSuggestionError(null);
                    }}
                  />
                </div>

                {section.entries.length > 1 ? (
                  <div className="flex shrink-0 flex-col gap-gb-xs pt-gb-lg">
                    <IconButton
                      label={`Move entry ${entryIndex + 1} up`}
                      disabled={entryIndex === 0}
                      onClick={() => moveEntry(section.id, entryIndex, -1)}
                    >
                      <KitIcon art={ICONS.arrowRight} frame={14} className="-rotate-90" />
                    </IconButton>
                    <IconButton
                      label={`Move entry ${entryIndex + 1} down`}
                      disabled={entryIndex === section.entries.length - 1}
                      onClick={() => moveEntry(section.id, entryIndex, 1)}
                    >
                      <KitIcon art={ICONS.arrowRight} frame={14} className="rotate-90" />
                    </IconButton>
                  </div>
                ) : null}
              </div>
            ))}

            <button
              type="button"
              onClick={() => addEntry(section.id)}
              className="inline-flex w-fit items-center gap-gb-xs rounded-gb-md border border-dashed border-line-strong bg-surface px-gb-xl py-gb-md text-gb-sm font-medium text-fg-tertiary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <KitIcon art={ICONS.plus} frame={14} />
              Thêm nội dung
            </button>
          </div>
        </StrategyPanel>
      ))}

      {sections.length > 0 && unusedKinds.length > 0 ? (
        <StrategyPanel padding="sm">
          <p className="text-gb-sm font-semibold text-fg">Thêm mục</p>
          <div className="flex flex-wrap gap-gb-md">
            {unusedKinds.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => addSection(kind)}
                className="rounded-gb-full border border-line-strong bg-surface px-gb-lg py-gb-xs text-gb-xs font-medium text-fg-secondary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                + {SECTION_LABEL[kind]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => addSection('custom')}
              className="rounded-gb-full border border-line-strong bg-surface px-gb-lg py-gb-xs text-gb-xs font-medium text-fg-secondary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              + Mục tuỳ chỉnh
            </button>
          </div>
        </StrategyPanel>
      ) : null}

      {sections.length > 0 ? (
        <div className="flex flex-col gap-gb-lg">
          <div className="flex flex-wrap items-center gap-gb-xl">
            <Button size="lg" href={`/ai-strategy/${applicationId}/cv/review`}>
              Review my CV
            </Button>
          </div>
          {/* Informs, never gates. The student may be mid-way through and know
              exactly what is left. */}
          {gaps.length > 0 ? (
            <ul className="flex list-disc flex-col gap-gb-xxs pl-gb-2xl text-gb-xs text-fg-muted">
              {gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
              <li>Bạn vẫn có thể tiếp tục.</li>
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** A manual start: the sections almost every CV has, ready to type into. */
function defaultStarter(): CvSection[] {
  return [
    emptySection('contact'),
    emptySection('education'),
    emptySection('experience'),
    emptySection('activities'),
    emptySection('skills'),
  ];
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean | undefined;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      /* A full 40px target rather than a 20px icon hit area — this is the control
         the mobile rule about touch-friendly reordering is about. */
      className="flex size-gb-5xl items-center justify-center rounded-gb-md border border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"
    >
      {children}
    </button>
  );
}
