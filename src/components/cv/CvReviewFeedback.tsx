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

const STRATEGIC_GRAPH_META = {
  programme_alignment: { label: 'Đúng hướng', color: '#ec4899' },
  story_positioning: { label: 'Dấu ấn cá nhân', color: '#8b5cf6' },
  evidence_quality: { label: 'Dẫn chứng', color: '#0ea5e9' },
  content_prioritization: { label: 'Ưu tiên nội dung', color: '#10b981' },
  one_page_efficiency: { label: 'Gọn một trang', color: '#f59e0b' },
} as const;

function scoreStatus(score: number) {
  if (score >= 8) return { label: 'Tốt', className: 'text-emerald-700' };
  if (score >= 6) return { label: 'Khá', className: 'text-amber-700' };
  return { label: 'Cần sửa', className: 'text-rose-700' };
}

function ScoreRing({
  label,
  score,
  color,
  large = false,
}: {
  label: string;
  score: number;
  color: string;
  large?: boolean;
}) {
  const value = Math.max(0, Math.min(10, score));
  const status = scoreStatus(value);
  const size = large ? 'h-28 w-28' : 'h-20 w-20';
  const inset = large ? 'inset-[9px]' : 'inset-[7px]';

  return (
    <div
      className="flex min-w-0 flex-col items-center text-center"
      role="img"
      aria-label={`${label}: ${value}/10, ${status.label}`}
    >
      <div
        className={`relative grid shrink-0 place-items-center rounded-full ${size}`}
        style={{
          background: `conic-gradient(${color} ${value * 10}%, #eef2f7 0)`,
        }}
      >
        <span className={`absolute rounded-full bg-white ${inset}`} aria-hidden />
        <span
          className={`relative font-semibold text-slate-950 ${large ? 'text-3xl' : 'text-xl'}`}
        >
          {value}
        </span>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-800">{label}</p>
      <p className={`mt-0.5 text-[11px] font-medium ${status.className}`}>
        {status.label}
      </p>
    </div>
  );
}

function CvScoreDashboard({
  strategic,
  cvSections,
  overallScore,
}: {
  strategic: Array<
    Extract<CvReviewSectionEvent, { section: 'strategic' }>
  >;
  cvSections: Array<
    Extract<CvReviewSectionEvent, { section: 'cv_section' }>
  >;
  overallScore?: number;
}) {
  if (!strategic.length) return null;

  const currentOverall =
    overallScore ??
    Math.round(
      (strategic.reduce((total, event) => total + event.data.score, 0) /
        strategic.length) *
        10,
    ) /
      10;

  return (
    <section
      className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 shadow-sm md:p-6"
      data-testid="cv-score-dashboard"
      aria-labelledby="cv-score-dashboard-title"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pink-600">
            Bản đồ điểm CV
          </p>
          <h3
            id="cv-score-dashboard-title"
            className="mt-1 text-lg font-semibold text-slate-950"
          >
            Điểm mạnh và phần cần ưu tiên
          </h3>
        </div>
        <div className="flex gap-4 text-[11px] font-medium text-slate-500">
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />8–10 Tốt</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />6–7 Khá</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />Dưới 6</span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[150px_1fr] xl:items-center">
        <div className="rounded-3xl border border-pink-100 bg-white p-5">
          <ScoreRing
            label="Điểm tổng"
            score={currentOverall}
            color="#ec4899"
            large
          />
        </div>
        <div className="grid grid-cols-2 gap-5 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-3 lg:grid-cols-5">
          {strategic.map((event) => {
            const meta = STRATEGIC_GRAPH_META[event.criterion];
            return (
              <ScoreRing
                key={event.criterion}
                label={meta.label}
                score={event.data.score}
                color={meta.color}
              />
            );
          })}
        </div>
      </div>

      {cvSections.length ? (
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-slate-950">
              Chất lượng từng phần
            </h4>
            <span className="text-xs text-slate-500">Thang điểm 10</span>
          </div>
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
            {cvSections.map((event) => {
              const status = scoreStatus(event.data.score);
              return (
                <div key={event.sectionKey}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-slate-700">
                      {CV_SECTION_TITLES[event.sectionKey] ?? 'Phần CV khác'}
                    </span>
                    <span className={`font-semibold ${status.className}`}>
                      {event.data.score}/10
                    </span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-slate-100"
                    role="img"
                    aria-label={`${CV_SECTION_TITLES[event.sectionKey] ?? 'Phần CV khác'}: ${event.data.score}/10`}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 transition-[width] duration-500"
                      style={{ width: `${Math.max(0, Math.min(10, event.data.score)) * 10}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

const STRONG_CV_TARGET = 8;

function CvReadinessGap({
  strategic,
}: {
  strategic: Array<
    Extract<CvReviewSectionEvent, { section: 'strategic' }>
  >;
}) {
  if (!strategic.length) return null;

  return (
    <section
      className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
      data-testid="cv-readiness-gap"
      aria-labelledby="cv-readiness-gap-title"
    >
      <div className="border-b border-slate-200 bg-gradient-to-r from-pink-50 via-white to-violet-50 px-5 py-4 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pink-600">
              Khoảng cách điểm
            </p>
            <h3
              id="cv-readiness-gap-title"
              className="mt-1 text-lg font-semibold text-slate-950"
            >
              Còn cách một CV mạnh bao xa?
            </h3>
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
            Vạch đen = mốc tốt {STRONG_CV_TARGET}/10
          </div>
        </div>
      </div>

      <div className="grid gap-x-8 gap-y-5 p-5 md:grid-cols-2 md:p-6">
        {strategic.map((event) => {
          const meta = STRATEGIC_GRAPH_META[event.criterion];
          const value = Math.max(0, Math.min(10, event.data.score));
          const gap = Math.max(0, STRONG_CV_TARGET - value);
          const gapText = gap
            ? `Còn thiếu ${gap.toFixed(1).replace(/\.0$/, '')} điểm`
            : 'Đã đạt mốc tốt';
          return (
            <div
              key={event.criterion}
              role="img"
              aria-label={`${meta.label}: hiện tại ${value}/10, mục tiêu ${STRONG_CV_TARGET}/10, ${
                gap
                  ? `còn thiếu ${gap.toFixed(1).replace(/\.0$/, '')} điểm`
                  : 'đã đạt mục tiêu'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-800">
                  {meta.label}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    gap ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  {gapText}
                </span>
              </div>
              <div className="relative h-4 overflow-visible rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${value * 10}%`,
                    backgroundColor: meta.color,
                  }}
                />
                <span
                  className="absolute -top-1 h-6 w-0.5 rounded-full bg-slate-950"
                  style={{ left: `${STRONG_CV_TARGET * 10}%` }}
                  aria-hidden
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-400">
                <span>0</span>
                <span>{value}/10 hiện tại</span>
                <span>10</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

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

        <CvScoreDashboard
          strategic={strategic}
          cvSections={cvSections}
          overallScore={analysis?.overallScore}
        />

        <CvReadinessGap strategic={strategic} />

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
