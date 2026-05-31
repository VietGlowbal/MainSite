# Newsletter System - User Guide

## For End Users (Students)

### How to Subscribe

#### On the News Page

1. Visit the **News** page at `/news`
2. Look for the **"Stay updated"** box in the sidebar
3. Enter your email address
4. Click the **Subscribe** button
5. Check your email for a welcome message!

#### On the Guides Page

1. Visit the **Guides** page at `/guides`
2. Scroll to the sidebar
3. Find the **"Stay updated"** section
4. Enter your email address
5. Click **Subscribe**
6. Check your email for confirmation!

### What You'll Receive

After subscribing, you'll get:

1. **Welcome Email** (immediately)
   - Confirmation of your subscription
   - What to expect from our newsletter
   - How to unsubscribe if needed

2. **New Content Notifications** (when published)
   - New study abroad guides
   - Scholarship opportunities
   - University application tips
   - Success stories

### How to Unsubscribe

#### From Any Newsletter Email

1. Scroll to the bottom of any newsletter email
2. Click the **"Unsubscribe"** link
3. You'll be taken to a confirmation page
4. Click **Unsubscribe** to confirm
5. You're done! No more emails from us.

#### Direct Unsubscribe Page

1. Visit `/newsletter/unsubscribe`
2. Enter your email address
3. Click **Unsubscribe**
4. Confirmation message will appear

### Privacy & Data

- We only store your email address (and first name if provided)
- We track when you subscribed and from which page
- We never share your email with third parties
- You can unsubscribe at any time
- Your data is stored securely in Supabase

---

## For Admins (Glowbal Team)

### How to Send a Newsletter

When you publish new content (guide or news article), notify subscribers:

#### Step 1: Prepare Content Information

You'll need:
- Content type: `guide` or `news`
- Content slug: URL-friendly identifier (e.g., `uk-study-guide-2027`)
- Content title: Full title of the content
- Content URL: Full URL to the content
- Content excerpt (optional): Brief description

#### Step 2: Run the Notify Script

Open your terminal and run:

```bash
npm run notify-newsletter -- \
  --type guide \
  --slug "uk-study-guide-2027" \
  --title "Complete UK Study Guide for 2027" \
  --url "https://glowbal.com/guides/uk-study-guide-2027" \
  --excerpt "Everything you need to know about studying in the UK"
```

#### Step 3: Review Results

The script will output:
```
📧 Notifying newsletter subscribers...
   Type: guide
   Slug: uk-study-guide-2027
   Title: Complete UK Study Guide for 2027
   URL: https://glowbal.com/guides/uk-study-guide-2027
✅ Newsletter sent successfully!
   Total subscribers: 150
   Successfully sent: 148
   Failed: 2
```

### Newsletter Best Practices

#### When to Send

✅ **Do send for:**
- New comprehensive guides
- Major news announcements
- Scholarship opportunities
- Important deadlines
- Success stories

❌ **Don't send for:**
- Minor content updates
- Small corrections
- Internal changes
- Test content

#### Frequency

- **Recommended**: 1-2 newsletters per week maximum
- **Avoid**: Sending multiple newsletters in one day
- **Consider**: User preferences (future feature)

#### Content Quality

Before sending, ensure:
- Content is published and accessible
- URL is correct and working
- Title is clear and compelling
- Excerpt is engaging (if provided)
- Content provides real value

### Managing Subscribers

#### View All Subscribers

```sql
-- In Supabase SQL Editor
SELECT 
  email,
  first_name,
  status,
  source,
  subscribed_at
FROM newsletter_subscriptions
ORDER BY subscribed_at DESC;
```

#### Count Active Subscribers

```sql
SELECT 
  COUNT(*) as total_active
FROM newsletter_subscriptions
WHERE status = 'active';
```

#### Subscribers by Source

```sql
SELECT 
  source,
  COUNT(*) as count
FROM newsletter_subscriptions
WHERE status = 'active'
GROUP BY source
ORDER BY count DESC;
```

#### Recent Unsubscribes

```sql
SELECT 
  email,
  unsubscribed_at
FROM newsletter_subscriptions
WHERE status = 'unsubscribed'
ORDER BY unsubscribed_at DESC
LIMIT 10;
```

### Newsletter History

#### View Sent Newsletters

```sql
SELECT 
  content_type,
  content_title,
  recipient_count,
  sent_at
FROM newsletter_content_sent
ORDER BY sent_at DESC;
```

#### Check if Content Was Sent

```sql
SELECT * 
FROM newsletter_content_sent
WHERE content_type = 'guide' 
  AND content_slug = 'uk-study-guide-2027';
```

### Monitoring Email Performance

#### In Resend Dashboard

1. Log into [resend.com](https://resend.com)
2. Go to **Emails** section
3. View metrics:
   - Delivery rate
   - Open rate
   - Click rate
   - Bounce rate
   - Complaint rate

#### Key Metrics to Watch

- **Delivery Rate**: Should be >95%
- **Open Rate**: Aim for >20%
- **Click Rate**: Aim for >5%
- **Unsubscribe Rate**: Keep <2%
- **Bounce Rate**: Keep <5%

### Troubleshooting

#### "Content already sent" Message

This is normal! The system prevents duplicate sends. If you need to resend:
1. Delete the record from `newsletter_content_sent` table
2. Run the notify script again

```sql
DELETE FROM newsletter_content_sent
WHERE content_type = 'guide' 
  AND content_slug = 'uk-study-guide-2027';
```

#### Emails Not Delivering

1. Check Resend dashboard for errors
2. Verify domain is verified
3. Check API key is valid
4. Review bounce/complaint reports

#### Low Open Rates

Try:
- More compelling subject lines
- Better timing (Tuesday-Thursday, 10am-2pm)
- Shorter, more focused content
- Better preview text
- A/B testing (future feature)

#### High Unsubscribe Rate

Consider:
- Reducing frequency
- Improving content quality
- Adding topic preferences (future feature)
- Surveying unsubscribers

### Email Template Customization

To customize email templates, edit:

**Welcome Email:**
- File: `src/app/api/newsletter/subscribe/route.ts`
- Look for the `sendEmail` call
- Modify the HTML template

**Content Notification Email:**
- File: `src/app/api/newsletter/notify/route.ts`
- Look for the `sendEmail` calls in the loop
- Modify the HTML template

### Automation Options

#### Manual (Current)

Run the notify script each time you publish content.

#### Semi-Automated

Add to your content publishing workflow:
```bash
# After publishing content
npm run notify-newsletter -- \
  --type guide \
  --slug "$SLUG" \
  --title "$TITLE" \
  --url "$URL"
```

#### Fully Automated (Future)

Set up GitHub Actions to automatically send newsletters when content is merged to main branch. See `.github/workflows/newsletter-automation-example.yml.disabled` for an example.

### Support & Questions

#### Common Questions

**Q: Can I send to specific subscribers only?**
A: Not yet. Currently sends to all active subscribers. Segmentation is a future feature.

**Q: Can I schedule newsletters?**
A: Not yet. Currently manual sending only. Scheduling is a future feature.

**Q: Can I see who opened the email?**
A: Yes, check the Resend dashboard for individual email tracking.

**Q: Can I customize the email design?**
A: Yes, edit the HTML templates in the API route files.

**Q: What if I make a mistake in the newsletter?**
A: You can't recall sent emails, but you can send a correction newsletter.

#### Getting Help

1. Check this guide
2. Review [NEWSLETTER_SYSTEM.md](./NEWSLETTER_SYSTEM.md)
3. Check Resend documentation
4. Review Supabase logs
5. Contact the development team

---

## Quick Reference

### For Users
- **Subscribe**: Visit News or Guides page, enter email, click Subscribe
- **Unsubscribe**: Click link in any email or visit `/newsletter/unsubscribe`

### For Admins
- **Send Newsletter**: `npm run notify-newsletter -- --type <type> --slug <slug> --title <title> --url <url>`
- **View Subscribers**: Query `newsletter_subscriptions` table in Supabase
- **Check Performance**: Review Resend dashboard

### Important URLs
- Unsubscribe page: `/newsletter/unsubscribe`
- Resend dashboard: [resend.com](https://resend.com)
- Supabase dashboard: Your Supabase project URL

---

**Questions?** Check the [full documentation](./NEWSLETTER_SYSTEM.md) or contact the team!
