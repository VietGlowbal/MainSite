import { emailButton, escapeHtml, glowbalEmailLayout, trustRow } from '@/lib/email/template';

/**
 * Password-reset email.
 *
 * The link points at OUR `/auth/reset-password` page carrying the recovery
 * token, not at Supabase's verify endpoint. The token is redeemed at the moment
 * the new password is submitted, so possession of this email is proved by the
 * act of changing the password rather than by an earlier redirect. See
 * `src/app/api/auth/reset-password/confirm/route.ts`.
 *
 * The expiry is stated because a recovery token is short-lived and "the link
 * did nothing" is the most common support question when it is not.
 */
export function passwordResetEmail(resetUrl: string, firstName?: string): string {
  const name = firstName?.trim();
  const titleHtml = name
    ? `Reset your password,<br /><span style="color:#E11D48;">${escapeHtml(name)}</span>`
    : 'Reset your password';

  return glowbalEmailLayout({
    preheader: 'Reset the password for your GlowBal account.',
    eyebrow: 'Password reset',
    titleHtml,
    hero: true,
    bodyHtml:
      'We received a request to reset your GlowBal password. Choose a new one using the button below. This link expires in one hour and can only be used once.',
    actionHtml: emailButton('Choose a new password →', resetUrl),
    afterActionHtml: trustRow(),
    footerNote:
      "If you didn't request a password reset, you can safely ignore this email — your password has not been changed.",
  });
}
