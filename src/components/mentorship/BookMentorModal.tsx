'use client';

import { useEffect, useState } from 'react';
import type { MentorWithUniversity, MentorAvailabilitySlot } from '@/types/mentorship';
import { formatMoney, computeServiceFee, computeTotal } from '@/lib/currency';
import { CloseIcon } from './mentor-icons';

const HELP_PROMPTS = [
  'Personal statement / SOP review',
  'Course choice & university fit',
  'Interview practice',
  'Scholarship & financial aid strategy',
  'Visa & relocation',
  'Life on campus',
  'Career planning',
  'Other (describe below)',
];

const QUESTION_PROMPTS = [
  'What\'s the one thing you wish you\'d known before applying?',
  'How competitive is the course you got into?',
  'What does a typical week look like?',
  'How did you finance your studies?',
];

type Props = {
  mentor: MentorWithUniversity;
  slot: MentorAvailabilitySlot;
  onClose: () => void;
};

type Phase = 'form' | 'redirecting';

/**
 * The booking modal — collects what the mentee wants help with, then kicks
 * off the Stripe Checkout session. After redirecting to Stripe, success +
 * cancellation are handled by the webhook + the success_url query string.
 */
export function BookMentorModal({ mentor, slot, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('form');
  const [helpTopic, setHelpTopic] = useState<string>(HELP_PROMPTS[0]);
  const [helpTopicCustom, setHelpTopicCustom] = useState<string>('');
  const [questions, setQuestions] = useState<string>('');
  const [outcome, setOutcome] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll + ESC to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const mentorAmount = Number(mentor.hourly_rate_amount ?? 0);
  const fee = computeServiceFee(mentorAmount);
  const total = computeTotal(mentorAmount);
  const currency = mentor.hourly_rate_currency;

  const start = new Date(slot.starts_at);
  const end = new Date(slot.ends_at);

  async function handleProceed() {
    setError(null);

    const finalTopic = helpTopic === 'Other (describe below)'
      ? helpTopicCustom.trim()
      : helpTopic;
    if (!finalTopic || finalTopic.length < 3) {
      setError('Please choose a topic so your mentor can prepare.');
      return;
    }
    if (!questions.trim() || questions.trim().length < 10) {
      setError('Tell your mentor what you want to discuss (at least a sentence).');
      return;
    }

    setPhase('redirecting');
    try {
      const res = await fetch('/api/mentorship/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: slot.id,
          help_topic: finalTopic,
          help_questions: questions.trim(),
          help_outcome: outcome.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Could not start checkout');
      }

      const { checkout_url } = (await res.json()) as { checkout_url: string };
      if (!checkout_url) throw new Error('Missing checkout URL from server');
      window.location.href = checkout_url;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Could not start checkout');
      setPhase('form');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4 py-6 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-mentor-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-black/5 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-pink-600">
              Step 2 of 2 · Tell us about your goals
            </p>
            <h2 id="book-mentor-title" className="mt-1 text-lg font-semibold text-slate-900">
              Book {mentor.display_name}
            </h2>
            <p className="text-xs text-slate-500">
              {start.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}{' '}
              · {start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              {' – '}
              {end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Topic */}
          <div>
            <label className="text-sm font-semibold text-slate-800">
              What do you want help with?
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {HELP_PROMPTS.map((opt) => {
                const active = helpTopic === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setHelpTopic(opt)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      active
                        ? 'border-pink-300 bg-pink-50 text-pink-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-pink-200'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {helpTopic === 'Other (describe below)' && (
              <input
                type="text"
                placeholder="Tell us in 1-2 words"
                value={helpTopicCustom}
                onChange={(e) => setHelpTopicCustom(e.target.value)}
                maxLength={80}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-cyan-300 focus:outline-none"
              />
            )}
          </div>

          {/* Questions */}
          <div>
            <label className="text-sm font-semibold text-slate-800">
              Specific questions you&rsquo;d like to ask
            </label>
            <p className="mt-0.5 text-xs text-slate-500">
              The more context you share, the more your mentor can prepare.
            </p>
            <textarea
              rows={5}
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              maxLength={1500}
              placeholder="e.g. I'm applying to MIT for Computer Science. I'd love advice on the supplemental essays, and how you balanced research with coursework."
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-cyan-300 focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUESTION_PROMPTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() =>
                    setQuestions((current) => (current ? current + (current.endsWith('\n') ? '' : '\n') + '• ' + q : '• ' + q))
                  }
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[0.7rem] text-slate-500 transition hover:border-cyan-200 hover:text-cyan-700"
                >
                  + {q}
                </button>
              ))}
            </div>
            <p className="mt-1 text-right text-xs text-slate-400">{questions.length}/1500</p>
          </div>

          {/* Outcome */}
          <div>
            <label className="text-sm font-semibold text-slate-800">
              What would success look like? (optional)
            </label>
            <input
              type="text"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              maxLength={200}
              placeholder="e.g. A clear plan for my SOP and 2 specific projects to mention."
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-cyan-300 focus:outline-none"
            />
          </div>

          {/* Pricing breakdown */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>Mentor session ({Math.round((end.getTime() - start.getTime()) / 60000)} min)</span>
              <span>{formatMoney(mentorAmount, currency)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-slate-500">
              <span>Glowbal service fee (10%)</span>
              <span>{formatMoney(fee, currency)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
              <span>Total today</span>
              <span>{formatMoney(total, currency)}</span>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
          <p className="text-[0.7rem] text-slate-400">
            Payments are secured by Stripe. You&rsquo;ll receive an email with the meeting link &amp; calendar invite.
          </p>
          <button
            type="button"
            onClick={handleProceed}
            disabled={phase === 'redirecting'}
            className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(255,77,140,0.25)] transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {phase === 'redirecting' ? 'Redirecting…' : `Pay ${formatMoney(total, currency)} & confirm`}
          </button>
        </div>
      </div>
    </div>
  );
}
