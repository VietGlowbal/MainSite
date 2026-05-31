# Newsletter System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GLOWBAL NEWSLETTER SYSTEM                    │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   User Visits    │         │   Admin Creates  │         │  User Wants to   │
│  News/Guides     │         │   New Content    │         │   Unsubscribe    │
│      Page        │         │                  │         │                  │
└────────┬─────────┘         └────────┬─────────┘         └────────┬─────────┘
         │                            │                            │
         ▼                            ▼                            ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Newsletter Box  │         │  Run CLI Script  │         │ Unsubscribe Page │
│  - Email Input   │         │  notify-         │         │  - Email Input   │
│  - Subscribe Btn │         │  newsletter      │         │  - Confirm Btn   │
└────────┬─────────┘         └────────┬─────────┘         └────────┬─────────┘
         │                            │                            │
         │ POST /api/newsletter/      │ POST /api/newsletter/      │ POST /api/newsletter/
         │      subscribe             │      notify                │      unsubscribe
         │                            │                            │
         ▼                            ▼                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API ROUTES (Next.js)                         │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐       │
│  │   subscribe    │  │     notify     │  │  unsubscribe   │       │
│  │   route.ts     │  │   route.ts     │  │   route.ts     │       │
│  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘       │
│          │                   │                    │                 │
└──────────┼───────────────────┼────────────────────┼─────────────────┘
           │                   │                    │
           ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPABASE DATABASE                            │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  newsletter_subscriptions                                     │  │
│  │  ─────────────────────────────────────────────────────────   │  │
│  │  id | email | first_name | status | source | subscribed_at   │  │
│  │  ─────────────────────────────────────────────────────────   │  │
│  │  1  | user@example.com | John | active | news_page | ...     │  │
│  │  2  | jane@example.com | Jane | active | guides_page | ...   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  newsletter_content_sent                                      │  │
│  │  ─────────────────────────────────────────────────────────   │  │
│  │  id | content_type | content_slug | sent_at | recipient_count│  │
│  │  ─────────────────────────────────────────────────────────   │  │
│  │  1  | guide | uk-study-guide | 2027-05-31 | 150             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
           │                   │                    │
           ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         RESEND EMAIL API                             │
│                                                                      │
│  ┌────────────────┐                    ┌────────────────┐          │
│  │ Welcome Email  │                    │ Content Email  │          │
│  │ ─────────────  │                    │ ─────────────  │          │
│  │ • Greeting     │                    │ • New Content  │          │
│  │ • What to      │                    │ • Title        │          │
│  │   expect       │                    │ • Excerpt      │          │
│  │ • Unsubscribe  │                    │ • CTA Button   │          │
│  └────────────────┘                    └────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
           │                                      │
           ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         USER'S INBOX                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### 1. Subscription Flow

```
User                    Frontend                API                 Database              Email
  │                        │                     │                      │                    │
  ├─ Enters email ────────>│                     │                      │                    │
  │                        │                     │                      │                    │
  ├─ Clicks Subscribe ────>│                     │                      │                    │
  │                        │                     │                      │                    │
  │                        ├─ POST /subscribe ──>│                      │                    │
  │                        │                     │                      │                    │
  │                        │                     ├─ Check if exists ───>│                    │
  │                        │                     │<─ Return result ─────┤                    │
  │                        │                     │                      │                    │
  │                        │                     ├─ Insert/Update ─────>│                    │
  │                        │                     │<─ Success ───────────┤                    │
  │                        │                     │                      │                    │
  │                        │                     ├─ Send welcome email ─────────────────────>│
  │                        │                     │                      │                    │
  │                        │<─ Success response ─┤                      │                    │
  │                        │                     │                      │                    │
  │<─ Show success msg ────┤                     │                      │                    │
  │                        │                     │                      │                    │
  │<─────────────────────────────────────────────────────────────── Welcome email ──────────┤
```

### 2. Newsletter Send Flow

```
Admin                   CLI Script              API                 Database              Email
  │                        │                     │                      │                    │
  ├─ Publishes content ───>│                     │                      │                    │
  │                        │                     │                      │                    │
  ├─ Runs notify script ──>│                     │                      │                    │
  │                        │                     │                      │                    │
  │                        ├─ POST /notify ─────>│                      │                    │
  │                        │   (with auth token) │                      │                    │
  │                        │                     │                      │                    │
  │                        │                     ├─ Check if sent ─────>│                    │
  │                        │                     │<─ Not sent ──────────┤                    │
  │                        │                     │                      │                    │
  │                        │                     ├─ Get subscribers ───>│                    │
  │                        │                     │<─ Return list ───────┤                    │
  │                        │                     │                      │                    │
  │                        │                     ├─ Send to each subscriber ────────────────>│
  │                        │                     │                      │                    │
  │                        │                     ├─ Record as sent ────>│                    │
  │                        │                     │<─ Success ───────────┤                    │
  │                        │                     │                      │                    │
  │                        │<─ Success + stats ──┤                      │                    │
  │                        │                     │                      │                    │
  │<─ Show results ────────┤                     │                      │                    │
```

### 3. Unsubscribe Flow

```
User                    Frontend                API                 Database
  │                        │                     │                      │
  ├─ Clicks link in email >│                     │                      │
  │                        │                     │                      │
  ├─ Lands on page ───────>│                     │                      │
  │   (email pre-filled)   │                     │                      │
  │                        │                     │                      │
  ├─ Clicks Unsubscribe ──>│                     │                      │
  │                        │                     │                      │
  │                        ├─ POST /unsubscribe >│                      │
  │                        │                     │                      │
  │                        │                     ├─ Update status ─────>│
  │                        │                     │   (set unsubscribed) │
  │                        │                     │<─ Success ───────────┤
  │                        │                     │                      │
  │                        │<─ Success response ─┤                      │
  │                        │                     │                      │
  │<─ Show confirmation ───┤                     │                      │
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND COMPONENTS                          │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  News Page (/news)                                                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  NewsPageClient                                                 │ │
│  │  ├─ Featured Article                                            │ │
│  │  ├─ Latest Articles Grid                                        │ │
│  │  └─ Sidebar                                                     │ │
│  │      ├─ Trending Topics                                         │ │
│  │      └─ NewsletterCard ◄─── SUBSCRIPTION COMPONENT              │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  Guides Page (/guides)                                               │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  GuidesClient                                                   │ │
│  │  ├─ Topic Filters                                               │ │
│  │  ├─ Guides Grid                                                 │ │
│  │  └─ Sidebar                                                     │ │
│  │      ├─ Popular Topics                                          │ │
│  │      └─ Newsletter Form ◄─── SUBSCRIPTION COMPONENT             │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  Unsubscribe Page (/newsletter/unsubscribe)                          │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  UnsubscribePage                                                │ │
│  │  ├─ Email Input (pre-filled from URL param)                    │ │
│  │  ├─ Unsubscribe Button                                         │ │
│  │  └─ Confirmation Message                                        │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

## API Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         API ROUTES                                   │
└─────────────────────────────────────────────────────────────────────┘

/api/newsletter/subscribe
├─ Validates email
├─ Checks for existing subscription
├─ Creates or reactivates subscription
├─ Sends welcome email
└─ Returns success/error

/api/newsletter/unsubscribe
├─ Validates email
├─ Updates status to 'unsubscribed'
├─ Sets unsubscribed_at timestamp
└─ Returns success/error

/api/newsletter/notify
├─ Validates authorization token
├─ Checks if content already sent
├─ Fetches active subscribers
├─ Sends email to each subscriber
├─ Records content as sent
├─ Updates last_email_sent
└─ Returns stats (total, success, failed)
```

## Database Schema

```
┌─────────────────────────────────────────────────────────────────────┐
│  newsletter_subscriptions                                            │
├─────────────────────────────────────────────────────────────────────┤
│  id              BIGSERIAL PRIMARY KEY                               │
│  email           TEXT UNIQUE NOT NULL                                │
│  first_name      TEXT                                                │
│  status          TEXT ('active' | 'unsubscribed')                    │
│  source          TEXT (e.g., 'news_page', 'guides_page')             │
│  subscribed_at   TIMESTAMPTZ                                         │
│  unsubscribed_at TIMESTAMPTZ                                         │
│  last_email_sent TIMESTAMPTZ                                         │
│  topics          TEXT[] (future use)                                 │
│  frequency       TEXT (future use)                                   │
│  created_at      TIMESTAMPTZ                                         │
│  updated_at      TIMESTAMPTZ                                         │
├─────────────────────────────────────────────────────────────────────┤
│  Indexes:                                                            │
│  - idx_newsletter_subscriptions_email (email)                        │
│  - idx_newsletter_subscriptions_status (status)                      │
├─────────────────────────────────────────────────────────────────────┤
│  RLS: Service role full access                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  newsletter_content_sent                                             │
├─────────────────────────────────────────────────────────────────────┤
│  id              BIGSERIAL PRIMARY KEY                               │
│  content_type    TEXT ('guide' | 'news')                             │
│  content_slug    TEXT                                                │
│  content_title   TEXT                                                │
│  sent_at         TIMESTAMPTZ                                         │
│  recipient_count INT                                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Constraints:                                                        │
│  - UNIQUE(content_type, content_slug)                                │
├─────────────────────────────────────────────────────────────────────┤
│  RLS: Service role full access                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Security Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SECURITY LAYERS                              │
└─────────────────────────────────────────────────────────────────────┘

1. Database Level (Supabase)
   ├─ Row Level Security (RLS) enabled
   ├─ Service role required for all operations
   └─ Unique constraints prevent duplicates

2. API Level (Next.js)
   ├─ Email validation on all inputs
   ├─ Authorization token for notify endpoint
   ├─ Rate limiting via Resend
   └─ Error handling and logging

3. Email Level (Resend)
   ├─ Domain verification required
   ├─ API key authentication
   ├─ Delivery tracking
   └─ Bounce/complaint handling
```

## Integration Points

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                            │
└─────────────────────────────────────────────────────────────────────┘

Supabase
├─ Database storage
├─ RLS policies
└─ Service role authentication

Resend
├─ Email delivery
├─ Template rendering
├─ Delivery tracking
└─ Bounce handling

Next.js
├─ API routes
├─ Server components
├─ Client components
└─ Environment variables
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DEPLOYMENT FLOW                              │
└─────────────────────────────────────────────────────────────────────┘

Development
├─ Local Next.js server
├─ Local environment variables
└─ Test Resend account

Staging
├─ Vercel preview deployment
├─ Staging Supabase project
└─ Test Resend account

Production
├─ Vercel production deployment
├─ Production Supabase project
├─ Production Resend account
└─ GitHub Actions (optional automation)
```

## Monitoring & Analytics

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MONITORING POINTS                            │
└─────────────────────────────────────────────────────────────────────┘

Database Metrics
├─ Total subscribers (active/unsubscribed)
├─ Subscription rate by source
├─ Unsubscribe rate
└─ Growth over time

Email Metrics (via Resend)
├─ Delivery rate
├─ Open rate
├─ Click-through rate
├─ Bounce rate
└─ Complaint rate

API Metrics
├─ Subscription success rate
├─ Newsletter send success rate
├─ Error rates
└─ Response times
```
