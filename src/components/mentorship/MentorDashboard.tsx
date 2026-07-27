'use client';

import { useMemo, useState } from 'react';
import type {
  MentorProfile,
  MentorshipBooking,
  MentorAvailabilitySlot,
  Currency,
  BookingStatus,
} from '@/types/mentorship';
import { formatMoney, currencySymbol, toSmallestUnits, toMajorUnits } from '@/lib/currency';
import { CheckIcon, CloseIcon } from './mentor-icons';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

const TIME_PRESETS = ['09:00', '11:00', '14:00', '16:00', '18:00', '20:00'];

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_payment: 'Pending payment',
  confirmed: 'Confirmed',
  completed: 'Completed',
  reviewed: 'Reviewed',
  cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending_payment: 'border-amber-200 bg-amber-50 text-amber-700',
  confirmed: 'border-sky-200 bg-sky-50 text-sky-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  reviewed: 'border-purple-200 bg-purple-50 text-purple-700',
  cancelled: 'border-slate-200 bg-slate-50 text-slate-500',
};

type Props = {
  profile: MentorProfile;
  bookings: MentorshipBooking[];
  initialSlots: MentorAvailabilitySlot[];
};

type Tab = 'sessions' | 'availability' | 'pricing' | 'earnings';

export function MentorDashboard({ profile, bookings, initialSlots }: Props) {
  const [tab, setTab] = useState<Tab>('sessions');

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {profile.status === 'pending' && (
        <Banner tone="amber">
          <strong>Profile under review.</strong> We&rsquo;ll email you within 48 hours. You can pre-fill your availability and pricing in the meantime.
        </Banner>
      )}
      {profile.status === 'rejected' && (
        <Banner tone="red">
          <strong>Application not approved.</strong> Reach out to support if you&rsquo;d like a re-review.
        </Banner>
      )}
      {profile.status === 'suspended' && (
        <Banner tone="red">
          <strong>Profile suspended.</strong> Bookings are paused. Contact support for next steps.
        </Banner>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-black/5 bg-white/95 p-2 shadow-[0_8px_24px_rgba(22,33,62,0.04)]">
        {(['sessions', 'availability', 'pricing', 'earnings'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition ${
              tab === t
                ? 'bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-white shadow-[0_6px_18px_rgba(255,77,140,0.22)]'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'sessions' && <SessionsTab bookings={bookings} />}
      {tab === 'availability' && (
        <AvailabilityTab profile={profile} initialSlots={initialSlots} />
      )}
      {tab === 'pricing' && <PricingTab profile={profile} />}
      {tab === 'earnings' && <EarningsTab bookings={bookings} />}
    </div>
  );
}

// ── Sessions tab ────────────────────────────────────────────────────────────

function SessionsTab({ bookings }: { bookings: MentorshipBooking[] }) {
  const upcoming = bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending_payment');
  const past = bookings.filter((b) => ['completed', 'reviewed', 'cancelled'].includes(b.status));

  return (
    <div className="space-y-6">
      <Section title={`Upcoming (${upcoming.length})`}>
        {upcoming.length === 0 ? (
          <Empty>No upcoming sessions yet. Once mentees book, they&rsquo;ll show up here.</Empty>
        ) : (
          <div className="space-y-3">
            {upcoming.map((b) => <BookingRow key={b.id} booking={b} />)}
          </div>
        )}
      </Section>

      <Section title={`Past (${past.length})`}>
        {past.length === 0 ? (
          <Empty>Past sessions will appear here.</Empty>
        ) : (
          <div className="space-y-3">
            {past.map((b) => <BookingRow key={b.id} booking={b} />)}
          </div>
        )}
      </Section>
    </div>
  );
}

function BookingRow({ booking }: { booking: MentorshipBooking }) {
  const start = new Date(booking.scheduled_at);
  const total = Number(booking.amount_total ?? 0);
  const currency = booking.currency ?? 'VND';

  return (
    <article className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_6px_18px_rgba(22,33,62,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
            · {start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {booking.duration_mins} min · #{booking.id}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[booking.status]}`}>
          {STATUS_LABELS[booking.status]}
        </span>
      </div>

      {booking.help_topic && (
        <div className="mt-3 rounded-xl bg-slate-50/70 p-3 text-sm text-slate-600">
          <p className="font-semibold text-slate-700">Topic: {booking.help_topic}</p>
          {booking.help_questions && (
            <p className="mt-1 whitespace-pre-line">{booking.help_questions}</p>
          )}
          {booking.help_outcome && (
            <p className="mt-1 italic text-slate-500">Goal: {booking.help_outcome}</p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm">
        <div>
          <p className="text-slate-500">Mentee paid</p>
          <p className="font-semibold text-slate-900">{total ? formatMoney(total, currency as Currency) : '—'}</p>
        </div>
        {booking.meeting_link && booking.status === 'confirmed' && (
          <a
            href={booking.meeting_link}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-4 py-2 text-xs font-semibold text-white shadow-[0_6px_18px_rgba(255,77,140,0.22)]"
          >
            Join meeting →
          </a>
        )}
      </div>
    </article>
  );
}

// ── Availability tab ────────────────────────────────────────────────────────

function AvailabilityTab({
  profile,
  initialSlots,
}: {
  profile: MentorProfile;
  initialSlots: MentorAvailabilitySlot[];
}) {
  const [slots, setSlots] = useState<MentorAvailabilitySlot[]>(initialSlots);
  const [viewMonth, setViewMonth] = useState<Date>(new Date());
  // Multi-select: mark several days, then add the same time(s) to all of them
  // in one go (Calendly-style) instead of editing one day at a time.
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [customTime, setCustomTime] = useState('10:00');
  const [busy, setBusy] = useState(false);
  useLoadingIndicator(busy, 'Updating your availability');
  const [error, setError] = useState<string | null>(null);
  void profile;

  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const monthEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
  const cells: (Date | null)[] = [];
  const lead = (monthStart.getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= monthEnd.getDate(); d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  // Local YYYY-MM-DD key (not UTC) so the calendar matches the mentor's
  // timezone — important for Vietnam (UTC+7).
  function dateKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function isoFor(date: string, time: string) {
    return new Date(`${date}T${time}:00`).toISOString();
  }

  function slotAt(date: string, time: string): MentorAvailabilitySlot | undefined {
    const t = new Date(isoFor(date, time)).getTime();
    return slots.find((s) => new Date(s.starts_at).getTime() === t);
  }

  function countOnDate(key: string): number {
    return slots.filter((s) => dateKey(new Date(s.starts_at)) === key).length;
  }

  function dayHasBooked(key: string): boolean {
    return slots.some(
      (s) => dateKey(new Date(s.starts_at)) === key && (s.status === 'booked' || s.status === 'held'),
    );
  }

  function toggleDay(key: string) {
    setSelectedDates((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function allSelectedHave(time: string) {
    return selectedDates.length > 0 && selectedDates.every((date) => !!slotAt(date, time));
  }

  // Add one time to every selected day that doesn't already have it — a single
  // batched POST to /api/mentorship/slots.
  async function addTimeToSelected(time: string) {
    if (selectedDates.length === 0) return;
    const wanted = selectedDates
      .filter((date) => !slotAt(date, time))
      .map((date) => isoFor(date, time));
    if (wanted.length === 0) return;

    setError(null);
    setBusy(true);
    const res = await fetch('/api/mentorship/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots: wanted.map((iso) => ({ starts_at: iso, duration_mins: 60 })) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not add slots');
      setBusy(false);
      return;
    }
    const { slots: created } = (await res.json()) as { slots: MentorAvailabilitySlot[] };
    setSlots((prev) => [...prev, ...created]);
    setBusy(false);
  }

  async function removeSlot(slotId: number) {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/mentorship/slots?id=${slotId}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not remove slot');
      setBusy(false);
      return;
    }
    setSlots((prev) => prev.filter((s) => s.id !== slotId));
    setBusy(false);
  }

  const todayKey = dateKey(new Date());

  // All slots grouped by day for the summary list.
  const grouped = useMemo(() => {
    const map = new Map<string, MentorAvailabilitySlot[]>();
    for (const s of slots) {
      const key = dateKey(new Date(s.starts_at));
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, arr]) => ({
        key,
        items: arr.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
      }));
  }, [slots]);

  return (
    <Section title="Your monthly availability" description="Tap one or more future days, then add the times you're free to all of them at once. Slots tied to confirmed bookings are locked.">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Month nav */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-3">
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Previous month"
        >
          ←
        </button>
        <p className="text-sm font-semibold text-slate-900">
          {viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </p>
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1.5 px-1 text-center text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c, i) => {
          if (!c) return <div key={`e-${i}`} className="h-12" />;
          const key = dateKey(c);
          const isPast = key < todayKey;
          const count = countOnDate(key);
          const selected = selectedDates.includes(key);
          const hasBooked = dayHasBooked(key);
          return (
            <button
              key={key}
              type="button"
              disabled={isPast}
              onClick={() => toggleDay(key)}
              aria-pressed={selected}
              className={`relative flex h-12 flex-col items-center justify-center rounded-xl border text-xs font-semibold transition ${
                isPast
                  ? 'border-transparent text-slate-300'
                  : selected
                  ? 'border-pink-300 bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-white'
                  : count > 0
                  ? hasBooked
                    ? 'border-purple-200 bg-purple-50 text-purple-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-pink-200'
              }`}
            >
              <span>{c.getDate()}</span>
              {count > 0 && (
                <span className="text-[0.55rem] font-normal opacity-80">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Add times to the selected day(s) */}
      <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
        {selectedDates.length === 0 ? (
          <p className="text-xs text-slate-500">Select one or more days above to add times.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                Add times to {selectedDates.length} selected day{selectedDates.length === 1 ? '' : 's'}
              </p>
              <button
                type="button"
                onClick={() => setSelectedDates([])}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                Clear selection
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TIME_PRESETS.map((t) => {
                const active = allSelectedHave(t);
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={busy}
                    onClick={() => addTimeToSelected(t)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                      active
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-pink-200'
                    }`}
                  >
                    {active ? '✓ ' : '+ '}{t}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="field max-w-[140px]"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => addTimeToSelected(customTime)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-pink-200 disabled:opacity-50"
              >
                Add custom time
              </button>
            </div>
          </>
        )}
      </div>

      {/* Summary of all open/booked slots, grouped by day */}
      {grouped.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Your availability</p>
          <div className="mt-3 space-y-2.5">
            {grouped.map(({ key, items }) => (
              <div key={key} className="rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-sm font-semibold text-slate-800">
                  {new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: 'short', day: 'numeric', month: 'short',
                  })}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {items.map((s) => {
                    const start = new Date(s.starts_at);
                    const locked = s.status === 'booked' || s.status === 'held';
                    const time = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                    return locked ? (
                      <span
                        key={s.id}
                        className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700"
                        title="Booked — can't be removed"
                      >
                        {time} · Booked
                      </span>
                    ) : (
                      <button
                        key={s.id}
                        type="button"
                        disabled={busy}
                        onClick={() => removeSlot(s.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        title="Remove this time"
                      >
                        {time}
                        <CloseIcon size={11} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

// ── Pricing tab ────────────────────────────────────────────────────────────

function PricingTab({ profile }: { profile: MentorProfile }) {
  const [currency, setCurrency] = useState<Currency>(profile.hourly_rate_currency);
  const [major, setMajor] = useState<string>(
    String(toMajorUnits(Number(profile.hourly_rate_amount ?? 0), profile.hourly_rate_currency)),
  );
  const [busy, setBusy] = useState(false);
  useLoadingIndicator(busy, 'Saving your rate');
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const amount = toSmallestUnits(Number(major), currency);
    const res = await fetch('/api/mentorship/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hourly_rate_amount: amount,
        hourly_rate_currency: currency,
      }),
    });
    if (res.ok) {
      setMsg('Pricing updated.');
    } else {
      const body = await res.json().catch(() => ({}));
      setMsg(body.error ?? 'Could not update pricing.');
    }
    setBusy(false);
  }

  return (
    <Section title="Hourly rate" description="Mentees see this rate plus a 10% Glowbal service fee. You receive your full rate after the session is completed.">
      <div className="rounded-2xl border border-slate-100 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {(['USD', 'GBP', 'VND'] as Currency[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
                currency === c
                  ? 'border-pink-300 bg-pink-50 text-pink-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-pink-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-2xl font-semibold text-slate-900">{currencySymbol(currency)}</span>
          <input
            type="number"
            value={major}
            onChange={(e) => setMajor(e.target.value)}
            min={0}
            step={currency === 'VND' ? 1000 : 1}
            className="field max-w-[200px] text-2xl font-semibold"
          />
          <span className="text-sm text-slate-500">/ hour</span>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Mentees pay {formatMoney(Math.round(toSmallestUnits(Number(major || 0), currency) * 1.1), currency)} including the service fee.
        </p>

        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(255,77,140,0.22)] disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save pricing'}
        </button>
        {msg && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700">
            <CheckIcon size={12} /> {msg}
          </p>
        )}
      </div>
    </Section>
  );
}

// ── Earnings tab ───────────────────────────────────────────────────────────

function EarningsTab({ bookings }: { bookings: MentorshipBooking[] }) {
  const completed = bookings.filter((b) => b.status === 'completed' || b.status === 'reviewed');
  const confirmed = bookings.filter((b) => b.status === 'confirmed');

  // Sum per currency since we now support multi-currency.
  const earningsByCurrency = new Map<Currency, number>();
  for (const b of completed) {
    const cur = (b.currency ?? 'VND') as Currency;
    earningsByCurrency.set(cur, (earningsByCurrency.get(cur) ?? 0) + Number(b.amount_mentor ?? 0));
  }
  const pendingByCurrency = new Map<Currency, number>();
  for (const b of confirmed) {
    const cur = (b.currency ?? 'VND') as Currency;
    pendingByCurrency.set(cur, (pendingByCurrency.get(cur) ?? 0) + Number(b.amount_mentor ?? 0));
  }

  return (
    <Section title="Earnings">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Completed sessions" value={completed.length.toString()} />
        <Stat
          label="Total earned"
          value={
            earningsByCurrency.size > 0
              ? Array.from(earningsByCurrency.entries())
                  .map(([cur, amt]) => formatMoney(amt, cur))
                  .join(' + ')
              : '—'
          }
          tone="emerald"
        />
        <Stat
          label="Pending payout"
          value={
            pendingByCurrency.size > 0
              ? Array.from(pendingByCurrency.entries())
                  .map(([cur, amt]) => formatMoney(amt, cur))
                  .join(' + ')
              : '—'
          }
          tone="amber"
        />
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Payouts are processed manually via Stripe Connect (in setup). Reach out to support if you need a payout reference now.
      </p>
    </Section>
  );
}

// ── Shared shells ─────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-black/5 bg-white/95 p-5 shadow-[0_8px_24px_rgba(22,33,62,0.04)]">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'emerald' | 'amber' }) {
  const color = tone === 'emerald' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-600' : 'text-slate-900';
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Banner({ tone, children }: { tone: 'amber' | 'red'; children: React.ReactNode }) {
  const styles =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-red-200 bg-red-50 text-red-700';
  return <div className={`rounded-2xl border px-5 py-3 text-sm ${styles}`}>{children}</div>;
}
