# Apply System - Phase 2 Implementation

## Overview

Phase 2 adds AI-powered course extraction, automatic task generation, and scholarship discovery to the Apply system. Users can now paste any university course URL and get a fully populated application plan with stages, tasks, and relevant scholarships.

## Features Implemented

### 1. AI Course Extraction (`/src/lib/ai/course-extractor.ts`)

**What it does:**
- Fetches and parses university course pages
- Extracts structured course information using OpenAI GPT-4
- Generates application stages with specific, actionable tasks
- Discovers scholarships mentioned on the course page

**Extracted Data:**
- **Core Info**: University name, course name, degree level, subject, study mode, intake, country
- **Application Details**: Method (UCAS/Direct/etc.), code, deadline, tuition fees
- **Requirements**: Entry requirements, English language requirements
- **Stages & Tasks**: 5-7 application stages with 2-5 tasks each
- **Scholarships**: Name, amount, eligibility, deadline, URL

**Confidence Levels:**
- `high`: Most information found and verified
- `medium`: Some information found, some inferred
- `low`: Limited information, mostly inferred

### 2. New API Endpoint (`/src/app/api/applications/extract/route.ts`)

**Endpoint:** `POST /api/applications/extract`

**Request Body:**
```json
{
  "courseUrl": "https://www.manchester.ac.uk/study/undergraduate/courses/2027/00560/bsc-computer-science/"
}
```

**Response (Success):**
```json
{
  "success": true,
  "applicationId": "app_xxx",
  "message": "Course imported and analyzed successfully",
  "summary": {
    "courseName": "BSc Computer Science",
    "universityName": "University of Manchester",
    "stagesCreated": 7,
    "tasksCreated": 23,
    "scholarshipsFound": 3,
    "confidence": "high"
  }
}
```

**Error Responses:**
- `400`: Invalid URL format
- `401`: Unauthorized (not logged in)
- `409`: Course already imported (returns existing application ID)
- `422`: Failed to extract course information
- `500`: Internal server error

### 3. Updated Apply Dashboard

**Changes to `/src/app/apply/apply-dashboard.tsx`:**

- ✅ Real-time URL import with loading states
- ✅ Success/error feedback with detailed messages
- ✅ Automatic redirect to new application after import
- ✅ Duplicate detection with redirect to existing application
- ✅ Loading spinner during AI extraction

**User Flow:**
1. User pastes course URL
2. Click "Build my checklist"
3. Loading state shows "Analyzing..."
4. Success message shows: "✓ [Course Name] imported successfully! Found X tasks and Y scholarships."
5. Auto-redirect to application workspace after 2 seconds

### 4. Scholarship Integration

**Database Storage:**
- Scholarships stored in `support_resources` table with `resource_type = 'scholarship'`
- Linked to applications via `application_id`
- Include confidence levels for AI-extracted data

**Display:**
- Scholarships fetched and attached to application object
- Available in application workspace for display

## Configuration

### Environment Variables

Add to `.env.local`:

```bash
# OpenAI API (required for AI features)
OPENAI_API_KEY=sk-proj-xxx
OPENAI_MODEL=gpt-4o  # or gpt-4o-mini for lower cost
```

### Cost Considerations

**Token Usage per Import:**
- Input: ~15,000 tokens (course page content)
- Output: ~2,000 tokens (structured JSON)
- **Total per import: ~17,000 tokens**

**Pricing (GPT-4o):**
- Input: $2.50 per 1M tokens
- Output: $10.00 per 1M tokens
- **Cost per import: ~$0.06**

**Pricing (GPT-4o-mini - recommended):**
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens
- **Cost per import: ~$0.0034 (less than 1 cent)**

## Testing

### Test with Real Course URL

```bash
# Example: University of Manchester Computer Science
curl -X POST http://localhost:3000/api/applications/extract \
  -H "Content-Type: application/json" \
  -d '{
    "courseUrl": "https://www.manchester.ac.uk/study/undergraduate/courses/2027/00560/bsc-computer-science/"
  }'
```

### Expected Results

The AI should extract:
- ✅ University: "University of Manchester"
- ✅ Course: "BSc Computer Science"
- ✅ Degree Level: "Bachelor's"
- ✅ Application Method: "UCAS"
- ✅ UCAS Code: "G400" (if available)
- ✅ Entry Requirements: e.g., "AAA-AAB at A-Level"
- ✅ English Requirements: e.g., "IELTS 6.5 overall"
- ✅ 7 stages with 15-25 tasks total
- ✅ 2-5 scholarships (if mentioned on page)

## Database Schema

### Tables Used

1. **course_applications** - Main application record
2. **application_stages** - 7 stages per application
3. **application_tasks** - Tasks within each stage
4. **support_resources** - Scholarships and other resources

### Sample Task Structure

```json
{
  "title": "Check A-Level grade requirements",
  "description": "Verify you meet the AAA-AAB requirement for Computer Science",
  "priority": "high",
  "type": "required",
  "status": "not_started",
  "confidence": "high",
  "created_by": "ai"
}
```

## AI Prompt Engineering

### Key Prompt Features

1. **Structured Output**: Forces JSON-only responses
2. **Specific Instructions**: Clear schema with examples
3. **Context-Aware**: Generates tasks based on actual course requirements
4. **Confidence Scoring**: AI self-assesses extraction quality
5. **Scholarship Discovery**: Actively searches for funding opportunities

### Prompt Sections

- **System Prompt**: Defines role and output format
- **User Prompt**: Provides URL and page content
- **Temperature**: 0.3 (lower for consistent extraction)
- **Max Tokens**: 4000 (enough for detailed output)

## Error Handling

### Common Issues & Solutions

**Issue**: "Failed to fetch course page"
- **Cause**: URL is invalid or page is behind authentication
- **Solution**: Verify URL is publicly accessible

**Issue**: "Failed to extract required course information"
- **Cause**: Page structure is unusual or content is minimal
- **Solution**: AI couldn't find university/course name - may need manual entry

**Issue**: "AI service not configured"
- **Cause**: Missing OPENAI_API_KEY in environment
- **Solution**: Add API key to .env.local

**Issue**: Rate limit errors
- **Cause**: Too many requests to OpenAI API
- **Solution**: Implement rate limiting or use caching

## Future Enhancements

### Phase 3 Possibilities

1. **Image Extraction**: Extract university/course images from page
2. **Logo Detection**: Find and store university logos
3. **Deadline Parsing**: Better date extraction and formatting
4. **Multi-Page Scraping**: Follow links to requirements/fees pages
5. **Scholarship Database**: Integrate external scholarship APIs
6. **Match Scoring**: Calculate fit based on user profile
7. **Requirement Validation**: Check user profile against requirements
8. **Smart Task Ordering**: Prioritize tasks based on deadline
9. **Progress Tracking**: Auto-update progress as tasks complete
10. **Email Notifications**: Alert users of upcoming deadlines

## Monitoring & Analytics

### Metrics to Track

- Import success rate
- Average extraction time
- Confidence level distribution
- Most common errors
- Token usage per import
- User satisfaction with extracted data

### Logging

All extraction attempts are logged with:
- User ID
- Course URL
- Success/failure status
- Extraction time
- Confidence level
- Error messages (if any)

## Support

For issues or questions:
1. Check error messages in browser console
2. Review server logs for API errors
3. Verify OpenAI API key is valid and has credits
4. Test with known working URLs (e.g., Manchester example)

## Example URLs for Testing

### UK Universities (UCAS)
- Manchester: `https://www.manchester.ac.uk/study/undergraduate/courses/2027/00560/bsc-computer-science/`
- Oxford: `https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/computer-science`
- Cambridge: `https://www.undergraduate.study.cam.ac.uk/courses/computer-science`

### US Universities (Common App)
- MIT: `https://mitadmissions.org/apply/`
- Stanford: `https://admission.stanford.edu/apply/`

### Direct Apply
- Various European universities with direct application systems

## Conclusion

Phase 2 transforms the Apply system from a manual checklist tool into an intelligent application assistant. The AI extraction significantly reduces user effort while providing comprehensive, actionable guidance for each application.
