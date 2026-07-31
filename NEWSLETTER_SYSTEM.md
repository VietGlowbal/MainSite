# Newsletter System Documentation

## Overview

The Glowbal newsletter system allows users to subscribe to updates about new guides and articles. When new content is published, subscribers receive email notifications via Resend.

## Features

- ✅ Newsletter subscription on News and Guides pages
- ✅ Email validation and duplicate prevention
- ✅ Welcome email on subscription
- ✅ Unsubscribe functionality
- ✅ Automated email notifications for new content
- ✅ Tracking of sent content to prevent duplicates
- ✅ Beautiful HTML email templates

## Database Schema

### `newsletter_subscriptions`

Stores all newsletter subscribers.

```sql
- id: bigserial (primary key)
- email: text (unique, required)
- first_name: text (optional)
- status: text ('active' | 'unsubscribed')
- source: text (tracks where they subscribed from)
- subscribed_at: timestamptz
- unsubscribed_at: timestamptz
- last_email_sent: timestamptz
- topics: text[] (for future topic preferences)
- frequency: text ('immediate' | 'daily' | 'weekly')
- created_at: timestamptz
- updated_at: timestamptz
```

### `newsletter_content_sent`

Tracks which content has been sent to prevent duplicate notifications.

```sql
- id: bigserial (primary key)
- content_type: text ('guide' | 'news')
- content_slug: text (unique with content_type)
- content_title: text
- sent_at: timestamptz
- recipient_count: int
```

## Setup

### 1. Run Database Migration

```bash
# Connect to your Supabase project and run:
psql -h your-db-host -U postgres -d postgres -f supabase-newsletter.sql
```

Or use the Supabase SQL Editor to run the contents of `supabase-newsletter.sql`.

### 2. Environment Variables

Add to your `.env.local`:

```env
# Already required for other features
RESEND_API_KEY=re_your_api_key
WAITLIST_FROM_EMAIL=hello@glowbal.com
NEXT_PUBLIC_SITE_URL=https://glowbal.com

# New for newsletter system
NEWSLETTER_NOTIFY_SECRET=your-secret-token-here
```

Generate a secure secret for `NEWSLETTER_NOTIFY_SECRET`:

```bash
openssl rand -base64 32
```

### 3. Verify Resend Setup

Make sure your Resend account is configured:
1. Sign up at [resend.com](https://resend.com)
2. Verify your sending domain
3. Get your API key from the dashboard

## Usage

### User Subscription Flow

Users can subscribe from:
- News page sidebar (NewsletterCard component)
- Guides listing page sidebar
- Individual guide pages sidebar

The subscription process:
1. User enters email
2. System checks for existing subscription
3. If new: creates subscription and sends welcome email
4. If existing active: shows "already subscribed" message
5. If previously unsubscribed: reactivates subscription

### Sending Newsletter Notifications

When you publish new content, notify subscribers using the script:

```bash
# For a new guide
npm run notify-newsletter -- \
  --type guide \
  --slug "uk-study-guide-2027" \
  --title "Complete UK Study Guide for 2027" \
  --url "https://glowbal.com/news/uk-study-guide-2027" \
  --excerpt "Everything you need to know about studying in the UK"

# For a news article
npm run notify-newsletter -- \
  --type news \
  --slug "new-scholarships-2027" \
  --title "New Scholarships Available for 2027" \
  --url "https://glowbal.com/news/new-scholarships-2027"
```

The script will:
- Check if this content was already sent
- Fetch all active subscribers
- Send personalized emails to each subscriber
- Track the content as sent
- Report success/failure counts

### Unsubscribe Flow

Users can unsubscribe via:
- Link in any newsletter email: `/newsletter/unsubscribe?email=user@example.com`
- Direct visit to unsubscribe page

## API Endpoints

### POST `/api/newsletter/subscribe`

Subscribe a user to the newsletter.

**Request:**
```json
{
  "email": "user@example.com",
  "firstName": "John",
  "source": "news_page"
}
```

**Response:**
```json
{
  "message": "Successfully subscribed to newsletter",
  "success": true
}
```

### POST `/api/newsletter/unsubscribe`

Unsubscribe a user from the newsletter.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "Successfully unsubscribed",
  "success": true
}
```

### POST `/api/newsletter/notify`

Send newsletter to all active subscribers (requires authorization).

**Headers:**
```
Authorization: Bearer your-secret-token
```

**Request:**
```json
{
  "contentType": "guide",
  "contentSlug": "uk-study-guide",
  "contentTitle": "UK Study Guide",
  "contentUrl": "https://glowbal.com/news/uk-study-guide",
  "contentExcerpt": "Optional excerpt text"
}
```

**Response:**
```json
{
  "message": "Newsletter sent successfully",
  "totalSubscribers": 150,
  "successCount": 148,
  "failedCount": 2
}
```

## Email Templates

### Welcome Email

Sent immediately after subscription:
- Welcomes the user
- Explains what they'll receive
- Provides unsubscribe link
- Branded with Glowbal colors

### Content Notification Email

Sent when new content is published:
- Eye-catching header with emoji (📚 for guides, 📰 for news)
- Content title and excerpt
- Call-to-action button to read content
- Personalized greeting if first name available
- Unsubscribe link in footer

## Automation Ideas

### GitHub Actions

Add to `.github/workflows/notify-newsletter.yml`:

```yaml
name: Notify Newsletter on New Content

on:
  push:
    paths:
      - 'content/geo/drafts/*.md'
    branches:
      - main

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - name: Send Newsletter
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          NEWSLETTER_NOTIFY_SECRET: ${{ secrets.NEWSLETTER_NOTIFY_SECRET }}
        run: |
          # Extract slug and title from new file
          # Run notify-newsletter script
```

### Manual Trigger

You can also trigger notifications manually from your admin panel or via API call:

```bash
curl -X POST https://glowbal.com/api/newsletter/notify \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "contentType": "guide",
    "contentSlug": "uk-study-guide",
    "contentTitle": "UK Study Guide",
    "contentUrl": "https://glowbal.com/news/uk-study-guide"
  }'
```

## Monitoring

### Check Subscriber Count

```sql
SELECT 
  status,
  COUNT(*) as count
FROM newsletter_subscriptions
GROUP BY status;
```

### Recent Subscriptions

```sql
SELECT 
  email,
  first_name,
  source,
  subscribed_at
FROM newsletter_subscriptions
WHERE status = 'active'
ORDER BY subscribed_at DESC
LIMIT 10;
```

### Newsletter Performance

```sql
SELECT 
  content_type,
  content_title,
  recipient_count,
  sent_at
FROM newsletter_content_sent
ORDER BY sent_at DESC
LIMIT 10;
```

## Future Enhancements

- [ ] Topic preferences (scholarships, guides, news, etc.)
- [ ] Frequency preferences (immediate, daily digest, weekly digest)
- [ ] A/B testing for email subject lines
- [ ] Analytics tracking (open rates, click rates)
- [ ] Admin dashboard for managing subscribers
- [ ] Segment subscribers by interests or location
- [ ] RSS feed integration
- [ ] Double opt-in confirmation

## Troubleshooting

### Emails Not Sending

1. Check Resend API key is valid
2. Verify domain is verified in Resend
3. Check Resend dashboard for error logs
4. Ensure `WAITLIST_FROM_EMAIL` matches verified domain

### Duplicate Subscriptions

The system prevents duplicates via unique constraint on email. If a user tries to subscribe twice, they'll see "Already subscribed" message.

### Newsletter Not Received

1. Check spam folder
2. Verify email in `newsletter_subscriptions` table
3. Check `newsletter_content_sent` to confirm it was sent
4. Review Resend logs for delivery status

## Support

For issues or questions, contact the development team or check the Resend documentation at [resend.com/docs](https://resend.com/docs).
