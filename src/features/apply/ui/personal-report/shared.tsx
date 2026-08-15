'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n';
import type { InsufficientData, ReportConfidence } from '../../domain';
import { Badge, Button, Panel, PanelHeader, Textarea } from '@/shared/ui';

/**
 * Chrome shared by every Personal Report section — pulled out of the
 * former single `personal-report-v2-view.tsx` (implementation spec §33:
 * "break the page into section files") so each chapter file only carries
 * the markup specific to its own section.
 */

export const CONFIDENCE_LABEL: Record<ReportConfidence, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const CONFIDENCE_BADGE_VARIANT: Record<ReportConfidence, 'safe-chip' | 'brand-chip' | 'neutral-chip'> = {
  high: 'safe-chip',
  medium: 'brand-chip',
  low: 'neutral-chip',
};

export function ConfidenceBadge({ confidence }: { confidence: ReportConfidence }) {
  const t = useT();
  return <Badge variant={CONFIDENCE_BADGE_VARIANT[confidence]}>{t(CONFIDENCE_LABEL[confidence])}</Badge>;
}

/**
 * Appends the current `?return=` context (this application's own path, when
 * the report was opened from one) onto an otherwise-stable, storable path —
 * see the file-level comment on `PersonalReportPage` for why this happens at
 * render time and never gets baked into the stored report.
 */
export function withReturn(href: string, returnTo: string | undefined): string {
  return returnTo ? `${href}?return=${encodeURIComponent(returnTo)}` : href;
}

/**
 * A "gap" the report can accept an answer for directly — see the doc
 * comment on `IntakeAction.fieldKey` and `supabase-personal-report-
 * supplements.sql` for why this writes to a report-only table rather than
 * reopening (possibly locked) Candidate Information. Collapses to a plain
 * button; expands into a textarea + save in place, then triggers
 * `onAnswered` (the report's own regenerate) once saved.
 */
export function InlineAnswerAction({
  label,
  fieldKey,
  onAnswered,
}: {
  label: string;
  fieldKey: string;
  onAnswered: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {t(label)}
      </Button>
    );
  }

  async function save() {
    if (!value.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/ai-strategy/personal-report/supplement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldKey, answer: value.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || t('Could not save your answer.'));
      setOpen(false);
      setValue('');
      onAnswered();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('Could not save your answer.'));
      setSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-gb-sm">
      <Textarea
        name={`report-answer-${fieldKey}`}
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t(label)}
        disabled={saving}
        error={error ?? undefined}
        autoFocus
      />
      <div className="flex gap-gb-sm">
        <Button size="sm" onClick={() => void save()} disabled={saving || !value.trim()}>
          {saving ? t('Saving…') : t('Save & update report')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
          {t('Cancel')}
        </Button>
      </div>
    </div>
  );
}

export function InsufficientDataCard({
  data,
  returnTo,
  onAnswered,
}: {
  data: InsufficientData;
  returnTo: string | undefined;
  onAnswered?: (() => void) | undefined;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-surface-muted p-gb-xl">
      <p className="text-gb-sm font-semibold text-fg">{t('More evidence needed')}</p>
      <p className="text-gb-sm text-fg-tertiary" data-no-auto-translate>
        {data.reason}
      </p>
      {data.actions.length > 0 ? (
        <div className="flex flex-wrap gap-gb-md print:hidden">
          {data.actions.map((action) =>
            action.fieldKey && onAnswered ? (
              <InlineAnswerAction
                key={action.kind + action.href}
                label={action.label}
                fieldKey={action.fieldKey}
                onAnswered={onAnswered}
              />
            ) : (
              <Button
                key={action.kind + action.href}
                href={withReturn(action.href, returnTo)}
                variant="secondary"
                size="sm"
              >
                {t(action.label)}
              </Button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

export function SectionShell({
  eyebrow,
  title,
  confidence,
  children,
}: {
  eyebrow: string;
  title: string;
  confidence?: ReportConfidence | undefined;
  children: React.ReactNode;
}) {
  return (
    <Panel as="section" elevation="flat" className="flex flex-col gap-gb-xl print:break-inside-avoid print:border-0 print:shadow-none">
      <PanelHeader
        title={title}
        description={eyebrow}
        action={confidence ? <ConfidenceBadge confidence={confidence} /> : undefined}
      />
      <div className="flex flex-col gap-gb-lg">{children}</div>
    </Panel>
  );
}
