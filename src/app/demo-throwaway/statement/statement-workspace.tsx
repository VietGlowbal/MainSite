'use client';

import { useMemo, useState } from 'react';
import { ICONS, KitIcon } from '@/shared/ui';
import {
  AACC_PILLARS,
  MIN_ANALYSABLE_WORDS,
  canAnalyseStatement,
  isAnalysisOutdated,
} from '@/features/application-strategy/domain';
import type { StatementAnalysis, StatementFinding } from '@/features/application-strategy/domain';
import {
  AutosaveStatus,
  CheckMark,
  Panel,
  PanelHeader,
  StateBlock,
  SuggestionCard,
  useFakeAutosave,
} from '../demo-ui';
import {
  DEMO_STATEMENT_BRIEF,
  DEMO_STATEMENT_DRAFT,
  DEMO_STATEMENT_PROMPT,
  DEMO_WORD_LIMIT,
  FAKE_AI_MS,
  makeStatementAnalysis,
  statementVersion,
  wordCount,
  type Scenario,
} from '../fixtures';

/**
 * THROWAWAY DEMO — "Strengthen Your Statement". Delete with the folder.
 *
 * The quote-binding behaviour is the subtle part and the part most worth
 * demoing. Findings carry a verbatim quote. If you edit the draft so a quoted
 * passage no longer exists, the finding renders WITHOUT a highlight rather than
 * highlighting the nearest similar text. Highlighting the wrong sentence is
 * worse than highlighting nothing, because the student then edits the wrong
 * sentence. Try deleting the phrase "accurate at rush hour" from the draft and
 * watch that finding lose its anchor.
 */

const SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'ideas', label: 'Ý tưởng và Cấu trúc' },
  { key: 'opening', label: 'Mở bài và sức hút' },
  { key: 'aacc', label: 'Đánh giá AACC' },
  { key: 'readiness', label: 'Submit Audit / Readiness' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

const PILLAR_LABEL: Record<(typeof AACC_PILLARS)[number], string> = {
  academic: 'Academic',
  activities: 'Activities',
  character: 'Character',
  contribution: 'Contribution',
};

/** The framing string the spec pins. Displayed, not paraphrased. */
const AACC_FRAMING =
  'This score measures how clearly the current draft demonstrates this area. It is not an admission probability.';

export function StatementWorkspace({
  scenario,
  initialSection,
}: {
  scenario: Scenario;
  initialSection?: string | undefined;
}) {
  const fixture = makeStatementAnalysis(scenario);

  const [draft, setDraft] = useState(scenario === 'empty' ? '' : DEMO_STATEMENT_DRAFT);
  const [analysis, setAnalysis] = useState<StatementAnalysis | null>(fixture);
  const [version, setVersion] = useState(statementVersion(scenario));
  const [section, setSection] = useState<SectionKey>(
    (SECTIONS.find((s) => s.key === initialSection)?.key ?? 'overview') as SectionKey,
  );
  const [busy, setBusy] = useState(false);
  const [activeFinding, setActiveFinding] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Record<string, 'accepted' | 'dismissed'>>({});
  const [suggestionFor, setSuggestionFor] = useState<StatementFinding | null>(null);
  const autosave = useFakeAutosave(version);

  const words = wordCount(draft);
  const outdated = isAnalysisOutdated(analysis, version);
  const overLimit = words > DEMO_WORD_LIMIT;

  const active = useMemo(() => {
    if (!analysis || !activeFinding) return null;
    return (
      [...analysis.ideasAndStructure, ...analysis.opening].find((f) => f.id === activeFinding) ??
      null
    );
  }, [analysis, activeFinding]);

  /**
   * Verbatim match only, then whitespace-normalised. Never fuzzy. Mirrors what
   * `domain/quote-match.ts` will do.
   */
  function quoteState(finding: StatementFinding): 'matched' | 'unmatched' {
    if (!finding.quote) return 'unmatched';
    if (draft.includes(finding.quote)) return 'matched';
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    return norm(draft).includes(norm(finding.quote)) ? 'matched' : 'unmatched';
  }

  function analyse() {
    setBusy(true);
    setTimeout(() => {
      const fresh = makeStatementAnalysis('partial');
      if (fresh) {
        setAnalysis({ ...fresh, contentVersion: version, createdAt: new Date().toISOString() });
      }
      setBusy(false);
    }, FAKE_AI_MS);
  }

  function acceptRevision(finding: StatementFinding) {
    if (finding.quote && finding.suggestedRevision && draft.includes(finding.quote)) {
      setDraft(draft.replace(finding.quote, finding.suggestedRevision));
      setVersion((v) => v + 1);
      autosave.save();
    }
    setResolved((r) => ({ ...r, [finding.id]: 'accepted' }));
    setSuggestionFor(null);
  }

  return (
    <div className="flex flex-col gap-gb-3xl">
      <header className="flex flex-col gap-gb-md">
        <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
          Strengthen Your Statement
        </h1>
        <p className="max-w-3xl text-gb-md text-fg-tertiary">
          Đề bài: {DEMO_STATEMENT_PROMPT}
        </p>
      </header>

      {/* ── Strategy brief ── */}

      <details className="rounded-gb-2xl border border-line bg-surface-muted p-gb-2xl">
        <summary className="cursor-pointer text-gb-sm font-semibold text-fg">
          Strategy Brief · {DEMO_STATEMENT_BRIEF.mustDemonstrate.length} điều cần chứng minh
          {DEMO_STATEMENT_BRIEF.missingInformation.length > 0
            ? ` · ${DEMO_STATEMENT_BRIEF.missingInformation.length} thông tin còn thiếu`
            : ''}
        </summary>

        <div className="mt-gb-xl grid gap-gb-2xl md:grid-cols-2">
          <BriefList title="Statement phải chứng minh" items={DEMO_STATEMENT_BRIEF.mustDemonstrate} />
          <BriefList title="Thông tin về chương trình" items={DEMO_STATEMENT_BRIEF.programmeInformation} />
          <BriefList title="Bằng chứng nên dùng" items={DEMO_STATEMENT_BRIEF.evidenceToConsider} />
          <BriefList title="CV đã nói rồi — đừng lặp lại" items={DEMO_STATEMENT_BRIEF.coveredByCv} />
          <BriefList title="Còn thiếu thông tin" items={DEMO_STATEMENT_BRIEF.missingInformation} />
        </div>
      </details>

      <div className="grid gap-gb-2xl lg:grid-cols-[3fr_2fr]">
        {/* ── Editor ── */}

        <Panel>
          <PanelHeader
            title="Personal Statement"
            aside={<AutosaveStatus status={autosave.status} version={autosave.version} />}
          />

          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setVersion((v) => v + 1);
              autosave.save();
            }}
            rows={22}
            placeholder="Bắt đầu viết, hoặc dán bản nháp bạn đã có..."
            className="w-full resize-y rounded-gb-md border border-line-strong bg-surface px-gb-xl py-gb-lg text-gb-sm leading-relaxed text-fg placeholder:text-fg-placeholder focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
          />

          <div className="mt-gb-lg flex flex-wrap items-center justify-between gap-gb-lg">
            <span className={`text-gb-sm ${overLimit ? 'text-fg-error' : 'text-fg-muted'}`}>
              {words} / {DEMO_WORD_LIMIT} từ
              {overLimit ? ' · vượt giới hạn' : ''}
            </span>

            <div className="flex flex-wrap items-center gap-gb-lg">
              <button
                type="button"
                disabled={!canAnalyseStatement(words) || busy}
                onClick={analyse}
                className="inline-flex items-center gap-gb-xs rounded-gb-md bg-brand px-gb-xl py-gb-md text-gb-sm font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-50"
              >
                <KitIcon art={ICONS.zapFast} frame={14} />
                {analysis ? 'Phân tích lại' : 'AI Feedback'}
              </button>
            </div>
          </div>

          {!canAnalyseStatement(words) ? (
            <p className="mt-gb-md text-gb-xs text-fg-muted">
              Cần ít nhất {MIN_ANALYSABLE_WORDS} từ để phân tích. Dưới mức đó, phản hồi sẽ chỉ
              nói về độ dài chứ không về nội dung.
            </p>
          ) : null}
        </Panel>

        {/* ── Feedback ── */}

        <div className="flex flex-col gap-gb-2xl">
          {busy ? <StateBlock title="Đang phân tích statement" busy /> : null}

          {outdated && !busy ? (
            <StateBlock
              tone="attention"
              title="Phản hồi đã cũ"
              body="Bản nháp đã thay đổi từ lần phân tích trước. Phân tích lại để cập nhật."
              action={{ label: 'Phân tích lại', onClick: analyse }}
            />
          ) : null}

          {!analysis && !busy && words === 0 ? (
            <StateBlock
              title="Chưa có nội dung"
              body="Dán bản nháp bạn đã có, hoặc bắt đầu từ Strategy Brief ở trên."
              action={{
                label: 'Start with this brief',
                onClick: () => {
                  setDraft(DEMO_STATEMENT_DRAFT);
                  setVersion((v) => v + 1);
                },
              }}
            />
          ) : null}

          {analysis && !busy ? (
            <Panel>
              <nav
                aria-label="Feedback sections"
                className="mb-gb-xl flex flex-wrap gap-gb-md overflow-x-auto"
              >
                {SECTIONS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSection(s.key)}
                    aria-current={section === s.key ? 'true' : undefined}
                    className={`rounded-gb-full px-gb-lg py-gb-xs text-gb-xs font-semibold whitespace-nowrap ${
                      section === s.key
                        ? 'bg-brand text-on-brand'
                        : 'border border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </nav>

              {section === 'overview' ? (
                <dl className="flex flex-col gap-gb-lg">
                  <OverviewRow label="Statement nói gì" value={analysis.overview.communicates} />
                  <OverviewRow label="Điểm mạnh nhất" value={analysis.overview.strongestQuality} />
                  <OverviewRow
                    label="Vấn đề quan trọng nhất"
                    value={analysis.overview.mostImportantIssue}
                  />
                  <OverviewRow
                    label="Có trả lời đúng đề bài"
                    value={
                      analysis.overview.answersPrompt === 'yes'
                        ? 'Có'
                        : analysis.overview.answersPrompt === 'partly'
                          ? 'Một phần'
                          : analysis.overview.answersPrompt === 'no'
                            ? 'Chưa'
                            : 'Không xác định'
                    }
                  />
                </dl>
              ) : null}

              {section === 'ideas' || section === 'opening' ? (
                <ol className="flex flex-col gap-gb-lg">
                  {(section === 'ideas' ? analysis.ideasAndStructure : analysis.opening).map(
                    (finding) => {
                      const state = quoteState(finding);
                      const outcome = resolved[finding.id];

                      return (
                        <li
                          key={finding.id}
                          className={`flex flex-col gap-gb-md rounded-gb-xl border p-gb-xl ${
                            outcome
                              ? 'border-line bg-surface opacity-60'
                              : activeFinding === finding.id
                                ? 'border-brand bg-brand-subtle'
                                : 'border-line bg-surface-muted'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-gb-md">
                            <SeverityTag severity={finding.severity} />
                            <span className="text-gb-sm font-semibold text-fg">
                              {finding.category}
                            </span>
                            {outcome ? (
                              <span className="text-gb-xs font-semibold text-fg-verified">
                                {outcome === 'accepted' ? 'Đã áp dụng' : 'Đã bỏ qua'}
                              </span>
                            ) : null}
                          </div>

                          <p className="text-gb-sm text-fg-tertiary">{finding.explanation}</p>

                          {finding.quote ? (
                            state === 'matched' ? (
                              <blockquote className="border-l-2 border-brand bg-surface pl-gb-xl text-gb-xs italic text-fg-secondary">
                                “{finding.quote}”
                              </blockquote>
                            ) : (
                              /* No highlight rather than the wrong highlight. */
                              <p className="rounded-gb-md bg-surface px-gb-lg py-gb-md text-gb-xs text-fg-muted">
                                Đoạn văn này không còn trong bản nháp, nên phản hồi hiển thị
                                không kèm trích dẫn.
                              </p>
                            )
                          ) : null}

                          <p className="text-gb-xs font-medium text-fg-secondary">
                            {finding.suggestedAction}
                          </p>

                          {!outcome ? (
                            <div className="flex flex-wrap items-center gap-gb-lg">
                              {finding.suggestedRevision ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveFinding(finding.id);
                                    setSuggestionFor(finding);
                                  }}
                                  className="rounded-gb-md border border-line-strong bg-surface px-gb-lg py-gb-md text-gb-xs font-semibold text-fg-secondary hover:bg-surface-hover"
                                >
                                  Xem bản viết lại
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() =>
                                  setResolved((r) => ({ ...r, [finding.id]: 'dismissed' }))
                                }
                                className="text-gb-xs font-medium text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg"
                              >
                                Bỏ qua
                              </button>
                            </div>
                          ) : null}

                          {suggestionFor?.id === finding.id && finding.suggestedRevision ? (
                            <SuggestionCard
                              original={finding.quote ?? ''}
                              suggested={finding.suggestedRevision}
                              onAccept={() => acceptRevision(finding)}
                              onDismiss={() => {
                                setResolved((r) => ({ ...r, [finding.id]: 'dismissed' }));
                                setSuggestionFor(null);
                              }}
                              onEdit={() => setSuggestionFor(null)}
                            />
                          ) : null}
                        </li>
                      );
                    },
                  )}
                </ol>
              ) : null}

              {section === 'aacc' ? (
                <div className="flex flex-col gap-gb-lg">
                  {/* Framing sentence, verbatim. */}
                  <p className="rounded-gb-md bg-surface-muted p-gb-lg text-gb-xs text-fg-tertiary">
                    {AACC_FRAMING}
                  </p>

                  {AACC_PILLARS.map((key) => {
                    const pillar = analysis.aacc[key];
                    return (
                      <div
                        key={key}
                        className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-surface-muted p-gb-xl"
                      >
                        <div className="flex items-baseline gap-gb-md">
                          <span className="text-gb-sm font-semibold text-fg">
                            {PILLAR_LABEL[key]}
                          </span>
                          {/* Small secondary text. Not a ring, not a bar. */}
                          <span className="text-gb-xs text-fg-muted">{pillar.score}/100</span>
                        </div>

                        <p className="text-gb-sm text-fg-tertiary">{pillar.explanation}</p>

                        {pillar.evidence.length > 0 ? (
                          <ul className="flex flex-col gap-gb-xs">
                            {pillar.evidence.map((e) => (
                              <li
                                key={e}
                                className="border-l-2 border-line-strong pl-gb-lg text-gb-xs italic text-fg-muted"
                              >
                                “{e}”
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        {pillar.missingEvidence.length > 0 ? (
                          <ul className="flex list-disc flex-col gap-gb-xs pl-gb-2xl text-gb-xs text-fg-tertiary">
                            {pillar.missingEvidence.map((m) => (
                              <li key={m}>{m}</li>
                            ))}
                          </ul>
                        ) : null}

                        <p className="text-gb-xs font-medium text-fg-secondary">
                          {pillar.recommendedImprovement}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {section === 'readiness' ? (
                <div className="flex flex-col gap-gb-lg">
                  <div className="flex items-center gap-gb-md">
                    <span className="text-gb-sm font-semibold text-fg">
                      {analysis.readiness.state === 'ready'
                        ? 'Ready for Submit Audit'
                        : 'Needs attention'}
                    </span>
                    <span className="text-gb-xs text-fg-muted">
                      {analysis.readiness.checks.filter((c) => c.passed).length} /{' '}
                      {analysis.readiness.checks.length} kiểm tra đạt
                    </span>
                  </div>

                  <ul className="flex flex-col gap-gb-md">
                    {analysis.readiness.checks.map((check) => (
                      <li
                        key={check.key}
                        className="flex items-start gap-gb-lg rounded-gb-md border border-line bg-surface-muted p-gb-lg"
                      >
                        <span className="pt-gb-xxs">
                          <CheckMark passed={check.passed} />
                        </span>
                        <div className="flex min-w-0 flex-col gap-gb-xxs">
                          <span className="text-gb-xs font-semibold text-fg capitalize">
                            {check.key.replace(/([A-Z])/g, ' $1')}
                          </span>
                          <span className="text-gb-xs text-fg-tertiary">{check.detail}</span>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <p className="text-gb-xs text-fg-muted">
                    Đây là kiểm tra ở mức statement. Submit Audit đầy đủ là Feature 4 và không
                    nằm trong bản demo này.
                  </p>
                </div>
              ) : null}
            </Panel>
          ) : null}

          {active && !suggestionFor ? (
            <p className="text-gb-xs text-fg-muted">
              Đang xem: {active.category}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BriefList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-gb-md">
      <p className="text-gb-xs font-semibold tracking-wide text-fg-muted uppercase">{title}</p>
      <ul className="flex list-disc flex-col gap-gb-xs pl-gb-2xl text-gb-sm text-fg-tertiary">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-gb-xxs border-b border-line pb-gb-md last:border-0 last:pb-0">
      <dt className="text-gb-xs font-semibold tracking-wide text-fg-muted uppercase">{label}</dt>
      <dd className="text-gb-sm text-fg-secondary">{value}</dd>
    </div>
  );
}

function SeverityTag({ severity }: { severity: StatementFinding['severity'] }) {
  const map = {
    strength: { label: 'Điểm mạnh', className: 'text-fg-verified' },
    suggestion: { label: 'Gợi ý', className: 'text-fg-info' },
    problem: { label: 'Cần sửa', className: 'text-fg-brand' },
  } as const;
  const { label, className } = map[severity];

  return (
    <span
      className={`inline-flex items-center gap-gb-xs rounded-gb-full bg-surface px-gb-md py-gb-xxs text-gb-xs font-semibold ${className}`}
    >
      <KitIcon
        art={severity === 'strength' ? ICONS.checkCircle : ICONS.messageChatCircle}
        frame={12}
      />
      {label}
    </span>
  );
}
