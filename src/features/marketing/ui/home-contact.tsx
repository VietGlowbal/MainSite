'use client';

import Image from 'next/image';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { getLocaleText, localizePath, type Locale } from '@/lib/i18n/locale';
import { Button, ICONS, Input, KitIcon, Textarea, controlClasses } from '@/shared/ui';

/**
 * Home contact — Figma 104:7361 (1440x840), the section the footer's
 * "Contact" link anchors into.
 *
 * ⚠️ The wrapper carries id="contact". src/features/marketing/ui/nav-items.tsx
 * points the footer at /#contact on EVERY page, so removing or renaming this id
 * breaks that link site-wide, not just here.
 *
 * Left is a photo card with an overlay caption; right is the consultation form.
 * A Client Component because the form reports its own success and pending
 * state — the rest of Home stays server-rendered.
 *
 * The action is passed in rather than imported: features/*\/ui must not reach
 * for server code, so the route owns the server action and hands it down. That
 * is the same wiring the page already used for the waitlist form.
 */

export type ContactState = {
  status: 'idle' | 'ok' | 'error';
  message: string;
};

const INITIAL: ContactState = { status: 'idle', message: '' };

/**
 * Figma I104:7361 dial codes. Only the four countries the design's dropdown
 * lists; add more when the design does.
 */
const DIAL_CODES = [
  { value: 'US', label: 'US +1' },
  { value: 'VN', label: 'VN +84' },
  { value: 'GB', label: 'UK +44' },
  { value: 'AU', label: 'AU +61' },
];

function SubmitButton({ locale }: { locale: Locale }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="xl" disabled={pending} className="w-full">
      {getLocaleText(locale, pending ? 'Sending…' : 'Request guidance')}
    </Button>
  );
}

export function HomeContact({
  action,
  locale = 'en',
}: {
  action: (state: ContactState, formData: FormData) => Promise<ContactState>;
  locale?: Locale;
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  return (
    <section id="contact" className="scroll-mt-gb-9xl bg-surface py-gb-5xl">
      <div className="mx-auto grid w-full max-w-gb-desktop items-center gap-gb-7xl px-gb-xl md:px-gb-4xl lg:grid-cols-2">
        {/* Photo card. The caption sits in a translucent panel over the lower
            part of the image, per the design.

            576x533 is the design's frame (107:9975) and the source is 16:9, so
            `object-cover` on that ratio reproduces the crop the mockup applies
            by hand — it shows the middle ~59% of the photo, which is where the
            team is. Do not "fix" the aspect to 16:9 or the framing changes. */}
        <div className="relative aspect-[576/533] overflow-hidden rounded-gb-xl">
          {/* `sizes` is deliberately ~1.65x the box, because `sizes` describes
              the LAYOUT width and `object-cover` needs more pixels than that.
              The source is 16:9 (1.778) and the box is 1.081, so cover scales
              to match height and shows only 1.081/1.778 = 61% of the width:
              filling 576 CSS px takes 576 x 1.645 = 948 source px. Declaring
              592 made the browser pick the 640w candidate and upscale it 1.6x,
              which is why the photo read as blurry. */}
          <Image
            src="/home-contact-team.jpg"
            alt="The GlowBal team at Venture X Demo Day"
            width={576}
            height={533}
            sizes="(max-width: 1024px) 165vw, 948px"
            quality={90}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-gb-3xl bottom-gb-3xl rounded-gb-lg bg-black/45 p-gb-2xl backdrop-blur-sm">
              <p className="text-gb-lg font-semibold text-white">{getLocaleText(locale, 'The GlowBal team')}</p>
            <p className="mt-gb-xs text-gb-sm text-white/85">
              {getLocaleText(locale, 'Start with a dream university. Leave with a scholarship plan.')}
            </p>
          </div>
        </div>

        <div>
          <h2 className="font-display text-gb-display-xs font-medium md:text-gb-display-sm">
            {getLocaleText(locale, 'Not sure where to begin?')}
          </h2>
          <p className="mt-gb-lg text-gb-md text-fg-tertiary">
            {getLocaleText(locale, 'Tell us about your goals. The GlowBal team will contact you to help identify a suitable next step.')}
          </p>

          <form action={formAction} className="mt-gb-4xl flex flex-col gap-gb-3xl">
            <Input name="firstName" label={getLocaleText(locale, 'First name')} placeholder={getLocaleText(locale, 'First name')} required maxLength={80} />

            <Input
              name="email"
              type="email"
              label={getLocaleText(locale, 'Email address')}
              placeholder="you@company.com"
              required
              maxLength={190}
            />

            {/* The design shows ONE "Phone number" label over a dial-code
                select and a number field. Written by hand rather than as two
                <Input>s so there is exactly one label: giving the number field
                its own blank label to keep the boxes aligned would announce an
                unlabelled control to a screen reader. Two controls rather than
                one combined field so the number still gets a tel keypad. */}
            <div>
              <label htmlFor="phone" className="text-gb-sm font-medium text-fg-secondary">
                {getLocaleText(locale, 'Phone number')}
              </label>
              <div className="mt-gb-sm grid grid-cols-[auto_1fr] gap-gb-md">
                <div className="relative">
                  <select
                    name="dialCode"
                    defaultValue="VN"
                    aria-label={getLocaleText(locale, 'Country dialling code')}
                    className={controlClasses(false, 'appearance-none pr-gb-5xl')}
                  >
                    {DIAL_CODES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-gb-input-x flex items-center text-gb-neutral-400">
                    <KitIcon art={ICONS.chevronDown} frame={16} />
                  </span>
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+84 000 000 000"
                  maxLength={32}
                  className={controlClasses(false)}
                />
              </div>
            </div>

            <Textarea
              name="notes"
              label={getLocaleText(locale, 'What and where would you like to study?')}
              placeholder={getLocaleText(locale, 'Leave us a message...')}
              required
              rows={4}
              maxLength={500}
            />

            <label className="flex items-start gap-gb-md">
              <input
                type="checkbox"
                name="consent"
                required
                className="mt-gb-xxs size-gb-3xl shrink-0 cursor-pointer rounded-gb-xs border border-line-strong accent-brand"
              />
              <span className="text-gb-sm text-fg-tertiary">
                {getLocaleText(locale, 'You agree to our friendly')}{' '}
                <a href={localizePath('/privacy', locale)} className="font-semibold text-fg-brand underline">
                  {getLocaleText(locale, 'privacy policy')}
                </a>
                .
              </span>
            </label>

            <SubmitButton locale={locale} />
          </form>

          {state.status !== 'idle' ? (
            <p
              role="status"
              className={`mt-gb-xl rounded-gb-md px-gb-xl py-gb-lg text-gb-sm ${
                state.status === 'ok'
                  ? 'bg-brand-subtle text-fg-brand'
                  : 'bg-surface-error text-fg-error'
              }`}
            >
              {getLocaleText(locale, state.message)}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
