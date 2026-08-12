'use client';

import { Button, ICONS, KitIcon, ProgressBar } from '@/shared/ui';
import { useT } from '@/lib/i18n';

/**
 * Every empty, loading, stale and failure state this feature can be in, with the
 * copy in one file.
 *
 * WHY THEY ARE COLLECTED RATHER THAN INLINE. There are about eighteen of them
 * across six screens, and the requirement is that each one offers exactly one
 * useful recovery action. Written inline, that becomes eighteen independent
 * judgements about what the way out is, and the ones on the least-visited screens
 * end up as a bare "Something went wrong". Here they are auditable in a single
 * read.
 *
 * `action` is a single value, not an array, so a state physically cannot render
 * two competing primary buttons. `secondary` exists for the genuine escape hatch —
 * "Continue to layout anyway" — and renders as text, never as a second button.
 */

export type StateTone = 'neutral' | 'attention' | 'error';

export type StateAction = { label: string; onClick?: (() => void) | undefined; href?: string | undefined };

const TONE: Record<StateTone, string> = {
  neutral: 'border-line bg-surface-muted',
  attention: 'border-line bg-brand-subtle',
  error: 'border-line-error bg-surface-error',
};

/**
 * The one shape all of the states below render through.
 *
 * Exported because a screen occasionally needs a state that is genuinely specific
 * to it; using this keeps the treatment identical even then.
 */
export function StateBlock({
  tone = 'neutral',
  title,
  body,
  action,
  secondary,
  busy,
  translate = false,
}: {
  tone?: StateTone | undefined;
  title: string;
  body?: string | undefined;
  action?: StateAction | undefined;
  secondary?: StateAction | undefined;
  /** Renders an indeterminate progress bar. For genuinely in-flight states only. */
  busy?: boolean | undefined;
  /** Opt-in for literals owned by this shared state catalogue; dynamic payloads stay untouched. */
  translate?: boolean | undefined;
}) {
  const t = useT();
  const localizedAction = action ? { ...action, label: translate ? t(action.label) : action.label } : undefined;
  const localizedSecondary = secondary ? { ...secondary, label: translate ? t(secondary.label) : secondary.label } : undefined;
  const localizedTitle = translate ? t(title) : title;
  const localizedBody = body ? (translate ? t(body) : body) : body;
  return (
    <div
      className={`flex flex-col gap-gb-lg rounded-gb-xl border p-gb-2xl ${TONE[tone]}`}
      {...(tone === 'error' ? { role: 'alert' } : {})}
    >
      <div className="flex flex-col gap-gb-xs">
        <p
          className={`flex items-center gap-gb-xs text-gb-sm font-semibold ${
            tone === 'error' ? 'text-fg-error' : 'text-fg'
          }`}
        >
          {tone === 'error' ? <KitIcon art={ICONS.messageChatCircle} frame={14} /> : null}
          {localizedTitle}
        </p>
        {localizedBody ? <p className="text-gb-sm text-fg-tertiary">{localizedBody}</p> : null}
      </div>

      {busy ? <ProgressBar label={localizedTitle} size="sm" /> : null}

      {localizedAction || localizedSecondary ? (
        <div className="flex flex-wrap items-center gap-gb-lg">
          {localizedAction ? renderAction(localizedAction) : null}
          {localizedSecondary ? (
            localizedSecondary.href ? (
              <a
                href={localizedSecondary.href}
                className="text-gb-sm font-semibold text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg"
              >
                {localizedSecondary.label}
              </a>
            ) : (
              <button
                type="button"
                onClick={localizedSecondary.onClick}
                className="rounded-gb-md text-gb-sm font-semibold text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {localizedSecondary.label}
              </button>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function renderAction(action: StateAction) {
  if (action.href) {
    return (
      <Button size="sm" href={action.href}>
        {action.label}
      </Button>
    );
  }
  return (
    <Button size="sm" onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

// ── Loading and in-flight ─────────────────────────────────────────────────

export function GeneratingState({ title, body, translate = false }: { title: string; body?: string | undefined; translate?: boolean | undefined }) {
  return <StateBlock title={title} body={body} busy translate={translate} />;
}

// ── Programme and profile data ────────────────────────────────────────────

export function NoProgrammeDataState({ applicationId }: { applicationId: string }) {
  return (
    <StateBlock
      title="We have not read this programme's page yet"
      body="Target profile suggestions use the course's own requirements. Without them, generation will leave most fields empty."
      action={{ label: 'Open course details', href: `/apply/${applicationId}` }}
      translate
    />
  );
}

// ── CV content and import ─────────────────────────────────────────────────

export function NoCvUploadedState({ onStartManually }: { onStartManually: () => void }) {
  return (
    <StateBlock
      title="No CV uploaded yet"
      body="Import a CV you already have, or start from your Glowbal profile."
      action={{ label: 'Upload a CV', href: '#cv-source' }}
      secondary={{ label: 'Enter information manually', onClick: onStartManually }}
      translate
    />
  );
}

/**
 * The unreadable-document fallback.
 *
 * The copy is fixed by the specification, and the reason is worth keeping: the
 * student's file DID upload. Telling them only that something failed reads as
 * their document having been thrown away.
 */
export function UnreadableCvState({
  onPasteText,
  onManual,
  onTryAnother,
}: {
  onPasteText: () => void;
  onManual: () => void;
  onTryAnother: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-gb-lg rounded-gb-xl border border-line bg-surface-muted p-gb-2xl">
      <div className="flex flex-col gap-gb-xs">
        <p className="text-gb-sm font-semibold text-fg">
          {t('We saved your file, but we could not read its text.')}
        </p>
        <p className="text-gb-sm text-fg-tertiary">
          {t('Scanned PDFs, images and Word documents cannot be read automatically yet. Your file is still attached to this application.')}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-gb-md">
        <Button size="sm" onClick={onPasteText}>
          {t('Paste CV text')}
        </Button>
        <Button size="sm" variant="secondary" onClick={onManual}>
          {t('Enter information manually')}
        </Button>
        <button
          type="button"
          onClick={onTryAnother}
          className="rounded-gb-md text-gb-sm font-semibold text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {t('Try another file')}
        </button>
      </div>
      <p className="text-gb-xs text-fg-muted">
        {t('A text-based PDF exported from Word or Google Docs reads reliably.')}
      </p>
    </div>
  );
}

// ── Analysis states ───────────────────────────────────────────────────────

export function AnalysisNotRunState({
  title,
  body,
  actionLabel,
  onRun,
  disabled,
  disabledReason,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onRun: () => void;
  disabled?: boolean | undefined;
  disabledReason?: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-gb-lg rounded-gb-xl border border-line bg-surface-muted p-gb-2xl">
      <div className="flex flex-col gap-gb-xs">
        <p className="text-gb-sm font-semibold text-fg">{title}</p>
        <p className="text-gb-sm text-fg-tertiary">{body}</p>
      </div>
      <div className="flex flex-wrap items-center gap-gb-lg">
        <Button size="sm" onClick={onRun} disabled={disabled}>
          {actionLabel}
        </Button>
        {disabled && disabledReason ? (
          <span className="text-gb-xs text-fg-muted">{disabledReason}</span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * "Your CV has changed since this review."
 *
 * `Continue to layout anyway` is deliberately present and deliberately secondary.
 * The requirement is explicit that a stale review must not hard-block the next
 * step: the student may know exactly what they changed, and trapping them behind
 * a re-run they have to pay for is worse than letting them proceed informed.
 */
export function OutdatedReviewState({
  onRerun,
  onContinue,
  running,
}: {
  onRerun: () => void;
  onContinue?: (() => void) | undefined;
  running?: boolean | undefined;
}) {
  return (
    <StateBlock
      tone="attention"
      title="Your CV has changed since this review."
      body="Run the review again to refresh the feedback."
      action={{ label: running ? 'Reviewing…' : 'Re-run review', onClick: onRerun }}
      {...(onContinue ? { secondary: { label: 'Continue to layout anyway', onClick: onContinue } } : {})}
      busy={running}
      translate
    />
  );
}

export function OutdatedAnalysisState({
  onRerun,
  running,
}: {
  onRerun: () => void;
  running?: boolean | undefined;
}) {
  return (
    <StateBlock
      tone="attention"
      title="Your statement has changed since this analysis."
      body="Re-analyze to refresh the feedback below."
      action={{ label: running ? 'Analyzing…' : 'Re-analyze', onClick: onRerun }}
      busy={running}
      translate
    />
  );
}

/**
 * A failed model call.
 *
 * The message is ours, never the provider's: a raw upstream error is
 * unactionable, occasionally leaks internals, and tells the student their work is
 * broken when the truth is that a third party is down.
 */
export function AnalysisFailedState({
  onRetry,
  onContinue,
  what = 'analysis',
}: {
  onRetry: () => void;
  onContinue?: (() => void) | undefined;
  what?: string | undefined;
}) {
  return (
    <StateBlock
      tone="error"
      title={`We could not finish the ${what}.`}
      body="Nothing you have written was lost. This is usually temporary."
      action={{ label: 'Retry', onClick: onRetry }}
      {...(onContinue ? { secondary: { label: 'Continue editing', onClick: onContinue } } : {})}
      translate
    />
  );
}

export function ProviderUnavailableState({ onRetry }: { onRetry: () => void }) {
  return (
    <StateBlock
      tone="error"
      title="Our AI provider is not responding."
      body="Your document is saved. Try again shortly."
      action={{ label: 'Try again', onClick: onRetry }}
      translate
    />
  );
}

export function MissingCvContentState({ applicationId }: { applicationId: string }) {
  return (
    <StateBlock
      title="There is no CV content to review yet"
      body="Add your education and experience first, then run the review."
      action={{ label: 'Add CV content', href: `/ai-strategy/${applicationId}/cv/content` }}
      translate
    />
  );
}

// ── Export states ─────────────────────────────────────────────────────────

export function ExportFailedState({ onRetry }: { onRetry: () => void }) {
  return (
    <StateBlock
      tone="error"
      title="We could not build your PDF."
      body="Your CV content is safe. This is usually temporary."
      action={{ label: 'Retry export', onClick: onRetry }}
      translate
    />
  );
}

export function ExportOutdatedState({ onRetry }: { onRetry: () => void }) {
  return (
    <StateBlock
      tone="attention"
      title="Your PDF is older than your CV"
      body="You have edited your CV since this file was generated."
      action={{ label: 'Generate a new PDF', onClick: onRetry }}
      translate
    />
  );
}

// ── Statement ─────────────────────────────────────────────────────────────

export function EmptyStatementState({ onPaste, onStart }: { onPaste: () => void; onStart: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-gb-lg rounded-gb-xl border border-line bg-surface-muted p-gb-2xl">
      <div className="flex flex-col gap-gb-xs">
        <p className="text-gb-sm font-semibold text-fg">{t('Nothing written yet')}</p>
        <p className="text-gb-sm text-fg-tertiary">
          {t('Paste a draft you already have, or start from the brief above.')}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-gb-md">
        <Button size="sm" onClick={onStart}>
          {t('Start writing')}
        </Button>
        <Button size="sm" variant="secondary" onClick={onPaste}>
          {t('Paste statement')}
        </Button>
      </div>
    </div>
  );
}
