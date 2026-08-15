# GlowBal email and lifecycle notification system

## Purpose

Email is an extension of the student's GlowBal journey. A product email should explain what changed, why it matters, and the best next action. Low-value product activity stays in-app; email is reserved for security, money, booked sessions, important deadlines, meaningful AI outputs, and useful return-to-product moments.

Brand direction: **black + white + GlowBal red + restrained global/digital imagery**. The shared tagline is **Go Glow, Go GlowBal**.

## Sender

The product-wide default is:

`GlowBal <support@glowbal-education.com>`

`src/lib/email/config.ts` is the source of truth. `EMAIL_FROM_DEFAULT`, `EMAIL_FROM_MENTORSHIP`, and `EMAIL_FROM_MARKETING` exist for deliberate future sending-stream overrides. The legacy `WAITLIST_FROM_EMAIL` variable is not used by the new transport.

Before production deployment, `glowbal-education.com` and `support@glowbal-education.com` must be valid/verified in the Resend account associated with `RESEND_API_KEY`.

## Shared implementation

- `src/lib/send-email.ts` — single Resend transport for normal product mail; supports HTML, text, attachments, reply-to, tags and Resend idempotency keys.
- `src/lib/email/config.ts` — sender, brand assets, social URLs and theme values.
- `src/lib/email/template.ts` — table-based, inline-styled, email-client-safe dark/red layout and shared components.
- `src/lib/email/delivery-log.ts` — persistent best-effort delivery logging/idempotency.
- `supabase-email-system.sql` — `email_deliveries` and `email_preferences` schema.
- `src/app/api/email/preferences/route.ts` — authenticated GET/PATCH API for product email preferences.
- `src/app/api/cron/lifecycle-emails/route.ts` — scheduled lifecycle processing.

The manual payment outbox keeps its existing durable queue/retry mechanism, but its sender identity is now taken from the shared GlowBal sender configuration.

## Current live triggers after this change

### Security / essential transactional

**Confirm account** — sent immediately after email/password signup. The Supabase action URL exists only behind the CTA and is not printed visibly in the email.

**Welcome** — sent once after a successful email-confirmation callback. The event key `welcome:<userId>` prevents repeat callback visits from sending it again.

### Product transactional

**Onboarding complete** — the daily lifecycle job sends one completion email for a profile completed in the previous 24 hours.

**Mentorship booking confirmation** — mentor and mentee versions retain the `.ics` attachment, meeting link, booking details and Google Calendar link, but use the new shared brand and transport.

**Manual payment messages** — retain the existing payment outbox and idempotency architecture while using the shared support sender identity.

**Contact/waitlist acknowledgement** — uses the shared new design rather than the old pastel template.

### Product reminders

**Onboarding reminder 1** — eligible verified users who are still incomplete 24–48 hours after account creation.

**Onboarding reminder 2** — final reminder 96–120 hours after account creation. No continuing onboarding nag sequence after this.

Both reminders respect `email_preferences.product_updates = false` when a preference row exists.

### Marketing

**Newsletter welcome** — sent only after a new newsletter subscription. Includes a real unsubscribe URL and uses the marketing category.

## Templates available for product integration

`src/lib/emails/lifecycle.ts` also contains reusable templates for:

- Personal Report ready
- Matching Report ready
- Strategy Report ready
- Evaluation Report ready
- application deadline reminders

These should be connected to the corresponding product event only when the event is genuinely useful outside the current screen. Do not synchronously email a user who is already sitting on the report generation screen waiting for the same result.

## Planned lifecycle rules

These rules define when future call sites should use the email system.

### Account and security

- Email verification: immediate, essential.
- Password reset: immediate, essential.
- Password/email changed: immediate security notice.
- Account deletion: immediate status/confirmation as appropriate.

### Onboarding

- Welcome: once, after confirmed account.
- Incomplete: 24h reminder, then one final reminder approximately 72h later.
- Complete: one milestone email, then route the student to discovery.

### Reports and Strategy Master

- Personal Report ready: first meaningful/new report when user is no longer waiting on the generating screen.
- Matching Report ready: meaningful new university/course analysis.
- Strategy ready: strong milestone email with next actions.
- Evaluation ready: communicate readiness and outstanding actions.
- Never send for trivial refreshes/cached reads.

### Planner and deadlines

Prefer a weekly strategy digest over one email per task. Important application deadlines can use 30-day, 7-day and 1-day reminders, with multiple same-day low-priority items combined where practical. Deadline emails should include readiness/tasks remaining when those values are trustworthy.

### Scholarships

Only notify for saved/relevant opportunities. Prefer a weekly personalised opportunity digest over one email per new database record. Saved-scholarship deadline reminders should be preference-controlled.

### Mentorship

- Confirmation: immediately after paid booking.
- Reminder: 24h before; optional concise 1h reminder.
- Reschedule/cancellation: immediately to both parties.
- Follow-up: after a completed session, not after a no-show/cancelled session.

### Payments

- Success: immediate receipt/access confirmation.
- Pending: only when the payment method truly has a pending state.
- Failed: after confirmed processor/manual failure, with a clear retry action.
- Renewal: only if recurring billing exists and where appropriate.

### Lifecycle engagement

Avoid generic "we miss you" mail. A re-engagement email requires a concrete, valuable next action in an active application. Otherwise do not send it.

## Categories and consent

Four categories are supported:

1. `security` — essential, no marketing opt-out.
2. `product_transactional` — triggered by a requested/important service event.
3. `product_reminder` — preference-controlled.
4. `marketing` — must be based on marketing/newsletter consent and include unsubscribe where required.

Marketing content must not be hidden inside a security/transactional email.

## Preferences

`email_preferences` currently supports:

- `deadline_reminders`
- `weekly_strategy_digest`
- `scholarship_alerts`
- `mentorship_reminders`
- `product_updates`
- `marketing`
- `preferred_language` (`en` / `vi`)
- `timezone`

The API exists now; a user-facing settings UI can be added to Profile without changing the underlying lifecycle architecture.

## Idempotency and delivery logging

Automated mail should always have a stable logical event key, e.g.:

- `welcome:<userId>`
- `onboarding-reminder-1:<userId>`
- `strategy-ready:<strategyId>`
- `deadline-7d:<applicationId>`
- `mentorship-confirmation:mentee:<bookingId>`
- `payment-success:<paymentId>`

`email_deliveries.event_key` is unique and the same value is also passed to Resend as the Idempotency-Key. Failed rows can retry; already-sent/sending events are treated as duplicates.

## Scheduler

Vercel invokes `/api/cron/lifecycle-emails` every day at `02:00 UTC` (`09:00` in Vietnam). The route uses the existing `CRON_SECRET`/service-role authorization helper.

Future deadline/digest processors can either extend this route or use separate cron routes when querying/scaling needs become materially different.

## Social links

Email footers are designed for exactly:

- LinkedIn
- Instagram
- Facebook
- GlowBal website

Instagram and Facebook are configured in code; the website uses `SITE_URL`. LinkedIn must be supplied through `NEXT_PUBLIC_GLOWBAL_LINKEDIN_URL` because the repository does not currently contain a verified company LinkedIn URL. When unset, the email omits the LinkedIn icon instead of linking to an invented account.

No YouTube or X/Twitter links are included.

## Deployment checklist

1. Merge/deploy the code changes.
2. Run `supabase-email-system.sql` in the production Supabase project.
3. Verify the `glowbal-education.com` sending domain and `support@glowbal-education.com` identity in Resend.
4. Ensure `RESEND_API_KEY` is configured.
5. Set `EMAIL_FROM_DEFAULT=support@glowbal-education.com` explicitly in production even though it is also the code fallback.
6. Set `EMAIL_REPLY_TO=support@glowbal-education.com` (optional; same fallback).
7. Set `NEXT_PUBLIC_GLOWBAL_LINKEDIN_URL` to the confirmed GlowBal LinkedIn company URL.
8. Ensure `CRON_SECRET` is configured for Vercel Cron.
9. Send test messages to Gmail, Outlook and Apple Mail; check desktop/mobile and images-disabled rendering.
10. Confirm onboarding cron output and `email_deliveries` rows before enabling additional lifecycle campaigns.

## Design constraints

Email HTML is not web UI. Critical structure uses tables, inline styles, absolute image URLs and normal anchors. Do not depend on JavaScript, canvas, WebGL, Tailwind runtime, CSS variables, custom fonts, backdrop filters or advanced animations.

The red globe is a brand motif, not mandatory decoration. Use it for major moments such as account confirmation, welcome and Strategy ready; keep utility emails such as reminders/receipts more restrained.
