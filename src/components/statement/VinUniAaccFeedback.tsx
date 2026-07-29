'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AaccAnalysis } from '@/lib/ai/vinuni-grounded-evaluation';
import type {
  AaccAnalysisV2,
  EssayDiagnosticKey,
  EssayDiagnostics,
  ReviewClaim,
} from '@/lib/ai/vinuni-evaluation-v2';
import { VINUNI_AACC_PILLARS } from '@/lib/vinuni-content';

type Props = {
  analysis: AaccAnalysis;
  onTryAgain: () => void;
  streaming?: boolean;
  loading?: boolean;
  onEvidenceSelect?: (claim: ReviewClaim) => void;
  activeClaimKeys?: string[];
  manuscript?: ReactNode;
};

const VERDICT_VI: Record<AaccAnalysis['overall']['verdict'], string> = {
  'strong-fit': 'Nền tảng mạnh',
  promising: 'Có tiềm năng',
  'needs-work': 'Cần cải thiện',
  misaligned: 'Chưa đúng trọng tâm',
};

type TypingTurn = {
  wait: Promise<void>;
  release: () => void;
};

const TypingQueueContext = createContext<(() => TypingTurn) | null>(null);
const TypingSectionContext = createContext<(() => void) | null>(null);
const EvidenceContext = createContext<{
  onSelect?: (claim: ReviewClaim) => void;
  activeClaimKeys: ReadonlySet<string>;
}>({ activeClaimKeys: new Set() });

type ReviewItem = string | ReviewClaim;

function isReviewClaim(item: ReviewItem): item is ReviewClaim {
  return typeof item !== 'string';
}

export function reviewClaimKey(claim: ReviewClaim) {
  return [
    claim.id,
    claim.text,
    ...claim.evidenceRefs.map(({ source, id }) => `${source}:${id}`),
  ].join('\u001f');
}

export function reviewClaimElementId(claim: ReviewClaim) {
  return `review-${encodeURIComponent(reviewClaimKey(claim))}`;
}

function TypingQueue({ children }: { children: React.ReactNode }) {
  const tail = useRef(Promise.resolve());
  const reserveTurn = useCallback(() => {
    const wait = tail.current;
    let release = () => {};
    const done = new Promise<void>((resolve) => {
      release = resolve;
    });
    tail.current = wait.then(() => done);
    return { wait, release };
  }, []);

  return (
    <TypingQueueContext.Provider value={reserveTurn}>
      {children}
    </TypingQueueContext.Provider>
  );
}

function Chapter({
  letter,
  title,
  children,
  hidden = false,
}: {
  letter: string;
  title: string;
  children: React.ReactNode;
  hidden?: boolean;
}) {
  return (
    <section
      aria-label={`Phần ${letter}: ${title}`}
      data-chapter={letter}
      hidden={hidden}
      className="relative grid gap-5 border-t border-slate-200/80 py-10 first:border-t-0 first:pt-0 md:grid-cols-[52px_1fr]"
    >
      <div
        aria-hidden
        className="relative z-10 grid h-10 w-10 place-items-center rounded-full border border-slate-900 bg-white text-sm font-semibold text-slate-950 shadow-[0_0_0_6px_#f8f6f3]"
      >
        {letter}
      </div>
      <div className="min-w-0">
        <h3 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950">
          {letter}. {title}
        </h3>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

function ProgressiveChapter({
  letter,
  title,
  children,
  animate,
}: {
  letter: string;
  title: string;
  children: React.ReactNode;
  animate: boolean;
}) {
  const [started, setStarted] = useState(!animate);
  const show = useCallback(() => setStarted(true), []);

  return (
    <TypingSectionContext.Provider value={show}>
      <Chapter letter={letter} title={title} hidden={!started}>
        {letter === 'A' ? null : (
          <TypingText
            text={`Đang chuẩn bị phần ${letter}: ${title}…`}
            animate={animate}
            hidden
          />
        )}
        {children}
      </Chapter>
    </TypingSectionContext.Provider>
  );
}

const itemText = (item: ReviewItem) => (isReviewClaim(item) ? item.text : item);

function StatusIcon({
  kind,
  className = '',
}: {
  kind: 'complete' | 'review' | 'missing';
  className?: string;
}) {
  return (
    <svg
      data-testid="status-icon"
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 shrink-0 ${className}`}
    >
      {kind === 'complete' ? (
        <path d="m5 12.5 4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ) : kind === 'review' ? (
        <>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M12 4 21 20H3L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 9v5m0 3h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function DisclosureLabel({ openText, closedText }: { openText: string; closedText: string }) {
  return (
    <span className="flex items-center justify-between gap-3">
      <span className="group-open:hidden">{closedText}</span>
      <span className="hidden group-open:inline">{openText}</span>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        fill="none"
        className="h-4 w-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
      >
        <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function TypingText({
  text,
  animate,
  onStart,
  hidden = false,
}: {
  text: string;
  animate: boolean;
  onStart?: () => void;
  hidden?: boolean;
}) {
  const [animateOnMount] = useState(animate);
  const [visibleCharacters, setVisibleCharacters] = useState(
    animateOnMount ? 0 : text.length,
  );
  const reserveTurn = useContext(TypingQueueContext);
  const revealSection = useContext(TypingSectionContext);

  useEffect(() => {
    if (!animateOnMount) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false) {
      const frame = window.requestAnimationFrame(() => {
        revealSection?.();
        onStart?.();
        setVisibleCharacters(text.length);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const turn = reserveTurn?.();
    let cancelled = false;
    let interval: number | undefined;

    void (turn?.wait ?? Promise.resolve()).then(() => {
      if (cancelled) {
        turn?.release();
        return;
      }
      if (!text.length) {
        revealSection?.();
        onStart?.();
        turn?.release();
        return;
      }

      let visible = 0;
      interval = window.setInterval(() => {
        visible = Math.min(visible + 1, text.length);
        if (visible === 1) {
          revealSection?.();
          onStart?.();
        }
        setVisibleCharacters(visible);
        if (visible === text.length) {
          window.clearInterval(interval);
          turn?.release();
        }
      }, 6);
    });

    return () => {
      cancelled = true;
      if (interval !== undefined) window.clearInterval(interval);
      turn?.release();
    };
  }, [animateOnMount, onStart, reserveTurn, revealSection, text]);

  if (!animateOnMount) return hidden ? null : text;
  if (hidden) {
    return <span aria-hidden className="sr-only">{text.slice(0, visibleCharacters)}</span>;
  }

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden data-testid="typing-text">
        {text.slice(0, visibleCharacters)}
      </span>
    </>
  );
}

function TypingBullet({
  item,
  marker,
  animate,
}: {
  item: ReviewItem;
  marker: string;
  animate: boolean;
}) {
  const text = isReviewClaim(item) ? item.text : item;
  const [started, setStarted] = useState(!animate);
  const show = useCallback(() => setStarted(true), []);
  const evidence = useContext(EvidenceContext);
  const active = isReviewClaim(item) && evidence.activeClaimKeys.has(reviewClaimKey(item));

  return (
    <li
      id={isReviewClaim(item) ? reviewClaimElementId(item) : undefined}
      hidden={!started}
      className={`flex gap-3 rounded-xl text-sm leading-6 text-slate-700 transition ${
        active ? 'bg-pink-50 px-3 py-2 ring-2 ring-pink-300' : ''
      }`}
    >
      <span className={`mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full ${marker}`} aria-hidden />
      {isReviewClaim(item) ? (
        <button
          type="button"
          aria-label={text}
          data-active={active ? 'true' : 'false'}
          onClick={() => evidence.onSelect?.(item)}
          className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500"
        >
          <TypingText text={text} animate={animate} onStart={show} />
          <span className="mt-1 flex flex-wrap gap-1.5" aria-label="Nguồn dẫn chứng">
            {item.evidenceRefs
              .filter(({ source }) => source !== 'essay')
              .map((reference) => (
                <span
                  key={`${reference.source}:${reference.id}`}
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500"
                >
                  {reference.source === 'profile' ? 'Hồ sơ' : 'Chương trình'} · {reference.id}
                </span>
              ))}
          </span>
        </button>
      ) : (
        <span>
          <TypingText text={text} animate={animate} onStart={show} />
        </span>
      )}
    </li>
  );
}

function BulletList({
  items,
  tone = 'default',
  loading = false,
  animate = false,
}: {
  items: ReviewItem[];
  tone?: 'default' | 'positive' | 'warning' | 'idea';
  loading?: boolean;
  animate?: boolean;
}) {
  if (!items.length) {
    return loading ? (
      <div data-testid="feedback-skeleton" className="space-y-3" aria-hidden>
        <div className="h-3 w-full animate-pulse rounded-full bg-slate-100" />
        <div className="h-3 w-5/6 animate-pulse rounded-full bg-slate-100" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-100" />
      </div>
    ) : null;
  }
  const marker = {
    default: 'bg-slate-400',
    positive: 'bg-emerald-500',
    warning: 'bg-amber-500',
    idea: 'bg-pink-500',
  }[tone];
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <TypingBullet
          key={isReviewClaim(item) ? reviewClaimKey(item) : item}
          item={item}
          marker={marker}
          animate={animate}
        />
      ))}
    </ul>
  );
}

const DIAGNOSTIC_META: Array<{
  key: EssayDiagnosticKey;
  label: string;
  color: string;
  track: string;
  definition: string;
}> = [
  {
    key: 'writing',
    label: 'Writing',
    color: '#ef553a',
    track: '#fee8e3',
    definition:
      'Đánh giá độ rõ ràng, nhịp câu và cấu trúc: mở bài, mạch phát triển, câu chuyển và kết luận có dẫn dắt người đọc hay không.',
  },
  {
    key: 'detail',
    label: 'Detail',
    color: '#cf86b5',
    track: '#f8e9f2',
    definition:
      'Đánh giá mức độ cụ thể của dẫn chứng: hành động, bối cảnh, số liệu, phản ứng và chi tiết giúp câu chuyện không trở nên chung chung.',
  },
  {
    key: 'voice',
    label: 'Voice',
    color: '#74c6d0',
    track: '#e6f5f7',
    definition:
      'Đánh giá giọng cá nhân: bài luận có cho thấy cách bạn suy nghĩ, động lực, cảm xúc và góc nhìn riêng thay vì một giọng văn khuôn mẫu hay không.',
  },
  {
    key: 'character',
    label: 'Character',
    color: '#f59e0b',
    track: '#fff1cf',
    definition:
      'Đánh giá phẩm chất thể hiện qua lựa chọn và hành động, như trách nhiệm, chính trực, trưởng thành và khả năng học từ sai lầm.',
  },
  {
    key: 'curiosity',
    label: 'Curiosity',
    color: '#52723a',
    track: '#e8eee3',
    definition:
      'Đánh giá tinh thần khám phá và học hỏi: cách bạn đặt câu hỏi, theo đuổi ý tưởng và mở rộng hiểu biết vượt ngoài yêu cầu thông thường.',
  },
  {
    key: 'contribution',
    label: 'Contribution',
    color: '#f4d400',
    track: '#fff8bf',
    definition:
      'Đánh giá giá trị bạn tạo ra cho người khác hoặc cộng đồng, gồm tác động, kết quả và điều bạn học được từ việc đóng góp.',
  },
];

const IMPACT_GAIN = { high: 0.5, medium: 0.3, low: 0.1 } as const;
const PRIORITY_LABEL = {
  high: 'Ưu tiên cao',
  medium: 'Ưu tiên vừa',
  low: 'Ưu tiên thấp',
} as const;

export function calculateImprovementProjection(
  current: number,
  items: Array<{ priority: keyof typeof IMPACT_GAIN } | string>,
) {
  const round = (value: number) => Math.round(value * 10 + 1e-9) / 10;
  const gain = round(
    items.reduce(
      (total, item) =>
        total + (typeof item === 'string' ? 0 : IMPACT_GAIN[item.priority]),
      0,
    ),
  );
  return {
    current: round(current),
    gain,
    potential: round(Math.min(10, current + gain)),
  };
}

function EvidenceCoverageMap({
  map,
  strength,
  gap,
}: {
  map: AaccAnalysisV2['evidenceMap'];
  strength?: ReviewItem;
  gap?: ReviewItem;
}) {
  const segments = map.essaySegments;
  if (!segments.length) return null;
  const gapIds = new Set(map.informationGaps.flatMap(({ evidenceIds }) => evidenceIds));
  const rows = [
    {
      label: 'Đề bài',
      strong: new Set(
        map.promptCoverage
          .filter(({ status }) => status === 'answered')
          .flatMap(({ evidenceIds }) => evidenceIds),
      ),
      partial: new Set(
        map.promptCoverage
          .filter(({ status }) => status === 'partial')
          .flatMap(({ evidenceIds }) => evidenceIds),
      ),
    },
    {
      label: 'Phản tư',
      strong: new Set(
        map.reflectionArcs
          .filter(({ completeness }) => completeness === 'complete')
          .flatMap(({ evidenceIds }) => evidenceIds),
      ),
      partial: new Set(
        map.reflectionArcs
          .filter(({ completeness }) => completeness === 'partial')
          .flatMap(({ evidenceIds }) => evidenceIds),
      ),
    },
    {
      label: 'Dẫn chứng',
      strong: new Set(map.claims.flatMap(({ evidenceIds }) => evidenceIds)),
      partial: new Set<string>(),
    },
    {
      label: 'AACC',
      strong: new Set(
        Object.values(map.aaccCoverage)
          .filter(({ strength }) => strength === 'clear')
          .flatMap(({ evidenceIds }) => evidenceIds),
      ),
      partial: new Set(
        Object.values(map.aaccCoverage)
          .filter(({ strength }) => strength === 'emerging')
          .flatMap(({ evidenceIds }) => evidenceIds),
      ),
    },
  ];
  const answered = map.promptCoverage.filter(({ status }) => status === 'answered').length;

  return (
    <figure
      role="img"
      aria-label="Bản đồ độ phủ dẫn chứng"
      className="mb-6 grid gap-6 rounded-[1.75rem] border border-slate-200 bg-[#fbfbfd] p-5 shadow-[0_16px_42px_rgba(15,23,42,0.05)] lg:grid-cols-[minmax(0,1fr)_280px] lg:p-6"
    >
      <div className="min-w-0 overflow-x-auto">
        <div
          className="grid min-w-max items-center gap-2"
          style={{ gridTemplateColumns: `88px repeat(${segments.length}, 34px)` }}
        >
          <span />
          {segments.map(({ evidence_id }, index) => (
            <span key={evidence_id} className="text-center text-[9px] font-semibold text-slate-400">
              {String(index + 1).padStart(2, '0')}
            </span>
          ))}
          {rows.flatMap((row) => [
            <span key={`${row.label}:label`} className="text-xs font-semibold text-slate-600">
              {row.label}
            </span>,
            ...segments.map(({ evidence_id }) => {
              const tone = gapIds.has(evidence_id)
                ? 'bg-rose-300'
                : row.strong.has(evidence_id)
                  ? 'bg-emerald-400'
                  : row.partial.has(evidence_id)
                    ? 'bg-amber-300'
                    : 'bg-slate-100';
              return (
                <span
                  key={`${row.label}:${evidence_id}`}
                  title={`${row.label} · ${evidence_id}`}
                  className={`h-7 rounded-md ring-1 ring-inset ring-black/[0.03] ${tone}`}
                />
              );
            }),
          ])}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-[10px] font-medium text-slate-500">
          {[
            ['bg-emerald-400', 'Đã làm tốt'],
            ['bg-amber-300', 'Có nhưng chưa rõ'],
            ['bg-rose-300', 'Còn thiếu'],
            ['bg-slate-100', 'Chưa đề cập'],
          ].map(([tone, label]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${tone}`} /> {label}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-500">
          Đã trả lời {answered}/{map.promptCoverage.length} yêu cầu
        </p>
        {strength ? (
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <StatusIcon kind="complete" /> Bạn đã làm tốt
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-700">{itemText(strength)}</p>
          </div>
        ) : null}
        {gap ? (
          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/70 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold text-rose-800">
              <StatusIcon kind="missing" /> Cần bổ sung
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-700">{itemText(gap)}</p>
          </div>
        ) : null}
      </div>
    </figure>
  );
}

function IdeasComparison({
  strengths,
  weaknesses,
}: {
  strengths: ReviewItem[];
  weaknesses: Array<{ title: string; items: ReviewItem[] }>;
}) {
  const gaps = weaknesses.flatMap(({ title, items }) =>
    items.map((item) => ({ title, item })),
  );
  const length = Math.max(strengths.length, gaps.length);
  if (!length) return null;

  return (
    <div
      role="table"
      aria-label="Đã có và cần bổ sung"
      className="mb-5 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_16px_42px_rgba(15,23,42,0.05)]"
    >
      <div role="row" className="grid border-b border-slate-200 text-xs font-semibold uppercase tracking-wider sm:grid-cols-2">
        <div role="columnheader" className="flex items-center gap-2 bg-emerald-50/80 px-5 py-4 text-emerald-800">
          <StatusIcon kind="complete" /> Đã chứng minh
        </div>
        <div role="columnheader" className="flex items-center gap-2 border-t border-slate-200 bg-amber-50/80 px-5 py-4 text-amber-800 sm:border-l sm:border-t-0">
          <StatusIcon kind="review" /> Cần làm rõ
        </div>
      </div>
      {Array.from({ length }, (_, index) => (
        <div key={index} role="row" className="grid border-b border-slate-100 last:border-b-0 sm:grid-cols-2">
          <div role="cell" className="min-w-0 p-4">
            {strengths[index]
              ? <BulletList items={[strengths[index]]} tone="positive" />
              : <span className="text-sm text-slate-300">—</span>}
          </div>
          <div role="cell" className="min-w-0 border-t border-slate-100 p-4 sm:border-l sm:border-t-0">
            {gaps[index] ? (
              <>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">{gaps[index].title}</p>
                <BulletList items={[gaps[index].item]} tone="warning" />
              </>
            ) : <span className="text-sm text-slate-300">—</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

const RADAR_LABEL_POSITIONS = [
  'left-1/2 top-0 -translate-x-1/2',
  'right-0 top-[18%]',
  'right-0 bottom-[18%]',
  'bottom-0 left-1/2 -translate-x-1/2',
  'bottom-[18%] left-0',
  'left-0 top-[18%]',
] as const;

function radarPoints(values: number[], radius = 88) {
  return values
    .map((value, index) => {
      const angle = -Math.PI / 2 + index * (Math.PI / 3);
      const distance = radius * (Math.max(0, Math.min(10, value)) / 10);
      return `${150 + Math.cos(angle) * distance},${150 + Math.sin(angle) * distance}`;
    })
    .join(' ');
}

function DiagnosticRadar({
  diagnostics,
  active,
  onActivate,
}: {
  diagnostics: EssayDiagnostics;
  active: EssayDiagnosticKey;
  onActivate: (key: EssayDiagnosticKey) => void;
}) {
  const dimensions = diagnostics.achievability!.dimensions;
  const current = DIAGNOSTIC_META.map(({ key }) => dimensions[key].current);
  const potential = DIAGNOSTIC_META.map(({ key }) => dimensions[key].potential);

  return (
    <>
      <div className="relative mx-auto aspect-square w-full max-w-[310px]">
        <svg
          data-testid="diagnostic-radar"
          role="img"
          aria-label="Biểu đồ radar so sánh điểm hiện tại và điểm có thể đạt"
          className="h-full w-full"
          viewBox="0 0 300 300"
        >
          {[2, 4, 6, 8, 10].map((level) => (
            <polygon
              key={level}
              points={radarPoints(Array(6).fill(level))}
              fill={level % 4 === 0 ? '#faf5ff' : 'none'}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          ))}
          {radarPoints(Array(6).fill(10)).split(' ').map((point) => {
            const [x, y] = point.split(',');
            return (
              <line
                key={point}
                x1="150"
                y1="150"
                x2={x}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
            );
          })}
          <polygon
            data-testid="diagnostic-radar-potential"
            points={radarPoints(potential)}
            fill="#8b5cf633"
            stroke="#7c3aed"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <polygon
            data-testid="diagnostic-radar-current"
            points={radarPoints(current)}
            fill="#ec489944"
            stroke="#ec4899"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {radarPoints(current).split(' ').map((point) => {
            const [cx, cy] = point.split(',');
            return <circle key={point} cx={cx} cy={cy} r="3.5" fill="#fff" stroke="#ec4899" strokeWidth="2.5" />;
          })}
        </svg>

        {DIAGNOSTIC_META.map(({ key, label }, index) => {
          const score = dimensions[key];
          return (
            <button
              key={key}
              type="button"
              aria-label={`${label}: ${score.current}/10 hiện tại, ${score.potential}/10 có thể đạt. Xem định nghĩa`}
              aria-pressed={active === key}
              onMouseEnter={() => onActivate(key)}
              onFocus={() => onActivate(key)}
              onClick={() => onActivate(key)}
              className={`absolute rounded-lg border bg-white/95 px-2 py-1 text-center shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500 ${RADAR_LABEL_POSITIONS[index]} ${
                active === key
                  ? 'border-pink-300 text-pink-700'
                  : 'border-slate-200 text-slate-600 hover:border-pink-200'
              }`}
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wide">{label}</span>
              <span className="block text-xs font-semibold tabular-nums text-slate-950">
                {score.current} <span className="text-slate-300">→</span> {score.potential}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-center gap-5 text-[11px] font-medium text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-full bg-pink-500" /> Hiện tại
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-full bg-violet-600" /> Có thể đạt
        </span>
      </div>
    </>
  );
}

function WritingSignals({ diagnostics }: { diagnostics?: EssayDiagnostics }) {
  if (!diagnostics?.achievability) return null;
  const keys: EssayDiagnosticKey[] = ['writing', 'detail', 'voice'];
  return (
    <figure
      role="img"
      aria-label="Tín hiệu Writing, Detail và Voice"
      className="mb-5 rounded-[1.75rem] border border-slate-200 bg-[#fbfbfd] p-5 shadow-[0_16px_42px_rgba(15,23,42,0.05)]"
    >
      <div className="space-y-4">
        {keys.map((key) => {
          const meta = DIAGNOSTIC_META.find((item) => item.key === key)!;
          const score = diagnostics.achievability!.dimensions[key];
          return (
            <div key={key} className="grid gap-2 sm:grid-cols-[90px_1fr_68px] sm:items-center">
              <span className="text-xs font-semibold text-slate-600">{meta.label}</span>
              <span className="relative block h-2.5 rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200">
                <span className="absolute inset-y-0 left-0 rounded-full bg-slate-700" style={{ width: `${score.current * 10}%` }} />
                <span className="absolute -top-1 h-4 w-1 rounded-full bg-pink-500" style={{ left: `${score.potential * 10}%` }} />
              </span>
              <span className="text-right text-xs font-semibold tabular-nums text-slate-700">
                {score.current} → <span className="text-pink-700">{score.potential}</span>
              </span>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-4 flex gap-4 border-t border-slate-100 pt-3 text-[10px] font-medium text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-slate-700" /> Hiện tại</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-1 rounded-full bg-pink-500" /> Có thể đạt</span>
      </figcaption>
    </figure>
  );
}

function NarrativeJourneyChart({
  analysis,
  diagnostics,
  strength,
  gap,
}: {
  analysis: AaccAnalysis;
  diagnostics?: EssayDiagnostics;
  strength?: ReviewItem;
  gap?: ReviewItem;
}) {
  const dimensions = diagnostics?.achievability?.dimensions;
  if (!dimensions) return null;

  const stages = [
    { label: 'Hook', score: dimensions.writing.current },
    { label: 'Bối cảnh', score: dimensions.detail.current },
    {
      label: 'Xung đột',
      score: Number(((dimensions.voice.current + dimensions.character.current) / 2).toFixed(1)),
    },
    { label: 'Chuyển biến', score: analysis.pillars.creativity.score / 10 },
    { label: 'Tương lai', score: analysis.pillars.aspirations.score / 10 },
  ];
  const points = stages.map(({ score }, index) => ({
    x: 50 + index * 225,
    y: 210 - Math.max(0, Math.min(10, score)) * 16,
  }));
  const line = points.reduce((path, point, index) => {
    if (!index) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const middle = (previous.x + point.x) / 2;
    return `${path} C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
  }, '');
  const itemText = (item?: ReviewItem) =>
    item ? (typeof item === 'string' ? item : item.text) : '';

  return (
    <figure
      role="img"
      aria-label="Biểu đồ nhịp bài luận qua 5 chặng"
      className="mb-10 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_16px_42px_rgba(15,23,42,0.05)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 px-6 py-6 md:px-8">
        <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-pink-600">
          Nhịp bài luận
        </p>
        <h3 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-slate-950">
          Hành trình câu chuyện qua 5 chặng
        </h3>
        </div>
        <p className="max-w-sm text-sm leading-6 text-slate-600">
          Đường càng cao, chặng đó càng có đủ dẫn chứng và sức thuyết phục.
        </p>
      </div>
      <div className="px-4 py-6 sm:px-7 md:px-10">
        <div className="grid grid-cols-5 gap-2 text-center">
          {stages.map(({ label }, index) => (
            <div key={label} className="min-w-0">
              <span className="mx-auto grid h-8 w-8 place-items-center rounded-full border border-pink-200 bg-pink-50 text-[10px] font-bold text-pink-700">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="mt-2 block text-[10px] font-semibold leading-4 text-slate-700 sm:text-sm">
                {label}
              </span>
            </div>
          ))}
        </div>
        <div
          data-testid="narrative-plot"
          className="relative mt-2 h-[260px] w-full"
        >
          <svg
            viewBox="0 0 1000 230"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
          <defs>
            <linearGradient id="narrative-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f472b6" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#fdf2f8" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[50, 130, 210].map((y) => (
            <line
              key={y}
              x1="30"
              x2="970"
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeDasharray="5 7"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path
            d={`${line} L ${points.at(-1)!.x} 220 L ${points[0].x} 220 Z`}
            fill="url(#narrative-area)"
          />
          <path
            d={line}
            fill="none"
            stroke="#ec4899"
            strokeLinecap="round"
            strokeWidth="4"
            vectorEffect="non-scaling-stroke"
          />
          </svg>
          {points.map((point, index) => (
            <span
              key={stages[index].label}
              data-testid="narrative-stage-marker"
              className="absolute grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-pink-500 bg-white text-base font-bold tabular-nums text-pink-700 shadow-[0_8px_22px_rgba(236,72,153,0.28)]"
              style={{
                left: `${(point.x / 1000) * 100}%`,
                top: `${(point.y / 230) * 100}%`,
              }}
            >
              {stages[index].score.toFixed(1).replace('.0', '')}
            </span>
          ))}
        </div>
      </div>
      {strength || gap ? (
        <div className="grid gap-4 border-t border-slate-100 bg-[#fbfbfd] p-5 md:grid-cols-2 md:p-6">
          {strength ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <StatusIcon kind="complete" /> Điểm đang hiệu quả
              </p>
              <p className="mt-3 text-[15px] leading-7 text-slate-700">{itemText(strength)}</p>
            </div>
          ) : null}
          {gap ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-rose-800">
                <StatusIcon kind="missing" /> Việc cần sửa trước
              </p>
              <p className="mt-3 text-[15px] leading-7 text-slate-700">{itemText(gap)}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      <figcaption className="border-t border-slate-100 px-6 py-4 text-xs leading-5 text-slate-500">
        Tổng hợp từ Writing, Detail, Voice, Character, Creativity và Aspirations trong kết quả hiện tại.
      </figcaption>
    </figure>
  );
}

function AaccBulletChart({
  analysis,
  review,
}: {
  analysis: AaccAnalysis;
  review?: AaccAnalysisV2['review'];
}) {
  return (
    <figure
      role="img"
      aria-label="Điểm AACC và mức có thể đạt"
      className="mb-5 space-y-2 rounded-[1.75rem] border border-slate-200 bg-[#f7f7fa] p-2 shadow-[0_16px_42px_rgba(15,23,42,0.05)]"
    >
      {VINUNI_AACC_PILLARS.map((pillar) => {
        const current = analysis.pillars[pillar.key].score / 10;
        const pillarReview = review?.pillars[pillar.key];
        const gain = (pillarReview?.gaps ?? []).reduce(
          (total, item) => total + IMPACT_GAIN[item.priority],
          0,
        );
        const potential = Math.min(10, current + gain);
        const strength = pillarReview?.strengths[0] ?? analysis.pillars[pillar.key].strengths[0];
        const gap = pillarReview?.gaps[0] ?? analysis.pillars[pillar.key].gaps[0];
        return (
          <div
            key={pillar.key}
            className="grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 transition-colors duration-200 hover:border-pink-200 lg:grid-cols-[150px_minmax(180px,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-center"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">{pillar.nameVi}</p>
              <p className="text-xs tabular-nums text-slate-500">
                {current.toFixed(1)} → <span className="font-semibold text-pink-700">{potential.toFixed(1)}</span>
              </p>
            </div>
            <span
              role="progressbar"
              aria-label={`Điểm ${pillar.nameVi}`}
              aria-valuemin={0}
              aria-valuemax={10}
              aria-valuenow={current}
              className="relative block h-2.5 rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200"
            >
              <span className="absolute inset-y-0 left-0 rounded-full bg-slate-700" style={{ width: `${current * 10}%` }} />
              <span className="absolute -top-1 h-4 w-1 rounded-full bg-pink-500" style={{ left: `${potential * 10}%` }} />
            </span>
            <p className="text-xs leading-5 text-slate-600">
              <span className="font-semibold text-emerald-700">Đã chứng minh:</span>{' '}
              {strength ? itemText(strength) : 'Chưa có tín hiệu rõ.'}
            </p>
            <p className="text-xs leading-5 text-slate-600">
              <span className="font-semibold text-rose-700">Cần bổ sung:</span>{' '}
              {gap ? itemText(gap) : 'Chưa ghi nhận khoảng trống lớn.'}
            </p>
          </div>
        );
      })}
    </figure>
  );
}

function PriorityRoadmap({
  items,
  animate = false,
}: {
  items: ReviewItem[];
  animate?: boolean;
}) {
  if (!items.length) return null;
  const lanes = {
    high: { label: 'Làm ngay', tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
    medium: { label: 'Bổ sung', tone: 'border-amber-200 bg-amber-50 text-amber-800' },
    low: { label: 'Tinh chỉnh', tone: 'border-sky-200 bg-sky-50 text-sky-800' },
  } as const;
  return (
    <ol aria-label="Lộ trình ưu tiên" className="relative space-y-3 before:absolute before:bottom-6 before:left-5 before:top-6 before:w-px before:bg-slate-200">
      {items.map((item, index) => {
        const priority = isReviewClaim(item) ? item.priority : 'medium';
        const lane = lanes[priority];
        return (
          <li
            key={isReviewClaim(item) ? reviewClaimKey(item) : item}
            className="relative grid gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] sm:grid-cols-[44px_110px_1fr_72px] sm:items-center"
          >
            <span className="relative z-10 grid h-10 w-10 place-items-center rounded-full border border-slate-900 bg-white text-xs font-semibold tabular-nums text-slate-950">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className={`rounded-full border px-3 py-1 text-center text-xs font-semibold ${lane.tone}`}>
              {lane.label}
            </span>
            <div className="min-w-0"><BulletList items={[item]} animate={animate} /></div>
            <span className="text-right text-sm font-semibold tabular-nums text-pink-600">
              {isReviewClaim(item) ? `+${IMPACT_GAIN[priority].toFixed(1)}` : `0${index + 1}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ScoreBridge({
  current,
  potential,
  issues,
}: {
  current: number;
  potential: number;
  issues: ReviewItem[];
}) {
  return (
    <figure
      role="img"
      aria-label="Cầu điểm cải thiện"
      className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.05)]"
    >
      <div className="grid gap-5 sm:grid-cols-[96px_minmax(0,1fr)_96px] sm:items-center">
        <div className="grid h-24 w-24 place-items-center rounded-full border border-slate-300 bg-slate-50 text-center">
          <span>
            <strong className="block text-3xl tabular-nums text-slate-950">{current.toFixed(1)}</strong>
            <span className="text-xs text-slate-500">Hiện tại</span>
          </span>
        </div>
        <div className="relative grid gap-2 before:absolute before:left-3 before:right-3 before:top-1/2 before:border-t before:border-dashed before:border-pink-300">
          {issues.slice(0, 4).map((issue) => (
            <div
              key={isReviewClaim(issue) ? reviewClaimKey(issue) : issue}
              className="relative z-10 grid grid-cols-[52px_1fr] items-center gap-3 rounded-xl border border-pink-100 bg-pink-50/80 p-2.5"
            >
              <span className="rounded-lg bg-white px-2 py-1 text-center text-xs font-semibold text-pink-700 shadow-sm">
                {isReviewClaim(issue)
                  ? `+${IMPACT_GAIN[issue.priority].toFixed(1)}`
                  : '—'}
              </span>
              <p className="line-clamp-2 text-[11px] leading-4 text-slate-600">
                {itemText(issue)}
              </p>
            </div>
          ))}
        </div>
        <div className="grid h-24 w-24 place-items-center rounded-full border border-pink-300 bg-pink-50 text-center">
          <span>
            <strong className="block text-3xl tabular-nums text-pink-700">{potential.toFixed(1)}</strong>
            <span className="text-xs text-pink-700">Có thể đạt</span>
          </span>
        </div>
      </div>
    </figure>
  );
}

function EssayDiagnosticBoard({
  diagnostics,
  manuscript,
  projection,
}: {
  diagnostics: EssayDiagnostics;
  manuscript: ReactNode;
  projection?: ReturnType<typeof calculateImprovementProjection>;
}) {
  const evidence = useContext(EvidenceContext);
  const [activeDefinition, setActiveDefinition] = useState<EssayDiagnosticKey>('writing');
  const achievability = diagnostics.achievability;
  if (!achievability) return null;
  const currentScore = projection?.current ?? achievability.currentScore;
  const potentialScore = projection?.potential ?? achievability.potentialScore;
  const issues = [...diagnostics.issues].sort(
    (a, b) => IMPACT_GAIN[b.priority] - IMPACT_GAIN[a.priority],
  );

  return (
    <section
      aria-label="Chẩn đoán bài luận"
      data-visual-style="editorial-diagnostic"
      className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[#f8f6f3] shadow-[0_24px_70px_rgba(15,23,42,0.08)]"
    >
      <header className="relative flex flex-wrap items-end justify-between gap-5 overflow-hidden border-b border-slate-200 bg-white px-6 py-6 md:px-8">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#ec4899_0%,#f9a8d4_44%,#f8f6f3_100%)]" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-pink-600">
            Chẩn đoán bài luận
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-slate-950">
            Bài luận đã chấm
          </h2>
        </div>
        <div className="flex items-end gap-3 border-l-2 border-pink-400 pl-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              AACC hiện tại
            </p>
            <p className="text-2xl font-semibold tabular-nums text-slate-950">
              {currentScore.toFixed(1)}
            </p>
          </div>
          <span className="pb-1 text-lg text-pink-500" aria-hidden>→</span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-pink-700">
              Sau ưu tiên
            </p>
            <p className="text-2xl font-semibold tabular-nums text-pink-700">
              {potentialScore.toFixed(1)}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:p-6">
        <article className="min-h-[540px] rounded-[1.75rem] border border-slate-200 bg-white px-6 py-8 shadow-[0_16px_42px_rgba(15,23,42,0.05)] md:px-10">
          <div className="mx-auto max-w-3xl">{manuscript}</div>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.05)]">
            <DiagnosticRadar
              diagnostics={diagnostics}
              active={activeDefinition}
              onActivate={setActiveDefinition}
            />
            <div className="mt-4 min-h-36 border-t border-slate-200 pt-4">
              <h3 className="font-semibold text-slate-950">
                {DIAGNOSTIC_META.find(({ key }) => key === activeDefinition)!.label}
              </h3>
              <p className="mt-1 text-sm leading-5 text-slate-700">
                {DIAGNOSTIC_META.find(({ key }) => key === activeDefinition)!.definition}
              </p>
            </div>
          </div>

          {issues.length ? (
            <div className="space-y-2.5">
              {issues.map((issue) => {
                const active = evidence.activeClaimKeys.has(reviewClaimKey(issue));
                return (
                  <button
                    key={reviewClaimKey(issue)}
                    id={reviewClaimElementId(issue)}
                    type="button"
                    aria-label={issue.text}
                    data-active={active ? 'true' : 'false'}
                    onClick={() => evidence.onSelect?.(issue)}
                    className={`w-full cursor-pointer rounded-2xl border bg-white px-4 py-3 text-left text-sm leading-5 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-colors duration-200 hover:border-amber-300 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
                      active ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200' : 'border-slate-200'
                    }`}
                  >
                    <span className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {DIAGNOSTIC_META.find(({ key }) => key === issue.criterion)?.label}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                        {PRIORITY_LABEL[issue.priority]}
                      </span>
                    </span>
                    {issue.text}
                  </button>
                );
              })}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function EssayDiagnosticSkeleton({ manuscript }: { manuscript: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-[#f4f4fa] shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
      <header className="border-b border-slate-200 bg-white px-6 py-5 md:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-pink-600">
          Essay diagnostic
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
          Đang chấm bài luận…
        </h2>
      </header>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:p-6">
        <article className="min-h-[540px] rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm md:px-10">
          <div className="mx-auto max-w-3xl">{manuscript}</div>
        </article>
        <aside
          data-testid="diagnostic-score-skeleton"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:self-start"
        >
          <svg
            data-testid="diagnostic-radar-skeleton"
            aria-hidden
            className="mx-auto aspect-square w-full max-w-[280px] animate-pulse"
            viewBox="0 0 300 300"
          >
            {[2, 4, 6, 8, 10].map((level) => (
              <polygon
                key={level}
                points={radarPoints(Array(6).fill(level))}
                fill={level === 6 ? '#fdf2f8' : 'none'}
                stroke="#e2e8f0"
                strokeWidth="2"
              />
            ))}
            <polygon
              points={radarPoints([6, 7, 5, 8, 6, 7])}
              fill="#fce7f3"
              stroke="#f9a8d4"
              strokeWidth="3"
            />
          </svg>
          <div className="mt-5 space-y-2 border-t border-slate-200 pt-5">
            <span className="block h-3 w-24 animate-pulse rounded-full bg-slate-100" />
            <span className="block h-3 w-full animate-pulse rounded-full bg-slate-100" />
            <span className="block h-3 w-4/5 animate-pulse rounded-full bg-slate-100" />
          </div>
        </aside>
      </div>
    </section>
  );
}

export function VinUniAaccFeedback({
  analysis,
  onTryAgain,
  streaming = false,
  loading = false,
  onEvidenceSelect,
  activeClaimKeys = [],
  manuscript,
}: Props) {
  const sections = analysis.sections;
  if (!sections) return null;
  const v2Analysis =
    'evidenceMap' in analysis || 'review' in analysis || 'diagnostics' in analysis
      ? (analysis as AaccAnalysisV2)
      : null;
  const review = v2Analysis?.review;
  const diagnostics = v2Analysis?.diagnostics;
  const overallItems: ReviewItem[] = review?.overall?.length
    ? review.overall
    : sections.overallSummary;
  const ideas = review?.ideasStructure ?? sections.ideasStructure;
  const hook = review?.hookEngagement ?? sections.hookEngagement;
  const nextSteps: ReviewItem[] = review?.nextSteps?.actions?.length
    ? review.nextSteps.actions
    : sections.nextSteps;
  const improvementProjection = calculateImprovementProjection(
    analysis.overall.score / 10,
    nextSteps,
  );
  const hasProjectedActions = nextSteps.some(isReviewClaim);
  const followUpQuestions = review?.nextSteps?.questions ?? [];
  const overallReady = overallItems.length > 0;
  const ideasReady =
    ideas.strengths.length > 0 ||
    ideas.suggestions.length > 0 ||
    ideas.weaknesses.some((group) => group.items.length > 0);
  const hookReady =
    hook.analysis.length > 0 || hook.suggestions.length > 0;
  const readyPillars = VINUNI_AACC_PILLARS.filter((pillar) => {
    const result = analysis.pillars[pillar.key];
    const reviewPillar = review?.pillars?.[pillar.key];
    return (
      (reviewPillar?.analysis.length ?? 0) > 0 ||
      (reviewPillar?.strengths.length ?? 0) > 0 ||
      (reviewPillar?.gaps.length ?? 0) > 0 ||
      (result.analysis?.length ?? 0) > 0 ||
      result.strengths.length > 0 ||
      result.gaps.length > 0 ||
      result.evidenceQuotes.length > 0
    );
  });
  const nextStepsReady = nextSteps.length > 0 || followUpQuestions.length > 0;
  const scoreReady =
    readyPillars.length === VINUNI_AACC_PILLARS.length &&
    (analysis.overall.score > 0 || !loading);
  const anySectionReady =
    overallReady || ideasReady || hookReady || readyPillars.length > 0 || nextStepsReady;
  const firstStrength = ideas.strengths[0] ?? overallItems[0];
  const firstGap = ideas.weaknesses.find(({ items }) => items.length)?.items[0];
  const strengthCount =
    ideas.strengths.length +
    readyPillars.reduce(
      (total, pillar) =>
        total + (review?.pillars[pillar.key].strengths.length ?? analysis.pillars[pillar.key].strengths.length),
      0,
    );
  const missingCount =
    ideas.weaknesses.reduce((total, group) => total + group.items.length, 0) +
    readyPillars.reduce(
      (total, pillar) =>
        total + (review?.pillars[pillar.key].gaps.length ?? analysis.pillars[pillar.key].gaps.length),
      0,
    );

  return (
    <TypingQueue>
      <EvidenceContext.Provider
        value={{
          onSelect: onEvidenceSelect,
          activeClaimKeys: new Set(activeClaimKeys),
        }}
      >
      <div className={manuscript ? 'space-y-8' : ''}>
      {manuscript && diagnostics ? (
        <EssayDiagnosticBoard
          diagnostics={diagnostics}
          manuscript={manuscript}
          projection={hasProjectedActions ? improvementProjection : undefined}
        />
      ) : manuscript ? (
        <EssayDiagnosticSkeleton manuscript={manuscript} />
      ) : null}
      <div
        data-visual-style="editorial-diagnostic"
        className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[#f8f6f3] shadow-[0_24px_70px_rgba(15,23,42,0.08)]"
      >
      <header className="relative overflow-hidden border-b border-slate-200 bg-white px-6 py-8 text-slate-950 md:px-10 md:py-10">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#ec4899_0%,#f9a8d4_44%,#f8f6f3_100%)]" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-pink-600">
          Phân tích có dẫn chứng
        </p>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] md:text-4xl">
              Hồ sơ phản biện bài luận
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {loading && !anySectionReady
                ? 'Đang phân tích bài luận'
                : VERDICT_VI[analysis.overall.verdict]}{' '}
              · Không phải quyết định tuyển sinh
            </p>
          </div>
          <div className="min-w-32 border-l-2 border-pink-400 pl-5 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Điểm tổng</p>
            <p className="mt-1 text-4xl font-semibold tracking-[-0.05em] tabular-nums">
              {loading && analysis.overall.score === 0
                ? '…'
                : (analysis.overall.score / 10).toFixed(1).replace('.0', '')}
              <span className="text-sm text-slate-500">/10</span>
            </p>
          </div>
        </div>
      </header>

      <div className="px-5 py-8 md:px-10 md:py-10">
        {anySectionReady ? <div
          aria-label="Tóm tắt chẩn đoán"
          data-layout="editorial-rail"
          className="mb-10 grid overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.04)] sm:grid-cols-3"
        >
          <span className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 text-emerald-800 sm:border-b-0 sm:border-r">
            <StatusIcon kind="complete" className="h-5 w-5" />
            <span><strong className="mr-1 text-2xl tabular-nums text-slate-950">{strengthCount}</strong><span className="text-xs font-semibold">điểm đã chứng minh</span></span>
          </span>
          <span className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 text-amber-800 sm:border-b-0 sm:border-r">
            <StatusIcon kind="review" className="h-5 w-5" />
            <span><strong className="mr-1 text-2xl tabular-nums text-slate-950">{ideas.suggestions.length + hook.suggestions.length}</strong><span className="text-xs font-semibold">điểm cần làm rõ</span></span>
          </span>
          <span className="flex items-center gap-3 px-5 py-4 text-rose-800">
            <StatusIcon kind="missing" className="h-5 w-5" />
            <span><strong className="mr-1 text-2xl tabular-nums text-slate-950">{missingCount}</strong><span className="text-xs font-semibold">nội dung còn thiếu</span></span>
          </span>
        </div> : null}
        <NarrativeJourneyChart
          analysis={analysis}
          diagnostics={diagnostics}
          strength={firstStrength}
          gap={firstGap}
        />
        {overallReady ? (
          <ProgressiveChapter letter="A" title="Tổng quan" animate={streaming}>
            {v2Analysis?.evidenceMap ? (
              <EvidenceCoverageMap
                map={v2Analysis.evidenceMap}
                strength={firstStrength}
                gap={firstGap}
              />
            ) : null}
            <BulletList items={overallItems} animate={streaming} />
          </ProgressiveChapter>
        ) : null}

        {ideasReady ? (
          <ProgressiveChapter letter="B" title="Ý tưởng & cấu trúc" animate={streaming}>
          <IdeasComparison strengths={ideas.strengths} weaknesses={ideas.weaknesses} />
          <details className="group rounded-[1.5rem] border border-slate-200 bg-white">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-pink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500">
            <DisclosureLabel closedText="Xem phân tích đầy đủ" openText="Thu gọn phân tích" />
          </summary>
          <div className="border-t border-slate-200 p-5">
          <div
            className={`grid gap-5 ${
              ideas.suggestions.length ? 'lg:grid-cols-2' : ''
            }`}
          >
            {ideas.strengths.length ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <StatusIcon kind="complete" /> Điểm mạnh
              </h4>
              <div className="mt-3">
                <BulletList items={ideas.strengths} tone="positive" />
              </div>
              </div>
            ) : null}
            {ideas.suggestions.length ? (
              <div className="rounded-2xl border border-pink-200 bg-pink-50/70 p-5">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-pink-800">
                  <StatusIcon kind="review" /> Gợi ý cải thiện
                </h4>
                <div className="mt-3">
                  <BulletList items={ideas.suggestions} tone="idea" />
                </div>
              </div>
            ) : null}
          </div>
          <div className="mt-5 space-y-4">
            {ideas.weaknesses.map((group) => (
              group.items.length ? (
                <div key={group.category} className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <StatusIcon kind="missing" /> {group.title}
                </h4>
                <div className="mt-3">
                  <BulletList items={group.items} tone="warning" />
                </div>
                </div>
              ) : null
            ))}
          </div>
          </div>
          </details>
          </ProgressiveChapter>
        ) : null}

        {hookReady ? (
          <ProgressiveChapter letter="C" title="Mở bài & sức hút" animate={streaming}>
          <WritingSignals diagnostics={diagnostics} />
          <div className="grid gap-4 border-t border-slate-200 p-4 lg:grid-cols-2">
            {hook.analysis.length ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  <StatusIcon kind="complete" /> Nhận định chính
                </h4>
                <div className="mt-3">
                  <BulletList items={hook.analysis} animate={streaming} />
                </div>
              </div>
            ) : null}
            {hook.suggestions.length ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-rose-800">
                  <StatusIcon kind="missing" /> Việc cần sửa trước
                </h4>
                <div className="mt-3">
                  <BulletList items={hook.suggestions} tone="warning" animate={streaming} />
                </div>
              </div>
            ) : null}
          </div>
          </ProgressiveChapter>
        ) : null}

        {readyPillars.length ? (
          <ProgressiveChapter letter="D" title="Đánh giá AACC" animate={streaming}>
          <AaccBulletChart analysis={analysis} review={review} />
          <details className="group rounded-[1.5rem] border border-slate-200 bg-white">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-pink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500">
            <DisclosureLabel closedText="Xem phân tích AACC đầy đủ" openText="Thu gọn phân tích AACC" />
          </summary>
          <div className="grid gap-4 lg:grid-cols-2">
            {readyPillars.map((pillar) => {
              const result = analysis.pillars[pillar.key];
              const reviewPillar = review?.pillars?.[pillar.key];
              const analysisItems: ReviewItem[] = reviewPillar?.analysis.length
                ? reviewPillar.analysis
                : (result.analysis ?? []);
              const strengthItems: ReviewItem[] = reviewPillar?.strengths.length
                ? reviewPillar.strengths
                : result.strengths;
              const gapItems: ReviewItem[] = reviewPillar?.gaps.length
                ? reviewPillar.gaps
                : result.gaps;
              return (
                <article key={pillar.key} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {pillar.name}
                      </p>
                      <h4 className="mt-1 font-semibold text-slate-950">{pillar.nameVi}</h4>
                    </div>
                    <span className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-700">
                      {loading && result.score === 0
                        ? '…'
                        : `${(result.score / 10).toFixed(1).replace('.0', '')}/10`}
                    </span>
                  </div>
                  <div className="mt-4">
                    <BulletList items={analysisItems} loading={loading} />
                  </div>
                  <div className="mt-4">
                    <BulletList items={strengthItems} tone="positive" loading={loading} />
                  </div>
                  <div className="mt-4">
                    <BulletList items={gapItems} tone="warning" loading={loading} />
                  </div>
                </article>
              );
            })}
          </div>
          </details>
          </ProgressiveChapter>
        ) : null}

        {nextStepsReady ? (
          <ProgressiveChapter letter="E" title="Bước tiếp theo" animate={streaming}>
          <PriorityRoadmap items={nextSteps} animate={streaming} />
          {followUpQuestions.length ? (
            <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50/70 p-5">
              <h4 className="text-sm font-semibold text-sky-900">Câu hỏi cần bổ sung</h4>
              <div className="mt-3">
                <BulletList items={followUpQuestions} animate={streaming} />
              </div>
            </div>
          ) : null}
          </ProgressiveChapter>
        ) : null}

        {scoreReady ? (
          <ProgressiveChapter letter="F" title="Điểm AACC" animate={streaming}>
          <aside aria-label="Điểm tổng AACC" className="rounded-[1.75rem] bg-pink-50/70 p-1">
            <ScoreBridge
              current={improvementProjection.current}
              potential={improvementProjection.potential}
              issues={nextSteps}
            />
          </aside>
          </ProgressiveChapter>
        ) : null}

        {loading && !scoreReady ? (
          <div
            data-testid="feedback-skeleton"
            className="flex items-center gap-3 border-t border-slate-200 py-6 text-sm text-slate-500"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-pink-400" aria-hidden />
            Đang phân tích phần tiếp theo…
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-7">
          <button
            type="button"
            onClick={onTryAgain}
            className="inline-flex h-11 items-center justify-center rounded-full border-2 border-pink-500 px-6 text-sm font-semibold text-pink-600 transition hover:bg-pink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500"
          >
            Chỉnh sửa & phân tích lại
          </button>
          <Link
            href="/mentors"
            className="inline-flex h-11 items-center justify-center rounded-full border-2 border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:border-pink-300 hover:bg-pink-50 hover:text-pink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500"
          >
            Trao đổi với mentor VinUni
          </Link>
        </div>
      </div>
      </div>
      </div>
      </EvidenceContext.Provider>
    </TypingQueue>
  );
}
