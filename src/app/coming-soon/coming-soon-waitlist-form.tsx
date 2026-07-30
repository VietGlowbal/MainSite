'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Input, Textarea } from '@/shared/ui';
import type { WaitlistAction, WaitlistState } from '@/lib/types';

const initialState: WaitlistState = { status: 'idle', message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? 'Joining…' : 'Notify me at launch'}
    </Button>
  );
}

/**
 * The lead-capture half of /coming-soon. Same `waitlist_signups` table and
 * confirmation email as the real "/" waitlist (`joinWaitlist` in this route's
 * page.tsx mirrors src/app/page.tsx's action), just styled with the token
 * primitives instead of the legacy `.glow-*` classes the old landing page's
 * WaitlistForm still carries.
 */
export function ComingSoonWaitlistForm({ action }: { action: WaitlistAction }) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} method="post" className="flex flex-col gap-gb-lg">
      <div className="grid gap-gb-lg sm:grid-cols-2">
        <Input name="firstName" label="First name" placeholder="Jamie" maxLength={80} />
        <Input
          name="email"
          type="email"
          label="Email address"
          placeholder="you@example.com"
          required
          maxLength={190}
        />
      </div>
      <Textarea
        name="notes"
        label="What are you hoping to study, and where?"
        placeholder="e.g. CS in the US, Business in the UK, anywhere in Europe…"
        rows={3}
        maxLength={500}
      />
      <SubmitButton />

      {state.status !== 'idle' ? (
        <p
          role="status"
          className={
            state.status === 'ok'
              ? 'text-gb-sm text-fg-brand'
              : 'text-gb-sm text-fg-error'
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
