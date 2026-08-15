# Founder-confirmed manual bank transfer design

Status: implemented locally and verified on 2026-08-15; database migration,
deployment secrets, scheduler configuration, and Sandbox acceptance testing are
still pending.

## Understanding lock

The owner explicitly delegated unresolved product and technical decisions and
asked not to be questioned before implementation. This document therefore
treats the following understanding and assumptions as confirmed defaults.

### Understanding summary

- Add a manual bank-transfer payment method for both mentorship and GlowBal
  Plus, alongside VNPay Sandbox and the disabled Stripe demo.
- After checkout starts, the student receives a customized email containing the
  founder's bank QR image, exact VND amount, unique transfer reference, product,
  and expiry.
- The founder receives one transaction-review email only after the student
  explicitly reports that the transfer was made. It includes useful account
  and payment details plus a secure review link.
- Opening an email link must never confirm money. The founder signs in, reviews
  the transaction, and explicitly submits Confirm received or Reject.
- A valid confirmation fulfils the original product exactly once and then sends
  the student a completion email. It does not mark the student's auth email as
  verified; “verified” means payment/product entitlement is confirmed.
- Email delivery is durable and retryable. A transient Resend/serverless failure
  must not lose the transaction or create duplicate fulfilment.
- Existing VNPay and Stripe provider behavior remains isolated and intact.

### Assumptions and non-functional defaults

- Expected scale is low-to-moderate (under 1,000 manual payments/day); database
  correctness and auditability matter more than sub-second email delivery.
- A founder reviewer has a normal Supabase account, `is_admin = true`, and a UUID
  in the server-only `MANUAL_PAYMENT_REVIEWER_USER_IDS` allowlist.
- Founder bank metadata and the QR image are configured server-side. The QR image
  is a stable public HTTPS asset; secrets and account configuration are never
  embedded in source control.
- Mentorship instructions expire with the initial owned slot hold (30 minutes).
  After actually transferring, the student must submit “I have transferred”
  before that deadline; this records a user claim (not a trusted bank timestamp)
  and extends the exact owned hold for a two-hour founder-review grace period.
  Plus instructions and review expire after 24 hours. Receipt confirmed after a
  product/owned-hold deadline is stored as `paid_unfulfilled` for refund/manual
  recovery and cannot reclaim a slot or silently grant stale entitlement.
- The system is available when checkout and database writes work. Resend is
  allowed to be temporarily unavailable because an outbox retries delivery.
- Founder email contains the account name, email, phone when supplied, stable
  user ID, product, amount, reference, and relevant timestamps. It never
  includes secrets, authentication cookies, private application content, or
  full help answers.
- English and Vietnamese student templates follow the checkout locale. Founder
  review email is concise bilingual operational copy.

## Approaches considered

### A. Authenticated review page with state-bound HMAC capability — selected

Email contains a signed `review_id + token_version` capability; only the version
and review state are stored. The GET link opens a no-index, no-referrer page and performs no mutation. A POST
confirmation requires a current Supabase session, admin status, the explicit
reviewer UUID allowlist, the unexpired token, and a still-valid transaction.

This costs one review page, one protected API route, and a small audit table,
but prevents forwarded links, mail scanners, accidental GETs, and replay.

### B. Signed one-click confirmation URL — rejected

It is smaller, but security scanners and forwarded email can trigger a state
change. A cryptographic signature proves the link was issued by GlowBal; it does
not prove the founder intentionally confirmed receipt.

### C. Automated bank reconciliation — deferred

Bank/open-banking integration would remove founder review, but no bank API,
merchant contract, or webhook is currently in scope. Adding one now would be
speculative and provider-specific.

## Architecture

```text
Mentorship / Plus UI
  -> choose Manual bank transfer
  -> POST /api/payments/manual/checkout
  -> shared server payment-intent builder derives product and VND amount
  -> payment_transactions(provider=manual_bank_transfer, status=pending)
  -> manual_payment_reviews(pending, token_version, expiry)
  -> payment_notification_jobs(student_instructions)
  -> /payment/manual/status?reference=...

Student transfers money
  -> POST /api/payments/manual/claim (own pending transaction, one time)
  -> records claimed_at and, for mentorship, extends only the owned slot hold
  -> enqueues the single founder_claimed review email

Outbox dispatcher (immediate attempt + protected reconciliation job)
  -> customized student email with founder QR + amount + reference
  -> founder email with authenticated review link

Founder
  -> GET /payment/manual/review?token=... (read-only, outside admin layout)
  -> sign in as allowlisted admin
  -> POST /api/admin/payments/manual/confirm or /reject
  -> atomic database transition and product fulfilment
  -> enqueue student_confirmed or student_needs_support email
```

## Data model and state transitions

### Existing `payment_transactions`

A follow-up migration expands the provider constraint to include
`manual_bank_transfer`, drops `vnp_amount`'s NOT NULL rule, and replaces it with
a conditional check: VNPay requires `vnp_amount = amount_vnd * 100`; manual
transfer requires `vnp_amount IS NULL`. It drops/recreates the idempotency index
as unique `(user_id, provider, product_type, idempotency_key)`, and every lookup
filters the same four fields. Product, amount, booking, Plus plan, frozen FX,
expiry, paid/fulfilled timestamps, and request fingerprint remain on the ledger.
The shared status machine stays:

```text
pending -> fulfilled
pending -> failed
pending -> expired
expired/failed + founder records late receipt -> paid_unfulfilled
fulfilled / paid_unfulfilled -> terminal
```

No browser role may insert or update the ledger. Students retain own-row SELECT
only. All mutation functions are security-definer, revoked from
`public`/`anon`/`authenticated`, and explicitly granted to `service_role` only.

### `manual_payment_reviews`

- one row per transaction (`transaction_id` unique);
- `token_version` supports explicit revocation; no raw capability is stored;
- state: `pending`, `claimed`, `confirmed`, `rejected`, `expired`;
- `expires_at`, `claimed_at`, `review_deadline_at`, `reviewed_at`, `reviewed_by`,
  optional bounded reviewer note;
- immutable snapshots for configured bank label and QR asset revision so support
  can identify what instructions the student saw without storing secrets.

### `payment_notification_jobs`

- unique `(transaction_id, kind)` for `student_instructions`, legacy
  `founder_review`, `founder_claimed`, `student_confirmed`, `student_rejected`, and
  `student_needs_support`;
- state: `pending`, `processing`, `sent`, `failed`;
- attempts, next attempt, lease expiry, last bounded error, provider message id,
  and sent timestamp;
- no raw token, HTML, or secret is persisted. The founder capability is
  deterministically generated as `review_id.version.HMAC-SHA256` using a
  server-only review secret, so retries reproduce the same valid link without
  storing recoverable credentials or invalidating an email already delivered.

## Checkout and idempotency

- Extract only provider-neutral, pure product validation/pricing into one
  server-only helper. Do not refactor the working VNPay write path in this task.
  Manual checkout validates authentication, application/slot ownership, server
  pricing, fixed Sandbox FX disclosure, booking fields, idempotency and exact
  slot ownership, then calls one service-role-only database function that
  atomically creates/binds the booking (when applicable), ledger row, review row,
  and student instruction job. Any failure rolls the whole checkout back.
- Provider is part of the idempotency scope and fingerprint. Reusing a key with
  different provider or payload returns 409; a retry returns the same reference
  and status URL and does not create duplicate email jobs.
- Manual checkout returns a status/instructions URL, not a bank URL. The page
  repeats the QR, amount, reference, product, expiry, and current state so email
  is convenient but not the only way to complete payment.

## Founder review security

- Sign `review_id + token_version` using HMAC-SHA256 and compare signatures in
  constant time. Rotating `token_version` revokes all earlier links.
- GET is read-only. Confirmation/rejection is POST with same-origin validation.
- Require: authenticated user, `isAdmin(user.id)`, UUID allowlist membership,
  valid unexpired token, matching manual provider, and pending review.
- Lock review + transaction + booking/slot/profile rows in one database function.
- Confirmation is idempotent: repeated POST returns the existing terminal result.
- Founder cannot edit amount, recipient, product, booking, or Plus package from
  the review page. Optional notes are audit-only.
- The review page lives outside `/admin` so the existing admin-layout redirect
  cannot discard its query. If signed out, it redirects to `/auth` with the full
  encoded review pathname and token as the return target; after login it
  revalidates token and reviewer authorization from scratch.
- Page sends `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, and robots
  noindex. Logs redact token, bank account, and user email.

## Atomic fulfilment rules

- Extract provider-neutral fulfilment into a database function called by both
  VNPay processing and founder confirmation; do not duplicate Plus credit or
  mentor-slot mutation logic in TypeScript.
- Mentorship confirms only when the pending booking still owns the held slot and
  the hold is unexpired. It persists the meeting link, marks the booking and slot
  confirmed/booked, then fulfils the ledger in the same transaction.
- Plus locks the profile, extends from `greatest(current expiry, now())`, adds
  credits once, inserts one subscription linked to the payment transaction, and
  fulfils the ledger in the same transaction.
- Founder review time is never treated as bank transfer time. A mentorship
  confirmation may fulfil after the initial 30 minutes only when the student
  submitted the one-time claim before the initial deadline and the exact owned
  slot is still held inside its two-hour review grace. Otherwise receipt becomes
  `paid_unfulfilled`, preserves `paid_at` and reviewer audit, sends a
  support/refund email, and grants nothing automatically.
- Reject/expiry releases only a slot still owned by that exact booking.

## Email and QR behavior

Student instruction email includes brand header, personalized greeting, QR
image embedded using a Resend CID attachment sourced from the configured HTTPS
asset, bank label/account holder/account number (partially masked if configured),
exact amount, copyable reference, product summary, expiry, status-page button,
and a warning that access is granted only after confirmation.

The single founder email is sent after the student's transfer claim. It includes
reference, exact amount, student display name/email/phone/user ID, product and
booking/plan summary, checkout/claim/review-deadline timestamps, and one Review
payment button. It never contains confirm/reject GET links.

Implement a new strict transactional-email adapter; do not reuse the existing
`sendEmail` behavior that returns void and suppresses configuration/API errors.
It returns Resend's message ID or throws, never logs recipient PII, and supplies
a stable `Idempotency-Key` derived from notification job ID/kind. The dispatcher
sends immediately after checkout using the Next.js lifecycle API supported by
the installed 16.3.1 docs, then a protected reconciliation endpoint leases due
jobs and retries with bounded backoff. Automatic retries stop within Resend's
24-hour idempotency window; unresolved jobs become operator-visible `failed`
rather than risking a duplicate after provider deduplication expires. A Resend
acceptance ID means `sent`; delivery/bounce webhooks are a later enhancement.

## UI behavior

- Payment selector becomes controlled and exposes VNPay Sandbox, Manual bank
  transfer, and disabled Stripe. No method is silently preselected after the
  student changes it.
- Manual checkout opens the internal instruction/status page; VNPay continues to
  redirect to Sandbox unchanged.
- Status API/page must authenticate with the ordinary Supabase user client and
  query by both `reference` and `user_id` under own-row RLS. It must never reuse
  the existing service-role/reference-only VNPay status helper.
- Status page shows `Awaiting transfer`, `Transfer reported — awaiting founder`,
  `Confirmed`, `Rejected`,
  `Expired`, or `Received late — support review required` and polls own-row state
  at a conservative interval while visible.
- Founder review page has a deliberate confirmation dialog summarizing amount,
  reference, and user before POST. Buttons are disabled after terminal state.

## Test and operational plan

- TDD unit/route tests: idempotent checkout, immutable server amount, provider
  separation, QR/config validation, email escaping, token hashing/redaction,
  unauthorized/non-allowlisted/expired/replayed review, GET no mutation, POST
  same-origin, confirm/reject behavior, and outbox retry/lease uniqueness.
- SQL contract tests: full provider/vnp_amount/idempotency constraints, atomic
  checkout rollback, RLS and grants, terminal transitions, simultaneous confirm,
  late mentorship receipt, exact slot ownership, Plus credits once, and rejection
  releasing only the owned hold.
- Component tests: provider selection, status states, founder double-confirm
  guard, bilingual templates, accessible QR alt text and copyable reference.
- Integration checks: payment-focused Vitest, full Vitest, base/strict TypeScript,
  i18n audit, ESLint, production build, and manual Resend Sandbox/inbox walk.
- Deployment: apply VNPay migration first, then the manual-payment follow-up;
  configure reviewer UUIDs, founder email, bank display fields, public HTTPS QR
  URL, Resend, site URL, and reconciliation secret; run one Plus and one
  mentorship transfer through confirm, reject, expiry, replay, and late receipt.

## Decision log

| Decision | Alternatives | Rationale / resolution |
|---|---|---|
| Authenticated review page + POST | One-click GET; bank automation | Prevents scanner/forward/replay confirmation without inventing a bank integration. |
| Admin plus UUID allowlist | Admin alone; email comparison | Limits payment authority even if another admin account is compromised; UUID is stable across email changes. |
| HMAC capability tied to review row/version | Plain token; stored opaque token; standalone JWT | Retry can regenerate the same link without plaintext storage; database state/version provides revocation and one-time semantics. |
| Durable database outbox | Fire-and-forget email | Email is core to this flow and serverless execution/Resend can fail transiently. |
| Internal status page also shows QR | Email-only instructions | Email delivery delay cannot block payment or hide current state. |
| Shared database fulfilment function | Duplicate manual fulfilment code | One atomic entitlement/booking implementation prevents provider drift and double credits. |
| Late payment -> `paid_unfulfilled` | Auto-fulfil; discard | Preserves money evidence without stealing expired slots or granting stale products. |
| Static configured HTTPS founder QR | Third-party QR API | Avoids external runtime dependency and keeps bank destination owner-controlled. |
| Both mentorship and Plus | Only one product | Matches the payment scope established for VNPay and the owner's unqualified request. |
| One-time user transfer claim + 2h mentorship review grace | Infer bank time from founder click; hold indefinitely | We cannot know bank transfer time without a bank webhook. A bounded user claim avoids that false inference while limiting slot abuse. |
| Atomic manual-checkout RPC | Sequential route writes | Prevents orphan ledgers, missing reviews/outbox jobs, and leaked slot holds on partial failure. |
| Strict email adapter + Resend idempotency key | Existing silent helper | Makes retries observable and suppresses duplicate delivery during the provider's documented 24h window. |
| One founder email after transfer claim | Checkout email plus claim reminder | Avoids duplicate founder notifications and sends the actionable review only when the student states that money was transferred. |
| Prioritize `founder_claimed` in outbox leasing | Strict creation-time FIFO | A blocked student-recipient email must not consume the claim callback's only delivery opportunity and delay the actionable founder review. |
