'use client';

import { useState } from 'react';
import type {
  EvidenceCandidate,
  EvidenceExtractionResponse,
} from '@/features/apply/domain';
import { Button } from '@/shared/ui';

const confidenceLabel = {
  high: 'Tin cậy cao',
  medium: 'Cần kiểm tra',
  needs_confirmation: 'Cần xác nhận',
} as const;

function titleOf(candidate: EvidenceCandidate) {
  return candidate.data.title;
}

export function EvidenceExtractionPreview({
  result,
  onApply,
  onDismiss,
}: {
  result: EvidenceExtractionResponse;
  onApply: (candidates: EvidenceCandidate[]) => void;
  onDismiss: () => void;
}) {
  const [selected, setSelected] = useState(
    () => new Set(result.candidates.map(({ candidateId }) => candidateId)),
  );
  const selectedCandidates = result.candidates.filter(({ candidateId }) =>
    selected.has(candidateId),
  );

  return (
    <section className="rounded-gb-2xl border border-brand bg-surface p-gb-2xl">
      <div className="flex flex-wrap items-start justify-between gap-gb-lg">
        <div>
          <p className="text-gb-xs font-semibold uppercase tracking-[0.16em] text-fg-brand">
            Kết quả đọc PDF
          </p>
          <h3 className="mt-gb-xs text-gb-lg font-semibold text-fg-primary">
            Kiểm tra trước khi điền vào hồ sơ
          </h3>
        </div>
        <div className="rounded-full bg-brand-subtle px-gb-md py-gb-xs text-gb-sm font-semibold text-fg-brand">
          {result.candidates.length} mục được tìm thấy
        </div>
      </div>

      <div className="mt-gb-lg grid gap-gb-sm sm:grid-cols-2">
        {result.documents.map((document) => (
          <div
            key={document.documentId}
            className="rounded-gb-xl border border-line bg-surface-muted p-gb-md"
          >
            <p className="truncate text-gb-sm font-semibold text-fg-primary">
              {document.fileName}
            </p>
            <p className="mt-gb-xs text-gb-xs text-fg-secondary">
              unpdf đọc được {document.pagesReadable}/{document.totalPages} trang
              {' · '}
              {document.charactersExtracted.toLocaleString('vi-VN')} ký tự
            </p>
            {document.pagesNeedingOcr.length > 0 ? (
              <p className="mt-gb-xs text-gb-xs font-medium text-amber-700">
                Cần OCR trang {document.pagesNeedingOcr.join(', ')}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {result.candidates.length > 0 ? (
        <div className="mt-gb-xl grid gap-gb-md">
          {result.candidates.map((candidate) => {
            const title = titleOf(candidate);
            const source = candidate.sourceRefs[0];
            return (
              <label
                key={candidate.candidateId}
                className="flex cursor-pointer gap-gb-md rounded-gb-xl border border-line p-gb-lg hover:border-brand"
              >
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-pink-500"
                  checked={selected.has(candidate.candidateId)}
                  aria-label={`Chọn ${title}`}
                  onChange={(event) =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(candidate.candidateId);
                      else next.delete(candidate.candidateId);
                      return next;
                    })
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-gb-sm">
                    <span className="font-semibold text-fg-primary">{title}</span>
                    <span className="rounded-full bg-brand-subtle px-gb-sm py-0.5 text-gb-xs text-fg-brand">
                      {candidate.kind === 'achievement' ? 'Thành tích' : 'Hoạt động'}
                    </span>
                    <span className="text-gb-xs text-fg-secondary">
                      {confidenceLabel[candidate.confidence]}
                    </span>
                  </span>
                  {source ? (
                    <span className="mt-gb-xs block text-gb-xs text-fg-tertiary">
                      Trang {source.page}: “{source.quote}”
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="mt-gb-xl rounded-gb-xl bg-amber-50 p-gb-lg text-gb-sm text-fg-secondary">
          {result.ocrRequired
            ? 'PDF này chủ yếu là ảnh scan. unpdf chưa đọc được nội dung; nhánh OCR đã được chừa sẵn nhưng chưa kết nối cloud.'
            : 'Không tìm thấy thành tích hoặc hoạt động đủ dẫn chứng trong tài liệu.'}
        </div>
      )}

      {result.rejectedCount > 0 ? (
        <p className="mt-gb-md text-gb-xs text-fg-tertiary">
          Đã loại {result.rejectedCount} mục vì không khớp đoạn nguồn hoặc sai định dạng.
        </p>
      ) : null}

      <div className="mt-gb-xl flex flex-wrap gap-gb-md">
        {result.candidates.length > 0 ? (
          <Button
            type="button"
            disabled={selectedCandidates.length === 0}
            onClick={() => onApply(selectedCandidates)}
          >
            Điền {selectedCandidates.length} mục đã chọn
          </Button>
        ) : null}
        <Button type="button" variant="secondary" onClick={onDismiss}>
          Bỏ qua
        </Button>
      </div>
    </section>
  );
}
