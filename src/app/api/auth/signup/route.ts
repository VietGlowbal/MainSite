import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/send-email';
import { signupConfirmationEmail } from '@/lib/emails/signup-confirmation';
import {
  NAME_MAX,
  PASSWORD_MAX_LENGTH,
  authErrorBody,
  normalizePhone,
  validateContactDetails,
  validatePassword,
} from '@/features/auth/domain';
import { checkPasswordBreach } from '@/features/auth/api';
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
  // Shape only — bounded so an unbounded string never reaches the hashers. The
  // real floor is `validatePassword`, which can say WHICH rule failed instead of
  // collapsing into the generic parse error below.
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
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
    return NextResponse.json(authErrorBody('invalid_json'), { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(authErrorBody('invalid_input'), { status: 400 });
  }
  const input = parsed.data;

  const passwordProblem = validatePassword(input.password);
  if (passwordProblem) {
    return NextResponse.json(authErrorBody(passwordProblem.code, passwordProblem.vars), {
      status: 400,
    });
  }

  const fieldErrors = validateContactDetails({
    full_name: input.full_name,
    phone: input.phone,
    date_of_birth: input.date_of_birth,
  });
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { ...authErrorBody('contact_fields'), errors: fieldErrors },
      { status: 400 },
    );
  }
  // Non-null: validateContactDetails rejects anything normalizePhone refuses.
  const phone = normalizePhone(input.phone) as string;

  const normalizedEmail = input.email.trim().toLowerCase();

  const safeNext = input.next && input.next.startsWith('/') ? input.next : null;
  const callbackUrl = new URL('/auth/callback', resolveAuthOrigin(new URL(request.url).origin));
  if (safeNext) callbackUrl.searchParams.set('next', safeNext);

  /**
   * Breach check — the compensating control for Supabase's leaked-password
   * protection, which is off and needs an org owner to enable
   * (`docs/known-issues.md §0i`).
   *
   * Runs last among the validations and before the account is created, because
   * it is the only one that makes a network call: everything cheap has already
   * rejected what it can.
   *
   * FAILS OPEN, deliberately. If HIBP is slow, rate-limiting us or down,
   * `status` is `unavailable` and the sign-up proceeds. Blocking registration on
   * a third-party outage would trade a defence-in-depth control for an
   * availability incident, and this is exactly the risk we carried anyway while
   * the Supabase toggle was off. The warning is logged so the failure is
   * visible rather than silent.
   */
  const breach = await checkPasswordBreach(input.password);
  if (breach.status === 'breached') {
    return NextResponse.json(authErrorBody('password_breached'), { status: 400 });
  }
  if (breach.status === 'unavailable') {
    console.warn('[auth/signup] breach check skipped', breach.reason);
  }

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
      return NextResponse.json(authErrorBody('email_exists'), { status: 409 });
    }
    console.error('[auth/signup] generateLink failed', error);
    return NextResponse.json(authErrorBody('signup_failed'), { status: 500 });
  }

  const confirmUrl = data.properties?.action_link;
  if (!confirmUrl) {
    console.error('[auth/signup] no action_link returned');
    return NextResponse.json(authErrorBody('signup_failed'), { status: 500 });
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
