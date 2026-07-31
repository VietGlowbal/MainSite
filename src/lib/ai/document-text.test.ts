import { beforeEach, describe, expect, it, vi } from 'vitest';

const { extractRawText, extractText, getDocumentProxy } = vi.hoisted(() => ({
  extractRawText: vi.fn(async () => ({ value: 'Education\nComputer Science' })),
  extractText: vi.fn(),
  getDocumentProxy: vi.fn(async () => ({ numPages: 2 })),
}));

vi.mock('mammoth', () => ({
  default: { extractRawText },
}));

vi.mock('unpdf', () => ({ extractText, getDocumentProxy }));

import { extractDocumentBytes, extractPdfWithOcrFallback } from './document-text';

describe('extractDocumentBytes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractText.mockResolvedValue({
      totalPages: 2,
      text: ['FIRST PRIZE Hanoi Mathematics Olympiad 2025', 'Volunteer Coding Tutor 2024'],
    });
  });

  it('decodes plain text without storage or database access', async () => {
    const bytes = new TextEncoder().encode('  Experience\nBuilt a robotics club.  ');

    await expect(extractDocumentBytes(bytes, 'text/plain', 'cv.txt')).resolves.toBe(
      'Experience\nBuilt a robotics club.',
    );
  });

  it('extracts DOCX text from the uploaded bytes', async () => {
    const bytes = new Uint8Array([80, 75, 3, 4]);

    await expect(
      extractDocumentBytes(
        bytes,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'cv.docx',
      ),
    ).resolves.toBe('Education\nComputer Science');
    expect(extractRawText).toHaveBeenCalledWith({ buffer: expect.any(Buffer) });
  });

  it('returns null for unsupported binary formats', async () => {
    await expect(
      extractDocumentBytes(new Uint8Array([1, 2, 3]), 'image/png', 'cv.png'),
    ).resolves.toBeNull();
  });
});

describe('extractPdfWithOcrFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps readable PDF text and reports no OCR work', async () => {
    extractText.mockResolvedValue({
      totalPages: 2,
      text: ['FIRST PRIZE Hanoi Mathematics Olympiad 2025', 'Volunteer Coding Tutor 2024'],
    });

    const result = await extractPdfWithOcrFallback(new Uint8Array([37, 80, 68, 70]));

    expect(result.pages.map(({ page, text }) => ({ page, text }))).toEqual([
      { page: 1, text: 'FIRST PRIZE Hanoi Mathematics Olympiad 2025' },
      { page: 2, text: 'Volunteer Coding Tutor 2024' },
    ]);
    expect(result.ocrPageNumbers).toEqual([]);
    expect(result.coverage).toBe(1);
  });

  it('marks image-only pages for the future OCR provider without losing readable pages', async () => {
    extractText.mockResolvedValue({
      totalPages: 3,
      text: ['Education and academic achievements', '', 'Leadership Club President 2023'],
    });

    const result = await extractPdfWithOcrFallback(new Uint8Array([37, 80, 68, 70]));

    expect(result.ocrPageNumbers).toEqual([2]);
    expect(result.pages[1]).toEqual({ page: 2, text: '', source: 'unreadable' });
    expect(result.coverage).toBeCloseTo(2 / 3);
  });

  it('uses an injected OCR provider only for unreadable pages', async () => {
    extractText.mockResolvedValue({ totalPages: 2, text: ['Readable CV text', ''] });
    const ocr = vi.fn(async () => new Map([[2, 'Certificate of Achievement 2025']]));

    const result = await extractPdfWithOcrFallback(
      new Uint8Array([37, 80, 68, 70]),
      ocr,
    );

    expect(ocr).toHaveBeenCalledWith(expect.any(Uint8Array), [2]);
    expect(result.ocrPageNumbers).toEqual([]);
    expect(result.pages[1]).toEqual({
      page: 2,
      text: 'Certificate of Achievement 2025',
      source: 'ocr',
    });
  });
});
