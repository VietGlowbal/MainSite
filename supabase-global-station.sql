-- ============================================================================
-- GLOWBAL — GLOBAL STATION: ACHIEVER MENTOR MARKETPLACE
-- Migration SQL — Run AFTER supabase-schema.sql
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================================

-- ── 1. Add is_admin column to student_profiles ─────────────────────────────

do $
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_profiles'
      and column_name = 'is_admin'
  ) then
    alter table public.student_profiles
      add column is_admin boolean not null default false;
  end if;
end $;


-- ── 2. Achiever Profiles ───────────────────────────────────────────────────

create table if not exists public.achiever_profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  display_name          text not null,
  avatar_url            text,
  university_id         bigint references public.universities(id) on delete set null,
  degree_level          text not null check (degree_level in ('undergraduate','masters','phd','alumni')),
  subject               text not null,
  graduation_year       int,
  currently_enrolled    boolean not null default true,
  bio                   text,
  help_topics           text[] not null default '{}',
  languages             text[] not null default '{}',
  session_price_vnd     int not null check (session_price_vnd >= 100000),
  session_duration_mins int not null default 60 check (session_duration_mins in (30, 45, 60)),
  status                text not null default 'pending' check (status in ('pending','approved','suspended','rejected')),
  verified_at           timestamptz,
  total_sessions        int not null default 0,
  avg_rating            numeric(2,1) not null default 0,
  created_at            timestamptz not null default now()
);

alter table public.achiever_profiles enable row level security;

-- SELECT: authenticated users can read approved profiles; achievers can read their own
create policy "Anyone can read approved achiever profiles"
  on public.achiever_profiles for select
  to authenticated
  using (status = 'approved' or id = auth.uid());

-- INSERT: authenticated users can create their own profile
create policy "Users can create own achiever profile"
  on public.achiever_profiles for insert
  to authenticated
  with check (id = auth.uid());

-- UPDATE: achievers can update own row (except admin-managed columns)
create policy "Achievers can update own profile"
  on public.achiever_profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Service role full access (for admin operations)
create policy "Service role full access to achiever_profiles"
  on public.achiever_profiles for all
  to service_role
  using (true)
  with check (true);


-- ── 3. Achiever Availability ───────────────────────────────────────────────

create table if not exists public.achiever_availability (
  id            bigserial primary key,
  achiever_id   uuid not null references public.achiever_profiles(id) on delete cascade,
  day_of_week   int not null check (day_of_week >= 0 and day_of_week <= 6),
  start_time    time not null,
  end_time      time not null,
  is_active     boolean not null default true,
  constraint end_after_start check (end_time > start_time)
);

alter table public.achiever_availability enable row level security;

-- SELECT: authenticated users can read active slots for approved achievers
create policy "Read active availability for approved achievers"
  on public.achiever_availability for select
  to authenticated
  using (
    is_active = true and exists (
      select 1 from public.achiever_profiles ap
      where ap.id = achiever_availability.achiever_id
        and ap.status = 'approved'
    )
    or achiever_id = auth.uid()
  );

-- INSERT/UPDATE/DELETE: only the achiever themselves
create policy "Achievers manage own availability"
  on public.achiever_availability for insert
  to authenticated
  with check (achiever_id = auth.uid());

create policy "Achievers update own availability"
  on public.achiever_availability for update
  to authenticated
  using (achiever_id = auth.uid())
  with check (achiever_id = auth.uid());

create policy "Achievers delete own availability"
  on public.achiever_availability for delete
  to authenticated
  using (achiever_id = auth.uid());

-- Service role full access
create policy "Service role full access to achiever_availability"
  on public.achiever_availability for all
  to service_role
  using (true)
  with check (true);


-- ── 4. Bookings ────────────────────────────────────────────────────────────

create table if not exists public.bookings (
  id                    bigserial primary key,
  applicant_id          uuid not null references auth.users(id) on delete cascade,
  achiever_id           uuid not null references public.achiever_profiles(id) on delete cascade,
  user_university_id    bigint references public.user_universities(id) on delete set null,
  scheduled_at          timestamptz not null,
  duration_mins         int not null,
  session_price_vnd     int not null,
  glowbal_fee_vnd       int not null,
  achiever_payout_vnd   int not null,
  status                text not null default 'pending_payment'
                        check (status in ('pending_payment','confirmed','completed','reviewed','cancelled')),
  payment_reference     text,
  payment_confirmed_at  timestamptz,
  meeting_link          text,
  applicant_notes       text,
  cancellation_reason   text,
  cancelled_by          text check (cancelled_by in ('applicant','achiever','admin')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.bookings enable row level security;

-- SELECT: both parties can see their own bookings
create policy "Users can read own bookings"
  on public.bookings for select
  to authenticated
  using (applicant_id = auth.uid() or achiever_id = auth.uid());

-- INSERT: authenticated users, applicant_id must be themselves
create policy "Users can create bookings as applicant"
  on public.bookings for insert
  to authenticated
  with check (applicant_id = auth.uid());

-- UPDATE: limited updates by each party
create policy "Users can update own bookings"
  on public.bookings for update
  to authenticated
  using (applicant_id = auth.uid() or achiever_id = auth.uid());

-- Service role full access (for admin operations)
create policy "Service role full access to bookings"
  on public.bookings for all
  to service_role
  using (true)
  with check (true);


-- ── 5. Session Reviews ─────────────────────────────────────────────────────

create table if not exists public.session_reviews (
  id            bigserial primary key,
  booking_id    bigint not null references public.bookings(id) on delete cascade unique,
  reviewer_id   uuid not null references auth.users(id) on delete cascade,
  achiever_id   uuid not null references public.achiever_profiles(id) on delete cascade,
  rating        int not null check (rating >= 1 and rating <= 5),
  comment       text,
  is_visible    boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.session_reviews enable row level security;

-- SELECT: all authenticated users can read visible reviews
create policy "Authenticated users can read visible reviews"
  on public.session_reviews for select
  to authenticated
  using (is_visible = true);

-- INSERT: reviewer must be the applicant of a completed booking
create policy "Applicants can review completed bookings"
  on public.session_reviews for insert
  to authenticated
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.id = session_reviews.booking_id
        and b.applicant_id = auth.uid()
        and b.status = 'completed'
    )
  );

-- Service role full access (for admin moderation)
create policy "Service role full access to session_reviews"
  on public.session_reviews for all
  to service_role
  using (true)
  with check (true);


-- ── 6. Triggers & Functions ────────────────────────────────────────────────

-- Function: update achiever stats after a review is inserted
create or replace function public.update_achiever_stats()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.achiever_profiles
  set
    avg_rating = (
      select coalesce(round(avg(rating)::numeric, 1), 0)
      from public.session_reviews
      where achiever_id = NEW.achiever_id and is_visible = true
    ),
    total_sessions = (
      select count(*)
      from public.bookings
      where achiever_id = NEW.achiever_id
        and status in ('completed', 'reviewed')
    )
  where id = NEW.achiever_id;

  return NEW;
end;
$$;

-- Trigger: fire after review insert
drop trigger if exists trg_update_achiever_stats on public.session_reviews;
create trigger trg_update_achiever_stats
  after insert on public.session_reviews
  for each row
  execute function public.update_achiever_stats();

-- Function: update booking updated_at
create or replace function public.update_booking_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

-- Trigger: fire before booking update
drop trigger if exists trg_update_booking_updated_at on public.bookings;
create trigger trg_update_booking_updated_at
  before update on public.bookings
  for each row
  execute function public.update_booking_updated_at();


-- ── 7. Indexes ─────────────────────────────────────────────────────────────

create index if not exists idx_achiever_profiles_status on public.achiever_profiles(status);
create index if not exists idx_achiever_profiles_university on public.achiever_profiles(university_id);
create index if not exists idx_achiever_availability_achiever on public.achiever_availability(achiever_id);
create index if not exists idx_bookings_applicant on public.bookings(applicant_id);
create index if not exists idx_bookings_achiever on public.bookings(achiever_id);
create index if not exists idx_bookings_status on public.bookings(status);
create index if not exists idx_session_reviews_achiever on public.session_reviews(achiever_id);
