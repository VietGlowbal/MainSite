# 📧 Glowbal Newsletter System

A complete, production-ready newsletter/mailing list system for Glowbal that allows users to subscribe to updates and receive email notifications when new guides or articles are published.

## 🎯 What It Does

- **User Subscriptions**: Users can subscribe from News and Guides pages
- **Welcome Emails**: Automatic welcome email sent on subscription
- **Content Notifications**: Send newsletters when publishing new content
- **Unsubscribe**: Easy one-click unsubscribe functionality
- **Tracking**: Full tracking of subscribers and sent content in Supabase
- **Beautiful Emails**: Professional HTML email templates with Glowbal branding

## 🚀 Quick Start

### 1. Setup (5 minutes)

```bash
# 1. Run database migration in Supabase SQL Editor
# Copy contents of supabase-newsletter.sql and run it

# 2. Add environment variable to .env.local
NEWSLETTER_NOTIFY_SECRET=$(openssl rand -base64 32)

# 3. Test locally
npm run dev
# Visit http://localhost:3000/news and try subscribing
```

### 2. Send Your First Newsletter

```bash
npm run notify-newsletter -- \
  --type guide \
  --slug "your-guide-slug" \
  --title "Your Guide Title" \
  --url "https://glowbal.com/guides/your-guide-slug"
```

### 3. Deploy

```bash
git add .
git commit -m "feat: Add newsletter system"
git push origin main
# Add NEWSLETTER_NOTIFY_SECRET to production env vars
# Run supabase-newsletter.sql in production Supabase
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[NEWSLETTER_QUICKSTART.md](./NEWSLETTER_QUICKSTART.md)** | 5-minute setup guide |
| **[NEWSLETTER_SYSTEM.md](./NEWSLETTER_SYSTEM.md)** | Complete system documentation |
| **[NEWSLETTER_ARCHITECTURE.md](./NEWSLETTER_ARCHITECTURE.md)** | System architecture and diagrams |
| **[NEWSLETTER_DEPLOYMENT_CHECKLIST.md](./NEWSLETTER_DEPLOYMENT_CHECKLIST.md)** | Step-by-step deployment guide |
| **[NEWSLETTER_IMPLEMENTATION_SUMMARY.md](./NEWSLETTER_IMPLEMENTATION_SUMMARY.md)** | What was built and how |

## 📁 Files Overview

### Database
- `supabase-newsletter.sql` - Database schema and migrations

### API Routes
- `src/app/api/newsletter/subscribe/route.ts` - Handle subscriptions
- `src/app/api/newsletter/unsubscribe/route.ts` - Handle unsubscriptions
- `src/app/api/newsletter/notify/route.ts` - Send newsletters

### Pages
- `src/app/newsletter/unsubscribe/page.tsx` - Unsubscribe page

### Components (Updated)
- `src/components/news/news-page-client.tsx` - NewsletterCard with working subscription
- `src/app/guides/guides-client.tsx` - Newsletter form with working subscription

### Scripts
- `scripts/notify-newsletter.ts` - CLI tool to send newsletters

### Automation (Optional)
- `.github/workflows/newsletter-automation-example.yml.disabled` - GitHub Actions example

## 🎨 User Experience

### Subscription Flow
1. User visits News or Guides page
2. Sees "Stay updated" box in sidebar
3. Enters email and clicks Subscribe
4. Receives instant welcome email
5. Gets notified when new content is published

### Newsletter Email
- Eye-catching header with emoji (📚 for guides, 📰 for news)
- Content title and excerpt
- Call-to-action button to read content
- Personalized greeting
- Easy unsubscribe link

## 🔧 Usage Examples

### Subscribe a User (Automatic via UI)
Users subscribe through the UI on News/Guides pages. The system:
- Validates email
- Checks for duplicates
- Sends welcome email
- Stores in Supabase

### Send Newsletter (Manual via CLI)
```bash
# For a new guide
npm run notify-newsletter -- \
  --type guide \
  --slug "uk-study-guide-2027" \
  --title "Complete UK Study Guide for 2027" \
  --url "https://glowbal.com/guides/uk-study-guide-2027" \
  --excerpt "Everything you need to know about studying in the UK"

# For a news article
npm run notify-newsletter -- \
  --type news \
  --slug "new-scholarships-2027" \
  --title "New Scholarships Available for 2027" \
  --url "https://glowbal.com/news/new-scholarships-2027"
```

### Unsubscribe (Automatic via UI)
Users click unsubscribe link in any email or visit:
```
https://glowbal.com/newsletter/unsubscribe?email=user@example.com
```

## 📊 Database Schema

### newsletter_subscriptions
Stores all subscribers with their preferences and status.

```sql
SELECT email, status, source, subscribed_at 
FROM newsletter_subscriptions 
WHERE status = 'active';
```

### newsletter_content_sent
Tracks which content has been sent to prevent duplicates.

```sql
SELECT content_type, content_title, recipient_count, sent_at 
FROM newsletter_content_sent 
ORDER BY sent_at DESC;
```

## 🔐 Security

- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Service role authentication required
- ✅ Authorization token for newsletter sending
- ✅ Email validation on all inputs
- ✅ Duplicate prevention via unique constraints
- ✅ Rate limiting via Resend

## 🎯 Features

### Current Features
- ✅ Email subscription from News/Guides pages
- ✅ Welcome email on subscription
- ✅ Newsletter sending via CLI
- ✅ Unsubscribe functionality
- ✅ Duplicate prevention
- ✅ Source tracking
- ✅ Beautiful HTML emails
- ✅ Supabase integration
- ✅ Resend email integration

### Future Enhancements
- [ ] Topic preferences (scholarships, guides, news)
- [ ] Frequency preferences (immediate, daily, weekly)
- [ ] Admin dashboard
- [ ] Email analytics
- [ ] A/B testing
- [ ] Subscriber segmentation
- [ ] Automated digest emails
- [ ] RSS feed integration

## 🐛 Troubleshooting

### Emails Not Sending
1. Check `RESEND_API_KEY` in environment variables
2. Verify domain is verified in Resend dashboard
3. Check Resend logs for errors

### Subscriptions Not Saving
1. Verify database migration ran successfully
2. Check `SUPABASE_SERVICE_ROLE_KEY` is correct
3. Review API logs for errors

### Newsletter Already Sent
This is expected behavior - the system prevents duplicate sends. Each content_type + slug combination can only be sent once.

## 📈 Monitoring

### Key Metrics
- Total active subscribers
- Subscription rate by source
- Unsubscribe rate
- Email delivery rate
- Open rates (via Resend)
- Click-through rates (via Resend)

### Useful Queries

**Active subscribers:**
```sql
SELECT COUNT(*) FROM newsletter_subscriptions WHERE status = 'active';
```

**Recent subscriptions:**
```sql
SELECT email, source, subscribed_at 
FROM newsletter_subscriptions 
ORDER BY subscribed_at DESC 
LIMIT 10;
```

**Newsletter performance:**
```sql
SELECT content_type, content_title, recipient_count, sent_at 
FROM newsletter_content_sent 
ORDER BY sent_at DESC;
```

## 🤝 Contributing

When adding new features:
1. Update database schema if needed
2. Add API routes for new functionality
3. Update UI components
4. Add tests
5. Update documentation

## 📞 Support

For issues or questions:
1. Check the [Quick Start Guide](./NEWSLETTER_QUICKSTART.md)
2. Review [Full Documentation](./NEWSLETTER_SYSTEM.md)
3. Check [Deployment Checklist](./NEWSLETTER_DEPLOYMENT_CHECKLIST.md)
4. Review Resend and Supabase dashboards

## 📄 License

Part of the Glowbal project.

---

**Ready to get started?** Check out the [Quick Start Guide](./NEWSLETTER_QUICKSTART.md)! 🚀
