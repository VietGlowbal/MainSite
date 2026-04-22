create table if not exists public.waitlist_signups (
  id bigserial primary key,
  email text not null unique,
  first_name text,
  notes text,
  source text default 'website_waitlist',
  created_at timestamptz not null default now()
);

alter table public.waitlist_signups enable row level security;

create policy "Allow service role full access to waitlist_signups"
on public.waitlist_signups
as permissive
for all
to service_role
using (true)
with check (true);
