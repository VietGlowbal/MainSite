import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/send-email';
import { signupConfirmationEmail } from '@/lib/emails/signup-confirmation';
import { resolveRequestOrigin } from '@/lib/site-url';

/**
 * POST /api/auth/signup
 *
 * Email/password sign-up that delivers the confirmation email via Resend
 * instead of Supabase's built-in SMTP, which is rate-limited on the free tier
 * ("email rate limit exceeded").
 *
 * How it works: we use the admin API's generateLink to create the (unconfirmed)
 * user and obtain the *exact same* confirmation URL Supabase would have emailed,
 * without Supabase sending anything. We then send that link ourselves through
 * Resend. The /auth/callback route is unchanged — the link is identical to the
 * one Supabase's own template would contain, so confirmation works the same way.
 */

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(200),
  full_name: z.string().max(160).optional(),
  phone: z.string().max(20).optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // A path to return to after confirmation (validated to be a local path).
  next: z.string().optional(),
});

function siteOrigin(request: NextRequest): string {
  return resolveRequestOrigin(new URL(request.url).origin);
}

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

  // Build the post-confirmation redirect from a *local* path only (no open
  // redirects), mirroring the callback's handling.
  const safeNext = input.next && input.next.startsWith('/') ? input.next : null;
  const callbackUrl = new URL('/auth/callback', siteOrigin(request));
  if (safeNext) callbackUrl.searchParams.set('next', safeNext);

  const admin = createAdminClient();

  // Create the user + get the confirmation link, without Supabase emailing it.
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email: input.email,
    password: input.password,
    options: {
      // Same metadata we used to pass to auth.signUp, so the callback can
      // backfill phone + date of birth onto the profile after confirmation.
      data: {
        full_name: input.full_name ?? '',
        phone: input.phone ?? '',
        date_of_birth: input.date_of_birth ?? '',
        marketing_consent: true,
      },
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error) {
    // Most common case: the email is already registered.
    const alreadyExists =
      error.status === 422 || /already|registered|exists/i.test(error.message);
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
  await sendEmail({
    to: input.email,
    subject: 'Confirm your GLOWBAL account',
    html: signupConfirmationEmail(confirmUrl, firstName),
  });

  return NextResponse.json({ ok: true });
}
