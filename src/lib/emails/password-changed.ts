import { emailButton, escapeHtml, glowbalEmailLayout } from '@/lib/email/template';

/**
 * "Your password was changed" — sent AFTER a successful change, not before.
 *
 * WHY THIS EXISTS. The change-password screen is reachable by anyone holding a
 * live session, which is exactly what an attacker has after a stolen laptop or
 * a replayed cookie. The current-password prompt makes that hard; this mail is
 * what catches the case where it was not hard enough. It is the only signal the
 * real owner gets, and it reaches a channel the session thief may not control.
 *
 * Deliberately NOT sent by the reset flow. There the user has just received a
 * reset link at this same address, so a second mail proves nothing they did not
 * already know — and an attacker who completed a reset already owns the mailbox.
 *
 * No token, no one-click undo: a link that reverses a password change is itself
 * a credential, and mailing one to an inbox that may be compromised would hand
 * over the thing this message exists to protect. The recovery path is the
 * ordinary reset flow, which re-proves control of the mailbox.
 */
export function passwordChangedEmail(resetUrl: string, firstName?: string): string {
  const name = firstName?.trim();
  const titleHtml = name
    ? `Your password was changed,<br /><span style="color:#E11D48;">${escapeHtml(name)}</span>`
    : 'Your password was changed';

  return glowbalEmailLayout({
    preheader: 'The password on your GlowBal account was just changed.',
    eyebrow: 'Security alert',
    titleHtml,
    bodyHtml:
      'The password on your GlowBal account was just changed, and every other device that was signed in has been signed out. If this was you, there is nothing to do — you can ignore this email.',
    actionHtml: emailButton('I did not do this — secure my account →', resetUrl),
    footerNote:
      "If you did not make this change, use the button above to reset your password straight away. Anyone who changed it can still sign in until you do.",
  });
}
