import { emailButton, escapeHtml, glowbalEmailLayout } from '@/lib/email/template';

export function welcomeEmail(input: {
  firstName?: string;
  nextUrl: string;
  onboardingComplete?: boolean;
}): string {
  const name = input.firstName?.trim();
  const titleHtml = name
    ? `You're in, <span style="color:#E11D48;">${escapeHtml(name)}</span>.`
    : "You're in.";
  const action = input.onboardingComplete ? 'Continue my strategy →' : 'Build my GlowBal profile →';

  return glowbalEmailLayout({
    preheader: 'Your GlowBal account is ready. Here is your next step.',
    eyebrow: 'Welcome to GlowBal',
    titleHtml,
    hero: true,
    bodyHtml: `
      <div>Let's build your path to university.</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;text-align:left;">
        <tr><td style="padding:6px 0;color:#FAFAFA;font-weight:700;">01&nbsp;&nbsp; Tell GlowBal about yourself</td></tr>
        <tr><td style="padding:6px 0;color:#FAFAFA;font-weight:700;">02&nbsp;&nbsp; Discover universities and scholarships</td></tr>
        <tr><td style="padding:6px 0;color:#FAFAFA;font-weight:700;">03&nbsp;&nbsp; Receive personalised reports</td></tr>
        <tr><td style="padding:6px 0;color:#FAFAFA;font-weight:700;">04&nbsp;&nbsp; Turn your profile into an application strategy</td></tr>
      </table>`,
    actionHtml: emailButton(action, input.nextUrl),
    footerNote: 'This is a product email about your GlowBal account.',
  });
}
