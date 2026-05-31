# Newsletter System - Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Database Setup
- [ ] Open Supabase SQL Editor
- [ ] Run `supabase-newsletter.sql` migration
- [ ] Verify tables created:
  ```sql
  SELECT * FROM newsletter_subscriptions LIMIT 1;
  SELECT * FROM newsletter_content_sent LIMIT 1;
  ```
- [ ] Check RLS policies are enabled:
  ```sql
  SELECT tablename, policyname FROM pg_policies 
  WHERE tablename IN ('newsletter_subscriptions', 'newsletter_content_sent');
  ```

### 2. Environment Variables
- [ ] Add to `.env.local`:
  ```env
  NEWSLETTER_NOTIFY_SECRET=your-generated-secret-here
  ```
- [ ] Generate secret: `openssl rand -base64 32`
- [ ] Verify existing variables are set:
  - [ ] `RESEND_API_KEY`
  - [ ] `WAITLIST_FROM_EMAIL`
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `NEXT_PUBLIC_SITE_URL`

### 3. Resend Configuration
- [ ] Log into [resend.com](https://resend.com)
- [ ] Verify domain is verified
- [ ] Check API key is active
- [ ] Test email sending (optional):
  ```bash
  curl -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $RESEND_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"from":"hello@glowbal.com","to":"your@email.com","subject":"Test","html":"Test"}'
  ```

### 4. Local Testing
- [ ] Start dev server: `npm run dev`
- [ ] Test subscription flow:
  - [ ] Visit `http://localhost:3000/news`
  - [ ] Enter your email in newsletter box
  - [ ] Click Subscribe
  - [ ] Check email for welcome message
  - [ ] Verify in Supabase: `SELECT * FROM newsletter_subscriptions WHERE email = 'your@email.com';`
- [ ] Test newsletter send:
  ```bash
  npm run notify-newsletter -- \
    --type guide \
    --slug "test-guide" \
    --title "Test Guide" \
    --url "http://localhost:3000/guides/test-guide"
  ```
  - [ ] Check email received
  - [ ] Verify in Supabase: `SELECT * FROM newsletter_content_sent;`
- [ ] Test unsubscribe:
  - [ ] Visit `http://localhost:3000/newsletter/unsubscribe?email=your@email.com`
  - [ ] Click Unsubscribe
  - [ ] Verify status changed: `SELECT status FROM newsletter_subscriptions WHERE email = 'your@email.com';`

### 5. Code Review
- [ ] Check TypeScript compilation: `npm run build`
- [ ] Review API routes for errors
- [ ] Verify all imports are correct
- [ ] Check for console.log statements to remove

## 🚀 Deployment Steps

### 1. Commit Changes
```bash
git add .
git commit -m "feat: Add newsletter subscription system

- Add newsletter_subscriptions and newsletter_content_sent tables
- Implement subscribe/unsubscribe API endpoints
- Add newsletter notification system
- Update NewsletterCard and guides newsletter form
- Add unsubscribe page
- Add CLI tool for sending newsletters
- Add comprehensive documentation"
```

### 2. Push to Repository
```bash
git push origin main
```

### 3. Deploy to Production
- [ ] If using Vercel:
  - [ ] Push triggers automatic deployment
  - [ ] Or manually deploy: `vercel --prod`
- [ ] If using other platform:
  - [ ] Follow platform-specific deployment steps

### 4. Set Production Environment Variables
- [ ] In Vercel Dashboard (or your platform):
  - [ ] Add `NEWSLETTER_NOTIFY_SECRET`
  - [ ] Verify all other env vars are set
  - [ ] Redeploy if needed

### 5. Run Production Database Migration
- [ ] Connect to production Supabase
- [ ] Run `supabase-newsletter.sql` in SQL Editor
- [ ] Verify tables created

### 6. Production Testing
- [ ] Visit production site
- [ ] Test subscription on `/news` page
- [ ] Check welcome email received
- [ ] Verify in production Supabase
- [ ] Test unsubscribe flow
- [ ] Test newsletter send (optional):
  ```bash
  npm run notify-newsletter -- \
    --type guide \
    --slug "test-guide" \
    --title "Test Guide" \
    --url "https://your-domain.com/guides/test-guide"
  ```

## 📊 Post-Deployment Monitoring

### First 24 Hours
- [ ] Monitor Resend dashboard for email delivery
- [ ] Check for any API errors in logs
- [ ] Verify subscriptions are being recorded
- [ ] Test from different email providers (Gmail, Outlook, etc.)

### First Week
- [ ] Monitor subscription rate
- [ ] Check unsubscribe rate
- [ ] Review email open rates in Resend
- [ ] Check for any user feedback

### Ongoing
- [ ] Weekly: Review subscriber growth
- [ ] Monthly: Analyze email performance
- [ ] Quarterly: Review and optimize email templates

## 🔧 Troubleshooting

### Emails Not Sending
1. Check Resend dashboard for errors
2. Verify API key is correct
3. Check domain verification status
4. Review Resend logs for specific errors

### Subscriptions Not Saving
1. Check Supabase logs
2. Verify RLS policies are correct
3. Check service role key is valid
4. Review API route logs

### Newsletter Script Fails
1. Verify all environment variables are set
2. Check Supabase connection
3. Verify content hasn't been sent already
4. Check for active subscribers

## 📝 Documentation Links

- **Quick Start**: `NEWSLETTER_QUICKSTART.md`
- **Full Documentation**: `NEWSLETTER_SYSTEM.md`
- **Architecture**: `NEWSLETTER_ARCHITECTURE.md`
- **Implementation Summary**: `NEWSLETTER_IMPLEMENTATION_SUMMARY.md`

## 🎯 Success Criteria

Your newsletter system is successfully deployed when:
- ✅ Users can subscribe from News and Guides pages
- ✅ Welcome emails are sent automatically
- ✅ Newsletter notifications can be sent via CLI
- ✅ Users can unsubscribe successfully
- ✅ All data is tracked in Supabase
- ✅ No errors in production logs

## 🎉 Next Steps After Deployment

1. **Announce the Newsletter**
   - Add banner to homepage
   - Mention in social media
   - Include in email signatures

2. **Create Content Schedule**
   - Plan when to send newsletters
   - Decide on frequency
   - Prepare content calendar

3. **Monitor Performance**
   - Track subscriber growth
   - Monitor email metrics
   - Gather user feedback

4. **Optimize**
   - A/B test subject lines
   - Improve email templates
   - Segment subscribers (future)

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the full documentation
3. Check Resend and Supabase dashboards
4. Review application logs

---

**Ready to deploy?** Start with the Pre-Deployment Checklist above! 🚀
