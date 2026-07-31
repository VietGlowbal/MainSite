import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { extractPdfWithOcrFallback } from '@/lib/ai/document-text';
import { extractReflectionEvidenceCandidates } from '@/lib/ai/reflection-evidence-extraction';
import { deepSeekCompletion } from '@/lib/ai/vinuni-grounded-evaluation';

export const runtime = 'nodejs';
export const maxDuration = 60;

const requestSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(8),
});

type DocumentRow = {
  id: string;
  storage_key: string;
  file_name: string;
  mime_type: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsedRequest = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) {
    return NextResponse.json({ error: 'Dữ liệu tài liệu không hợp lệ.' }, { status: 400 });
  }

  const documentIds = [...new Set(parsedRequest.data.documentIds)];
  const { data, error } = await supabase
    .from('uploaded_documents')
    .select('id,storage_key,file_name,mime_type')
    .in('id', documentIds)
    .eq('user_id', user.id);
  const documents = (data ?? []) as DocumentRow[];
  if (error || documents.length !== documentIds.length) {
    return NextResponse.json({ error: 'Không tìm thấy tài liệu.' }, { status: 404 });
  }
  if (
    documents.some(
      (document) =>
        !document.file_name.toLowerCase().endsWith('.pdf') &&
        !document.mime_type?.toLowerCase().includes('pdf'),
    )
  ) {
    return NextResponse.json({ error: 'Tính năng tự điền hiện chỉ hỗ trợ PDF.' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const extractedDocuments = await Promise.all(
      documents.map(async (document) => {
        const { data: file, error: downloadError } = await admin.storage
          .from('student-documents')
          .download(document.storage_key);
        if (downloadError || !file) throw new Error('DOCUMENT_DOWNLOAD_FAILED');

        const bytes = new Uint8Array(await file.arrayBuffer());
        const extraction = await extractPdfWithOcrFallback(bytes);
        const readableText = extraction.pages
          .filter(({ source }) => source !== 'unreadable')
          .map(({ text }) => text)
          .join('\n')
          .slice(0, 15_000);
        if (readableText) {
          await admin
            .from('uploaded_documents')
            .update({ parsed_text: readableText })
            .eq('id', document.id);
        }

        return { document, extraction };
      }),
    );

    const readableDocuments = extractedDocuments.map(({ document, extraction }) => ({
      documentId: document.id,
      fileName: document.file_name,
      pages: extraction.pages
        .filter(({ source }) => source !== 'unreadable')
        .map(({ page, text }) => ({ page, text })),
    }));
    const hasReadableText = readableDocuments.some(({ pages }) => pages.length > 0);
    let result = { candidates: [], rejectedCount: 0 } as Awaited<
      ReturnType<typeof extractReflectionEvidenceCandidates>
    >;

    if (hasReadableText) {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: 'AI service not configured.' }, { status: 500 });
      }
      result = await extractReflectionEvidenceCandidates({
        documents: readableDocuments,
        apiKey,
        model: process.env.DEEPSEEK_DOCUMENT_MODEL ?? 'deepseek-v4-flash',
        completion: deepSeekCompletion,
      });
    }

    const documentMetrics = extractedDocuments.map(({ document, extraction }) => ({
      documentId: document.id,
      fileName: document.file_name,
      totalPages: extraction.totalPages,
      pagesReadable: extraction.totalPages - extraction.ocrPageNumbers.length,
      pagesNeedingOcr: extraction.ocrPageNumbers,
      charactersExtracted: extraction.charactersExtracted,
      coverage: extraction.coverage,
    }));
    const ocrRequired = documentMetrics.some(({ pagesNeedingOcr }) => pagesNeedingOcr.length > 0);

    return NextResponse.json({
      documents: documentMetrics,
      candidates: result.candidates,
      rejectedCount: result.rejectedCount,
      ocrRequired,
      partial: ocrRequired,
      ocrProvider: 'not_configured',
    });
  } catch (routeError) {
    console.error('[reflection-evidence] extraction failed', {
      code: routeError instanceof Error ? routeError.message : 'UNKNOWN_ERROR',
    });
    return NextResponse.json(
      { error: 'Không thể đọc tài liệu. Vui lòng thử lại.' },
      { status: 502 },
    );
  }
}
