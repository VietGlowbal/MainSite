'use client';

import { useEffect, useState } from 'react';
import type { ReflectionCardValues } from '@/features/apply/domain';
import { Button, KitIcon, ICONS, Panel, PanelHeader, Textarea } from '@/shared/ui';

/**
 * The AI Reflection Card — Story → My Contribution → Evidence → Demonstrated
 * Skills → Key Takeaway → Future Connection — plus its loading state and its
 * "Here's how GlowBal understood this experience" review screen.
 *
 * Never replaces the raw reflection answers: this renders only `card`, which
 * is a separate field from `reflection` on the item (see
 * `activity-reflection.ts`). Editing here edits the card's own text, and
 * marks it `status: 'edited'`; it never rewrites what the student originally
 * wrote in the seven-dimension answers.
 */

const LOADING_STEPS = [
  'Understanding your contribution…',
  'Finding the strongest evidence…',
  'Identifying demonstrated skills…',
  'Connecting the experience to your future direction…',
] as const;

export function ReflectionCardLoading({ t }: { t: (s: string) => string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <Panel className="flex flex-col items-center gap-gb-xl py-gb-5xl text-center">
      <span className="flex size-12 animate-pulse items-center justify-center rounded-gb-full bg-brand-subtle text-fg-brand">
        <KitIcon art={ICONS.zapFast} frame={22} />
      </span>
      <h2 className="text-gb-lg font-semibold text-fg">{t('Building your Reflection Card')}</h2>
      <ul className="flex flex-col gap-gb-sm text-gb-sm text-fg-tertiary">
        {LOADING_STEPS.map((line, i) => (
          <li key={line} className={i <= step ? 'text-fg-secondary' : 'opacity-40'}>
            {t(line)}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** "We saved your reflection, but couldn't create the summary." */
export function ReflectionCardError({
  message,
  onRetry,
  t,
}: {
  message: string;
  onRetry: () => void;
  t: (s: string) => string;
}) {
  return (
    <Panel className="flex flex-col items-center gap-gb-lg py-gb-4xl text-center">
      <p className="text-gb-sm text-fg-error">{t(message)}</p>
      <Button type="button" onClick={onRetry}>
        {t('Try again')}
      </Button>
    </Panel>
  );
}

function linesToList(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function ReflectionCardView({
  card,
  editable,
  onSave,
  onRegenerate,
  onConfirm,
  t,
}: {
  card: ReflectionCardValues;
  editable: boolean;
  onSave: (next: ReflectionCardValues) => void;
  onRegenerate: () => void;
  onConfirm: () => void;
  t: (s: string) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card);

  // Adjusted during render rather than in a `useEffect` (which would set
  // state synchronously on mount) — React's documented pattern for
  // resetting derived state when a prop changes.
  const [prevCard, setPrevCard] = useState(card);
  if (card !== prevCard) {
    setPrevCard(card);
    setDraft(card);
  }

  function saveEdits() {
    onSave({ ...draft, status: 'edited' });
    setEditing(false);
  }

  if (editing) {
    return (
      <Panel className="flex flex-col gap-gb-xl">
        <PanelHeader title={t('Edit your Reflection Card')} />
        <Textarea
          name="card-story"
          label={t('Story')}
          rows={3}
          value={draft.story ?? ''}
          onChange={(e) => setDraft({ ...draft, story: e.target.value })}
        />
        <Textarea
          name="card-contributions"
          label={t('My Contribution (one per line)')}
          rows={4}
          value={draft.contributions.join('\n')}
          onChange={(e) => setDraft({ ...draft, contributions: linesToList(e.target.value) })}
        />
        <Textarea
          name="card-evidence"
          label={t('Evidence (one per line)')}
          rows={4}
          value={draft.evidence.join('\n')}
          onChange={(e) => setDraft({ ...draft, evidence: linesToList(e.target.value) })}
        />
        <Textarea
          name="card-skills"
          label={t('Demonstrated Skills — one per line, as "Skill — why"')}
          rows={4}
          value={draft.demonstratedSkills
            .map((s) => (s.evidence ? `${s.skill} — ${s.evidence}` : s.skill))
            .join('\n')}
          onChange={(e) =>
            setDraft({
              ...draft,
              demonstratedSkills: linesToList(e.target.value).map((line) => {
                const [skill, ...rest] = line.split('—').map((part) => part.trim());
                const evidence = rest.join('—').trim();
                return { skill: skill || line, ...(evidence ? { evidence } : {}) };
              }),
            })
          }
        />
        <Textarea
          name="card-takeaway"
          label={t('Key Takeaway')}
          rows={2}
          value={draft.keyTakeaway ?? ''}
          onChange={(e) => setDraft({ ...draft, keyTakeaway: e.target.value })}
        />
        <Textarea
          name="card-future"
          label={t('Future Connection')}
          rows={2}
          value={draft.futureConnection ?? ''}
          onChange={(e) => setDraft({ ...draft, futureConnection: e.target.value })}
        />
        <div className="flex justify-end gap-gb-md">
          <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
            {t('Cancel')}
          </Button>
          <Button type="button" onClick={saveEdits}>
            {t('Save changes')}
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="flex flex-col gap-gb-2xl">
      <div className="flex flex-col gap-gb-xs">
        <h2 className="text-gb-lg font-semibold text-fg">
          {t('Here’s how GlowBal understood this experience')}
        </h2>
        <p className="text-gb-sm text-fg-tertiary">{t('Review this before we use it in your reports.')}</p>
      </div>

      {card.story ? (
        <div className="flex flex-col gap-gb-xs">
          <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-tertiary">{t('Story')}</p>
          <p className="text-gb-sm text-fg-secondary">{card.story}</p>
        </div>
      ) : null}

      {card.contributions.length > 0 ? (
        <div className="flex flex-col gap-gb-xs">
          <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-tertiary">
            {t('My Contribution')}
          </p>
          <ul className="list-disc pl-gb-xl text-gb-sm text-fg-secondary">
            {card.contributions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {card.evidence.length > 0 ? (
        <div className="flex flex-col gap-gb-xs">
          <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-tertiary">{t('Evidence')}</p>
          <ul className="list-disc pl-gb-xl text-gb-sm text-fg-secondary">
            {card.evidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {card.demonstratedSkills.length > 0 ? (
        <div className="flex flex-col gap-gb-md">
          <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-tertiary">
            {t('Demonstrated Skills')}
          </p>
          <div className="flex flex-col gap-gb-md">
            {card.demonstratedSkills.map((skill) => (
              <div key={skill.skill} className="rounded-gb-lg bg-surface-muted px-gb-lg py-gb-md">
                <p className="text-gb-sm font-semibold text-fg">{skill.skill}</p>
                {skill.evidence ? (
                  <p className="mt-gb-xxs text-gb-xs text-fg-tertiary">
                    {t('Why GlowBal identified this')}: {skill.evidence}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {card.keyTakeaway ? (
        <div className="flex flex-col gap-gb-xs">
          <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-tertiary">
            {t('Key Takeaway')}
          </p>
          <p className="text-gb-sm text-fg-secondary">{card.keyTakeaway}</p>
        </div>
      ) : null}

      {card.futureConnection ? (
        <div className="flex flex-col gap-gb-xs">
          <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-tertiary">
            {t('Future Connection')}
          </p>
          <p className="text-gb-sm text-fg-secondary">{card.futureConnection}</p>
        </div>
      ) : null}

      {editable ? (
        <div className="flex flex-wrap justify-end gap-gb-md pt-gb-md">
          <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
            {t('Edit')}
          </Button>
          <Button type="button" variant="secondary" onClick={onRegenerate}>
            {t('Regenerate')}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {t('Looks right')}
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}
