# Apply System Phase 3: UI Redesign & Enhanced Match Scoring

## Overview
Complete redesign of the application details page to match the new UI design with enhanced AI-powered match scoring and dynamic resource links.

## Key Features

### 1. Enhanced AI Extraction
- ✅ Extract dynamic official links (course page, requirements, fees, scholarships, tests, etc.)
- ✅ Generate match score based on user profile analysis
- ✅ Calculate max possible match score
- ✅ Provide detailed match analysis (strengths, gaps, recommendations)

### 2. User Profile Analysis
- Analyze user's CV, statement of purpose, and academic background
- Compare against course requirements
- Generate personalized recommendations
- Calculate realistic match percentages

### 3. New UI Components (Based on Screenshot)

#### Header Section
- Course title with university name
- Degree level, study mode, intake badges
- UCAS/application code badge
- Status badge (On track, etc.)
- "View official course page" and "More details" buttons

#### Key Metrics Bar
- **Apply deadline**: Date with days left countdown
- **Progress**: Percentage complete
- **Your match**: Current match percentage with CV indicator
- **Max possible match**: Target percentage with AI-optimized CV
- **Entry requirements**: Grade requirements (e.g., AAA-AAB, A-Level)

#### Application Journey Pipeline
- Visual step-by-step progress (1-6 or 1-7 steps)
- Stage status indicators (Complete, In progress, Not started)
- Click to navigate between stages
- Current stage highlighted

#### Stage Detail Panel
- Stage number and title (e.g., "Step 2 of 6: Check eligibility")
- Stage description
- Task list with checkboxes
- Task icons (book, people, chart, etc.)
- Action buttons for each task
- "Why this matters" info boxes
- Previous/Next step navigation

#### Right Sidebar
- **Application progress**: Overall percentage with breakdown
  - Completed: X/Y
  - In progress: X
  - Not started: X
- **Upcoming deadline**: UCAS application deadline with countdown
- **Tips**: Contextual recommendations
- **Need help?**: Mentor avatars and "Ask a mentor" button
- **Official links**: 
  - Course page
  - Entry requirements
  - How to apply
  - Tuition fees
  - View all sources

### 4. Database Schema Updates

#### New fields for `course_applications` table:
```sql
ALTER TABLE course_applications ADD COLUMN IF NOT EXISTS match_score INTEGER;
ALTER TABLE course_applications ADD COLUMN IF NOT EXISTS max_possible_match INTEGER;
ALTER TABLE course_applications ADD COLUMN IF NOT EXISTS match_strengths JSONB;
ALTER TABLE course_applications ADD COLUMN IF NOT EXISTS match_gaps JSONB;
ALTER TABLE course_applications ADD COLUMN IF NOT EXISTS match_recommendations JSONB;
ALTER TABLE course_applications ADD COLUMN IF NOT EXISTS official_links JSONB;
```

#### New table for task resources:
```sql
CREATE TABLE IF NOT EXISTS task_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES application_tasks(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL, -- 'link', 'document', 'tool', 'test'
  title TEXT NOT NULL,
  url TEXT,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. API Endpoints

#### Enhanced extraction endpoint
- `POST /api/applications/extract`
  - Extract course data
  - Fetch user profile
  - Analyze match score
  - Store all data including links and match analysis

#### New match analysis endpoint
- `POST /api/applications/[id]/analyze-match`
  - Re-analyze match score based on updated profile
  - Return updated match data

### 6. Implementation Steps

#### Phase 3.1: Backend (COMPLETED)
- [x] Update course-extractor.ts with match scoring
- [x] Add dynamic links extraction
- [x] Add analyzeUserMatch function
- [ ] Update database schema
- [ ] Update extraction API to call match analysis
- [ ] Store match data and official links

#### Phase 3.2: UI Components (TODO)
- [ ] Create new ApplicationHeader component
- [ ] Create KeyMetricsBar component
- [ ] Create JourneyPipeline component (enhanced version)
- [ ] Create StageDetailPanel component (new design)
- [ ] Create ProgressSidebar component
- [ ] Create OfficialLinks component

#### Phase 3.3: Integration (TODO)
- [ ] Update application-workspace.tsx with new components
- [ ] Connect match scoring to UI
- [ ] Add profile fetching for match analysis
- [ ] Test full workflow

## Design Specifications

### Colors
- Primary Pink: #FF3D9A
- Success Green: #10B981
- Warning Amber: #F59E0B
- Info Blue: #3B82F6
- Background: #F8FAFC
- Border: #E2E8F0

### Typography
- Headers: font-semibold, text-slate-900
- Body: text-sm, text-slate-600
- Labels: text-xs, text-slate-500
- Badges: text-[10px], font-semibold

### Spacing
- Card padding: p-5
- Card gap: gap-4
- Section gap: space-y-4
- Border radius: rounded-2xl (cards), rounded-xl (elements)

## Testing Checklist

- [ ] Course extraction with links works
- [ ] Match scoring calculates correctly
- [ ] User profile is fetched and analyzed
- [ ] UI matches design screenshot
- [ ] Stage progression works
- [ ] Task completion updates match score
- [ ] Official links are clickable and correct
- [ ] Responsive design works on mobile
- [ ] Performance is acceptable (<3s load time)

## Notes

- Use gpt-4o-mini for match analysis (cost-effective)
- Cache match analysis results (update only when profile changes)
- Gracefully handle missing user profile data
- Provide default match scores if analysis fails
- Ensure all links are validated before display
