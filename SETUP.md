# Glowbal — Developer Setup Guide

## 1. Environment Variables

Add these to your `.env.local` file:

```bash
# ── Supabase (already configured) ──
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# ── OpenAI (for AI personal statement writer) ──
OPENAI_API_KEY=sk-...your-openai-api-key...

# OpenAI model to use (defaults to gpt-4o-mini if not set)
OPENAI_MODEL=gpt-4o-mini
```

### Getting an OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to **API Keys** in the left sidebar
4. Click **Create new secret key**
5. Copy the key and add it to `.env.local` as `OPENAI_API_KEY`
6. Add a payment method under **Billing** (API calls are pay-per-use)

**Cost estimate:** Each personal statement analysis uses ~1,500 tokens input + ~800 tokens output ≈ $0.002 per analysis with `gpt-4o-mini`.

### Alternative: Using Anthropic Claude instead of OpenAI

If you prefer Claude, set these instead:

```bash
ANTHROPIC_API_KEY=sk-ant-...your-key...
AI_PROVIDER=anthropic
```

Then update `src/app/api/ai/analyze-statement/route.ts` to use the Anthropic SDK.

---

## 2. Database Setup

Run the SQL schema in your Supabase project:

1. Open your Supabase Dashboard
2. Go to **SQL Editor** → **New Query**
3. Paste the contents of `sql/supabase-schema.sql`
4. Click **Run**

This creates:
- `universities` — university data (imported from CSV)
- `user_universities` — user's saved/shortlisted universities
- `application_tasks` — per-university application steps
- `task_templates` — reusable task templates (pre-seeded)
- `personal_statements` — AI writer drafts
- Adds `onboarding_completed` column to `student_profiles`

All tables have Row Level Security (RLS) enabled.

---

## 3. Import University Data

After running the schema, import the CSV data:

1. Open Supabase Dashboard → **Table Editor** → `universities`
2. Click **Import data** → **CSV**
3. Upload `public/Universities_Database - Sheet1.csv`
4. Map the CSV columns to the table columns

**Or** use the import API route:
```bash
# With the dev server running:
curl -X POST http://localhost:3000/api/import-universities \
  -H "Authorization: Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY"
```

---

## 4. Supabase Storage Bucket

Ensure the `student-documents` storage bucket exists:

1. Supabase Dashboard → **Storage**
2. Create bucket named `student-documents` (if not already created)
3. Set it to **private** (authenticated access only)
4. Add a storage policy allowing authenticated users to upload to their own folder:

```sql
create policy "Users upload own documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'student-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users read own documents"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'student-documents' and (storage.foldername(name))[1] = auth.uid()::text);
```

---

## 5. Running the App

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

---

## 6. User Flow Summary

1. **Landing page** (`/`) — waitlist or sign-up CTA
2. **Auth** (`/auth`) — sign up / log in (email or Google)
3. **Onboarding** (`/onboarding`) — 7-step profile questionnaire (enforced for new users)
4. **Document upload** (`/onboarding/documents`) — optional CV/SOP upload
5. **University search** (`/universities`) — search with match % scores
6. **My Universities** (`/my-universities`) — saved universities + application roadmap
7. **AI Writer** (`/my-universities/[id]/writer`) — personal statement editor with AI feedback
8. **Profile** (`/profile`) — view/edit profile, documents, achievements


---

## 7. Mentorship Hub Setup (`/mentors`)

The Mentorship Hub adds a real, paid 1:1 booking flow on top of the existing
mentor profiles. To run it end-to-end you need three things in place:

### 7a. Run the migration

In the Supabase SQL Editor, run **`sql/supabase-mentorship.sql`** after the existing
`sql/supabase-global-station.sql` migration. It:

- Adds verification fields (legal name, DoB, CV/transcript/etc. storage keys)
  and multi-currency hourly pricing to `achiever_profiles`.
- Creates a `mentor_availability_slots` table for the calendar-style
  booking flow.
- Extends `bookings` with currency, Stripe IDs, and help-request prompts.
- Adds storage policies for the private `mentor-documents` bucket.

### 7b. Storage buckets

Create two buckets in Supabase → Storage:

| Bucket | Visibility | Used for |
| --- | --- | --- |
| `mentor-documents` | Private | CV, acceptance letter, transcript, student card |
| `avatars` | Public | Mentor profile photos |

The migration installs the right RLS policies; you only need to create the
buckets if they don't exist yet.

### 7c. Stripe configuration

Mentor bookings are charged via Stripe Checkout. Add these to `.env.local`:

```bash
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
NEXT_PUBLIC_SITE_URL=https://your-domain.tld
```

Then register the webhook in the Stripe Dashboard:

- URL: `https://your-domain.tld/api/mentorship/webhook`
- Events: `checkout.session.completed`, `checkout.session.expired`,
  `charge.refunded`

For local development use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/mentorship/webhook
```

The CLI prints a `whsec_…` secret — paste it into `STRIPE_WEBHOOK_SECRET` in
`.env.local`.

### 7d. Optional integrations to wire up

- **Stripe Connect payouts** — `achiever_profiles.stripe_account_id` is
  already in the schema. Add a Connect onboarding flow when you're ready to
  pay mentors automatically; until then, payouts are tracked in the admin
  bookings page and can be transferred manually.
- **Video provider** — defaults to Jitsi Meet (no API key needed). Override
  `MEETING_BASE_URL` in `.env.local` to use your own room namespace, or
  replace `generateMeetingLink` in `src/lib/meetings.ts` with a Zoom / Google
  Meet API integration.
- **Resend** — booking confirmation emails use the same `RESEND_API_KEY`
  that powers the waitlist. If it's missing the webhook still confirms the
  booking and updates the database — emails just get logged and skipped.

### 7e. Founder-confirmed manual bank transfer (not applied by this task)

Apply `sql/supabase-vnpay-payments.sql` first, then the guarded follow-up
`sql/supabase-manual-payment-founder.sql`. Never edit an already-applied migration
in place. This task does not connect to Supabase or send real email.

Keep all of these values server-only in `.env.local`/deployment secrets:

```bash
RESEND_API_KEY=re_xxx
MANUAL_PAYMENT_REVIEWER_USER_IDS=founder-user-uuid
MANUAL_PAYMENT_FOUNDER_EMAIL=founder@example.com
MANUAL_PAYMENT_FROM_EMAIL=payments@your-domain.tld
MANUAL_PAYMENT_REVIEW_SECRET=at-least-32-random-characters
MANUAL_PAYMENT_RECONCILIATION_SECRET=at-least-32-random-characters
MANUAL_PAYMENT_BANK_LABEL=Your bank
MANUAL_PAYMENT_BANK_ACCOUNT_HOLDER=GlowBal Education
MANUAL_PAYMENT_BANK_ACCOUNT_NUMBER=123456789
MANUAL_PAYMENT_BANK_QR_URL=https://your-domain.tld/assets/bank-qr.png
MANUAL_PAYMENT_BANK_QR_REVISION=qr-v1
MANUAL_PAYMENT_EMAIL_SITE_URL=https://glowbal-education.com
NEXT_PUBLIC_SITE_URL=https://your-domain.tld
```

Transactional payment emails use `MANUAL_PAYMENT_EMAIL_SITE_URL`. It accepts
only a public HTTPS origin and defaults to `https://glowbal-education.com`, so
running the app on localhost cannot put a localhost link into founder/student
emails. A review token created against a local database will not exist in the
production database; test the clickable review flow against the same deployed
environment that created the transaction.

Configure a protected scheduler to `POST /api/payments/manual/outbox` with
`Authorization: Bearer $MANUAL_PAYMENT_RECONCILIATION_SECRET`. The checkout
and review routes make an immediate best-effort outbox attempt; the scheduler
is authoritative for retries and failed-job visibility. Run one Sandbox/manual
Plus and one mentorship flow through claim, confirm, reject, expiry, replay,
and late-receipt support review before enabling production sales.

Verification recorded 2026-08-15: the focused manual/VNPay/payment-UI Vitest
suite passed **40/40**; the full suite passed **2,381 tests** with 2 todo tests
under the CI-like 15-second timeout; base and strict TypeScript passed; full
ESLint had 0 errors; and the Next.js 16.3.1 production build generated all
125 pages. These checks used no remote database migration and sent no real
email.

If an earlier SQL Editor run stopped with PostgreSQL `42883` at
`make_interval(minutes => ...)`, pull the corrected migration and run the whole
`sql/supabase-manual-payment-founder.sql` file again. The valid PostgreSQL named
argument is `mins`; the migration is guarded for a complete rerun.

Also rerun the corrected guarded migration if an earlier application created
`lease_manual_payment_notification_jobs` with `tx record; review record;`. The
correct declaration uses `tx jsonb; review jsonb;`; runtime compatibility can
deliver old wrapped jobs, but replacing the database function prevents future
`"?column?"` wrappers at the source.

Rerun the guarded migration after updating to the one-founder-email flow. It
replaces checkout so only `student_instructions` is queued initially, retires
unsent legacy `founder_review` jobs, and keeps the single actionable
`founder_claimed` email for when the student reports the transfer.
