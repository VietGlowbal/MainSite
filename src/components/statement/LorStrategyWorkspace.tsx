'use client';

import { useState } from 'react';
import type { LorStrategy, LorStrategyInput } from '@/lib/ai/lor';
import { Button } from '@/shared/ui';

export type LorEvidenceOption = {
  kind: 'activity' | 'achievement';
  id: string;
  title: string;
  description?: string | null;
};

export type StoredLorStrategy = Omit<LorStrategyInput, 'applicationId'> & LorStrategy;

type Props = {
  applicationId: string;
  targetName?: string;
  studentName?: string | null;
  evidence: LorEvidenceOption[];
  initialStrategy: StoredLorStrategy | null;
  onContinue: () => void;
};

const inputClass =
  'mt-gb-sm w-full rounded-gb-md border border-line bg-surface px-gb-lg py-gb-lg text-gb-sm text-fg shadow-gb-xs outline-none transition placeholder:text-fg-muted focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20';

type EmailTemplate = { subject: string; body: string };
type CachedEmailTemplate = EmailTemplate & {
  recommenderType: string;
  relationshipContext: string;
};

const emailTemplateStorageKey = (applicationId: string) =>
  `glowbal:lor-email-template:v1:${applicationId}`;

export function LorStrategyWorkspace({
  applicationId,
  targetName = 'your chosen programme',
  studentName,
  evidence,
  initialStrategy,
  onContinue,
}: Props) {
  const [recommenderType, setRecommenderType] = useState(
    initialStrategy?.recommenderType ?? 'subject_teacher',
  );
  const [relationshipContext, setRelationshipContext] = useState(
    initialStrategy?.relationshipContext ?? '',
  );
  const [knownDuration, setKnownDuration] = useState(
    initialStrategy?.knownDuration ?? 'one_to_two_years',
  );
  const [observedEvidence, setObservedEvidence] = useState(
    initialStrategy?.observedEvidence ?? [],
  );
  const [strategy, setStrategy] = useState<LorStrategy | null>(initialStrategy);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate | null>(null);

  const emailSubject = `Recommendation letter request for ${targetName}`;
  const emailBody = `Dear [Recommender's Name],

I hope you are well. I am applying to ${targetName} and would be very grateful if you would feel comfortable writing a letter of recommendation for me.

${relationshipContext.trim() ? `You have known me through ${relationshipContext.trim()}. ` : ''}I have prepared a short brief with the experiences you have directly observed, so that the letter can reflect your own perspective clearly. I can also send my CV, programme details, and the submission deadline.

Please let me know if this would be possible. Thank you very much for considering my request.

Best regards,
${studentName || '[Your name]'}`;

  const activeEmailSubject = emailTemplate?.subject ?? emailSubject;
  const activeEmailBody = emailTemplate?.body ?? emailBody;

  async function openEmailTemplate() {
    setEmailOpen(true);
    setEmailCopied(false);
    setEmailError('');
    const context = relationshipContext.trim();
    try {
      const cached = JSON.parse(
        window.localStorage.getItem(emailTemplateStorageKey(applicationId)) ?? 'null',
      ) as CachedEmailTemplate | null;
      if (
        cached &&
        cached.recommenderType === recommenderType &&
        cached.relationshipContext === context &&
        cached.subject &&
        cached.body
      ) {
        setEmailTemplate({ subject: cached.subject, body: cached.body });
        return;
      }
    } catch {
      // A broken local draft should not stop the user from generating a new one.
    }

    setEmailTemplate(null);
    setEmailLoading(true);
    try {
      const response = await fetch('/api/ai/lor-email-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, recommenderType, relationshipContext: context }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not create the email template.');
      const template = body as EmailTemplate;
      setEmailTemplate(template);
      try {
        window.localStorage.setItem(
          emailTemplateStorageKey(applicationId),
          JSON.stringify({ ...template, recommenderType, relationshipContext: context }),
        );
      } catch {
        // Storage can be unavailable in private browsing; the generated template still works.
      }
    } catch (cause) {
      setEmailError(cause instanceof Error ? cause.message : 'Could not create the email template.');
    } finally {
      setEmailLoading(false);
    }
  }

  async function copyEmailTemplate() {
    try {
      await navigator.clipboard.writeText(`Subject: ${activeEmailSubject}\n\n${activeEmailBody}`);
      setEmailCopied(true);
    } catch {
      setEmailCopied(false);
    }
  }

  async function generateStrategy() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/ai/lor-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          recommenderType,
          relationshipContext,
          knownDuration,
          observedEvidence,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not generate a recommender strategy.');
      setStrategy(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not generate a recommender strategy.');
    } finally {
      setLoading(false);
    }
  }

  function toggleEvidence(option: LorEvidenceOption) {
    setObservedEvidence((current) => {
      const selected = current.some(({ kind, id }) => kind === option.kind && id === option.id);
      return selected
        ? current.filter(({ kind, id }) => kind !== option.kind || id !== option.id)
        : [...current, { kind: option.kind, id: option.id }];
    });
  }

  return (
    <section className="w-full overflow-y-auto bg-surface-muted p-gb-xl sm:p-gb-3xl lg:p-gb-4xl">
      <div className="mx-auto max-w-gb-desktop">
        <p className="text-gb-xs font-bold uppercase tracking-[0.2em] text-fg-brand">
          F7.1 · Evidence matching
        </p>
        <h2 className="mt-gb-sm font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
          Build the recommender&apos;s point of view
        </h2>
        <p className="mt-gb-sm max-w-2xl text-gb-sm leading-6 text-fg-tertiary">
          Select only experiences this recommender directly observed. School and programme context
          are taken from this application.
        </p>

        <form
          className="mt-gb-3xl grid gap-gb-xl rounded-gb-2xl border border-line bg-surface p-gb-xl shadow-gb-sm sm:grid-cols-2 sm:p-gb-2xl"
          onSubmit={(event) => {
            event.preventDefault();
            void generateStrategy();
          }}
        >
          <label className="text-gb-sm font-semibold text-fg-secondary">
            Who are you asking for a recommendation?
            <select
              className={inputClass}
              value={recommenderType}
              onChange={(event) => setRecommenderType(event.target.value as typeof recommenderType)}
            >
              <option value="subject_teacher">Subject teacher</option>
              <option value="homeroom_teacher">Homeroom teacher</option>
              <option value="school_counselor">School counselor</option>
              <option value="research_supervisor">Research supervisor</option>
              <option value="club_advisor">Club advisor</option>
              <option value="internship_supervisor">Internship supervisor</option>
              <option value="employer">Employer</option>
              <option value="volunteer_supervisor">Volunteer supervisor</option>
              <option value="coach">Coach</option>
              <option value="academic_mentor">Academic mentor</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="text-gb-sm font-semibold text-fg-secondary">
            How long have they known you?
            <select
              className={inputClass}
              value={knownDuration}
              onChange={(event) => setKnownDuration(event.target.value as typeof knownDuration)}
            >
              <option value="less_than_six_months">Less than 6 months</option>
              <option value="six_to_twelve_months">6–12 months</option>
              <option value="one_to_two_years">1–2 years</option>
              <option value="more_than_two_years">More than 2 years</option>
            </select>
          </label>

          <label className="text-gb-sm font-semibold text-fg-secondary sm:col-span-2">
            How do they know you?
            <textarea
              className={`${inputClass} min-h-28 resize-y`}
              minLength={10}
              maxLength={1000}
              required
              value={relationshipContext}
              onChange={(event) => setRelationshipContext(event.target.value)}
              placeholder="For example: She taught me Economics for two years and supervised my research project."
            />
          </label>

          <fieldset className="sm:col-span-2">
            <legend className="text-gb-sm font-semibold text-fg-secondary">
              What experiences have they directly observed or supervised?
            </legend>
            <div className="mt-gb-lg grid gap-gb-sm sm:grid-cols-2">
              {evidence.length ? (
                evidence.map((option) => {
                  const checked = observedEvidence.some(
                    ({ kind, id }) => kind === option.kind && id === option.id,
                  );
                  return (
                    <label
                      key={`${option.kind}:${option.id}`}
                      className={`flex cursor-pointer gap-gb-lg rounded-gb-md border p-gb-lg transition-colors ${
                        checked
                          ? 'border-brand bg-brand-subtle'
                          : 'border-line bg-surface-muted hover:border-line-strong'
                      }`}
                    >
                      <input
                        className="mt-gb-xs h-4 w-4 accent-brand"
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEvidence(option)}
                      />
                      <span>
                        <span className="block text-gb-sm font-semibold text-fg-secondary">
                          {option.title}
                        </span>
                        {option.description ? (
                          <span className="mt-gb-xs block text-gb-xs leading-5 text-fg-tertiary">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })
              ) : (
                <p className="rounded-gb-md border border-dashed border-line-strong p-gb-xl text-gb-sm text-fg-tertiary sm:col-span-2">
                  No saved activities or achievements are available yet.
                </p>
              )}
            </div>
          </fieldset>

          {error ? (
            <p className="rounded-gb-md bg-surface-error px-gb-lg py-gb-md text-gb-sm font-medium text-fg-error sm:col-span-2" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            className="sm:col-span-2 sm:justify-self-start"
            type="submit"
            size="lg"
            disabled={loading || relationshipContext.trim().length < 10}
          >
            {loading ? 'Generating strategy…' : 'Generate recommender strategy'}
          </Button>
        </form>

        {strategy ? (
          <div className="mt-gb-3xl space-y-gb-xl" aria-live="polite">
            <section className="rounded-gb-2xl border border-line bg-surface p-gb-2xl text-fg">
              <p className="text-gb-xs font-bold tracking-[0.2em] text-fg-brand">
                RECOMMENDER PERSPECTIVE
              </p>
              <p className="mt-gb-lg max-w-3xl text-gb-sm leading-6 text-fg-tertiary">
                {strategy.perspective.summary}
              </p>
              <div className="mt-gb-xl grid gap-gb-lg md:grid-cols-2">
                {strategy.perspective.strongInsights.map((item) => (
                  <article key={item.trait} className="rounded-gb-md bg-brand-subtle p-gb-xl">
                    <h4 className="font-semibold">{item.trait}</h4>
                    <p className="mt-gb-xs text-gb-sm leading-6 text-fg-tertiary">{item.explanation}</p>
                  </article>
                ))}
                {strategy.perspective.limitedInsights.map((item) => (
                  <article key={item.topic} className="rounded-gb-md border border-line bg-surface-muted p-gb-xl">
                    <h4 className="font-semibold">{item.topic}</h4>
                    <p className="mt-gb-xs text-gb-sm leading-6 text-fg-tertiary">{item.explanation}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-gb-2xl border border-line bg-surface p-gb-2xl">
              <p className="text-gb-xs font-bold uppercase tracking-[0.2em] text-fg-brand">
                F7.2 · Recommended emphasis
              </p>
              <div className="mt-gb-xl space-y-gb-lg">
                {strategy.recommendations.map((item) => (
                  <article key={item.trait} className="rounded-gb-md border border-line p-gb-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-fg">{item.trait}</h4>
                      <span className="rounded-gb-full bg-brand-subtle px-gb-md py-gb-xs text-gb-xs font-bold uppercase text-fg-brand">
                        {item.priority.replace('_', ' ')} priority
                      </span>
                    </div>
                    <p className="mt-gb-sm text-gb-sm leading-6 text-fg-tertiary">{item.rationale}</p>
                    <p className="mt-gb-sm text-gb-sm leading-6 text-fg-secondary">
                      <span className="font-semibold">How to raise it:</span> {item.howToRaise}
                    </p>
                  </article>
                ))}
              </div>
              {strategy.doNotPrioritize.length ? (
                <div className="mt-gb-2xl border-t border-line pt-gb-xl">
                  <h3 className="text-gb-sm font-bold uppercase tracking-[0.14em] text-fg-tertiary">
                    Do not prioritise
                  </h3>
                  <div className="mt-gb-lg grid gap-gb-lg sm:grid-cols-2">
                    {strategy.doNotPrioritize.map((item) => (
                      <article key={item.trait} className="rounded-gb-md bg-surface-muted p-gb-xl">
                        <h4 className="font-semibold text-fg">{item.trait}</h4>
                        <p className="mt-gb-xs text-gb-sm leading-6 text-fg-tertiary">{item.reason}</p>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-gb-2xl border border-brand bg-brand-subtle p-gb-2xl">
              <h3 className="text-gb-lg font-semibold text-fg">Suggested Recommender Brief</h3>
              <p className="mt-gb-lg whitespace-pre-wrap text-gb-sm leading-7 text-fg-secondary">
                {strategy.recommendationBrief}
              </p>
            </section>

            <div className="flex flex-wrap gap-gb-md">
              <Button type="button" size="lg" onClick={onContinue}>
                Continue
              </Button>
              <Button type="button" size="lg" variant="secondary" onClick={() => void openEmailTemplate()}>
                Send an email to my recommender
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {emailOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-gb-lg" role="presentation">
          <section
            aria-label="Email template for recommender"
            aria-modal="true"
            role="dialog"
            className="w-full max-w-2xl rounded-gb-2xl bg-surface p-gb-2xl shadow-gb-lg"
          >
            <div className="flex items-start justify-between gap-gb-lg">
              <div>
                <p className="text-gb-xs font-bold uppercase tracking-[0.18em] text-fg-brand">EMAIL TEMPLATE</p>
                <h3 className="mt-gb-xs text-gb-xl font-semibold text-fg">Ask your recommender</h3>
                <p className="mt-gb-xs text-gb-sm text-fg-tertiary">AI is drafting this with your application context.</p>
              </div>
              <button
                type="button"
                aria-label="Close email template"
                className="rounded-gb-full p-gb-sm text-fg-tertiary hover:bg-surface-muted hover:text-fg"
                onClick={() => setEmailOpen(false)}
              >
                ×
              </button>
            </div>

            <p className="mt-gb-lg text-gb-xs font-semibold uppercase tracking-[0.14em] text-fg-tertiary">Subject</p>
            <p className="mt-gb-xs rounded-gb-md bg-surface-muted px-gb-lg py-gb-md text-gb-sm text-fg-secondary">{activeEmailSubject}</p>
            {emailLoading ? (
              <div className="mt-gb-lg flex min-h-72 items-center justify-center rounded-gb-md border border-line bg-surface-muted text-gb-sm text-fg-tertiary">
                <span className="mr-gb-sm h-4 w-4 animate-spin rounded-gb-full border-2 border-brand-subtle border-t-brand" />
                Drafting your email…
              </div>
            ) : (
              <textarea
                aria-label="Email template"
                readOnly
                value={activeEmailBody}
                className="mt-gb-lg min-h-72 w-full resize-y rounded-gb-md border border-line bg-surface-muted p-gb-lg text-gb-sm leading-6 text-fg-secondary outline-none"
              />
            )}
            {emailError ? <p className="mt-gb-sm text-gb-xs text-fg-error">{emailError} Using the standard template instead.</p> : null}
            <div className="mt-gb-xl flex flex-wrap justify-end gap-gb-md">
              <Button type="button" variant="secondary" disabled={emailLoading} onClick={() => void copyEmailTemplate()}>
                {emailCopied ? 'Copied' : 'Copy email'}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
