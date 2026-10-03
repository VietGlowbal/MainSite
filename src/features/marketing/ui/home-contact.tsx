'use client';

import Image from 'next/image';
import {
  useActionState,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { getLocaleText, localizePath, type Locale } from '@/lib/i18n/locale';
import { BRAND_ICONS, BrandIcon, Button, CONTROL_BASE, GlowbalIcon, ICONS, KitIcon } from '@/shared/ui';
import {
  CONSULTATION_BUDGET_LABELS,
  CONSULTATION_BUDGETS,
  CONSULTATION_DIAL_CODES,
  CONSULTATION_PACKAGE_OPTIONS,
  firstInvalidField,
  formatDateOfBirthInput,
  validateConsultation,
  type ConsultationErrorCode,
  type ConsultationField,
  type ConsultationFieldErrors,
} from '../domain/consultation';
import { DESTINATION_COUNTRIES } from '../domain/home-content';
import { useHomeConsultation } from './home-consultation';
import { PARTNER_LOGOS } from './partner-logos';

/**
 * Free consultation form — sales-journey handoff §9, the page's one conversion.
 *
 * ⚠️ The wrapper carries id="contact". nav-items.tsx points the footer at
 * /#contact on EVERY page, and every CTA on Home scrolls here, so removing or
 * renaming this id breaks both.
 *
 * ─── FIELDS AND STATES ──────────────────────────────────────────────────────
 *
 * Full name · date of birth (dd/mm/yyyy) · email · phone (dial code + number)
 * · destination (a combobox of countries and universities that still accepts
 * anything typed) · budget (optional) · package (three radio cards, optional)
 * · consent. States: empty, focused, inline errors, pre-filled from Pricing
 * (the card pulses), pre-filled from the account (name + email read-only),
 * submitting, server error, rate-limited, and success.
 *
 * Validation is `validateConsultation` (marketing/domain/consultation.ts) —
 * run here on submit for instant errors, and again in the server action, which
 * is the one that counts. Editing a field clears its error.
 *
 * ─── DELIBERATE DEPARTURES FROM THE HANDOFF ─────────────────────────────────
 *
 * 1. ERRORS ARE ROSE, NOT THE KIT'S RED. The shared FormField paints errors in
 *    the error ramp, which its own notes call not design-confirmed; this
 *    handoff confirms rose (rose-500 border, rose-100 ring, rose-700 message).
 *    Geometry and focus still come from the kit's CONTROL_BASE.
 * 2. RADIO CARDS AND THE CHECKBOX ARE NATIVE INPUTS, visually replaced. The
 *    prototype drew `role="radio"` buttons; native radios give arrow-key
 *    movement inside the group and form submission for free.
 * 3. THE COMBOBOX IS KEYBOARD-OPERABLE (↑/↓, Enter, Escape) — the prototype
 *    picked on mousedown only.
 * 4. NO ZALO BUTTON YET. The brief leaves whose Zalo number/OA open [CONFIRM];
 *    a guessed chat link is worse than none. Facebook and the hotline ship.
 * 5. SUCCESS WHILE SIGNED IN has no "Sign in again" action: that variant
 *    exists to unlock gated search, and page gating is deferred (owner,
 *    2026-09-27). It confirms the request and stops.
 */

export type ContactState =
  | { readonly status: 'idle' }
  | { readonly status: 'invalid'; readonly errors: ConsultationFieldErrors }
  | { readonly status: 'rate-limited' }
  | { readonly status: 'server-error' }
  | { readonly status: 'ok'; readonly email: string; readonly emailed: boolean };

/** The signed-in student, when there is one. Pre-fills and locks name + email. */
export type ConsultationAccount = {
  readonly fullName: string | null;
  readonly email: string;
};

const INITIAL: ContactState = { status: 'idle' };

const FACEBOOK_HREF = 'https://www.facebook.com/glowbal.education';
const HOTLINE_TEL = 'tel:0911552005';
const HOTLINE_LABEL = '091 155 20 05';

/** How many suggestions each group shows while the student types. */
const SUGGESTIONS_PER_GROUP = 5;

const ERROR_MESSAGES: Readonly<Record<ConsultationErrorCode, string>> = {
  required: 'This field is required.',
  email: 'Enter a valid email address, e.g. you@example.com',
  dob: 'Enter your date of birth as dd/mm/yyyy.',
  phone: 'Enter a valid phone number.',
  consent: 'Please agree to the privacy policy to continue.',
};

type Values = {
  name: string;
  dob: string;
  email: string;
  dialCode: string;
  phone: string;
  destination: string;
  budget: string;
  package: string;
  consent: boolean;
};

function initialValues(account: ConsultationAccount | null | undefined): Values {
  return {
    name: account?.fullName ?? '',
    dob: '',
    email: account?.email ?? '',
    dialCode: 'VN',
    phone: '',
    destination: '',
    budget: '',
    package: '',
    consent: false,
  };
}

/** Error state per the handoff: rose-500 border plus a 4px rose-100 halo. */
function controlState(invalid: boolean, extra = ''): string {
  const state = invalid
    ? 'border-gb-brand-500 shadow-[0_0_0_4px_var(--color-gb-brand-100)] focus:outline-gb-brand-500'
    : 'border-line-strong';
  // ⚠️ `extra` must not repeat a property CONTROL_BASE sets (bg, text colour):
  // two plain utilities on one property resolve by stylesheet order, not by
  // which comes later here. Use a variant (`read-only:`, `data-[…]:`) instead.
  return `${CONTROL_BASE} ${state} min-h-[44px] ${extra}`;
}

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error: string | undefined;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-gb-sm">
      <label htmlFor={id} className="text-gb-sm font-medium text-fg-secondary">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-brand">
            {' *'}
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-message`} role="alert" className="text-gb-sm text-fg-brand">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-message`} className="text-gb-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Spinner() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[18px] animate-spin motion-reduce:animate-none" fill="none">
      <circle cx="10" cy="10" r="8" strokeWidth="2.5" className="stroke-white/35" />
      <path d="M18 10a8 8 0 0 0-8-8" strokeWidth="2.5" strokeLinecap="round" className="stroke-white" />
    </svg>
  );
}

function SuccessPanel({
  email,
  emailed,
  signedIn,
  locale,
}: {
  email: string;
  emailed: boolean;
  signedIn: boolean;
  locale: Locale;
}) {
  const sentences = [
    // Only claim an email went out when the mailer says it did. A re-submission
    // (the address is already registered) or an unconfigured mailer sends
    // nothing, and the sentence has to stay true either way.
    emailed
      ? getLocaleText(locale, "We've emailed {email}.", { email })
      : getLocaleText(locale, "We've received your details for {email}.", { email }),
    getLocaleText(locale, 'A GlowBal mentor will contact you shortly.'),
    ...(signedIn
      ? []
      : [
          getLocaleText(
            locale,
            'Create your free account with this email to unlock free scholarship & university search.',
          ),
        ]),
  ];

  return (
    <div role="status" className="rounded-gb-2xl border border-line bg-surface p-gb-3xl shadow-gb-lg md:p-gb-5xl">
      <span className="flex size-[56px] items-center justify-center rounded-gb-full bg-brand-surface text-brand">
        <KitIcon art={ICONS.checkCircle} frame={28} />
      </span>
      <h2 className="mt-gb-3xl font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg md:text-gb-display-sm">
        {getLocaleText(locale, "You're registered!")}
      </h2>
      <p className="mt-gb-lg text-pretty text-gb-md text-fg-tertiary">{sentences.join(' ')}</p>
      {signedIn ? null : (
        <div className="mt-gb-4xl">
          <Button href="/auth?mode=signup" size="xl" prefetch={false}>
            {getLocaleText(locale, 'Sign up free')}
          </Button>
        </div>
      )}
    </div>
  );
}

export function HomeContact({
  action,
  locale = 'en',
  account = null,
}: {
  action: (state: ContactState, formData: FormData) => Promise<ContactState>;
  locale?: Locale;
  account?: ConsultationAccount | null | undefined;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [values, setValues] = useState<Values>(() => initialValues(account));
  const [errors, setErrors] = useState<ConsultationFieldErrors>({});
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [activeOption, setActiveOption] = useState(-1);
  const [flashNonce, setFlashNonce] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const uid = useId();
  const ids = {
    name: `${uid}-name`,
    dob: `${uid}-dob`,
    email: `${uid}-email`,
    phone: `${uid}-phone`,
    destination: `${uid}-destination`,
    budget: `${uid}-budget`,
    consent: `${uid}-consent`,
    listbox: `${uid}-destinations`,
    packages: `${uid}-packages`,
  };
  const { selection } = useHomeConsultation();

  /* ── State adjusted during render (React's pattern for derived state) ── */

  // The account resolves after hydration; fill the locked fields when it lands.
  const [seenAccountEmail, setSeenAccountEmail] = useState(account?.email ?? null);
  if ((account?.email ?? null) !== seenAccountEmail) {
    setSeenAccountEmail(account?.email ?? null);
    if (account) {
      setValues((current) => ({ ...current, name: account.fullName ?? current.name, email: account.email }));
    }
  }

  // A Pricing CTA picked a package: select it and pulse the card.
  const [seenSelection, setSeenSelection] = useState(selection?.nonce ?? 0);
  if (selection !== null && selection.nonce !== seenSelection) {
    setSeenSelection(selection.nonce);
    setValues((current) => ({ ...current, package: selection.pkg }));
    setFlashNonce(selection.nonce);
  }

  // A server response replaces the field errors it carries.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === 'invalid') setErrors(state.errors);
  }

  const locked = account !== null && account !== undefined;
  const lockedName = locked && Boolean(account.fullName);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    const field: ConsultationField | null =
      key === 'destination' || key === 'name' || key === 'dob' || key === 'email' || key === 'phone' || key === 'consent'
        ? key
        : null;
    if (field !== null && errors[field] !== undefined) {
      setErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  };

  const errorFor = (field: ConsultationField) => {
    const code = errors[field];
    return code === undefined ? undefined : getLocaleText(locale, ERROR_MESSAGES[code]);
  };
  const describedBy = (field: ConsultationField, id: string) =>
    errors[field] !== undefined || (locked && (field === 'email' || (field === 'name' && lockedName)))
      ? { 'aria-describedby': `${id}-message` }
      : {};

  /* ── Destination combobox ─────────────────────────────────────────── */

  const query = values.destination.trim().toLowerCase();
  const matches = (text: string) => query.length < 2 || text.toLowerCase().includes(query);
  const countries = DESTINATION_COUNTRIES.filter(matches).slice(0, SUGGESTIONS_PER_GROUP);
  const universities = PARTNER_LOGOS.map((logo) => logo.name)
    .filter(matches)
    .slice(0, SUGGESTIONS_PER_GROUP);
  const options = [...countries, ...universities];
  const listOpen = destinationOpen && options.length > 0;

  const pickDestination = (value: string) => {
    set('destination', value);
    setDestinationOpen(false);
    setActiveOption(-1);
  };

  const onDestinationKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setDestinationOpen(true);
      if (options.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveOption((current) => (current + step + options.length) % options.length);
    } else if (event.key === 'Enter' && listOpen && activeOption >= 0) {
      event.preventDefault();
      const option = options[activeOption];
      if (option !== undefined) pickDestination(option);
    } else if (event.key === 'Escape') {
      setDestinationOpen(false);
      setActiveOption(-1);
    }
  };

  /* ── Submit ───────────────────────────────────────────────────────── */

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const result = validateConsultation(values);
    if (result.ok) {
      setErrors({});
      return;
    }
    // Stop here: React skips a form action whose submit event was prevented.
    event.preventDefault();
    setErrors(result.errors);
    const first = firstInvalidField(result.errors);
    if (first !== null) {
      formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
    }
  };

  const pickedOption = CONSULTATION_PACKAGE_OPTIONS.find((option) => option.id === values.package);

  return (
    /* The page's last band, and white — the end of the black → rose → white
       ramp (tokens.css, `--gb-home-band-*`). It was near-black until
       2026-09-29, which put a hard dark block after the light pricing band.
       Being a light surface also fixed the form's two contact icons: inside
       `data-surface="dark"` their ink stroke resolved to white on this white
       card, so only the rose accent stroke showed. */
    <section
      id="contact"
      className="relative isolate scroll-mt-gb-9xl overflow-hidden bg-surface py-gb-7xl text-fg md:py-gb-9xl"
    >
      <div className="relative mx-auto grid w-full max-w-gb-desktop items-start gap-gb-6xl px-gb-xl md:px-gb-4xl lg:grid-cols-[0.8fr_1.2fr] lg:gap-gb-8xl">
        <div aria-hidden="true" className="pointer-events-none absolute -left-[8%] top-[12%] -z-10 size-[420px] rounded-full bg-brand/10 blur-[140px]" />
        {/* The team photo on the left — owner, 2026-10-01: back as it was before
            the v2 rebuild (the Venture X Demo Day photo with a frosted caption),
            replacing a text column that repeated the form's own heading.
            Sticky on desktop, so it stays beside the form as you fill it in. */}
        <figure className="relative lg:sticky lg:top-gb-9xl">
          {/* The team at the GlowBal booth with the poster (owner, 2026-10-01;
              was the 16:9 stage shot, which is now the Venture X number card).
              The file is pre-cropped to this box's 576:533, so `object-cover`
              uses its full width and `sizes` can be the box's own width
              (1440px source covers a ~600px box at 2x). */}
          <div className="relative aspect-[576/533] overflow-hidden rounded-gb-xl shadow-gb-lg">
            <Image
              src="/home/contact-team-booth.webp"
              alt={getLocaleText(locale, 'The GlowBal team at Venture X Demo Day')}
              fill
              sizes="(min-width: 1024px) 600px, 100vw"
              quality={90}
              className="object-cover"
            />
            <figcaption className="absolute inset-x-gb-xl bottom-gb-xl rounded-gb-lg bg-black/45 p-gb-xl backdrop-blur-sm md:inset-x-gb-3xl md:bottom-gb-3xl md:p-gb-2xl">
              <span className="block text-gb-lg font-semibold text-white">{getLocaleText(locale, 'The GlowBal team')}</span>
              <span className="mt-gb-xs block text-gb-sm text-white/85">
                {getLocaleText(locale, 'Start with a dream university. Leave with a scholarship plan.')}
              </span>
            </figcaption>
          </div>
        </figure>

        <div className="relative min-w-0 rounded-gb-2xl border border-line bg-surface p-gb-3xl text-fg shadow-gb-xl md:p-gb-5xl">
          {state.status === 'ok' ? (
            <SuccessPanel email={state.email} emailed={state.emailed} signedIn={locked} locale={locale} />
          ) : (
            <>
              <GlowbalIcon name="contact" size={40} className="block" />
              <h2 className="mt-gb-xl text-balance font-display text-gb-display-xs font-medium tracking-gb-display-tight text-fg md:text-gb-display-sm">
                {getLocaleText(locale, 'Register for Free Scholarship Consultation with GlowBal Mentors')}
              </h2>
              <p className="mt-gb-lg text-gb-md text-fg-muted">
                {getLocaleText(
                  locale,
                  'Tell us about your goals. The GlowBal team will contact you to help identify a suitable next step.',
                )}
              </p>

              <form
                ref={formRef}
                action={formAction}
                onSubmit={onSubmit}
                noValidate
                className="mt-gb-4xl flex flex-col gap-gb-2xl"
              >
                <div className="grid gap-x-gb-xl gap-y-gb-2xl md:grid-cols-2">
                  <Field
                    id={ids.name}
                    label={getLocaleText(locale, 'Full name')}
                    required
                    error={errorFor('name')}
                    hint={lockedName ? getLocaleText(locale, 'From your account') : undefined}
                  >
                    <input
                      id={ids.name}
                      data-field="name"
                      name="name"
                      autoComplete="name"
                      maxLength={120}
                      value={values.name}
                      readOnly={lockedName}
                      onChange={(event) => set('name', event.target.value)}
                      placeholder={getLocaleText(locale, 'Your full name')}
                      aria-invalid={errors.name !== undefined}
                      aria-required="true"
                      {...describedBy('name', ids.name)}
                      className={controlState(errors.name !== undefined, 'read-only:bg-surface-muted')}
                    />
                  </Field>

                  <Field id={ids.dob} label={getLocaleText(locale, 'Date of birth')} required error={errorFor('dob')}>
                    <input
                      id={ids.dob}
                      data-field="dob"
                      name="dob"
                      inputMode="numeric"
                      autoComplete="bday"
                      maxLength={10}
                      value={values.dob}
                      onChange={(event) => set('dob', formatDateOfBirthInput(event.target.value))}
                      placeholder="dd/mm/yyyy"
                      aria-invalid={errors.dob !== undefined}
                      aria-required="true"
                      {...describedBy('dob', ids.dob)}
                      className={controlState(errors.dob !== undefined)}
                    />
                  </Field>
                </div>

                <Field
                  id={ids.email}
                  label={getLocaleText(locale, 'Email address')}
                  required
                  error={errorFor('email')}
                  hint={locked ? getLocaleText(locale, 'From your account') : undefined}
                >
                  <input
                    id={ids.email}
                    data-field="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={190}
                    value={values.email}
                    readOnly={locked}
                    onChange={(event) => set('email', event.target.value)}
                    placeholder="you@example.com"
                    aria-invalid={errors.email !== undefined}
                    aria-required="true"
                    {...describedBy('email', ids.email)}
                    className={controlState(errors.email !== undefined, 'read-only:bg-surface-muted')}
                  />
                </Field>

                {/* One label over two controls, written by hand so there is
                    exactly one: the dial code carries its own aria-label. */}
                <Field id={ids.phone} label={getLocaleText(locale, 'Phone number')} required error={errorFor('phone')}>
                  <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-gb-md">
                    <div className="relative">
                      <select
                        name="dialCode"
                        value={values.dialCode}
                        onChange={(event) => set('dialCode', event.target.value)}
                        aria-label={getLocaleText(locale, 'Country dialling code')}
                        className={controlState(false, 'appearance-none pr-gb-4xl')}
                      >
                        {CONSULTATION_DIAL_CODES.map((code) => (
                          <option key={code.value} value={code.value}>
                            {code.label}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-gb-input-x flex items-center text-gb-neutral-400">
                        <KitIcon art={ICONS.chevronDown} frame={16} />
                      </span>
                    </div>
                    <input
                      id={ids.phone}
                      data-field="phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel-national"
                      maxLength={32}
                      value={values.phone}
                      onChange={(event) => set('phone', event.target.value)}
                      placeholder="912 345 678"
                      aria-invalid={errors.phone !== undefined}
                      aria-required="true"
                      {...describedBy('phone', ids.phone)}
                      className={controlState(errors.phone !== undefined)}
                    />
                  </div>
                </Field>

                <Field
                  id={ids.destination}
                  label={getLocaleText(locale, 'Where would you like to study?')}
                  required
                  error={errorFor('destination')}
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute left-gb-input-x top-1/2 -translate-y-1/2 text-fg-muted">
                      <KitIcon art={ICONS.search} frame={18} />
                    </span>
                    <input
                      id={ids.destination}
                      data-field="destination"
                      name="destination"
                      role="combobox"
                      aria-expanded={listOpen}
                      aria-controls={ids.listbox}
                      aria-autocomplete="list"
                      {...(listOpen && activeOption >= 0
                        ? { 'aria-activedescendant': `${ids.listbox}-${activeOption}` }
                        : {})}
                      autoComplete="off"
                      maxLength={160}
                      value={values.destination}
                      onChange={(event) => {
                        set('destination', event.target.value);
                        setDestinationOpen(true);
                        setActiveOption(-1);
                      }}
                      onFocus={() => setDestinationOpen(true)}
                      // Delayed so a click on an option lands before the list closes.
                      onBlur={() => setTimeout(() => setDestinationOpen(false), 150)}
                      onKeyDown={onDestinationKeyDown}
                      placeholder={getLocaleText(locale, 'A country or a university')}
                      aria-invalid={errors.destination !== undefined}
                      aria-required="true"
                      {...describedBy('destination', ids.destination)}
                      className={controlState(errors.destination !== undefined, 'pl-[42px]')}
                    />
                    {listOpen ? (
                      <div
                        id={ids.listbox}
                        role="listbox"
                        aria-label={getLocaleText(locale, 'Where would you like to study?')}
                        className="absolute inset-x-0 top-full z-20 mt-gb-sm max-h-[320px] overflow-y-auto rounded-gb-md border border-line bg-surface p-gb-sm shadow-gb-lg"
                      >
                        {[
                          { heading: 'Countries', items: countries, offset: 0 },
                          { heading: 'Universities', items: universities, offset: countries.length },
                        ].map((group) =>
                          group.items.length === 0 ? null : (
                            <div key={group.heading} role="group" aria-label={getLocaleText(locale, group.heading)}>
                              <p
                                aria-hidden="true"
                                className={`px-gb-md pb-gb-xs pt-gb-md text-[11px] font-semibold uppercase leading-[16px] tracking-[0.06em] text-fg-muted ${
                                  group.offset > 0 ? 'border-t border-line' : ''
                                }`}
                              >
                                {getLocaleText(locale, group.heading)}
                              </p>
                              {group.items.map((item, index) => {
                                const optionIndex = group.offset + index;
                                const active = optionIndex === activeOption;
                                return (
                                  <div
                                    key={item}
                                    id={`${ids.listbox}-${optionIndex}`}
                                    role="option"
                                    aria-selected={active}
                                    data-no-auto-translate
                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                      pickDestination(item);
                                    }}
                                    className={`cursor-pointer rounded-gb-sm px-gb-md py-gb-input-y text-gb-sm text-fg hover:bg-brand-subtle ${
                                      active ? 'bg-brand-subtle' : ''
                                    }`}
                                  >
                                    {item}
                                  </div>
                                );
                              })}
                            </div>
                          ),
                        )}
                      </div>
                    ) : null}
                  </div>
                </Field>

                <Field id={ids.budget} label={getLocaleText(locale, 'Study-abroad budget')} error={undefined}>
                  <div className="relative">
                    <select
                      id={ids.budget}
                      name="budget"
                      value={values.budget}
                      onChange={(event) => set('budget', event.target.value)}
                      // Grey until chosen, like a placeholder. A variant, not a
                      // plain class: CONTROL_BASE already sets `text-fg`.
                      data-empty={values.budget === '' ? 'true' : undefined}
                      className={controlState(false, 'appearance-none pr-gb-5xl data-[empty=true]:text-gb-neutral-400')}
                    >
                      <option value="">{getLocaleText(locale, 'Choose…')}</option>
                      {CONSULTATION_BUDGETS.map((budget) => (
                        <option key={budget} value={budget} className="text-fg">
                          {getLocaleText(locale, CONSULTATION_BUDGET_LABELS[budget])}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-gb-input-x flex items-center text-gb-neutral-400">
                      <KitIcon art={ICONS.chevronDown} frame={16} />
                    </span>
                  </div>
                </Field>

                <fieldset className="min-w-0">
                  <legend id={ids.packages} className="text-gb-sm font-medium text-fg-secondary">
                    {getLocaleText(locale, 'Choose your GlowBal package')}
                  </legend>
                  <div role="radiogroup" aria-labelledby={ids.packages} className="mt-gb-sm grid gap-gb-md md:grid-cols-3">
                    {CONSULTATION_PACKAGE_OPTIONS.map((option) => {
                      const selected = values.package === option.id;
                      return (
                        <label
                          key={option.id}
                          /* The fill lives only in the two branches: with a base
                             `bg-surface` beside `bg-brand-subtle`, whichever
                             Tailwind emits later wins, not the later class. */
                          className={`relative flex min-h-[56px] cursor-pointer items-start gap-gb-md rounded-gb-lg px-gb-lg py-gb-input-y transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                            selected
                              ? 'border-2 border-brand bg-brand-subtle'
                              : 'border border-line-strong bg-surface hover:bg-surface-hover'
                          }`}
                        >
                          <input
                            type="radio"
                            name="package"
                            value={option.id}
                            checked={selected}
                            onChange={() => set('package', option.id)}
                            className="sr-only"
                          />
                          <span
                            aria-hidden="true"
                            className={`mt-gb-xxs flex size-gb-xl shrink-0 items-center justify-center rounded-gb-full border bg-surface ${
                              selected ? 'border-brand' : 'border-line-strong'
                            }`}
                          >
                            {selected ? <span className="size-gb-md rounded-gb-full bg-brand" /> : null}
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span data-no-auto-translate className="text-gb-sm font-semibold text-fg">
                              {option.name}
                            </span>
                            <span className="text-gb-xs text-fg-tertiary">
                              {option.price === null
                                ? getLocaleText(locale, 'Free')
                                : `${option.price}${getLocaleText(locale, '/year')}`}
                            </span>
                          </span>
                          {selected && flashNonce > 0 ? (
                            <span
                              key={flashNonce}
                              aria-hidden="true"
                              className="pointer-events-none absolute -inset-px animate-gb-pkg-flash rounded-gb-lg motion-reduce:animate-none"
                            />
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                  {pickedOption ? (
                    <p className="mt-gb-md text-gb-xs font-medium text-fg-brand">
                      {getLocaleText(locale, 'You picked {package} — change anytime', { package: pickedOption.name })}
                    </p>
                  ) : null}
                </fieldset>

                <div>
                  <label className="flex items-start gap-gb-md">
                    <span className="relative mt-px flex size-[20px] shrink-0">
                      <input
                        id={ids.consent}
                        data-field="consent"
                        type="checkbox"
                        name="consent"
                        checked={values.consent}
                        onChange={(event) => set('consent', event.target.checked)}
                        aria-invalid={errors.consent !== undefined}
                        aria-required="true"
                        {...describedBy('consent', ids.consent)}
                        className={`peer size-[20px] cursor-pointer appearance-none rounded-gb-sm border bg-surface checked:border-brand checked:bg-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                          errors.consent !== undefined ? 'border-gb-brand-500' : 'border-line-strong'
                        }`}
                      />
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 12 10"
                        fill="none"
                        className="pointer-events-none absolute inset-[5px_4px] hidden stroke-white peer-checked:block"
                      >
                        <path d="M1 5l3.5 3.5L11 1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="text-gb-sm text-fg-tertiary">
                      {getLocaleText(locale, 'You agree to our friendly')}{' '}
                      <a href={localizePath('/privacy', locale)} className="font-semibold text-fg-brand underline">
                        {getLocaleText(locale, 'privacy policy')}
                      </a>
                      .
                    </span>
                  </label>
                  {errors.consent !== undefined ? (
                    <p id={`${ids.consent}-message`} role="alert" className="ml-[30px] mt-gb-sm text-gb-sm text-fg-brand">
                      {errorFor('consent')}
                    </p>
                  ) : null}
                </div>

                {state.status === 'server-error' || state.status === 'rate-limited' ? (
                  <div
                    role="alert"
                    className="rounded-gb-md border border-gb-brand-300 bg-brand-subtle px-gb-xl py-gb-lg text-gb-sm font-medium text-fg-brand"
                  >
                    {getLocaleText(
                      locale,
                      state.status === 'rate-limited'
                        ? 'Too many requests, try again in a minute.'
                        : 'Something went wrong saving your details. Please try again.',
                    )}
                  </div>
                ) : null}

                <Button type="submit" size="xl" disabled={pending} className="min-h-[48px] w-full">
                  {pending ? (
                    <>
                      <Spinner />
                      {getLocaleText(locale, 'Sending…')}
                    </>
                  ) : (
                    getLocaleText(locale, 'Request Consultation')
                  )}
                </Button>
              </form>
            </>
          )}

          <div className="mt-gb-4xl border-t border-line pt-gb-3xl">
            <p className="text-gb-sm font-medium text-fg-tertiary">{getLocaleText(locale, 'Prefer to talk now?')}</p>
            <div className="mt-gb-lg flex flex-wrap items-center gap-gb-lg">
              <a
                href={FACEBOOK_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-gb-md whitespace-nowrap rounded-gb-md border border-line px-gb-input-x text-gb-sm font-semibold text-fg transition-colors hover:bg-surface-hover"
              >
                <BrandIcon art={BRAND_ICONS.facebook} frame={18} />
                GlowBal Education
              </a>
              <a
                href={HOTLINE_TEL}
                className="inline-flex min-h-[44px] items-center gap-gb-md whitespace-nowrap rounded-gb-md border border-line px-gb-input-x text-gb-sm font-semibold text-fg transition-colors hover:bg-surface-hover"
              >
                <GlowbalIcon name="contact" size={20} />
                {HOTLINE_LABEL}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
