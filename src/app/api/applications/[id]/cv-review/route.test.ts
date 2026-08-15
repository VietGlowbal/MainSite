import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createClientMock,
  extractDocumentBytesMock,
  fetchApplicationWorkspaceMock,
  streamCvReviewMock,
  streamOpenAITextMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  extractDocumentBytesMock: vi.fn(),
  fetchApplicationWorkspaceMock: vi.fn(),
  streamCvReviewMock: vi.fn(),
  streamOpenAITextMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/api/application-workspace', () => ({
  fetchApplicationWorkspace: fetchApplicationWorkspaceMock,
}));
vi.mock('@/lib/ai/document-text', () => ({
  extractDocumentBytes: extractDocumentBytesMock,
}));
vi.mock('@/lib/ai/cv-review', () => ({
  streamCvReview: streamCvReviewMock,
}));
vi.mock('@/lib/ai/vinuni-grounded-evaluation', () => ({
  streamOpenAIText: streamOpenAITextMock,
}));

import { POST } from './route';

const context = { params: Promise.resolve({ id: 'app-1' }) };
const cvText = `EDUCATION
VinUniversity, Computer Science
EXPERIENCE
Built a robotics programme for 30 students.`;

function jsonRequest(text = cvText, template = 'technical') {
  return new Request('http://localhost/api/applications/app-1/cv-review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, template }),
  });
}

describe('POST /api/applications/[id]/cv-review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OPENAI_API_KEY', 'openai-key');
    vi.stubEnv('OPENAI_MODEL', '');
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
      },
    });
    fetchApplicationWorkspaceMock.mockResolvedValue({
      application: {
        id: 'app-1',
        universityName: 'VinUniversity',
        courseName: 'BSc Computer Science',
        degreeLevel: 'Undergraduate',
        subject: 'Computer Science',
      },
      course: {
        entryRequirementsSummary: 'Strong mathematics and English.',
      },
    });
    streamCvReviewMock.mockImplementation(async function* () {
      yield {
        type: 'section',
        section: 'summary',
        data: { communicationReadiness: 'Clear' },
      };
      yield {
        type: 'complete',
        analysis: { overallScore: 7.2 },
        timing: { firstSectionMs: 900, totalMs: 12000 },
      };
    });
  });

  it('authenticates, derives target context and streams NDJSON through OpenAI', async () => {
    const response = await POST(jsonRequest(), context);
    const events = (await response.text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    expect(events.map(({ type }) => type)).toEqual(['section', 'complete']);
    expect(fetchApplicationWorkspaceMock).toHaveBeenCalledWith('app-1', 'user-1');
    expect(streamCvReviewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cvText,
        template: 'technical',
        apiKey: 'openai-key',
        model: 'gpt-4o',
        stream: streamOpenAITextMock,
        targetProfile: {
          universityName: 'VinUniversity',
          programmeName: 'BSc Computer Science',
          degreeLevel: 'Undergraduate',
          subject: 'Computer Science',
          entryRequirements: 'Strong mathematics and English.',
        },
      }),
    );
  });

  it('extracts an uploaded DOCX in memory without persisting it', async () => {
    extractDocumentBytesMock.mockResolvedValue(cvText);
    const body = new FormData();
    body.set('template', 'academic');
    body.set(
      'file',
      new File([new Uint8Array([80, 75, 3, 4])], 'cv.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    );

    const response = await POST(
      new Request('http://localhost/api/applications/app-1/cv-review', {
        method: 'POST',
        body,
      }),
      context,
    );
    await response.text();

    expect(response.status).toBe(200);
    expect(extractDocumentBytesMock).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'cv.docx',
    );
    expect(streamCvReviewMock).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'academic' }),
    );
  });

  it('rejects a missing or unsupported CV format before opening the stream', async () => {
    const missing = new Request('http://localhost/api/applications/app-1/cv-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cvText }),
    });

    expect((await POST(missing, context)).status).toBe(400);
    expect((await POST(jsonRequest(cvText, 'leadership'), context)).status).toBe(400);
    expect(streamCvReviewMock).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated and unauthorized application requests', async () => {
    createClientMock.mockResolvedValueOnce({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    });
    expect((await POST(jsonRequest(), context)).status).toBe(401);

    fetchApplicationWorkspaceMock.mockResolvedValueOnce(null);
    expect((await POST(jsonRequest(), context)).status).toBe(404);
  });

  it('rejects unreadable or undersized CV input before opening the stream', async () => {
    expect((await POST(jsonRequest('short'), context)).status).toBe(400);

    extractDocumentBytesMock.mockResolvedValueOnce(null);
    const body = new FormData();
    body.set('template', 'academic');
    body.set('file', new File([new Uint8Array([1, 2])], 'scan.pdf', { type: 'application/pdf' }));
    const response = await POST(
      new Request('http://localhost/api/applications/app-1/cv-review', {
        method: 'POST',
        body,
      }),
      context,
    );
    expect(response.status).toBe(400);
  });

  it('rejects oversized pasted CV text before sending it to OpenAI', async () => {
    const response = await POST(jsonRequest('A'.repeat(15_001)), context);

    expect(response.status).toBe(413);
    expect(streamCvReviewMock).not.toHaveBeenCalled();
  });
});
