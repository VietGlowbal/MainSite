export type EmailCategory =
  | 'security'
  | 'product_transactional'
  | 'product_reminder'
  | 'marketing';

export type EmailTemplateId =
  | 'signup-confirmation'
  | 'welcome'
  | 'onboarding-reminder'
  | 'onboarding-complete'
  | 'report-ready'
  | 'deadline-reminder'
  | 'newsletter-welcome'
  | 'waitlist-confirmation'
  | 'mentorship-confirmation'
  | 'mentorship-reminder'
  | 'payment-confirmation'
  | 'payment-failed'
  | 'contact-confirmation'
  | 'legacy';

export type EmailAttachment = {
  filename: string;
  /** Base64 encoded attachment content. */
  content: string;
  contentType?: string;
  contentId?: string;
};

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  category?: EmailCategory;
  template?: EmailTemplateId;
  userId?: string;
  /**
   * Stable key for a logical email event. Forwarded to Resend as its
   * Idempotency-Key so retries do not create duplicate deliveries.
   */
  idempotencyKey?: string;
  tags?: Record<string, string>;
};

export type SendEmailResult =
  | { ok: true; skipped?: false; messageId: string }
  | { ok: true; skipped: true; reason: 'email-disabled' | 'duplicate' | 'not-configured' }
  | { ok: false; error: string; status?: number };
