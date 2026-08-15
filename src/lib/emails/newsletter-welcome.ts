import { emailButton, escapeHtml, glowbalEmailLayout } from '@/lib/email/template';

export function newsletterWelcomeEmail(input: {
  firstName?: string;
  newsUrl: string;
  unsubscribeUrl: string;
}): string {
  const name = input.firstName?.trim();
  return glowbalEmailLayout({
    preheader: 'Scholarships, university guidance and useful application updates from GlowBal.',
    eyebrow: 'Welcome to the GlowBal newsletter',
    titleHtml: name
      ? `You're on the list, <span style="color:#E11D48;">${escapeHtml(name)}</span>.`
      : "You're on the list.",
    bodyHtml: `
      <div>We will send you useful updates — not noise.</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;text-align:left;">
        <tr><td style="padding:5px 0;color:#FAFAFA;">• Scholarship opportunities</td></tr>
        <tr><td style="padding:5px 0;color:#FAFAFA;">• University and admissions guidance</td></tr>
        <tr><td style="padding:5px 0;color:#FAFAFA;">• Application strategy and practical tips</td></tr>
        <tr><td style="padding:5px 0;color:#FAFAFA;">• Important GlowBal product updates</td></tr>
      </table>`,
    actionHtml: emailButton('Explore GlowBal News →', input.newsUrl),
    unsubscribeUrl: input.unsubscribeUrl,
    footerNote: 'You are receiving this because you subscribed to GlowBal marketing updates.',
  });
}
