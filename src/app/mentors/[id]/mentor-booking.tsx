'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Modal, Textarea } from '@/shared/ui';
import { computeServiceFee, computeTotal, formatMoney } from '@/lib/currency';
import { convertToVnd } from '@/lib/payments/vnpay-shared';
import { PaymentMethodSelector } from '@/components/payments/payment-method-selector';
import { useLanguage } from '@/lib/i18n';
import type { Currency, MentorAvailabilitySlot } from '@/types/mentorship';

/**
 * The booking section — Figma 375:21702, the "_Date picker menu" instance.
 *
 * ── The frame's calendar is broken, and this one is not ────────────────────
 *
 * `Dates` (375:21725) is 412px wide with cells at x=0,40,…,360 — ten columns —
 * under a seven-label weekday header, so the dates run 1…31 continuously and
 * "8", the selected day, sits in the ninth column. January 8 2027 is a Friday.
 * That is an auto-layout wrap artefact from stretching the component, not a
 * design: a calendar whose dates do not fall under their weekday cannot be
 * read. This renders a real Monday-first month grid at the same 40px cell size,
 * keeping the frame's visual language (rose pill on the selected day, a dot
 * under any day with availability).
 *
 * ── Why the whole widget waits for mount ───────────────────────────────────
 *
 * "Which day is this slot on" is a question with a different answer per
 * timezone, and the server renders in the host's zone while the browser renders
 * in the student's. Grouping slots into days on the server would therefore emit
 * markup the client immediately disagrees with — a hydration mismatch on the
 * one control that matters. So the shell (heading, helper text) is server-
 * rendered and identical in both passes, and the calendar itself is filled in
 * on the client at the same height, which is why there is no layout shift.
 *
 * ── Why "Book now" opens a form instead of going to Stripe ─────────────────
 *
 * The frame ends at the slot: pick a day, pick a time, "Đặt lịch ngay". But
 * POST /api/mentorship/checkout requires `help_topic` (3–200 chars) and the
 * booking is worthless to the mentor without it — it is the only thing telling
 * them what to prepare. Inventing one to satisfy the API would put words in the
 * student's mouth, so the slot picker stays exactly as drawn and the intake it
 * omits is asked for in a dialog before payment.
 */

/*
 * "Has this hydrated yet", without setting state in an effect — which is both a
 * cascading render and a lint error here. `useSyncExternalStore` is the
 * sanctioned way to give the server and the client different answers to the
 * same question: React takes the server snapshot during SSR and the client one
 * immediately after hydration. All three are module-level constants because an
 * inline `subscribe` would be a new function every render and resubscribe.
 */
const subscribeToNothing = () => () => {};
const onClient = () => true;
const onServer = () => false;

/** Monday-first, matching the frame's "Mo Tu We Th Fr Sa Su" header. */
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

type DayKey = string; // `yyyy-mm-dd` in the viewer's timezone

function dayKeyOf(date: Date): DayKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 0 for Monday … 6 for Sunday. `getDay()` is Sunday-first. */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

/**
 * The dates to draw, always whole weeks so the grid stays rectangular. Days
 * outside the month are included and rendered muted, exactly as the frame does.
 */
function monthGrid(year: number, month: number): Date[] {
  const first = startOfMonth(year, month);
  const start = new Date(first);
  start.setDate(first.getDate() - mondayIndex(first));

  const days: Date[] = [];
  const cursor = new Date(start);
  // Six weeks covers every possible month layout; trailing empty weeks are
  // trimmed below so February does not draw a blank row.
  for (let i = 0; i < 42; i += 1) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const lastOfMonth = new Date(year, month + 1, 0).getDate();
  const neededCells = mondayIndex(first) + lastOfMonth;
  const weeks = Math.ceil(neededCells / 7);
  return days.slice(0, weeks * 7);
}

function formatTime(iso: string, locale?: string): string {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatLongDate(key: DayKey, locale?: string): string {
  const parts = key.split('-').map(Number);
  const [y, m, d] = parts;
  if (y === undefined || m === undefined || d === undefined) return key;
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function MentorBooking({
  mentorId,
  mentorName,
  slots,
  amount,
  currency,
  isSignedIn,
}: {
  mentorId: string;
  mentorName: string;
  slots: readonly MentorAvailabilitySlot[];
  amount: number;
  currency: Currency;
  isSignedIn: boolean;
}) {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const locale = lang === 'vi' ? 'vi-VN' : 'en-GB';
  const mounted = useSyncExternalStore(subscribeToNothing, onClient, onServer);

  const byDay = useMemo(() => {
    const map = new Map<DayKey, MentorAvailabilitySlot[]>();
    for (const slot of slots) {
      const key = dayKeyOf(new Date(slot.starts_at));
      const list = map.get(key);
      if (list) list.push(slot);
      else map.set(key, [slot]);
    }
    return map;
  }, [slots]);

  const firstAvailable = useMemo(() => {
    const keys = [...byDay.keys()].sort();
    return keys[0] ?? null;
  }, [byDay]);

  const [cursor, setCursor] = useState(() => {
    const base = firstAvailable ? new Date(`${firstAvailable}T00:00:00`) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const [pickedDay, setPickedDay] = useState<DayKey | null>(firstAvailable);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);

  /*
   * Derived, not synchronised through an effect. The route is force-dynamic, so
   * `slots` changes whenever a session is sold, and the day held in state can
   * stop existing between renders. Falling back here means the stale value is
   * never rendered even for one frame — and `selectedSlot` below is derived the
   * same way, so a slot id left over from a day that vanished resolves to null
   * on its own and the Book button disables itself.
   */
  const selectedDay = pickedDay !== null && byDay.has(pickedDay) ? pickedDay : firstAvailable;

  const daySlots = selectedDay ? (byDay.get(selectedDay) ?? []) : [];
  const selectedSlot = daySlots.find((s) => s.id === selectedSlotId) ?? null;

  const grid = monthGrid(cursor.year, cursor.month);
  const monthLabel = startOfMonth(cursor.year, cursor.month).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
  const todayKey = dayKeyOf(new Date());

  const durationMins = selectedSlot
    ? Math.round(
        (new Date(selectedSlot.ends_at).getTime() -
          new Date(selectedSlot.starts_at).getTime()) /
          60000,
      )
    : null;

  return (
    <section
      id="booking"
      aria-labelledby="booking-heading"
      className="scroll-mt-gb-9xl rounded-gb-2xl bg-surface-muted px-gb-lg py-gb-4xl"
    >
      {/* The frame labels this "Điểm mạnh" — the strengths heading, pasted
          twice. See the departure note in mentor-detail.tsx. */}
      <h2 id="booking-heading" className="font-display text-gb-display-xs font-semibold text-fg">
        {t('Book a session')}
      </h2>
      {/* One literal, for the same two reasons as the empty state below. */}
      <p className="mt-gb-lg text-gb-lg text-fg-tertiary">
        {t('Pick any open day below. Sessions must be booked at least an hour ahead.')}
      </p>

      <div className="mt-gb-3xl overflow-hidden rounded-gb-xl border border-line bg-surface">
        {/*
         * "Are there any slots at all" is answerable on the server — it needs no
         * timezone — so the empty state renders in both passes and skips the
         * mount gate entirely. Only the day grid below is deferred, which is
         * also why this state is sized by its content instead of being padded
         * out to the picker's 364px: there is nothing coming to replace it.
         */}
        {slots.length === 0 ? (
          <div className="flex flex-col items-center gap-gb-md px-gb-2xl py-gb-6xl text-center">
            <p className="text-gb-md font-semibold text-fg">{t('No open times right now')}</p>
            {/*
             * One text child, and no interpolated name. Two reasons, both real:
             * `{mentorName} hasn't…` renders as two adjacent text nodes, which
             * did not survive hydration here; and a sentence with a name spliced
             * into it can never match a key in i18n-dictionary.ts, so it would
             * have stayed English forever.
             */}
            <p className="text-gb-sm text-fg-tertiary">
              {t('This advisor hasn’t published availability for the next 90 days.')}
            </p>
          </div>
        ) : !mounted ? (
          /* Same height as the real picker so nothing jumps when it arrives. */
          <div className="flex h-[364px] items-center justify-center text-gb-sm text-fg-muted">
            {t('Loading availability…')}
          </div>
        ) : (
          <>
            <div className="flex flex-col lg:flex-row">
              {/* ── Calendar, Figma 375:21720 ─────────────────────────── */}
              <div className="flex-1 p-gb-2xl">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setCursor((c) =>
                        c.month === 0
                          ? { year: c.year - 1, month: 11 }
                          : { year: c.year, month: c.month - 1 },
                      )
                    }
                    aria-label={t('Previous month')}
                    className="flex size-[32px] items-center justify-center rounded-gb-md text-fg-tertiary transition-colors hover:bg-surface-hover"
                  >
                    <span aria-hidden="true">‹</span>
                  </button>
                  <p aria-live="polite" className="text-gb-sm font-semibold text-fg">
                    {monthLabel}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setCursor((c) =>
                        c.month === 11
                          ? { year: c.year + 1, month: 0 }
                          : { year: c.year, month: c.month + 1 },
                      )
                    }
                    aria-label={t('Next month')}
                    className="flex size-[32px] items-center justify-center rounded-gb-md text-fg-tertiary transition-colors hover:bg-surface-hover"
                  >
                    <span aria-hidden="true">›</span>
                  </button>
                </div>

                <div className="mt-gb-xl grid grid-cols-7 gap-gb-xxs">
                  {WEEKDAYS.map((day) => (
                    <div
                      key={day}
                      aria-hidden="true"
                      className="flex h-[40px] items-center justify-center text-gb-sm font-medium text-fg-tertiary"
                    >
                      {t(day)}
                    </div>
                  ))}

                  {grid.map((date) => {
                    const key = dayKeyOf(date);
                    const inMonth = date.getMonth() === cursor.month;
                    const available = byDay.has(key);
                    const isSelected = key === selectedDay;

                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={!available}
                        aria-pressed={isSelected}
                        aria-label={
                          available
                            ? formatLongDate(key, locale)
                            : t('{date} — no times available', {
                                date: formatLongDate(key, locale),
                              })
                        }
                        onClick={() => {
                          setPickedDay(key);
                          setSelectedSlotId(null);
                        }}
                        className={`relative flex h-[40px] items-center justify-center rounded-gb-full text-gb-sm transition-colors ${
                          isSelected
                            ? 'bg-brand font-semibold text-on-brand'
                            : available
                              ? 'font-medium text-fg hover:bg-surface-hover'
                              : inMonth
                                ? 'cursor-default text-fg-muted'
                                : 'cursor-default text-fg-muted/60'
                        }`}
                      >
                        {date.getDate()}
                        {/* The availability dot, Figma's `_Calendar cell` with
                            its indicator on. Hidden when the day is selected —
                            a rose dot on a rose pill is invisible anyway. */}
                        {available && !isSelected ? (
                          <span
                            aria-hidden="true"
                            className="absolute bottom-[4px] size-[4px] rounded-gb-full bg-brand"
                          />
                        ) : null}
                        {key === todayKey && !isSelected ? (
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 rounded-gb-full ring-1 ring-inset ring-line"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Available times, Figma 375:21775 ──────────────────── */}
              <div className="border-t border-line p-gb-2xl lg:w-[260px] lg:border-l lg:border-t-0">
                <p className="text-center text-gb-sm font-semibold text-fg">
                  {t('Available times')}
                </p>
                {daySlots.length === 0 ? (
                  <p className="mt-gb-xl text-center text-gb-sm text-fg-muted">
                    {t('Select a day with a dot to see its times.')}
                  </p>
                ) : (
                  <ul className="mt-gb-xl flex max-h-[208px] flex-col gap-gb-sm overflow-y-auto">
                    {daySlots.map((slot) => {
                      const active = slot.id === selectedSlotId;
                      return (
                        <li key={slot.id}>
                          <button
                            type="button"
                            aria-pressed={active}
                            onClick={() => setSelectedSlotId(slot.id)}
                            className={`w-full rounded-gb-md border px-gb-lg py-gb-sm text-gb-sm font-semibold transition-colors ${
                              active
                                ? 'border-brand bg-brand-subtle text-fg-brand'
                                : 'border-line bg-surface text-fg hover:bg-surface-hover'
                            }`}
                          >
                            {formatTime(slot.starts_at, locale)}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* ── Bottom panel, Figma 375:21789 ───────────────────────── */}
            <div className="flex flex-col gap-gb-lg border-t border-line p-gb-xl sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-gb-lg">
                {/*
                 * The frame draws an editable date field here. Rendered as a
                 * read-only display instead: typing a date the mentor has not
                 * opened cannot produce a booking, so a text box would only
                 * invite input the calendar then has to reject.
                 */}
                <p className="rounded-gb-md border border-line px-gb-lg py-gb-sm text-gb-sm text-fg">
                  {selectedDay ? formatLongDate(selectedDay, locale) : t('No date selected')}
                </p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const now = new Date();
                    setCursor({ year: now.getFullYear(), month: now.getMonth() });
                  }}
                >
                  {t('Today')}
                </Button>
              </div>

              <div className="flex items-center gap-gb-lg">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedSlotId(null)}
                  disabled={selectedSlotId === null}
                >
                  {t('Cancel')}
                </Button>
                <Button
                  variant="primary"
                  disabled={selectedSlot === null}
                  onClick={() => {
                    if (!isSignedIn) {
                      router.push(`/auth?next=${encodeURIComponent(
                        `/advisors/${mentorId}`,
                      )}`);
                      return;
                    }
                    setIntakeOpen(true);
                  }}
                >
                  {t('Book now')}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedSlot && durationMins !== null ? (
        <BookingIntake
          open={intakeOpen}
          onClose={() => setIntakeOpen(false)}
          slot={selectedSlot}
          durationMins={durationMins}
          mentorName={mentorName}
          amount={amount}
          currency={currency}
        />
      ) : null}
    </section>
  );
}

/**
 * The step the frame does not draw: what the student wants out of the session.
 *
 * Kept to the two fields the API and the mentor genuinely need —
 * `help_topic` (required, 3–200) and `help_questions` — rather than porting the
 * legacy modal's third "what would success look like" field, which was optional
 * and unused downstream.
 */
function BookingIntake({
  open,
  onClose,
  slot,
  durationMins,
  mentorName,
  amount,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  slot: MentorAvailabilitySlot;
  durationMins: number;
  mentorName: string;
  amount: number;
  currency: Currency;
}) {
  const { lang, t } = useLanguage();
  const locale = lang === 'vi' ? 'vi-VN' : 'en-GB';
  const [topic, setTopic] = useState('');
  const [questions, setQuestions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'vnpay' | 'manual_bank_transfer'>('vnpay');
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const fee = computeServiceFee(amount);
  const total = computeTotal(amount);

  async function submit() {
    setError(null);

    const finalTopic = topic.trim();
    if (finalTopic.length < 3) {
      setError(t('Choose or type a topic so your advisor can prepare.'));
      return;
    }
    if (questions.trim().length < 10) {
      setError(t('Tell your advisor what you want to discuss — a sentence is enough.'));
      return;
    }

    setSubmitting(true);
    try {
      const key = idempotencyKey ?? crypto.randomUUID();
      setIdempotencyKey(key);
      const res = await fetch(paymentMethod === 'manual_bank_transfer' ? '/api/payments/manual/checkout' : '/api/payments/vnpay/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: 'mentorship',
          ...(paymentMethod === 'manual_bank_transfer' ? { provider: 'manual_bank_transfer' } : {}),
          slot_id: slot.id,
          help_topic: finalTopic,
          help_questions: questions.trim(),
          idempotency_key: key,
        }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        checkout_url?: string;
        status_url?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(t(body.error ?? 'Could not start checkout.'));
      if (!(paymentMethod === 'manual_bank_transfer' ? body.status_url : body.checkout_url)) {
        throw new Error(t('The payment link was missing. Please try again.'));
      }

      window.location.href = (paymentMethod === 'manual_bank_transfer' ? body.status_url : body.checkout_url)!;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Could not start checkout.'));
      setSubmitting(false);
    }
  }

  const start = new Date(slot.starts_at);

  return (
    <Modal
      open={open}
      onClose={onClose}
      label={t('Book a session with {name}', { name: mentorName })}
      className="max-w-gb-width-xl p-gb-4xl"
    >
      <h3 className="font-display text-gb-display-xs font-semibold text-fg">
        {t('Book {name}', { name: mentorName })}
      </h3>
      <p className="mt-gb-sm text-gb-sm text-fg-tertiary">
        {start.toLocaleDateString(locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}{' '}
        · {formatTime(slot.starts_at, locale)} · {t('{count} min', { count: durationMins })}
      </p>

      <div className="mt-gb-3xl flex flex-col gap-gb-2xl">
        <div>
          <p className="text-gb-sm font-semibold text-fg">{t('What do you want help with?')}</p>
          <div className="mt-gb-lg flex flex-wrap gap-gb-md">
            {TOPIC_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setTopic(t(suggestion));
                  setIdempotencyKey(null);
                }}
                aria-pressed={topic === suggestion || topic === t(suggestion)}
                className="rounded-gb-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Badge
                  variant={
                    topic === suggestion || topic === t(suggestion) ? 'brand-chip' : 'info-chip'
                  }
                >
                  {t(suggestion)}
                </Badge>
              </button>
            ))}
          </div>
          <label htmlFor="help-topic" className="sr-only">
            {t('Session topic')}
          </label>
          <input
            id="help-topic"
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              setIdempotencyKey(null);
            }}
            maxLength={200}
            placeholder={t('Or type your own topic')}
            className="mt-gb-lg w-full rounded-gb-md border border-line bg-surface px-gb-lg py-gb-md text-gb-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
        </div>

        <Textarea
          name="help-questions"
          label={t('What would you like to ask?')}
          hint={t('The more context you give, the more your advisor can prepare.')}
          rows={5}
          maxLength={1500}
          value={questions}
          onChange={(e) => {
            setQuestions(e.target.value);
            setIdempotencyKey(null);
          }}
          placeholder={t("e.g. I'm applying for Computer Science and would like advice on my personal statement.")}
        />

        <div className="rounded-gb-md bg-surface-muted p-gb-xl text-gb-sm">
          <div className="flex items-center justify-between text-fg-tertiary">
            <span>{t('Session ({count} min)', { count: durationMins })}</span>
            <span>{formatMoney(amount, currency)}</span>
          </div>
          <div className="mt-gb-sm flex items-center justify-between text-fg-tertiary">
            <span>{t('Service fee (10%)')}</span>
            <span>{formatMoney(fee, currency)}</span>
          </div>
          <div className="mt-gb-lg flex items-center justify-between border-t border-line pt-gb-lg text-gb-md font-semibold text-fg">
            <span>{t('Total')}</span>
            <span>{formatMoney(total, currency)}</span>
          </div>
        </div>

        <PaymentMethodSelector amountVnd={convertToVnd(total, currency)} value={paymentMethod} onChange={setPaymentMethod} />

        {error ? (
          <p role="alert" className="text-gb-sm text-fg-error">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-gb-lg">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t('Back')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting}>
            {submitting
              ? t('Redirecting…')
              : paymentMethod === 'manual_bank_transfer' ? t('Continue with manual transfer') : t('Continue with VNPay')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Starting points for the topic field. Generic on purpose — the mentor's own
 * `help_topics` are already shown in "Best for" further up the page, and
 * pre-filling from them would put the mentor's words in the student's request.
 */
const TOPIC_SUGGESTIONS = [
  'Personal statement review',
  'Course & university choice',
  'Interview practice',
  'Scholarships & funding',
  'Life on campus',
] as const;
