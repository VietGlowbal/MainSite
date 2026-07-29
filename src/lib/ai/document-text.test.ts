import { describe, expect, it, vi } from 'vitest';

const extractRawText = vi.hoisted(() =>
  vi.fn(async () => ({ value: 'Education\nComputer Science' })),
);

vi.mock('mammoth', () => ({
  default: { extractRawText },
}));

import { extractDocumentBytes } from './document-text';

describe('extractDocumentBytes', () => {
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
