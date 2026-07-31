'use client';

import { useState } from 'react';
import { Button, FileDropzone, ICONS, KitIcon } from '@/shared/ui';
import { useDocumentUpload } from '@/shared/hooks';
import {
  SECTION_LABEL,
  countUncertain,
  sectionTitle,
  uncertainFields,
  type CvImportDraft,
} from '../domain';
import { StrategyPanel } from './panel';
import { GeneratingState, StateBlock, UnreadableCvState } from './states';

/**
 * CV import: pick a source, watch it parse, confirm what came out.
 *
 * WHY CONFIRMATION IS A SCREEN AND NOT A TOAST. The student is about to adopt
 * machine-extracted text as their own CV content. They need to see what was
 * extracted, in the same shape the editor will show it, before it becomes theirs.
 * Nothing is written until they press through — the import endpoint has no write
 * path at all — so cancelling genuinely leaves existing content untouched.
 *
 * WHY THERE IS NO PERCENTAGE. The phases are real: uploading, then extracting
 * text, then the model call. None of them reports progress, so a bar that creeps
 * to 90% and stalls would be invented. A named phase is honest and is what
 * `use-document-upload.ts` already settled on for the same reason.
 */

export type ExistingDocument = {
  id: string;
  fileName: string;
  uploadedAt: string | null;
  sizeLabel: string | null;
};

type Phase =
  | { kind: 'picking' }
  | { kind: 'uploading' }
  | { kind: 'reading' }
  | { kind: 'organizing' }
  | { kind: 'confirming'; draft: CvImportDraft; sourceDocumentId: string | null }
  | { kind: 'unreadable' }
  | { kind: 'pasting' }
  | { kind: 'no_content'; notes: string[] }
  | { kind: 'failed'; message: string };

export function CvImportFlow({
  applicationId,
  documents,
  hasExistingContent,
  onCancel,
  onConfirm,
}: {
  applicationId: string;
  /** CVs the student has already uploaded, newest first. */
  documents: readonly ExistingDocument[];
  /** Drives the overwrite confirmation. */
  hasExistingContent: boolean;
  onCancel: () => void;
  onConfirm: (draft: CvImportDraft, sourceDocumentId: string | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'picking' });
  const [pasted, setPasted] = useState('');
  const [confirmingOverwrite, setConfirmingOverwrite] = useState(false);
  const upload = useDocumentUpload();

  async function runImport(body: Record<string, unknown>, startPhase: Phase) {
    setPhase(startPhase);
    try {
      const response = await fetch(`/api/applications/${applicationId}/cv/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        reason?: string;
        draft?: CvImportDraft;
        sourceDocumentId?: string | null;
        notes?: string[];
        error?: string;
      };

      if (data.ok && data.draft) {
        setPhase({
          kind: 'confirming',
          draft: data.draft,
          sourceDocumentId: data.sourceDocumentId ?? null,
        });
        return;
      }

      if (data.reason === 'unreadable') {
        setPhase({ kind: 'unreadable' });
        return;
      }
      if (data.reason === 'no_content') {
        setPhase({ kind: 'no_content', notes: data.notes ?? [] });
        return;
      }

      setPhase({ kind: 'failed', message: data.error ?? 'We could not read that CV.' });
    } catch {
      setPhase({
        kind: 'failed',
        message: 'We could not reach Glowbal. Check your connection and try again.',
      });
    }
  }

  async function importDocument(documentId: string) {
    // 'reading' rather than 'uploading': the file is already in storage, so the
    // first real phase is text extraction.
    await runImport({ mode: 'document', documentId }, { kind: 'reading' });
  }

  async function importFiles(files: File[]) {
    setPhase({ kind: 'uploading' });
    const settled = await upload.upload(files, 'cv');
    const uploaded = settled.find((item) => item.status === 'complete' && item.documentId);

    if (!uploaded?.documentId) {
      setPhase({
        kind: 'failed',
        message: settled[0]?.error ?? 'We could not upload that file.',
      });
      return;
    }

    await importDocument(uploaded.documentId);
  }

  async function importPaste() {
    await runImport({ mode: 'paste', text: pasted }, { kind: 'organizing' });
  }

  async function importProfile() {
    await runImport({ mode: 'profile' }, { kind: 'organizing' });
  }

  function finish(draft: CvImportDraft, sourceDocumentId: string | null) {
    if (hasExistingContent && !confirmingOverwrite) {
      setConfirmingOverwrite(true);
      return;
    }
    onConfirm(draft, sourceDocumentId);
  }

  return (
    <div className="flex flex-col gap-gb-3xl">
      <header className="flex flex-col gap-gb-md">
        <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
          Nhập nội dung từ CV
        </h1>
        <p className="max-w-3xl text-gb-md text-fg-tertiary">
          Nội dung sẽ được tách thành từng mục để bạn kiểm tra trước khi lưu. Chưa có gì được ghi
          vào CV của bạn cho đến khi bạn xác nhận.
        </p>
      </header>

      {phase.kind === 'picking' ? (
        <StrategyPanel>
          <div className="flex flex-col gap-gb-xl">
            {documents.length > 0 ? (
              <div className="flex flex-col gap-gb-md">
                <h2 className="text-gb-sm font-semibold text-fg">CV bạn đã tải lên</h2>
                <ul className="flex flex-col gap-gb-md">
                  {documents.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-gb-lg rounded-gb-xl border border-line bg-surface-muted p-gb-xl"
                    >
                      <div className="flex min-w-0 items-center gap-gb-lg">
                        <span aria-hidden className="shrink-0 text-fg-muted">
                          <KitIcon art={ICONS.uploadCloud} frame={20} />
                        </span>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-gb-sm font-semibold text-fg">
                            {doc.fileName}
                          </span>
                          <span className="text-gb-xs text-fg-muted">
                            {[doc.uploadedAt, doc.sizeLabel].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => void importDocument(doc.id)}>
                        Nhập từ file này
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-col gap-gb-md">
              <h2 className="text-gb-sm font-semibold text-fg">
                {documents.length > 0 ? 'Hoặc tải lên CV khác' : 'Tải lên CV'}
              </h2>
              <FileDropzone
                onFiles={(files) => void importFiles(files)}
                accept=".pdf,.doc,.docx,.txt"
                label="Kéo CV vào đây, hoặc chọn file"
                hint="PDF có lớp văn bản đọc được tốt nhất. Tối đa 10MB."
              />
            </div>

            <div className="flex flex-wrap items-center gap-gb-xl border-t border-line pt-gb-xl">
              <Button size="sm" variant="secondary" onClick={() => void importProfile()}>
                Tạo từ hồ sơ Glowbal
              </Button>
              <button
                type="button"
                onClick={() => setPhase({ kind: 'pasting' })}
                className="rounded-gb-md text-gb-sm font-medium text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Dán nội dung CV
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-gb-md text-gb-sm font-medium text-fg-tertiary hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Huỷ
              </button>
            </div>
          </div>
        </StrategyPanel>
      ) : null}

      {phase.kind === 'uploading' ? <GeneratingState title="Uploading" /> : null}
      {phase.kind === 'reading' ? (
        <GeneratingState title="Reading document" body="Extracting the text from your file." />
      ) : null}
      {phase.kind === 'organizing' ? (
        <GeneratingState title="Organizing content" body="Splitting it into CV sections." />
      ) : null}

      {phase.kind === 'unreadable' ? (
        <UnreadableCvState
          onPasteText={() => setPhase({ kind: 'pasting' })}
          onManual={onCancel}
          onTryAnother={() => setPhase({ kind: 'picking' })}
        />
      ) : null}

      {phase.kind === 'no_content' ? (
        <StateBlock
          tone="attention"
          title="Chúng tôi không tìm thấy nội dung CV trong file này"
          body={
            phase.notes.length > 0
              ? phase.notes.join(' ')
              : 'File đọc được nhưng không giống một CV. Bạn có thể dán nội dung hoặc nhập thủ công.'
          }
          action={{ label: 'Paste CV text', onClick: () => setPhase({ kind: 'pasting' }) }}
          secondary={{ label: 'Nhập thủ công', onClick: onCancel }}
        />
      ) : null}

      {phase.kind === 'failed' ? (
        <StateBlock
          tone="error"
          title="Không nhập được CV"
          body={phase.message}
          action={{ label: 'Try again', onClick: () => setPhase({ kind: 'picking' }) }}
          secondary={{ label: 'Nhập thủ công', onClick: onCancel }}
        />
      ) : null}

      {phase.kind === 'pasting' ? (
        <StrategyPanel>
          <div className="flex flex-col gap-gb-lg">
            <label htmlFor="paste-cv" className="text-gb-sm font-semibold text-fg">
              Dán nội dung CV
            </label>
            <p className="text-gb-sm text-fg-tertiary">
              Mở CV của bạn, chọn tất cả, sao chép và dán vào đây. Cách này luôn hoạt động, kể cả
              với file scan.
            </p>
            <textarea
              id="paste-cv"
              name="paste-cv"
              rows={12}
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              placeholder="Dán toàn bộ nội dung CV vào đây..."
              className="w-full resize-y rounded-gb-md border border-line-strong bg-surface px-gb-xl py-gb-lg text-gb-sm text-fg placeholder:text-fg-placeholder focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
            />
            <div className="flex flex-wrap items-center gap-gb-xl">
              <Button size="sm" onClick={() => void importPaste()} disabled={pasted.trim().length < 40}>
                Tách thành từng mục
              </Button>
              {pasted.trim().length > 0 && pasted.trim().length < 40 ? (
                <span className="text-gb-xs text-fg-muted">Cần thêm nội dung để tách.</span>
              ) : null}
              <button
                type="button"
                onClick={() => setPhase({ kind: 'picking' })}
                className="rounded-gb-md text-gb-sm font-medium text-fg-tertiary hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Quay lại
              </button>
            </div>
          </div>
        </StrategyPanel>
      ) : null}

      {phase.kind === 'confirming' ? (
        <ConfirmationView
          draft={phase.draft}
          hasExistingContent={hasExistingContent}
          confirmingOverwrite={confirmingOverwrite}
          onBack={() => {
            setConfirmingOverwrite(false);
            setPhase({ kind: 'picking' });
          }}
          onCancel={onCancel}
          onConfirm={() => finish(phase.draft, phase.sourceDocumentId)}
        />
      ) : null}
    </div>
  );
}

/**
 * The extracted content, in the same section-card treatment the editor uses.
 *
 * Deliberately read-only. Correcting a field here would mean building a second
 * editor that has to stay in step with the real one; the student confirms, lands
 * in the editor, and corrects there — where every field is already editable and
 * autosaved.
 */
function ConfirmationView({
  draft,
  hasExistingContent,
  confirmingOverwrite,
  onBack,
  onCancel,
  onConfirm,
}: {
  draft: CvImportDraft;
  hasExistingContent: boolean;
  confirmingOverwrite: boolean;
  onBack: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const uncertainCount = countUncertain(draft);
  const entryCount = draft.sections.reduce((n, s) => n + s.entries.length, 0);

  return (
    <>
      <StateBlock
        title="Ready to review"
        body={
          uncertainCount > 0
            ? `We found ${draft.sections.length} sections and ${entryCount} entries. ${uncertainCount} field${uncertainCount === 1 ? '' : 's'} we were unsure about are marked "Please check".`
            : `We found ${draft.sections.length} sections and ${entryCount} entries.`
        }
      />

      {draft.notes.length > 0 ? (
        <ul className="flex list-disc flex-col gap-gb-xs pl-gb-2xl text-gb-sm text-fg-tertiary">
          {draft.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      {draft.sections.map((section) => (
        <StrategyPanel key={section.id} padding="sm">
          <h2 className="text-gb-md font-semibold text-fg">
            {sectionTitle(section) || SECTION_LABEL[section.kind]}
          </h2>
          <div className="flex flex-col gap-gb-lg">
            {section.entries.map((entry) => {
              const flagged = uncertainFields(draft, entry.id);
              return (
                <div
                  key={entry.id}
                  className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-surface-muted p-gb-xl"
                >
                  <div className="flex flex-wrap items-center gap-gb-md">
                    <span className="text-gb-sm font-semibold text-fg">
                      {entry.role || entry.organization || '—'}
                    </span>
                    {flagged.length > 0 ? (
                      <span className="rounded-gb-full bg-brand-subtle px-gb-md py-gb-xxs text-gb-xs font-semibold text-fg-brand">
                        Please check: {flagged.join(', ')}
                      </span>
                    ) : null}
                  </div>

                  {[entry.organization, entry.location, [entry.startDate, entry.current ? 'present' : entry.endDate].filter(Boolean).join(' – ')]
                    .filter((v) => v && String(v).trim().length > 0)
                    .join(' · ') ? (
                    <p className="text-gb-xs text-fg-muted">
                      {[
                        entry.organization,
                        entry.location,
                        [entry.startDate, entry.current ? 'present' : entry.endDate]
                          .filter(Boolean)
                          .join(' – '),
                      ]
                        .filter((v) => v && String(v).trim().length > 0)
                        .join(' · ')}
                    </p>
                  ) : null}

                  {entry.bullets.length > 0 ? (
                    <ul className="flex list-disc flex-col gap-gb-xs pl-gb-2xl text-gb-sm text-fg-tertiary">
                      {entry.bullets.map((bullet, index) => (
                        <li key={`${entry.id}-${index}`}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}

                  {entry.evidence ? (
                    <p className="text-gb-xs text-fg-muted">Evidence: {entry.evidence}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </StrategyPanel>
      ))}

      {confirmingOverwrite ? (
        <StateBlock
          tone="attention"
          title="Thay thế nội dung CV hiện tại?"
          body="Bạn đã có nội dung CV trong Glowbal. Nhập từ file này sẽ thay thế nội dung đó."
          action={{ label: 'Thay thế nội dung', onClick: onConfirm }}
          secondary={{ label: 'Huỷ', onClick: onCancel }}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-gb-xl">
          <Button size="lg" onClick={onConfirm}>
            {hasExistingContent ? 'Thay thế bằng nội dung này' : 'Start with this content'}
          </Button>
          <button
            type="button"
            onClick={onBack}
            className="rounded-gb-md text-gb-sm font-medium text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Chọn file khác
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-gb-md text-gb-sm font-medium text-fg-tertiary hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Cancel import
          </button>
        </div>
      )}
    </>
  );
}
