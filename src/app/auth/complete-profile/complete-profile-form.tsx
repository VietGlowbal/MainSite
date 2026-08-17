'use client';

import { FormEvent, useMemo, useState } from 'react';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { Button, Checkbox, Input } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { useT } from '@/lib/i18n';
import { validateContactDetails, type ContactDetailsErrors } from '@/features/auth/domain';

/**
 * The completion form behind the contact-details gate.
 *
 * Three fields, and no way out of them — there is no skip control here, which is
 * the whole point of the gate. What softens it instead: the name arrives
 * pre-filled from Google, it is asked once per account, and the copy says why
 * the data is wanted rather than just demanding it.
 *
 * Validation runs through the same `validateContactDetails` the API route uses.
 * The client copy exists to spare a round trip, not to be the check — the route
 * re-runs it on input it cannot trust.
 *
 * Every visible string goes through `t()`, including the validation messages.
 * That is not the usual belt-and-braces: /auth is a PII route, so DomTranslator
 * never machine-translates this page, and an unlisted string would sit here in
 * English in front of a Vietnamese student who cannot get past it. The domain
 * returns English text and the dictionary keys on it verbatim.
 */

export function CompleteProfileForm({
  initialName,
  initialPhone,
  initialDob,
  next,
}: {
  initialName: string;
  initialPhone: string;
  initialDob: string;
  next: string;
}) {
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [dob, setDob] = useState(initialDob);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<ContactDetailsErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const t = useT();
  useLoadingIndicator(loading, 'Saving your details');

  const todayDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const input = { full_name: fullName, phone, date_of_birth: dob };
    const found = validateContactDetails(input);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch('/api/account/contact-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, marketing_consent: consent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.errors) setErrors(data.errors as ContactDetailsErrors);
        throw new Error(data.error ?? 'Could not save your details.');
      }
      // Full navigation, not router.push: the proxy re-reads the profile on the
      // way through, and the destination is frequently a route it gates.
      window.location.assign(next);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-gb-3xl flex flex-col items-center gap-gb-lg text-center">
        <GlowbalLogo height={28} />
        <div className="flex flex-col gap-gb-xs">
          <h1 className="font-display text-gb-display-xs font-semibold text-fg">
            {t('One more step')}
          </h1>
          <p className="text-gb-md text-fg-tertiary">
            {t(
              "Signing in with Google doesn't pass these on to us. We need them to match you to scholarships with age limits and to reach you about application deadlines.",
            )}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-gb-xl">
        <Input
          name="fullName"
          label={t('Name')}
          placeholder={t('Enter your name')}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.full_name ? t(errors.full_name) : undefined}
          required
          autoComplete="name"
        />

        <Input
          name="phone"
          type="tel"
          label={t('Phone number')}
          placeholder="0912 345 678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone ? t(errors.phone) : undefined}
          required
          autoComplete="tel"
          hint={t('A Vietnamese number starting 0 is fine — or include your country code.')}
        />

        <Input
          name="dob"
          type="date"
          label={t('Date of birth')}
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          error={errors.date_of_birth ? t(errors.date_of_birth) : undefined}
          max={todayDate}
          required
          autoComplete="bday"
        />

        <Checkbox
          name="marketingConsent"
          label={t('Send me scholarship and deadline reminders')}
          description={t(
            'Optional. Your details are saved either way — this only covers non-essential messages.',
          )}
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />

        {formError ? (
          <p role="alert" className="rounded-gb-md bg-surface-error px-gb-lg py-gb-md text-gb-sm text-fg-error">
            {t(formError)}
          </p>
        ) : null}

        <Button type="submit" size="xl" disabled={loading} className="w-full">
          {loading ? t('Saving…') : t('Continue')}
        </Button>
      </form>
    </div>
  );
}
