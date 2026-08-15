import { emailButton, escapeHtml, glowbalEmailLayout, trustRow } from '@/lib/email/template';

export function signupConfirmationEmail(confirmUrl: string, firstName?: string): string {
  const name = firstName?.trim();
  const titleHtml = name
    ? `Confirm your email,<br /><span style="color:#E11D48;">${escapeHtml(name)}</span>`
    : 'Confirm your email';

  return glowbalEmailLayout({
    preheader: 'Confirm your email to activate your GlowBal account.',
    eyebrow: "One tap and you're in",
    titleHtml,
    hero: true,
    bodyHtml:
      'Welcome to GlowBal! Confirm your email address to activate your account and start finding your dream university.',
    actionHtml: emailButton('Confirm my account →', confirmUrl),
    afterActionHtml: trustRow(),
    footerNote: "If you didn't create a GlowBal account, you can safely ignore this email.",
  });
}
