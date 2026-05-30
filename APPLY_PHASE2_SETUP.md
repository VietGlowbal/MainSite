# Apply Phase 2 - Quick Setup Guide

## Prerequisites

- ✅ Supabase database with apply system tables (from `supabase-apply-system.sql`)
- ✅ OpenAI API account with credits
- ✅ Next.js app running locally

## Setup Steps

### 1. Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-proj-...`)
5. Add credits to your account (minimum $5 recommended)

### 2. Configure Environment Variables

Add to your `.env.local` file:

```bash
# OpenAI API (required for AI features)
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-4o-mini  # Recommended: cheaper and faster
```

**Model Options:**
- `gpt-4o-mini`: ~$0.003 per import (recommended)
- `gpt-4o`: ~$0.06 per import (more accurate)
- `gpt-4-turbo`: ~$0.04 per import (balanced)

### 3. Restart Development Server

```bash
npm run dev
```

### 4. Test the Feature

1. Navigate to `/apply` in your browser
2. Paste a course URL, for example:
   ```
   https://www.manchester.ac.uk/study/undergraduate/courses/2027/00560/bsc-computer-science/
   ```
3. Click "Build my checklist"
4. Wait 10-30 seconds for AI extraction
5. You should see: "✓ BSc Computer Science imported successfully!"
6. Auto-redirect to the application workspace

## Verification Checklist

- [ ] OpenAI API key is set in `.env.local`
- [ ] Development server restarted after adding key
- [ ] Can access `/apply` page
- [ ] Import bar is visible
- [ ] Can paste URL without errors
- [ ] Loading spinner appears when submitting
- [ ] Success message shows after extraction
- [ ] Redirects to application workspace
- [ ] Application shows extracted data (course name, university, etc.)
- [ ] Stages are created (should see 7 stages)
- [ ] Tasks are visible within stages
- [ ] Scholarships appear (if found on page)

## Troubleshooting

### "AI service not configured"
**Problem**: Missing or invalid OpenAI API key

**Solution**:
1. Check `.env.local` has `OPENAI_API_KEY=sk-proj-...`
2. Verify key is valid on OpenAI platform
3. Restart dev server: `npm run dev`

### "Failed to fetch course page"
**Problem**: URL is invalid or page requires authentication

**Solution**:
1. Verify URL is publicly accessible
2. Try opening URL in incognito browser
3. Use a different course URL for testing

### "Failed to extract required course information"
**Problem**: AI couldn't parse the page structure

**Solution**:
1. Try a different university course page
2. Check if page has actual course content (not just a search page)
3. Try UK universities first (better structured pages)

### Import takes too long (>60 seconds)
**Problem**: Large page or slow API response

**Solution**:
1. Check OpenAI API status: https://status.openai.com/
2. Try `gpt-4o-mini` model (faster)
3. Check your internet connection

### "This course has already been imported"
**Problem**: Duplicate URL for same user

**Solution**:
- This is expected behavior
- You'll be redirected to existing application
- Delete the existing application first if you want to re-import

## Testing Different Universities

### UK Universities (UCAS System)
```
https://www.manchester.ac.uk/study/undergraduate/courses/2027/00560/bsc-computer-science/
https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/computer-science
https://www.cam.ac.uk/study-at-cambridge/undergraduate/courses/computer-science
```

### US Universities
```
https://mitadmissions.org/apply/
https://admission.stanford.edu/apply/
```

### Australian Universities
```
https://www.sydney.edu.au/courses/courses/uc/bachelor-of-computer-science.html
https://www.unimelb.edu.au/study/find/courses/undergraduate/bachelor-of-science/
```

## Expected Results

After successful import, you should see:

### Application Details
- ✅ University name
- ✅ Course name
- ✅ Degree level (Bachelor's, Master's, etc.)
- ✅ Study mode (Full-time, Part-time)
- ✅ Intake (September 2027, etc.)
- ✅ Country flag emoji

### Application Info
- ✅ Application method (UCAS, Direct Apply, etc.)
- ✅ Application code (if applicable)
- ✅ Deadline date
- ✅ Tuition fees
- ✅ Entry requirements summary
- ✅ English requirements summary

### Stages (7 total)
1. Research
2. Check eligibility
3. Prepare documents
4. Improve application
5. Submit
6. Interview (optional)
7. Decision

### Tasks (15-30 total)
- Specific to the course
- Prioritized (high/medium/low)
- Typed (required/recommended/optional)
- Actionable and clear

### Scholarships (0-5 typically)
- Name
- Amount (if mentioned)
- Eligibility criteria
- Deadline (if mentioned)
- Link to scholarship page

## Cost Monitoring

### Track Your Usage

1. Go to [OpenAI Usage Dashboard](https://platform.openai.com/usage)
2. Monitor daily API costs
3. Set up usage alerts

### Expected Costs (gpt-4o-mini)

- **Per import**: ~$0.003 (less than 1 cent)
- **100 imports**: ~$0.30
- **1000 imports**: ~$3.00

### Cost Optimization

1. Use `gpt-4o-mini` instead of `gpt-4o` (20x cheaper)
2. Implement caching for popular courses
3. Add rate limiting (e.g., 5 imports per user per day)
4. Consider batch processing for multiple courses

## Next Steps

Once Phase 2 is working:

1. **Test with various universities** to ensure broad compatibility
2. **Gather user feedback** on extraction accuracy
3. **Monitor confidence levels** - low confidence may need manual review
4. **Add analytics** to track success rates
5. **Implement caching** for popular courses
6. **Add manual editing** for AI-extracted data
7. **Build Phase 3 features** (see APPLY_PHASE2_IMPLEMENTATION.md)

## Support

If you encounter issues:

1. Check browser console for errors
2. Check server logs: `npm run dev` output
3. Verify OpenAI API key has credits
4. Test with known working URLs
5. Check OpenAI API status page

## Success Criteria

Phase 2 is working correctly when:

- ✅ Users can paste any course URL
- ✅ AI extracts course information in <30 seconds
- ✅ Application is created with all extracted data
- ✅ 7 stages are generated
- ✅ 15+ tasks are created
- ✅ Scholarships are found (when available)
- ✅ User is redirected to application workspace
- ✅ All data is visible and accurate
- ✅ Confidence level is displayed
- ✅ No errors in console or server logs

## Congratulations! 🎉

You've successfully implemented AI-powered course extraction. Users can now import any university course with a single click and get a complete, personalized application plan.
