import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createClientMock,
  createAdminClientMock,
  extractPdfWithOcrFallbackMock,
  extractReflectionEvidenceCandidatesMock,
  deepSeekCompletionMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  extractPdfWithOcrFallbackMock: vi.fn(),
  extractReflectionEvidenceCandidatesMock: vi.fn(),
  deepSeekCompletionMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }));
vi.mock('@/lib/ai/document-text', () => ({
  extractPdfWithOcrFallback: extractPdfWithOcrFallbackMock,
}));
vi.mock('@/lib/ai/reflection-evidence-extraction', () => ({
  extractReflectionEvidenceCandidates: extractReflectionEvidenceCandidatesMock,
}));
vi.mock('@/lib/ai/vinuni-grounded-evaluation', () => ({
  deepSeekCompletion: deepSeekCompletionMock,
}));

import { POST } from './route';

const DOC_ID = '11111111-1111-4111-8111-111111111111';

function userClient(documents: unknown[]) {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: documents, error: null })),
        })),
      })),
    })),
  };
}

describe('POST /api/reflection/extract-evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DEEPSEEK_API_KEY', 'deepseek-key');
    vi.stubEnv('DEEPSEEK_DOCUMENT_MODEL', 'deepseek-v4-flash');
    const updateEq = vi.fn(async () => ({ error: null }));
    createAdminClientMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          download: vi.fn(async () => ({
            data: new Blob([new Uint8Array([37, 80, 68, 70])]),
            error: null,
          })),
        })),
      },
      from: vi.fn(() => ({ update: vi.fn(() => ({ eq: updateEq })) })),
    });
    extractReflectionEvidenceCandidatesMock.mockResolvedValue({
      candidates: [
        {
          candidateId: 'a-1',
          kind: 'achievement',
          confidence: 'high',
          data: { category: 'competition', title: 'First Prize' },
          sourceRefs: [{ documentId: DOC_ID, page: 1, quote: 'First Prize' }],
        },
      ],
      rejectedCount: 0,
    });
  });

  it('returns candidates plus visible unpdf coverage metrics', async () => {
    createClientMock.mockResolvedValue(
      userClient([
        {
          id: DOC_ID,
          storage_key: 'user-1/other/cv.pdf',
          file_name: 'cv.pdf',
          mime_type: 'application/pdf',
        },
      ]),
    );
    extractPdfWithOcrFallbackMock.mockResolvedValue({
      pages: [{ page: 1, text: 'First Prize', source: 'text_layer' }],
      totalPages: 1,
      ocrPageNumbers: [],
      coverage: 1,
      charactersExtracted: 11,
    });

    const response = await POST(
      new Request('http://localhost/api/reflection/extract-evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: [DOC_ID] }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.documents[0]).toEqual(
      expect.objectContaining({ coverage: 1, pagesReadable: 1, pagesNeedingOcr: [] }),
    );
    expect(body.candidates).toHaveLength(1);
    expect(extractReflectionEvidenceCandidatesMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'deepseek-v4-flash', apiKey: 'deepseek-key' }),
    );
  });

  it('reports OCR-required scans without calling the model', async () => {
    createClientMock.mockResolvedValue(
      userClient([
        {
          id: DOC_ID,
          storage_key: 'user-1/other/scan.pdf',
          file_name: 'scan.pdf',
          mime_type: 'application/pdf',
        },
      ]),
    );
    extractPdfWithOcrFallbackMock.mockResolvedValue({
      pages: [{ page: 1, text: '', source: 'unreadable' }],
      totalPages: 1,
      ocrPageNumbers: [1],
      coverage: 0,
      charactersExtracted: 0,
    });
    extractReflectionEvidenceCandidatesMock.mockResolvedValue({
      candidates: [],
      rejectedCount: 0,
    });

    const response = await POST(
      new Request('http://localhost/api/reflection/extract-evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: [DOC_ID] }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ocrRequired).toBe(true);
    expect(body.candidates).toEqual([]);
    expect(extractReflectionEvidenceCandidatesMock).not.toHaveBeenCalled();
  });
});
