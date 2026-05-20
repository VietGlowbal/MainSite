# Glowbal — Developer Setup Guide

## 1. Environment Variables

Add these to your `.env.local` file:

```bash
# ── Supabase (already configured) ──
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# ── OpenAI (for AI personal statement writer) ──
OPENAI_API_KEY=sk-...your-openai-api-key...

# OpenAI model to use (defaults to gpt-4o-mini if not set)
OPENAI_MODEL=gpt-4o-mini
```

### Getting an OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to **API Keys** in the left sidebar
4. Click **Create new secret key**
5. Copy the key and add it to `.env.local` as `OPENAI_API_KEY`
6. Add a payment method under **Billing** (API calls are pay-per-use)

**Cost estimate:** Each personal statement analysis uses ~1,500 tokens input + ~800 tokens output ≈ $0.002 per analysis with `gpt-4o-mini`.

### Alternative: Using Anthropic Claude instead of OpenAI

If you prefer Claude, set these instead:

```bash
ANTHROPIC_API_KEY=sk-ant-...your-key...
AI_PROVIDER=anthropic
```

Then update `src/app/api/ai/analyze-statement/route.ts` to use the Anthropic SDK.

---

## 2. Database Setup

Run the SQL schema in your Supabase project:

1. Open your Supabase Dashboard
2. Go to **SQL Editor** → **New Query**
3. Paste the contents of `supabase-schema.sql`
4. Click **Run**

This creates:
- `universities` — university data (imported from CSV)
- `user_universities` — user's saved/shortlisted universities
- `application_tasks` — per-university application steps
- `task_templates` — reusable task templates (pre-seeded)
- `personal_statements` — AI writer drafts
- Adds `onboarding_completed` column to `student_profiles`

All tables have Row Level Security (RLS) enabled.

---

## 3. Import University Data

After running the schema, import the CSV data:

1. Open Supabase Dashboard → **Table Editor** → `universities`
2. Click **Import data** → **CSV**
3. Upload `public/Universities_Database - Sheet1.csv`
4. Map the CSV columns to the table columns

**Or** use the import API route:
```bash
# With the dev server running:
curl -X POST http://localhost:3000/api/import-universities \
  -H "Authorization: Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY"
```

---

## 4. Supabase Storage Bucket

Ensure the `student-documents` storage bucket exists:

1. Supabase Dashboard → **Storage**
2. Create bucket named `student-documents` (if not already created)
3. Set it to **private** (authenticated access only)
4. Add a storage policy allowing authenticated users to upload to their own folder:

```sql
create policy "Users upload own documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'student-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users read own documents"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'student-documents' and (storage.foldername(name))[1] = auth.uid()::text);
```

---

## 5. Running the App

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

---

## 6. User Flow Summary

1. **Landing page** (`/`) — waitlist or sign-up CTA
2. **Auth** (`/auth`) — sign up / log in (email or Google)
3. **Onboarding** (`/onboarding`) — 7-step profile questionnaire (enforced for new users)
4. **Document upload** (`/onboarding/documents`) — optional CV/SOP upload
5. **University search** (`/universities`) — search with match % scores
6. **My Universities** (`/my-universities`) — saved universities + application roadmap
7. **AI Writer** (`/my-universities/[id]/writer`) — personal statement editor with AI feedback
8. **Profile** (`/profile`) — view/edit profile, documents, achievements
