'use client';

import { useState } from 'react';
import { Badge, Button } from '@/shared/ui';
import {
  CV_ENTRY,
  MATCHING_REPORT,
  PERSONAL_REPORT,
  RECOMMENDER,
  SCHOLARSHIP_MATCHES,
  STATEMENT_SUGGESTION,
  STRATEGY_POSITIONING,
  type Output,
} from '../domain';

const STATUS_LABEL: Record<Output['status'], string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete: 'Complete',
};

const STATUS_VARIANT: Record<Output['status'], 'neutral' | 'brand-subtle' | 'safe'> = {
  not_started: 'neutral',
  in_progress: 'brand-subtle',
  complete: 'safe',
};

function PreviewBody({ output }: { output: Output }) {
  switch (output.type) {
    case 'personal-report':
      return (
        <ul className="flex flex-col gap-gb-xs text-gb-sm text-fg-tertiary">
          {PERSONAL_REPORT.strengths.map((s) => (
            <li key={s.text}>✓ {s.text}</li>
          ))}
        </ul>
      );
    case 'matching-report':
      return <p className="text-gb-sm text-fg-tertiary">{MATCHING_REPORT.summary}</p>;
    case 'strategy':
      return <p className="text-gb-sm italic text-fg-tertiary">“{STRATEGY_POSITIONING}”</p>;
    case 'scholarship':
      return (
        <p className="text-gb-sm text-fg-tertiary">
          Top match: {SCHOLARSHIP_MATCHES[0]?.name} — {SCHOLARSHIP_MATCHES[0]?.matchScore}%.
        </p>
      );
    case 'cv':
      return <p className="text-gb-sm text-fg-tertiary">{CV_ENTRY}</p>;
    case 'personal-statement':
      return <p className="text-gb-sm text-fg-tertiary">{STATEMENT_SUGGESTION}</p>;
    case 'recommendation':
      return (
        <p className="text-gb-sm text-fg-tertiary">
          {RECOMMENDER.name} ({RECOMMENDER.role}) — requested {RECOMMENDER.requestedOn}.
        </p>
      );
    default:
      return <p className="text-gb-sm text-fg-tertiary">This output isn&rsquo;t generated yet.</p>;
  }
}

/**
 * Everything GlowBal or the student has produced, stored inside the Planner
 * — not a separate product feature (spec §17). Left: searchable list,
 * right: selected preview.
 */
export function OutputsView({
  outputs,
  onOpenTask,
}: {
  outputs: readonly Output[];
  onOpenTask: (taskId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const generated = outputs.filter((o) => o.status !== 'not_started');
  const [selectedId, setSelectedId] = useState<string | null>(generated[0]?.id ?? null);
  const filtered = outputs.filter((o) => o.title.toLowerCase().includes(query.toLowerCase()));
  const selected = outputs.find((o) => o.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-gb-lg lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-gb-2xl border border-line bg-surface p-gb-lg">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search outputs…"
          className="mb-gb-lg w-full rounded-gb-md border border-line bg-surface px-gb-lg py-gb-sm text-gb-sm text-fg outline-none focus:border-line-strong"
        />
        <ul className="flex flex-col gap-gb-xs">
          {filtered.map((output) => (
            <li key={output.id}>
              <button
                type="button"
                onClick={() => setSelectedId(output.id)}
                className={`flex w-full flex-col gap-gb-xxs rounded-gb-lg px-gb-lg py-gb-md text-left transition-colors ${
                  output.id === selectedId ? 'bg-brand-subtle' : 'hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center justify-between gap-gb-md">
                  <span className="text-gb-sm font-semibold text-fg">{output.title}</span>
                  <Badge variant={STATUS_VARIANT[output.status]} className="shrink-0">
                    {STATUS_LABEL[output.status]}
                  </Badge>
                </div>
                <span className="text-gb-xs text-fg-tertiary">{output.description}</span>
                {output.generatedAt ? (
                  <span className="text-gb-xs text-fg-muted">
                    Generated {output.generatedAt}
                    {output.updatedAt ? ` · Updated ${output.updatedAt}` : ''}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-gb-2xl border border-line bg-surface p-gb-lg">
        {selected ? (
          <div className="flex flex-col gap-gb-lg">
            <div className="flex items-center justify-between gap-gb-md">
              <p className="text-gb-md font-semibold text-fg">{selected.title}</p>
              <Badge variant={STATUS_VARIANT[selected.status]}>{STATUS_LABEL[selected.status]}</Badge>
            </div>
            {selected.status === 'not_started' ? (
              <p className="text-gb-sm text-fg-tertiary">
                This hasn&rsquo;t been generated yet — complete the task that produces it first.
              </p>
            ) : (
              <PreviewBody output={selected} />
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenTask(selected.relatedTaskId)}
              className="w-fit"
            >
              Open related task →
            </Button>
          </div>
        ) : (
          <p className="text-gb-sm text-fg-tertiary">Select an output to preview it.</p>
        )}
      </div>
    </div>
  );
}
