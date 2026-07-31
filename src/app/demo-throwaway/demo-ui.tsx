'use client';

/**
 * THROWAWAY DEMO — the shared primitives the walkthrough needs. Delete with the
 * folder.
 *
 * These are demo-quality stand-ins for the components task 6.5 will build
 * properly (`ui/panel.tsx`, `ui/status-pill.tsx`, `ui/autosave-status.tsx`,
 * `ui/suggestion-card.tsx`, `ui/cv-steps.tsx`, `ui/states.tsx`). They follow the
 * same rules the spec sets — status is text plus icon and never colour alone,
 * suggestions have no silent-apply path — so the demo does not teach anyone the
 * wrong interaction. They are not the real thing and should not be promoted;
 * build them in `src/features/application-strategy/ui/` instead.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ICONS, KitIcon, ProgressBar } from '@/shared/ui';
import type { KitIconArt } from '@/shared/ui';
import { statusLabel } from '@/features/application-strategy/domain';
import type { WorkspaceStatus } from '@/features/application-strategy/domain';
import { FAKE_SAVE_MS } from './fixtures';

// ── Panel ─────────────────────────────────────────────────────────────────

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-gb-2xl border border-line bg-surface p-gb-3xl ${className ?? ''}`}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  description,
  aside,
}: {
  title: string;
  description?: string;
  aside?: React.ReactNode;
}) {
  return (
    <header className="mb-gb-2xl flex items-start justify-between gap-gb-xl">
      <div className="flex flex-col gap-gb-xs">
        <h2 className="text-gb-lg font-semibold text-fg">{title}</h2>
        {description ? <p className="text-gb-sm text-fg-tertiary">{description}</p> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────

/**
 * Icon + text, always both. The spec is explicit that status must never be
 * conveyed by colour alone, so the label is not optional and the icon is not
 * decorative.
 */
const STATUS_ART: Record<WorkspaceStatus, { art: KitIconArt; tone: string }> = {
  not_started: { art: ICONS.clock, tone: 'bg-surface-muted text-fg-muted border-line' },
  in_progress: { art: ICONS.zap, tone: 'bg-info-subtle text-fg-info border-line' },
  needs_attention: {
    art: ICONS.messageChatCircle,
    tone: 'bg-brand-subtle text-fg-brand border-line',
  },
  ready_for_audit: {
    art: ICONS.checkCircle,
    tone: 'bg-surface-muted text-fg-verified border-line',
  },
};

export function StatusPill({
  status,
  label,
  size = 'md',
}: {
  status: WorkspaceStatus;
  /** Overrides the default wording. The icon still comes from `status`. */
  label?: string;
  size?: 'sm' | 'md';
}) {
  const { art, tone } = STATUS_ART[status];
  const pad = size === 'sm' ? 'px-gb-md py-gb-xxs text-gb-xs' : 'px-gb-lg py-gb-xs text-gb-sm';

  return (
    <span
      className={`inline-flex items-center gap-gb-xs rounded-gb-full border font-medium whitespace-nowrap ${tone} ${pad}`}
    >
      <KitIcon art={art} frame={size === 'sm' ? 12 : 14} />
      {label ?? statusLabel(status)}
    </span>
  );
}

/** A plain pass/fail marker for readiness checks and inline flags. */
export function CheckMark({ passed }: { passed: boolean }) {
  return (
    <span
      aria-hidden
      className={passed ? 'text-fg-verified' : 'text-fg-brand'}
    >
      <KitIcon art={passed ? ICONS.checkCircle : ICONS.messageChatCircle} frame={16} />
    </span>
  );
}

// ── Autosave ──────────────────────────────────────────────────────────────

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function AutosaveStatus({ status, version }: { status: SaveStatus; version?: number }) {
  if (status === 'idle') {
    return version === undefined ? null : (
      <span className="text-gb-xs text-fg-muted">Version {version}</span>
    );
  }

  const text =
    status === 'saving' ? 'Saving' : status === 'saved' ? 'Saved' : 'Could not save';

  return (
    <span
      aria-live="polite"
      className={`inline-flex items-center gap-gb-xs text-gb-xs ${
        status === 'error' ? 'text-fg-error' : 'text-fg-muted'
      }`}
    >
      {status === 'saved' ? <KitIcon art={ICONS.checkCircle} frame={12} /> : null}
      {text}
      {status === 'saved' && version !== undefined ? ` · version ${version}` : ''}
    </span>
  );
}

/**
 * Debounced fake autosave. Same contract as the real `use-autosave.ts` will
 * have — `{ status, save }`, last-write-wins, surfaces a version — so the
 * demoed behaviour matches what gets built.
 */
export function useFakeAutosave(initialVersion = 1) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [version, setVersion] = useState(initialVersion);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );

  const save = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (settle.current) clearTimeout(settle.current);
    setStatus('saving');

    timer.current = setTimeout(() => {
      setStatus('saved');
      setVersion((v) => v + 1);
      settle.current = setTimeout(() => setStatus('idle'), 2400);
    }, FAKE_SAVE_MS);
  }, []);

  return { status, version, save };
}

// ── Suggestion card ───────────────────────────────────────────────────────

/**
 * The only route AI text takes to the student.
 *
 * There is deliberately no prop that applies a suggestion without Accept,
 * Dismiss or Edit manually being pressed. That constraint is the reason this
 * component exists rather than each page rendering its own suggestion block.
 */
export function SuggestionCard({
  original,
  suggested,
  onAccept,
  onDismiss,
  onEdit,
}: {
  original: string;
  suggested: string;
  onAccept: () => void;
  onDismiss: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col gap-gb-lg rounded-gb-xl border border-line bg-surface-muted p-gb-2xl">
      <div className="flex flex-col gap-gb-xs">
        <span className="text-gb-xs font-semibold tracking-wide text-fg-muted uppercase">
          Current
        </span>
        <p className="text-gb-sm text-fg-tertiary line-through decoration-line-strong">
          {original}
        </p>
      </div>

      <div className="flex flex-col gap-gb-xs">
        <span className="text-gb-xs font-semibold tracking-wide text-fg-brand uppercase">
          Suggested
        </span>
        <p className="text-gb-sm text-fg">{suggested}</p>
      </div>

      <div className="flex flex-wrap gap-gb-md">
        <button
          type="button"
          onClick={onAccept}
          className="inline-flex items-center gap-gb-xs rounded-gb-md bg-brand px-gb-lg py-gb-md text-gb-sm font-semibold text-on-brand hover:bg-brand-hover"
        >
          <KitIcon art={ICONS.checkCircle} frame={14} />
          Accept
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-gb-md border border-line-strong bg-surface px-gb-lg py-gb-md text-gb-sm font-semibold text-fg-secondary hover:bg-surface-hover"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-gb-md px-gb-lg py-gb-md text-gb-sm font-semibold text-fg-tertiary hover:bg-surface-hover"
        >
          Edit manually
        </button>
      </div>
    </div>
  );
}

// ── CV steps ──────────────────────────────────────────────────────────────

export const CV_STEPS = [
  { key: 'target-profile', label: 'Target Profile' },
  { key: 'content', label: 'Nội dung CV' },
  { key: 'review', label: 'Bản CV' },
  { key: 'layout', label: 'Layout - PDF' },
] as const;

export type CvStepKey = (typeof CV_STEPS)[number]['key'];

/**
 * The compact four-step CV indicator. Built on ProgressBar and kept visually
 * subordinate to the global Stepper, which is the actual journey spine.
 */
export function CvSteps({ current }: { current: CvStepKey }) {
  const index = CV_STEPS.findIndex((s) => s.key === current);
  const percent = Math.round(((index + 1) / CV_STEPS.length) * 100);

  return (
    <div className="flex flex-col gap-gb-md">
      <div className="flex items-center justify-between gap-gb-lg">
        <ol className="flex flex-wrap items-center gap-gb-md text-gb-xs">
          {CV_STEPS.map((step, i) => (
            <li key={step.key} className="flex items-center gap-gb-md">
              <span
                className={
                  i === index
                    ? 'font-semibold text-fg-brand'
                    : i < index
                      ? 'text-fg-secondary'
                      : 'text-fg-muted'
                }
                aria-current={i === index ? 'step' : undefined}
              >
                {i + 1}. {step.label}
              </span>
              {i < CV_STEPS.length - 1 ? (
                <span aria-hidden className="text-fg-muted">
                  ·
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <span className="shrink-0 text-gb-xs text-fg-muted">
          Step {index + 1} of {CV_STEPS.length}
        </span>
      </div>
      <ProgressBar
        value={percent}
        size="sm"
        label={`CV step ${index + 1} of ${CV_STEPS.length}: ${CV_STEPS[index]?.label ?? ''}`}
      />
    </div>
  );
}

// ── States ────────────────────────────────────────────────────────────────

/**
 * Every state in the spec's Requirement 13 gets exactly one recovery action.
 * `action` is a single value rather than a list precisely so a state cannot
 * render two competing ways out.
 */
export function StateBlock({
  tone = 'neutral',
  title,
  body,
  action,
  secondary,
  busy,
}: {
  tone?: 'neutral' | 'attention' | 'error';
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  /** A genuinely secondary escape hatch, e.g. "Continue anyway". Never primary. */
  secondary?: { label: string; onClick: () => void };
  busy?: boolean;
}) {
  const border =
    tone === 'error'
      ? 'border-line-error bg-surface-error'
      : tone === 'attention'
        ? 'border-line bg-brand-subtle'
        : 'border-line bg-surface-muted';

  return (
    <div className={`flex flex-col gap-gb-lg rounded-gb-xl border p-gb-2xl ${border}`}>
      <div className="flex flex-col gap-gb-xs">
        <p
          className={`text-gb-sm font-semibold ${
            tone === 'error' ? 'text-fg-error' : 'text-fg'
          }`}
        >
          {title}
        </p>
        {body ? <p className="text-gb-sm text-fg-tertiary">{body}</p> : null}
      </div>

      {busy ? <ProgressBar label={title} size="sm" /> : null}

      {action || secondary ? (
        <div className="flex flex-wrap items-center gap-gb-lg">
          {action ? (
            <button
              type="button"
              onClick={action.onClick}
              className="rounded-gb-md bg-brand px-gb-xl py-gb-md text-gb-sm font-semibold text-on-brand hover:bg-brand-hover"
            >
              {action.label}
            </button>
          ) : null}
          {secondary ? (
            <button
              type="button"
              onClick={secondary.onClick}
              className="text-gb-sm font-semibold text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg"
            >
              {secondary.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────

export function OriginBadge({ origin }: { origin: 'university' | 'profile' | 'mixed' }) {
  const label =
    origin === 'university' ? 'From university' : origin === 'profile' ? 'From profile' : 'Mixed';
  return (
    <span className="inline-flex items-center rounded-gb-full bg-surface-muted px-gb-md py-gb-xxs text-gb-xs font-medium text-fg-muted">
      {label}
    </span>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-gb-md font-semibold text-fg">{children}</h3>;
}

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
