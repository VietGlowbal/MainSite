'use client';

import { useState } from 'react';
import { ICONS, KitIcon, Textarea } from '@/shared/ui';

/**
 * The two write-something questions — the aspiration and the per-subject
 * motivation — and the idea helper they share.
 *
 * ─── THESE ARE THE QUESTIONS PEOPLE ABANDON ──────────────────────────────────
 *
 * Not because the answer is hard, but because an empty box asks for a finished
 * thought. Everything here exists to lower that: a character counter that
 * shows the ceiling is generous rather than a target, three prompts to think
 * against, a line saying the answer need not be perfect, and a button that
 * offers a sentence to start from.
 *
 * ─── THE SUGGESTIONS ARE INSERTED, NEVER APPLIED ─────────────────────────────
 *
 * A suggestion lands in the textarea only when the student clicks it, and is
 * ordinary editable text from that moment — there is no "AI answer" state, no
 * badge, nothing to undo. If they already had text, the suggestion is appended
 * rather than replacing it: overwriting someone's own words with a machine's
 * is the one behaviour the spec rules out explicitly.
 */

type Idea = string;

async function requestIdeas(body: unknown): Promise<Idea[]> {
  const response = await fetch('/api/reflection/ideas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? 'We could not come up with ideas just now.');
  }
  const payload = (await response.json()) as { ideas?: unknown };
  return Array.isArray(payload.ideas) ? (payload.ideas as Idea[]) : [];
}

/** The button, the suggestion list, and the states in between. */
function IdeaHelper({
  ideas,
  busy,
  error,
  onGenerate,
  onInsert,
  generateLabel,
  busyLabel,
  headingLabel,
  insertHint,
}: {
  ideas: Idea[];
  busy: boolean;
  error: string | null;
  onGenerate: () => void;
  onInsert: (idea: Idea) => void;
  generateLabel: string;
  busyLabel: string;
  headingLabel: string;
  insertHint: string;
}) {
  return (
    <div className="flex flex-col gap-gb-md">
      <button
        type="button"
        onClick={onGenerate}
        disabled={busy}
        className="inline-flex items-center gap-gb-sm self-start rounded-gb-lg border border-brand px-gb-lg py-gb-sm text-gb-sm font-semibold text-fg-brand transition-colors hover:bg-brand-subtle disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span aria-hidden="true">
          <KitIcon art={ICONS.zapFast} frame={16} />
        </span>
        {busy ? busyLabel : generateLabel}
      </button>

      {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}

      {ideas.length > 0 ? (
        <div className="flex flex-col gap-gb-sm rounded-gb-lg border border-line bg-surface-muted p-gb-lg">
          <p className="text-gb-sm font-semibold text-fg">{headingLabel}</p>
          <p className="text-gb-xs text-fg-tertiary">{insertHint}</p>
          <ul className="flex flex-col gap-gb-sm">
            {ideas.map((idea) => (
              <li key={idea}>
                <button
                  type="button"
                  onClick={() => onInsert(idea)}
                  className="w-full rounded-gb-lg border border-line bg-surface px-gb-lg py-gb-md text-left text-gb-sm text-fg-secondary transition-colors hover:border-brand hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {idea}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Appends rather than replaces, so a suggestion never eats existing text. */
function appendIdea(current: string, idea: string): string {
  const trimmed = current.trim();
  return trimmed ? `${trimmed}\n\n${idea}` : idea;
}

/** Q9 — what do you want to do after you graduate? */
export function AspirationQuestion({
  value,
  subjects,
  onChange,
  maxLength = 1500,
  t,
}: {
  value: string | undefined;
  /** Subject labels, as context for the suggestions. */
  subjects: readonly string[];
  onChange: (next: string | undefined) => void;
  maxLength?: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const text = value ?? '';

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      setIdeas(
        await requestIdeas({
          kind: 'aspiration',
          subjects,
          ...(text.trim() ? { draft: text } : {}),
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('We could not come up with ideas.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-gb-xl">
      <div className="flex flex-col gap-gb-xs">
        <Textarea
          name="careerGoal"
          // The question card above already asks this, word for word. A
          // visible label here would print it twice a few pixels apart;
          // `aria-label` keeps the accessible name without the repetition.
          aria-label={t('What do you want to do after you graduate?')}
          placeholder={t(
            'Example: I want to work in sustainable energy and help build a cleaner future.',
          )}
          rows={5}
          maxLength={maxLength}
          value={text}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
        <p className="self-end text-gb-xs tabular-nums text-fg-muted">
          {text.length} / {maxLength}
        </p>
      </div>

      <div className="flex flex-col gap-gb-md rounded-gb-lg bg-surface-muted p-gb-lg">
        <p className="flex items-center gap-gb-sm text-gb-sm font-semibold text-fg">
          <span aria-hidden="true" className="text-fg-brand">
            <KitIcon art={ICONS.zap} frame={14} />
          </span>
          {t('Here are some things to think about:')}
        </p>
        <ul className="flex flex-col gap-gb-xs text-gb-sm text-fg-tertiary sm:flex-row sm:flex-wrap sm:gap-gb-2xl">
          <li>• {t('What kind of work excites you?')}</li>
          <li>• {t('What impact do you want to make?')}</li>
          <li>• {t('Where do you see yourself in the future?')}</li>
        </ul>
      </div>

      <IdeaHelper
        ideas={ideas}
        busy={busy}
        error={error}
        onGenerate={() => void generate()}
        onInsert={(idea) => onChange(appendIdea(text, idea))}
        generateLabel={t('Generate ideas with AI')}
        busyLabel={t('Thinking…')}
        headingLabel={t('Pick one to start from')}
        insertHint={t('It goes straight into the box — edit it however you like.')}
      />

      <p className="flex items-start gap-gb-sm text-gb-sm text-fg-tertiary">
        <span aria-hidden="true" className="mt-gb-xxs shrink-0 text-fg-brand">
          <KitIcon art={ICONS.heart} frame={14} />
        </span>
        {t(
          'Your answer doesn’t need to be perfect — this can be short and you can always change it later.',
        )}
      </p>
    </div>
  );
}

/** Q10 — why are you interested in <subject>? */
export function SubjectMotivationQuestion({
  subjects,
  active,
  onActiveChange,
  answers,
  onAnswerChange,
  aspiration,
  maxLength = 1000,
  t,
}: {
  /** The subjects chosen in Q5, as {id, label}. */
  subjects: ReadonlyArray<{ id: string; label: string; icon?: string | undefined }>;
  active: string | undefined;
  onActiveChange: (id: string) => void;
  answers: Readonly<Record<string, string>>;
  onAnswerChange: (id: string, next: string) => void;
  /** Their Q9 answer, given to the model as related context. */
  aspiration: string | undefined;
  maxLength?: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = subjects.find((subject) => subject.id === active) ?? subjects[0];

  if (!current) {
    // Q5 is required, so this only happens if a student reaches Q10 with the
    // subjects question somehow unanswered — say it plainly rather than
    // rendering an empty card.
    return (
      <p className="text-gb-sm text-fg-tertiary">
        {t('Choose your subjects first and we’ll ask about them here.')}
      </p>
    );
  }

  const text = answers[current.id] ?? '';

  async function generate() {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      setIdeas(
        await requestIdeas({
          kind: 'subject-motivation',
          subject: current.label,
          ...(aspiration?.trim() ? { aspiration } : {}),
          ...(text.trim() ? { draft: text } : {}),
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('We could not come up with ideas.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-gb-xl">
      {subjects.length > 1 ? (
        <div className="flex flex-col gap-gb-md">
          <p className="text-gb-sm text-fg-secondary">
            {t('Choose a subject to tell us more about.')}
          </p>
          <div role="tablist" aria-label={t('Your subjects')} className="flex flex-wrap gap-gb-md">
            {subjects.map((subject) => {
              const selected = subject.id === current.id;
              const answered = (answers[subject.id] ?? '').trim().length > 0;
              return (
                <button
                  key={subject.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    onActiveChange(subject.id);
                    // Suggestions were for the previous subject; keeping them
                    // on screen would attach one subject's ideas to another.
                    setIdeas([]);
                    setError(null);
                  }}
                  className={`inline-flex items-center gap-gb-sm rounded-gb-full border px-gb-lg py-gb-sm text-gb-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    selected
                      ? 'border-brand bg-brand-subtle text-fg'
                      : 'border-line bg-surface text-fg-tertiary hover:border-line-strong'
                  }`}
                >
                  {subject.label}
                  {/* A tick, not just colour — the chips say which subjects
                      already have an answer, and colour alone would not. */}
                  {answered ? (
                    <span aria-label={t('answered')} className="text-fg-brand">
                      <KitIcon art={ICONS.checkCircle} frame={14} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-gb-xs">
        <Textarea
          name={`motivation-${current.id}`}
          label={t('Why are you interested in {subject}?', { subject: current.label })}
          placeholder={t(
            'Example: I first became interested in {subject} when I started building my own projects and realised I loved solving real problems.',
            { subject: current.label },
          )}
          rows={5}
          maxLength={maxLength}
          value={text}
          onChange={(e) => onAnswerChange(current.id, e.target.value)}
        />
        <p className="self-end text-gb-xs tabular-nums text-fg-muted">
          {text.length} / {maxLength}
        </p>
      </div>

      <div className="flex flex-col gap-gb-md rounded-gb-lg bg-surface-muted p-gb-lg">
        <p className="text-gb-sm font-semibold text-fg">{t('Need a nudge? Consider these:')}</p>
        <ul className="flex flex-col gap-gb-xs text-gb-sm text-fg-tertiary">
          <li>• {t('What first interested you in {subject}?', { subject: current.label })}</li>
          <li>
            • {t('What parts of {subject} excite you most?', { subject: current.label })}
          </li>
          <li>
            • {t('What would you like to do with {subject}?', { subject: current.label })}
          </li>
        </ul>
      </div>

      <IdeaHelper
        ideas={ideas}
        busy={busy}
        error={error}
        onGenerate={() => void generate()}
        onInsert={(idea) => onAnswerChange(current.id, appendIdea(text, idea))}
        generateLabel={t('Generate ideas with AI')}
        busyLabel={t('Thinking…')}
        headingLabel={t('Pick one to start from')}
        insertHint={t('It goes straight into the box — edit it however you like.')}
      />

      <p className="text-gb-sm text-fg-tertiary">
        {t('You only need to answer for one subject — you can add more later if you want.')}
      </p>
    </div>
  );
}
