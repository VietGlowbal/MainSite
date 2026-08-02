'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ICONS, KitIcon } from '@/shared/ui';
import { isReviewOutdated } from '@/features/application-strategy/domain';
import type { CvReview } from '@/features/application-strategy/domain';
import { CvSteps, Panel, PanelHeader, StateBlock, StatusPill, formatDate } from '../../demo-ui';
import {
  FAKE_AI_MS,
  SECTION_LABELS,
  makeCvReview,
  makeStructuredCv,
  makeTargetProfile,
  type Scenario,
} from '../../fixtures';

/**
 * THROWAWAY DEMO — "AI ASSESSMENT". Delete with the folder.
 *
 * The outdated state is the one to demo. It is not a flag: `isReviewOutdated`
 * compares the review's recorded contentVersion (5) against the CV's current one
 * (7). And it does not hard-block progress — "Continue to layout anyway" is
 * present, because a student who has decided the feedback is stale should not be
 * trapped on this page.
 */
export function CvReviewWorkspace({ scenario }: { scenario: Scenario }) {
  const cv = makeStructuredCv(scenario);
  const targetProfile = makeTargetProfile(scenario);
  const fixture = makeCvReview(scenario);

  const [review, setReview] = useState<CvReview | null>(fixture);
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'failed'>('idle');
  const [expanded, setExpanded] = useState<number | null>(0);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [acknowledgedStale, setAcknowledgedStale] = useState(false);

  const outdated =
    !acknowledgedStale && isReviewOutdated(review, cv, targetProfile);

  const criticalOpen =
    review?.missingSignals.filter((s) => s.critical && !dismissed.includes(s.signal)).length ?? 0;

  function runReview(fail = false) {
    setPhase('analyzing');
    setTimeout(() => {
      if (fail) {
        setPhase('failed');
        return;
      }
      const fresh = makeCvReview('partial');
      if (fresh && cv && targetProfile) {
        // A fresh review records the versions it actually read, which is what
        // makes it current rather than a copy that looks current.
        setReview({
          ...fresh,
          contentVersion: cv.contentVersion,
          targetProfileVersion: targetProfile.version,
          createdAt: new Date().toISOString(),
        });
      }
      setAcknowledgedStale(false);
      setPhase('idle');
    }, FAKE_AI_MS);
  }

  return (
    <div className="flex flex-col gap-gb-3xl">
      <CvSteps current="review" />

      <header className="flex flex-wrap items-start justify-between gap-gb-lg">
        <div className="flex flex-col gap-gb-md">
          <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
            AI Assessment
          </h1>
          {review ? (
            <p className="text-gb-sm text-fg-muted">
              Đánh giá ngày {formatDate(review.createdAt)} · đọc phiên bản CV{' '}
              {review.contentVersion}
              {cv ? ` · CV hiện tại là phiên bản ${cv.contentVersion}` : ''}
            </p>
          ) : null}
        </div>
        {review ? (
          <StatusPill
            status={
              outdated || criticalOpen > 0 ? 'needs_attention' : 'ready_for_audit'
            }
          />
        ) : null}
      </header>

      {/* ── States ── */}

      {phase === 'analyzing' ? (
        <StateBlock
          title="Đang đánh giá CV"
          body="Đối chiếu nội dung CV với target profile và yêu cầu của chương trình."
          busy
        />
      ) : null}

      {phase === 'failed' ? (
        <StateBlock
          tone="error"
          title="Không thể hoàn tất đánh giá"
          /* No raw provider message — the student cannot act on one. */
          body="AI provider unavailable. Nội dung CV của bạn không bị ảnh hưởng."
          action={{ label: 'Retry', onClick: () => runReview(false) }}
          secondary={{ label: 'Continue editing', onClick: () => setPhase('idle') }}
        />
      ) : null}

      {!review && phase === 'idle' && cv ? (
        <StateBlock
          title="Chưa đánh giá"
          body="AI sẽ đọc CV của bạn và đối chiếu với target profile để tìm điểm mạnh và những gì còn thiếu."
          action={{ label: 'Đánh giá CV', onClick: () => runReview(false) }}
        />
      ) : null}

      {!cv ? (
        <StateBlock
          tone="attention"
          title="Missing CV content"
          body="Chưa có nội dung CV để đánh giá. Nhập nội dung trước, sau đó quay lại đây."
          action={{ label: 'Nhập nội dung CV', onClick: () => undefined }}
        />
      ) : null}

      {outdated && phase === 'idle' ? (
        <StateBlock
          tone="attention"
          title="Analysis outdated"
          /* Copy pinned by the spec. */
          body="Your CV has changed since this review. Run the review again to refresh the feedback."
          action={{ label: 'Re-run review', onClick: () => runReview(false) }}
          secondary={{
            label: 'Continue to layout anyway',
            onClick: () => setAcknowledgedStale(true),
          }}
        />
      ) : null}

      {review && phase === 'idle' && !outdated && criticalOpen === 0 ? (
        <StateBlock
          title="Critical gaps resolved"
          body="Không còn thiếu sót nghiêm trọng nào. Bạn có thể chọn layout và xuất PDF."
        />
      ) : null}

      {/* ── Summary ── */}

      {review ? (
        <Panel>
          <PanelHeader title="Tổng quan" />
          <p className="text-gb-md leading-relaxed text-fg-secondary">{review.summary}</p>
        </Panel>
      ) : null}

      {/* ── Strengths ── */}

      {review ? (
        <Panel>
          <PanelHeader
            title="Điểm mạnh"
            description="Trích dẫn trực tiếp từ CV của bạn — không diễn giải lại."
          />
          <ol className="flex flex-col gap-gb-lg">
            {review.strengths.map((s, i) => {
              const open = expanded === i;
              return (
                <li key={s.title} className="rounded-gb-xl border border-line bg-surface-muted">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : i)}
                    aria-expanded={open}
                    className="flex w-full items-start justify-between gap-gb-lg p-gb-xl text-left"
                  >
                    <span className="flex min-w-0 flex-col gap-gb-xxs">
                      <span className="text-gb-sm font-semibold text-fg">{s.title}</span>
                      <span className="text-gb-xs text-fg-muted">{s.targetProfileArea}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-gb-md">
                      <span
                        className={`rounded-gb-full px-gb-md py-gb-xxs text-gb-xs font-semibold ${
                          s.strength === 'strong'
                            ? 'bg-surface-muted text-fg-verified'
                            : 'bg-surface-muted text-fg-muted'
                        }`}
                      >
                        {s.strength === 'strong' ? 'Rõ ràng' : 'Vừa phải'}
                      </span>
                      <span aria-hidden className="text-fg-muted">
                        <KitIcon
                          art={ICONS.chevronDown}
                          frame={16}
                          className={open ? 'rotate-180' : ''}
                        />
                      </span>
                    </span>
                  </button>

                  {open ? (
                    <div className="flex flex-col gap-gb-lg border-t border-line p-gb-xl">
                      <blockquote className="border-l-2 border-brand pl-gb-xl text-gb-sm italic text-fg-secondary">
                        “{s.evidence}”
                      </blockquote>
                      <p className="text-gb-sm text-fg-tertiary">{s.programmeRelevance}</p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </Panel>
      ) : null}

      {/* ── Missing signals ── */}

      {review ? (
        <Panel>
          <PanelHeader
            title="Còn thiếu"
            description="Mỗi mục có một hành động cụ thể và mục CV cần sửa."
          />
          <ol className="flex flex-col gap-gb-lg">
            {review.missingSignals.map((m) => {
              const done = dismissed.includes(m.signal);
              return (
                <li
                  key={m.signal}
                  className={`flex flex-col gap-gb-lg rounded-gb-xl border p-gb-xl ${
                    done
                      ? 'border-line bg-surface opacity-60'
                      : m.critical
                        ? 'border-line bg-brand-subtle'
                        : 'border-line bg-surface-muted'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-gb-md">
                    <span className="text-gb-sm font-semibold text-fg">{m.signal}</span>
                    {m.critical && !done ? (
                      <span className="rounded-gb-full bg-surface px-gb-md py-gb-xxs text-gb-xs font-semibold text-fg-brand">
                        Nghiêm trọng
                      </span>
                    ) : null}
                    {done ? (
                      <span className="text-gb-xs font-semibold text-fg-verified">
                        Đã xử lý
                      </span>
                    ) : null}
                  </div>

                  <p className="text-gb-sm text-fg-tertiary">{m.reason}</p>
                  <p className="text-gb-sm font-medium text-fg-secondary">{m.action}</p>

                  <div className="flex flex-wrap items-center gap-gb-lg">
                    <Link
                      href={`/demo-throwaway/cv/content?scenario=${scenario}`}
                      className="inline-flex items-center gap-gb-xs rounded-gb-md border border-line-strong bg-surface px-gb-lg py-gb-md text-gb-xs font-semibold text-fg-secondary hover:bg-surface-hover"
                    >
                      <KitIcon art={ICONS.arrowRight} frame={12} />
                      Mở mục {SECTION_LABELS[m.targetSection]}
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        setDismissed((d) =>
                          d.includes(m.signal)
                            ? d.filter((x) => x !== m.signal)
                            : [...d, m.signal],
                        )
                      }
                      className="text-gb-xs font-medium text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg"
                    >
                      {done ? 'Bỏ đánh dấu' : 'Đánh dấu đã xử lý'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>
      ) : null}

      {/* ── Actions ── */}

      <div className="flex flex-wrap items-center gap-gb-xl">
        <Link
          href={`/demo-throwaway/cv/layout?scenario=${scenario}`}
          className="rounded-gb-md bg-brand px-gb-3xl py-gb-lg text-gb-sm font-semibold text-on-brand hover:bg-brand-hover"
        >
          Chọn layout và xuất PDF
        </Link>
        {review ? (
          <button
            type="button"
            onClick={() => runReview(false)}
            className="text-gb-sm font-medium text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg"
          >
            Đánh giá lại
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => runReview(true)}
          className="text-gb-xs text-fg-muted underline decoration-line underline-offset-4 hover:text-fg-tertiary"
        >
          Demo: lỗi AI provider
        </button>
      </div>
    </div>
  );
}
