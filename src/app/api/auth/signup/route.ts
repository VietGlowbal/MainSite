import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/send-email';
import { signupConfirmationEmail } from '@/lib/emails/signup-confirmation';
import { NAME_MAX, normalizePhone, validateContactDetails } from '@/features/auth/domain';
import { resolveAuthOrigin } from '@/lib/auth-origin';

/**
 * POST /api/auth/signup
 *
 * Email/password sign-up that delivers the confirmation email via Resend
 * instead of Supabase's built-in SMTP, which is rate-limited on the free tier.
 */

/**
 * Name, phone and date of birth are REQUIRED, not optional.
 *
 * They were `.optional()` with an `?? ''` default until 2026-08-17, which meant
 * the form's `required` attributes were the only thing enforcing them — and an
 * HTML attribute is not enforcement, it is a suggestion to a cooperating
 * browser. A direct POST created an account with three blank fields, and the
 * blanks (not nulls) then read as "present" to every NOT NULL check downstream.
 *
 * The shape check is Zod's; the content rules live in the auth domain so this
 * route and /api/account/contact-details cannot drift apart on what a valid
 * phone number is.
 */
const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(200),
  full_name: z.string().min(1).max(NAME_MAX),
  phone: z.string().min(1).max(32),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  next: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please enter a valid email and password.' }, { status: 400 });
  }
  const input = parsed.data;

  const fieldErrors = validateContactDetails({
    full_name: input.full_name,
    phone: input.phone,
    date_of_birth: input.date_of_birth,
  });
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: 'Please check the fields below.', errors: fieldErrors },
      { status: 400 },
    );
  }
  // Non-null: validateContactDetails rejects anything normalizePhone refuses.
  const phone = normalizePhone(input.phone) as string;

  const normalizedEmail = input.email.trim().toLowerCase();

  const safeNext = input.next && input.next.startsWith('/') ? input.next : null;
  const callbackUrl = new URL('/auth/callback', resolveAuthOrigin(new URL(request.url).origin));
  if (safeNext) callbackUrl.searchParams.set('next', safeNext);

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email: normalizedEmail,
    password: input.password,
    options: {
      data: {
        full_name: input.full_name.trim(),
        phone,
        date_of_birth: input.date_of_birth,
        marketing_consent: true,
        // The generic /auth/callback route is also used by non-signup auth
        // flows. This marker keeps the welcome email specific to accounts
        // created through this signup path rather than emailing every login.
        glowbal_welcome_pending: true,
      },
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error) {
    const alreadyExists = error.status === 422 || /already|registered|exists/i.test(error.message);
    if (alreadyExists) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Try signing in instead.' },
        { status: 409 },
      );
    }
    console.error('[auth/signup] generateLink failed', error);
    return NextResponse.json(
      { error: 'Could not create your account. Please try again.' },
      { status: 500 },
    );
  }

  const confirmUrl = data.properties?.action_link;
  if (!confirmUrl) {
    console.error('[auth/signup] no action_link returned');
    return NextResponse.json(
      { error: 'Could not create your account. Please try again.' },
      { status: 500 },
    );
  }

  const firstName = (input.full_name ?? '').trim().split(/\s+/)[0] || undefined;
  const emailResult = await sendEmail({
    to: normalizedEmail,
    subject: 'Confirm your GlowBal account',
    html: signupConfirmationEmail(confirmUrl, firstName),
    text: 'Confirm your GlowBal account using the secure button in the HTML version of this email. If you did not create a GlowBal account, you can ignore this message.',
    category: 'security',
    template: 'signup-confirmation',
    userId: data.user?.id,
    idempotencyKey: `signup-confirmation:${data.user?.id ?? normalizedEmail}`,
    tags: { kind: 'signup-confirmation' },
  });

  if (!emailResult.ok) {
    console.error('[auth/signup] confirmation email failed', emailResult.error);
  }

  return NextResponse.json({ ok: true });
}
