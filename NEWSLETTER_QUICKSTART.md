# Newsletter System - Quick Start Guide

## 🚀 Setup (5 minutes)

### Step 1: Run Database Migration

Open your Supabase SQL Editor and run:

```bash
# Copy the contents of supabase-newsletter.sql and paste into Supabase SQL Editor
# Or use psql:
psql -h your-db-host -U postgres -d postgres -f supabase-newsletter.sql
```

### Step 2: Add Environment Variable

Add to your `.env.local`:

```env
NEWSLETTER_NOTIFY_SECRET=your-secret-token-here
```

Generate a secure token:
```bash
openssl rand -base64 32
```

### Step 3: Deploy

```bash
npm run build
# Deploy to your hosting platform
```

## ✅ What's Working Now

### User-Facing Features

1. **Newsletter Subscription Box** - Live on:
   - `/news` page (sidebar)
   - `/guides` page (sidebar)
   - `/guides/[slug]` pages (sidebar)

2. **Subscription Flow**:
   - User enters email → clicks Subscribe
   - Receives welcome email immediately
   - Email stored in Supabase `newsletter_subscriptions` table

3. **Unsubscribe Page**:
   - Visit `/newsletter/unsubscribe?email=user@example.com`
   - Or click unsubscribe link in any newsletter email

### Admin Features

**Send Newsletter When Publishing New Content:**

```bash
# For a new guide
npm run notify-newsletter -- \
  --type guide \
  --slug "your-guide-slug" \
  --title "Your Guide Title" \
  --url "https://glowbal.com/guides/your-guide-slug"

# For a news article  
npm run notify-newsletter -- \
  --type news \
  --slug "your-news-slug" \
  --title "Your News Title" \
  --url "https://glowbal.com/news/your-news-slug"
```

## 📧 Email Examples

### Welcome Email
Sent automatically when user subscribes:
- Branded header with gradient
- Welcome message
- What to expect
- Unsubscribe link

### Content Notification
Sent when you run notify-newsletter:
- Eye-catching emoji header (📚 or 📰)
- Content title and excerpt
- "Read Guide/Article" button
- Personalized if first name provided
- Unsubscribe link

## 🔍 Verify It's Working

### Test Subscription

1. Go to `http://localhost:3000/news`
2. Scroll to sidebar
3. Enter your email in "Stay updated" box
4. Click Subscribe
5. Check your email for welcome message
6. Check Supabase: `newsletter_subscriptions` table should have your email

### Test Newsletter Send

```bash
npm run notify-newsletter -- \
  --type guide \
  --slug "test-guide" \
  --title "Test Guide" \
  --url "https://glowbal.com/guides/test-guide"
```

Check your email - you should receive the newsletter!

### Test Unsubscribe

1. Go to `/newsletter/unsubscribe?email=your@email.com`
2. Click Unsubscribe
3. Check Supabase: your status should be 'unsubscribed'

## 📊 Monitor Subscribers

### View All Subscribers

```sql
SELECT email, first_name, status, source, subscribed_at
FROM newsletter_subscriptions
ORDER BY subscribed_at DESC;
```

### Count Active Subscribers

```sql
SELECT COUNT(*) as active_subscribers
FROM newsletter_subscriptions
WHERE status = 'active';
```

### See Newsletter History

```sql
SELECT content_type, content_title, recipient_count, sent_at
FROM newsletter_content_sent
ORDER BY sent_at DESC;
```

## 🎯 Next Steps

1. **Test the flow** with your own email
2. **Customize email templates** in `/src/app/api/newsletter/subscribe/route.ts` and `/src/app/api/newsletter/notify/route.ts`
3. **Set up automation** - add to your content publishing workflow
4. **Monitor performance** - check Resend dashboard for delivery stats

## 🐛 Troubleshooting

**Emails not sending?**
- Check `RESEND_API_KEY` in `.env.local`
- Verify domain in Resend dashboard
- Check Resend logs for errors

**"Already subscribed" message?**
- This is normal if email already exists
- Check `newsletter_subscriptions` table

**Newsletter sent twice?**
- System prevents this via `newsletter_content_sent` table
- Each content_type + slug combination can only be sent once

## 📚 Full Documentation

See `NEWSLETTER_SYSTEM.md` for complete documentation including:
- API endpoint details
- Database schema
- Automation ideas
- Future enhancements
