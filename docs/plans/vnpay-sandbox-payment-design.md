# VNPay Sandbox payment design

Status: implemented locally and verified on 2026-08-15; database migration,
deployment configuration, and VNPay Sandbox SIT remain operational steps.

## Understanding summary

- Add VNPay Sandbox checkout to both mentor bookings and GlowBal Plus.
- Keep Stripe visible as a disabled demo option labelled "Coming soon"; do not
  route users into the existing Stripe endpoints.
- Keep all prices authoritative on the server. VNPay is charged in VND only.
- Use the VNPay IPN as the payment source of truth. The browser Return URL may
  verify and display a result, but must not fulfil a purchase.
- Preserve the existing mentor slot/booking flow and Plus entitlement model.
- Keep secrets server-only and out of committed source and documentation.
- Reuse the existing design system and EN/VI translation infrastructure.

## Assumptions

- This implementation targets VNPay API 2.1.0 and is hard-locked to Sandbox.
  It must fail closed if configured with a non-Sandbox payment host.
- Checkout expires after 15 minutes and uses Asia/Ho_Chi_Minh timestamps.
- Both products require an authenticated user to start checkout.
- The deployed IPN URL is public HTTPS and will be registered with VNPay.
- Stripe integration remains owned by another developer; the VNPay work must be
  isolated so that developer can replace the disabled demo path later.
- Existing USD/GBP mentor prices are converted for Sandbox testing with explicit
  server-side fixed rates. The exact source currency, source amount, rate, and
  resulting VND amount are frozen on the transaction and shown before redirect.
  Production VNPay must stay disabled until the owner supplies a live FX/pricing
  policy; display-grade rates must never silently become production prices.

## Architecture

```text
Mentor / Plus UI
  -> POST /api/payments/vnpay/checkout
  -> create payment_transactions(pending)
  -> redirect to VNPay Sandbox

VNPay
  -> GET /api/payments/vnpay/ipn
  -> verify signature, terminal, reference, amount, and current state
  -> fulfil exactly once in a database transaction
  -> return VNPay RspCode JSON

Browser
  -> GET /payment/vnpay/return
  -> verify checksum
  -> read transaction state and render the result only
```

### Server modules and routes

- `src/lib/payments/vnpay.ts`: typed server-only configuration, canonical query
  serialization, HMAC-SHA512 signing/verification, GMT+7 date formatting, and
  payment URL construction.
- `POST /api/payments/vnpay/checkout`: a Zod discriminated union for
  `mentorship` and `plus`. It derives amount, plan/credits, mentor, slot, and
  ownership from server data rather than accepting a client price.
- `GET /api/payments/vnpay/ipn`: an unauthenticated machine callback protected
  by checksum and invariant checks. It returns VNPay `RspCode` values `00`,
  `01`, `02`, `04`, `97`, or `99` as appropriate.
- `/payment/vnpay/return`: a no-index result page. It never writes payment or
  entitlement state.

### Payment ledger

Add a provider-neutral `payment_transactions` table with explicit constraints:

- UUID primary key; unique alphanumeric merchant reference (max 100);
- unique `(user_id, product_type, idempotency_key)` and a request fingerprint;
- user, provider (`vnpay`), product type (`mentorship`/`plus`), VND amount,
  `vnp_amount = amount_vnd * 100`, and a constrained state;
- source currency/amount and the frozen Sandbox FX rate when conversion occurs;
- exactly one product payload: mentor booking link plus preserved
  `help_topic`/`help_questions`/`help_outcome`/`user_university_id`, or immutable
  Plus plan/credits/duration/application inputs;
- VNPay response/transaction identifiers and non-sensitive audit fields;
- created, updated, expiry, paid, and fulfilled timestamps.

RLS permits authenticated users to read only their own rows. Writes and IPN
fulfilment use the service role. Migration presence does not prove deployment;
Sandbox checkout remains disabled until the live schema check confirms the table,
functions, constraints, and policies exist.

The state machine is:

```text
pending -> fulfilled
pending -> failed
pending -> expired
expired/failed -> paid_unfulfilled (late success; manual review/refund)
pending -> paid_unfulfilled (payment received but product invariant failed)
```

`fulfilled` and `paid_unfulfilled` are terminal to automatic processing.
Duplicate callbacks for a terminal transaction return `RspCode=02`. A database
function locks the transaction and relevant profile/slot rows, applies the state
transition, and fulfils in one DB transaction. Plus credits use an atomic
increment; renewal expiry is `max(now, current active expiry) + purchased
duration`, and `plus_subscriptions.payment_transaction_id` is unique. Entitlement
checks require both `plus_status=true` and `plus_expires_at > now`.

Mentor checkout uses one database function to reclaim stale holds, create the
booking and transaction, and bind `mentor_availability_slots.booking_id` while
placing the hold. The hold expiry exactly matches VNPay expiry. Confirmation is
allowed only while the slot is still held by that same booking. A late payment
must become `paid_unfulfilled`; it can never claim a slot held by another user.
Slot listing and checkout both run stale-hold cleanup, and a protected scheduled
cleanup/reconciliation route handles inactivity.

## UI contract

Both flows use one accessible payment-method selector:

- VNPay Sandbox is selected and active, with an explicit Sandbox label.
- Stripe is visible but disabled and labelled "Coming soon".
- Mentor checkout places the selector after the total and uses a
  "Continue with VNPay" action.
- Plus plan actions open the selector. Other displayed currencies remain
  estimates; the selector shows the canonical VND amount VNPay will receive.

Use existing `Modal`, `Radio`, `Badge`, `Button`, tokens, focus behaviour, and
translation helpers. Do not add a new colour/radius/type system.

## Security and reliability

- Read terminal code, hash secret, payment URL, and enabled state from server
  environment variables. Commit placeholders only.
- Compare hashes in constant time and never log secrets, complete signed URLs,
  or raw callback queries.
- Verify checksum, terminal, reference, expected amount, pending state, and both
  `vnp_ResponseCode === '00'` and `vnp_TransactionStatus === '00'` before
  successful fulfilment.
- Scope the client-generated idempotency key to user and product, constrain its
  format/length, and store a fingerprint of immutable request fields. Return the
  same pending checkout only when fingerprints match; otherwise return `409`.
- IPN always returns non-cacheable JSON `{ RspCode, Message }`. It records and
  fulfils before acknowledging. `00` means first processing succeeded; `02`
  means already terminal; other documented codes remain retryable.
- Record follow-up notification state on the payment transaction. Trigger email
  after the response with Next.js supported lifecycle APIs, and let the protected
  reconciliation job retry notification rows so serverless termination cannot
  lose them permanently. Follow-up failure must not roll back payment.
- Treat Return URL parameters as presentation data even after checksum
  verification.
- Return shows no PII and does not require an active auth cookie. Invalid/unknown
  callbacks render an unverified state; a valid return that arrives before IPN
  shows pending and polls briefly, then directs the user to support/status.
- The protected reconciliation route checks stale pending transactions against
  VNPay's transaction-query API and records a terminal manual-review state when
  automatic fulfilment is no longer safe.

## Verification

Implement with test-first red/green cycles:

- unit tests for canonical serialization, HMAC-SHA512, VND x100, locale dates,
  expiry, and response verification;
- checkout tests for auth, validation, server-authoritative prices, missing
  configuration, Sandbox-only host enforcement, FX freezing, full mentorship
  narrative preservation, slot contention, payload-mismatch idempotency, and
  partial checkout rollback;
- IPN tests for bad signature/terminal, unknown reference, amount mismatch,
  duplicate callback, failed payment, and successful fulfilment for each
  product;
- UI tests proving VNPay is active, Stripe is disabled, and successful checkout
  redirects to the returned URL;
- race tests for simultaneous IPNs, simultaneous Plus purchases, stale hold
  reclamation, callback-after-expiry, and a late payment after slot reuse;
- entitlement tests proving expired Plus access is denied and concurrent renewal
  extends from the later of now/current expiry without losing credits;
- targeted Vitest, base and strict typecheck, targeted ESLint, production build,
  and a manual VNPay Sandbox SIT pass when a public callback URL is available.

## Decision log

| Decision | Alternatives | Rationale |
|---|---|---|
| One provider-neutral payment ledger | Per-feature VNPay columns; stateless references | Best auditability, idempotency, and future provider support. |
| Separate VNPay endpoint from Stripe endpoints | Add a provider branch to existing routes | Minimizes conflicts with the developer who owns Stripe. |
| IPN fulfils; Return only displays | Fulfil on browser return | A browser can close or replay the Return URL; VNPay specifies IPN for updates. |
| VNPay charges canonical VND | Charge selected display currency | VNPay PAY supports VND for this integration. |
| Stripe UI is disabled demo | Hide Stripe; keep current Stripe checkout live | Matches the requested ownership split without misleading users. |
| Shared payment-method selector | Two bespoke selectors | Keeps behaviour and accessibility consistent across both products. |

## Structured review objections and resolutions

| Objection | Resolution |
|---|---|
| Mentor prices include USD/GBP but VNPay charges VND | Accepted. Sandbox-only fixed rates are explicit, frozen, displayed, and forbidden for production use. |
| Holds and checkout expiry differed; abandoned holds never reopen | Accepted. One shared expiry, ownership binding, lazy cleanup plus protected scheduled cleanup. |
| Late IPN could steal a reused slot | Accepted. Fulfil only when the held slot still belongs to the same booking; otherwise `paid_unfulfilled`. |
| Plus expiry was advertised but not enforced | Accepted. Entitlement check now includes `plus_expires_at > now`; renewal semantics are defined. |
| Success predicate and IPN response contract were ambiguous | Accepted. Require both VNPay success fields and return non-cacheable `{RspCode, Message}`. |
| Checkout and fulfilment atomic boundaries were vague | Accepted. Product-specific DB functions own checkout creation and fulfilment transactions. |
| Idempotency scope/payload equality were undefined | Accepted. User/product scope plus immutable request fingerprint and `409` on mismatch. |
| Mentor narrative fields could be dropped | Accepted. All existing fields are explicitly preserved. |
| Concurrent Plus purchases could lose credits/expiry | Accepted. Row locking, atomic increment, and renewal-from-later-date semantics. |
| Work after response may be killed | Accepted. Persist follow-up state and retry via protected reconciliation. |
| State transitions and highest-risk race tests were missing | Accepted. State machine and race coverage are explicit. |
| `PLUS_SALES_ENABLED=false` could leave VNPay unreachable | Accepted. Existing flag continues to guard Stripe only; server pages pass separately verified VNPay availability to UI. |
| Provider-neutral model may be YAGNI | Rejected. A single ledger is already shared by two products and prevents reuse of Stripe-named fields; no extra provider abstraction beyond `provider='vnpay'` is planned. |
