import { escapeHtml, glowbalEmailLayout } from '@/lib/email/template';

export function waitlistConfirmationEmail(firstName?: string): string {
  const name = firstName?.trim();
  return glowbalEmailLayout({
    preheader: 'GlowBal received your details.',
    eyebrow: 'Request received',
    titleHtml: name
      ? `Thanks, <span style="color:#E11D48;">${escapeHtml(name)}</span>. We’ve got it.`
      : 'Thanks. We’ve got it.',
    bodyHtml:
      'Your details have reached the GlowBal team. We’ll review what you sent and follow up using the contact information you provided. In the meantime, you can keep exploring universities, scholarships and application guidance on GlowBal.',
    footerNote: 'You are receiving this because you submitted your details to GlowBal.',
  });
}
