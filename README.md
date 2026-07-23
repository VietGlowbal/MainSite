# Glowbal

Serious product build for Glowbal.

## Stack
- Next.js
- Supabase
- Tailwind CSS

## Initial focus
- auth
- onboarding
- student profile
- optional CV upload
- shortlist results
- save and compare

## Environment variables
Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Course Search Provider Configuration

The AI Course Selector feature uses external search APIs to find course pages. Configure your preferred provider:

```bash
# Primary search provider (default: tavily)
COURSE_SEARCH_PROVIDER=tavily

# Tavily API Key (recommended)
TAVILY_API_KEY=tvly-your-key-here

# Optional: Alternative providers
# SERPAPI_API_KEY=your-serpapi-key
# BING_SEARCH_API_KEY=your-bing-key
# EXA_API_KEY=your-exa-key
```

**Supported Providers:**
- `tavily` (default) - AI-optimized search API with domain filtering
- `serpapi` - Google Search API wrapper (future support)
- `bing` - Bing Search API (future support)
- `exa` - Neural search engine (future support)

**Provider Selection:**
Set `COURSE_SEARCH_PROVIDER` to your chosen provider name. If the configured provider is unavailable, the system will gracefully degrade to manual course URL paste.

**Getting API Keys:**
- Tavily: Sign up at [tavily.com](https://tavily.com) for AI search API access
- SerpAPI: Register at [serpapi.com](https://serpapi.com) for Google Search access

## Run locally
```bash
npm install
npm run dev
```

## Running the Course Parse Worker

The course parse worker is a background job processor that handles AI-powered course page parsing for applications added through the Apply page.

### Local Development

```bash
# Run the worker in development mode
npm run worker:dev
```

The worker will:
- Poll for pending jobs every 5-10 seconds
- Process course parsing jobs in the background
- Output structured JSON logs for monitoring
- Handle graceful shutdown on SIGTERM/SIGINT

### Required Environment Variables

Ensure these are set in your `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (required for job processing)
- `OPENAI_API_KEY` - For AI parsing (when integrated)

### Optional Worker Configuration

```bash
WORKER_ID=worker-01    # Default: hostname-pid
BATCH_SIZE=5           # Default: 5 jobs per poll
```

### Production Deployment

The worker (`scripts/course-parse-worker.mjs`) can be deployed separately from the Next.js application:

- **Railway/Render**: Deploy as a standalone Node.js service
- **AWS ECS**: Run as a container with auto-scaling
- **Kubernetes**: Deploy with Deployment and HPA for scaling
- **PM2/systemd**: Run on VPS with process management
- **Vercel Cron**: Schedule periodic job claiming (alternative)

Example production deployment:

```bash
# Set environment variables
export NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-key
export WORKER_ID=worker-prod-01
export BATCH_SIZE=10

# Run the worker
node scripts/course-parse-worker.mjs
```

For horizontal scaling, run multiple worker instances with different `WORKER_ID` values. The atomic job claiming ensures no race conditions.

**Monitoring**: Check queue depth and processing rates against the `course_parse_jobs` table (schema in `supabase-claim-parse-jobs.sql`).
