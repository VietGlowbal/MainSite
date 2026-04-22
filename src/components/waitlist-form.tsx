'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

type WaitlistState = {
  status: 'idle' | 'ok' | 'error';
  message: string;
};

const initialWaitlistState: WaitlistState = {
  status: 'idle',
  message: '',
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#FF4D8C,#FF85B3)] px-6 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(255,77,140,0.28)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
      disabled={pending}
    >
      {pending ? 'Joining…' : 'Join the waitlist'}
    </button>
  );
}

export function WaitlistForm({
  action,
}: {
  action: (state: WaitlistState, formData: FormData) => Promise<WaitlistState>;
}) {
  const [state, formAction] = useActionState(action, initialWaitlistState);

  return (
    <>
      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <label className="glow-label">
          First name
          <input className="glow-input" type="text" name="firstName" placeholder="James" maxLength={80} />
        </label>

        <label className="glow-label">
          Email address
          <input
            className="glow-input"
            type="email"
            name="email"
            placeholder="you@example.com"
            required
            maxLength={190}
          />
        </label>

        <label className="glow-label">
          What are you hoping Glowbal helps with?
          <textarea
            className="glow-input glow-textarea"
            name="notes"
            placeholder="For example: choosing countries, comparing courses, figuring out fit..."
            rows={4}
            maxLength={500}
          />
        </label>

        <SubmitButton />
      </form>

      {state.status !== 'idle' ? (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            state.status === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}
        >
          {state.message}
        </div>
      ) : null}
    </>
  );
}
