'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  CvReviewAnalysis,
  CvReviewSectionEvent,
} from '@/lib/ai/cv-review';

type TypingTurn = { wait: Promise<void>; release: () => void };
type CompletionRegistration = {
  complete: () => void;
  cancel: () => void;
};
const QueueContext = createContext<(() => TypingTurn) | null>(null);
const RevealContext = createContext<(() => void) | null>(null);
const BlockProgressContext = createContext<
  (() => CompletionRegistration) | null
>(null);

function TypingQueue({ children }: { children: React.ReactNode }) {
  const tail = useRef(Promise.resolve());
  const reserve = useCallback(() => {
    const wait = tail.current;
    let release = () => {};
    const done = new Promise<void>((resolve) => {
      release = resolve;
    });
    tail.current = wait.then(() => done);
    return { wait, release };
  }, []);
  return <QueueContext.Provider value={reserve}>{children}</QueueContext.Provider>;
}

function ProgressiveBlock({
  children,
  className = '',
  onComplete,
}: {
  children: React.ReactNode;
  className?: string;
  onComplete: () => void;
}) {
  const [started, setStarted] = useState(false);
  const registered = useRef(new Set<symbol>());
  const completed = useRef(new Set<symbol>());
  const reported = useRef(false);
  const reveal = useCallback(() => setStarted(true), []);
  const registerCompletion = useCallback(() => {
    const id = Symbol();
    registered.current.add(id);
    let active = true;
    return {
      complete: () => {
        if (!active) return;
        completed.current.add(id);
        queueMicrotask(() => {
          if (
            !reported.current &&
            registered.current.size > 0 &&
            completed.current.size === registered.current.size
          ) {
            reported.current = true;
            onComplete();
          }
        });
      },
      cancel: () => {
        active = false;
        registered.current.delete(id);
        completed.current.delete(id);
      },
    };
  }, [onComplete]);
  return (
    <BlockProgressContext.Provider value={registerCompletion}>
      <RevealContext.Provider value={reveal}>
        <section hidden={!started} className={className}>
          {children}
        </section>
      </RevealContext.Provider>
    </BlockProgressContext.Provider>
  );
}

function TypingText({
  text,
  onStart,
}: {
  text: string;
  onStart?: () => void;
}) {
  const reserve = useContext(QueueContext);
  const reveal = useContext(RevealContext);
  const registerCompletion = useContext(BlockProgressContext);
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const completion = registerCompletion?.();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false) {
      const frame = window.requestAnimationFrame(() => {
        reveal?.();
        onStart?.();
        setVisible(text.length);
        completion?.complete();
      });
      return () => {
        window.cancelAnimationFrame(frame);
        completion?.cancel();
      };
    }

    const turn = reserve?.();
    let cancelled = false;
    let interval: number | undefined;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      completion?.complete();
      turn?.release();
    };
    void (turn?.wait ?? Promise.resolve()).then(() => {
      if (cancelled) {
        turn?.release();
        return;
      }
      let count = 0;
      interval = window.setInterval(() => {
        count = Math.min(count + 1, text.length);
        if (count <= 1) {
          reveal?.();
          onStart?.();
        }
        setVisible(count);
        if (count === text.length) {
          window.clearInterval(interval);
          finish();
        }
      }, 8);
    });
    return () => {
      cancelled = true;
      if (interval !== undefined) window.clearInterval(interval);
      turn?.release();
      completion?.cancel();
    };
  }, [onStart, registerCompletion, reserve, reveal, text]);

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden data-testid="typing-text">
        {text.slice(0, visible)}
      </span>
    </>
  );
}

function TypedItem({
  text,
  tone = 'default',
}: {
  text: string;
  tone?: 'default' | 'positive' | 'warning' | 'high' | 'medium' | 'low';
}) {
  const [started, setStarted] = useState(false);
  const show = useCallback(() => setStarted(true), []);
  const marker = {
    default: 'bg-slate-400',
    positive: 'bg-emerald-500',
    warning: 'bg-amber-500',
    high: 'bg-rose-500',
    medium: 'bg-amber-500',
    low: 'bg-sky-500',
  }[tone];
  return (
    <li hidden={!started} className="flex gap-3 text-sm leading-6 text-slate-700">
      <span className={`mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full ${marker}`} aria-hidden />
      <span>
        <TypingText text={text} onStart={show} />
      </span>
    </li>
  );
}

function TypedList({
  items,
  tone,
}: {
  items: Array<{ text: string }>;
  tone?: Parameters<typeof TypedItem>[0]['tone'];
}) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <TypedItem key={`${item.text}-${index}`} text={item.text} tone={tone} />
      ))}
    </ul>
  );
}

const STRATEGIC_TITLES = {
  programme_alignment: 'A. CV có đúng hướng ngành học không?',
  story_positioning: 'B. Người đọc hiểu bạn là ai không?',
  evidence_quality: 'C. Có đủ ví dụ và kết quả không?',
  content_prioritization: 'D. Nội dung quan trọng có nổi bật không?',
  one_page_efficiency: 'E. CV có gọn trong một trang không?',
} as const;

const CV_SECTION_TITLES: Record<string, string> = {
  general: 'Thông tin chung',
  about_me: 'Giới thiệu',
  education: 'Học vấn',
  experience: 'Kinh nghiệm',
  projects: 'Dự án',
  awards: 'Giải thưởng và thành tích',
  skills: 'Kỹ năng',
  activities: 'Hoạt động',
  research: 'Nghiên cứu',
  publications: 'Công bố',
  certifications: 'Chứng chỉ',
  languages: 'Ngôn ngữ',
  interests: 'Sở thích',
};

export function CvReviewFeedback({
  events,
  analysis,
  streaming,
}: {
  events: CvReviewSectionEvent[];
  analysis: CvReviewAnalysis | null;
  streaming: boolean;
}) {
  const [visibleBlocks, setVisibleBlocks] = useState(1);
  const showNextBlock = useCallback(
    () => setVisibleBlocks((current) => current + 1),
    [],
  );
  const summary = events.find(
    (event): event is Extract<CvReviewSectionEvent, { section: 'summary' }> =>
      event.section === 'summary',
  );
  const strategic = events.filter(
    (event): event is Extract<CvReviewSectionEvent, { section: 'strategic' }> =>
      event.section === 'strategic',
  );
  const cvSections = events.filter(
    (event): event is Extract<CvReviewSectionEvent, { section: 'cv_section' }> =>
      event.section === 'cv_section',
  );
  const recommendations = events.find(
    (event): event is Extract<CvReviewSectionEvent, { section: 'recommendations' }> =>
      event.section === 'recommendations',
  );

  if (!events.length) {
    if (streaming) {
      return (
        <div
          className="grid min-h-[560px] place-items-center px-6 text-center"
          role="status"
          aria-live="polite"
        >
          <div>
            <div className="mx-auto flex h-16 w-16 items-center justify-center gap-1 rounded-full bg-pink-50">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-2 w-2 animate-bounce rounded-full bg-pink-500"
                  style={{ animationDelay: `${delay}ms` }}
                  aria-hidden
                />
              ))}
            </div>
            <p className="mt-5 font-semibold text-slate-800">Đang suy luận…</p>
            <p className="mt-2 text-sm text-slate-500">
              AI đang đọc và đối chiếu từng phần của CV.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="grid min-h-[560px] place-items-center px-6 text-center">
        <div>
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-pink-50 text-3xl text-pink-500">
            ✧
          </div>
          <p className="mt-5 text-sm text-slate-500">
            Kết quả đánh giá CV sẽ xuất hiện tại đây.
          </p>
        </div>
      </div>
    );
  }

  return (
    <TypingQueue>
      <div className="space-y-6 p-5 md:p-7">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pink-600">
              Phản hồi AI
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Đánh giá CV có dẫn chứng
            </h2>
          </div>
          <div className="rounded-2xl border border-pink-200 bg-pink-50 px-4 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-pink-700">
              Điểm CV
            </p>
            <p className="text-2xl font-semibold text-slate-950">
              {analysis ? `${analysis.overallScore}/10` : '…'}
            </p>
          </div>
        </header>

        {summary && visibleBlocks > 0 ? (
          <ProgressiveBlock
            className="space-y-5 border-b border-slate-200 pb-7"
            onComplete={showNextBlock}
          >
            <h3 className="text-lg font-semibold text-slate-950">
              1. CV hiện đang thể hiện điều gì?
            </h3>
            <div className="space-y-3 text-sm leading-6 text-slate-700">
              <p><TypingText text={summary.data.communicationReadiness} /></p>
              <p><TypingText text={summary.data.programmeAlignment} /></p>
              <p><TypingText text={summary.data.firstImpression} /></p>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                <h4 className="mb-3 text-sm font-semibold text-emerald-800">Bạn đã làm tốt</h4>
                <TypedList items={summary.data.biggestStrengths} tone="positive" />
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <h4 className="mb-3 text-sm font-semibold text-amber-900">Điểm cần làm rõ</h4>
                <TypedList items={summary.data.biggestWeaknesses} tone="warning" />
              </div>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-semibold text-slate-900">
                3 việc nên làm trước
              </h4>
              <TypedList items={summary.data.priorities} />
            </div>
          </ProgressiveBlock>
        ) : null}

        {strategic.map((event, index) =>
          index + (summary ? 1 : 0) < visibleBlocks ? (
          <ProgressiveBlock
            key={event.criterion}
            className="space-y-4 border-b border-slate-200 pb-7"
            onComplete={showNextBlock}
          >
            {index === 0 ? (
              <h3 className="text-lg font-semibold text-slate-950">
                2. Kiểm tra 5 tiêu chí quan trọng
              </h3>
            ) : null}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-semibold text-slate-950">
                  {STRATEGIC_TITLES[event.criterion]}
                </h4>
                <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-700">
                  {event.data.score}/10
                </span>
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <TypedList items={event.data.strengths} tone="positive" />
                <TypedList items={event.data.weaknesses} tone="warning" />
              </div>
            </div>
          </ProgressiveBlock>
          ) : null,
        )}

        {cvSections.map((event, index) =>
          index + (summary ? 1 : 0) + strategic.length < visibleBlocks ? (
          <ProgressiveBlock
            key={event.sectionKey}
            className="space-y-4 border-b border-slate-200 pb-7"
            onComplete={showNextBlock}
          >
            {index === 0 ? (
              <h3 className="text-lg font-semibold text-slate-950">
                3. Xem từng phần của CV
              </h3>
            ) : null}
            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-semibold text-slate-950">
                  {CV_SECTION_TITLES[event.sectionKey] ?? 'Phần CV khác'}
                </h4>
                <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-700">
                  {event.data.score}/10
                </span>
              </div>
              <div className="mt-4 grid gap-4">
                <TypedList items={event.data.strengths} tone="positive" />
                <TypedList items={event.data.improvements} tone="warning" />
                <TypedList items={event.data.missingOpportunities} />
                <TypedList items={event.data.recommendations} />
              </div>
            </article>
          </ProgressiveBlock>
          ) : null,
        )}

        {recommendations &&
        (summary ? 1 : 0) + strategic.length + cvSections.length <
          visibleBlocks ? (
          <ProgressiveBlock className="space-y-4" onComplete={showNextBlock}>
            <h3 className="text-lg font-semibold text-slate-950">
              4. Việc cần sửa theo thứ tự
            </h3>
            {(
              [
                ['Làm trước', recommendations.data.high, 'high'],
                ['Làm tiếp theo', recommendations.data.medium, 'medium'],
                ['Có thể làm thêm', recommendations.data.low, 'low'],
              ] as const
            ).map(([title, items, tone]) =>
              items.length ? (
                <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="mb-3 text-sm font-semibold text-slate-900">{title}</h4>
                  <TypedList items={items} tone={tone} />
                </div>
              ) : null,
            )}
          </ProgressiveBlock>
        ) : null}

        {streaming ? (
          <div className="flex items-center gap-2 py-3 text-sm text-slate-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-pink-500" aria-hidden />
            AI đang suy luận phần tiếp theo…
          </div>
        ) : null}
      </div>
    </TypingQueue>
  );
}
