'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  CvReviewAnalysis,
  CvReviewSectionEvent,
  CvReviewStreamEvent,
} from '@/lib/ai/cv-review';
import { useT } from '@/lib/i18n';
import { CvReviewFeedback } from './CvReviewFeedback';

async function readNdjson(
  response: Response,
  onEvent: (event: CvReviewStreamEvent) => void,
) {
  if (!response.body) throw new Error('AI service returned no stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) onEvent(JSON.parse(line) as CvReviewStreamEvent);
    }
    if (done) break;
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as CvReviewStreamEvent);
}

export function CvReviewWorkspace({
  applicationId,
  targetName,
}: {
  applicationId: string;
  targetName: string;
  contextNote?: string | null;
}) {
  const t = useT();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [events, setEvents] = useState<CvReviewSectionEvent[]>([]);
  const [analysis, setAnalysis] = useState<CvReviewAnalysis | null>(null);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [runId, setRunId] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const analyze = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunId((current) => current + 1);
    setEvents([]);
    setAnalysis(null);
    setError('');
    setAnalyzing(true);

    try {
      const init: RequestInit = { method: 'POST', signal: controller.signal };
      if (file) {
        const body = new FormData();
        body.set('file', file);
        init.body = body;
      } else {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify({ text });
      }
      const response = await fetch(
        `/api/applications/${applicationId}/cv-review`,
        init,
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? t('Could not analyse the CV.'));
      }
      await readNdjson(response, (event) => {
        if (event.type === 'section') {
          setEvents((current) => [...current, event]);
        } else if (event.type === 'complete') {
          setAnalysis(event.analysis);
        } else {
          setError(event.message);
        }
      });
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : t('Could not analyse the CV.'));
    } finally {
      if (controllerRef.current === controller) setAnalyzing(false);
    }
  };

  const canAnalyze = Boolean(file || text.trim().length >= 80);

  return (
    <main className="min-h-screen bg-[#f7f7f8] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            {/* The "← Quay lại hồ sơ" link that used to sit here is gone: this
                is one of the six application destinations, so the breadcrumb in
                the band above already links /apply/<id> and names the course. */}
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-600">
              {t('Profile strategy')}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              {t('Review and improve your CV')}
            </h1>
            <p className="mt-2 text-sm text-slate-500">{targetName}</p>
          </div>
          <span className="rounded-full border border-pink-200 bg-pink-50 px-4 py-2 text-xs font-semibold text-pink-700">
            {t('Evidence-based analysis')}
          </span>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.9fr)_minmax(560px,1.1fr)]">
          <section className="self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold text-slate-950">{t('Your CV')}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {t('Upload a PDF/DOCX or paste the content.')}
            </p>

            <label className="mt-5 grid min-h-32 cursor-pointer place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center transition hover:border-pink-400 hover:bg-pink-50/40">
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setError('');
                }}
              />
              <span>
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl border border-slate-300 bg-white text-xl">
                  ↑
                </span>
                <span className="mt-3 block text-sm font-semibold text-pink-600">
                  {file ? file.name : t('Choose PDF/DOCX')}
                </span>
                <span className="mt-1 block text-xs text-slate-400">{t('Up to 5 MB')}</span>
              </span>
            </label>

            <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              {t('or')}
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                if (event.target.value) setFile(null);
              }}
              placeholder={t('Paste your CV content here')}
              className="min-h-72 w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-pink-400 focus:ring-4 focus:ring-pink-100"
            />

            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              disabled={!canAnalyze}
              onClick={() => void analyze()}
              className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-pink-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {analyzing ? t('Analysing…') : t('Analyse CV')}
            </button>
          </section>

          <section className="min-h-[640px] overflow-hidden rounded-2xl border border-slate-200 bg-[#fffdf9] shadow-sm">
            <CvReviewFeedback
              key={runId}
              events={events}
              analysis={analysis}
              streaming={analyzing}
            />
            {analyzing || events.length ? (
              <div className="border-t border-slate-200 bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={() => void analyze()}
                  disabled={!canAnalyze}
                  className="rounded-full border border-pink-400 px-4 py-2 text-xs font-semibold text-pink-600 transition hover:bg-pink-50 disabled:opacity-50"
                >
                  {t('Analyse again')}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
