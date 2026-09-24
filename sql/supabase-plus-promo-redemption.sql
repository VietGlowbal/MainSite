-- GlowBal — atomic Plus promo-code redemption
-- Run after supabase-plus.sql and the current Plus payment migrations.

create table if not exists public.plus_promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign text not null,
  plan text not null check (plan in ('plus-starter', 'plus-pro', 'plus-premium')),
  subscription_id uuid references public.plus_subscriptions(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  unique (user_id, campaign)
);

alter table public.plus_promo_redemptions enable row level security;

drop policy if exists "Users read own plus promo redemptions"
  on public.plus_promo_redemptions;
create policy "Users read own plus promo redemptions"
  on public.plus_promo_redemptions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Service role manages plus promo redemptions"
  on public.plus_promo_redemptions;
create policy "Service role manages plus promo redemptions"
  on public.plus_promo_redemptions for all
  to service_role
  using (true)
  with check (true);

create or replace function public.redeem_plus_promo(
  p_user_id uuid,
  p_campaign text,
  p_plan text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_redemption_id uuid;
  v_subscription_id uuid;
  v_duration_months integer;
  v_ai_credits integer;
  v_profile public.student_profiles%rowtype;
  v_new_expiry timestamptz;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_campaign <> 'glowbalglowbal-v1' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_campaign');
  end if;

  select plan_values.duration_months, plan_values.ai_credits
    into v_duration_months, v_ai_credits
    from (values
      ('plus-starter', 1, 25),
      ('plus-pro', 12, 120),
      ('plus-premium', 12, 500)
    ) as plan_values(plan, duration_months, ai_credits)
   where plan_values.plan = p_plan;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_plan');
  end if;

  insert into public.plus_promo_redemptions (user_id, campaign, plan)
  values (p_user_id, p_campaign, p_plan)
  on conflict (user_id, campaign) do nothing
  returning id into v_redemption_id;
  if v_redemption_id is null then
    return jsonb_build_object('ok', false, 'reason', 'already_redeemed');
  end if;

  insert into public.student_profiles (
    user_id, plus_status, plus_plan, plus_started_at, plus_expires_at,
    ai_strategy_credits
  ) values (
    p_user_id, true, p_plan, now(), now() + make_interval(months => v_duration_months),
    0
  ) on conflict (user_id) do nothing;

  select * into v_profile
    from public.student_profiles
   where user_id = p_user_id
   for update;
  if not found then
    raise exception 'student profile unavailable';
  end if;

  v_new_expiry := greatest(coalesce(v_profile.plus_expires_at, now()), now())
    + make_interval(months => v_duration_months);
  update public.student_profiles
     set plus_status = true,
         plus_plan = p_plan,
         plus_started_at = coalesce(v_profile.plus_started_at, now()),
         plus_expires_at = v_new_expiry,
         ai_strategy_credits = coalesce(v_profile.ai_strategy_credits, 0) + v_ai_credits
   where user_id = p_user_id;

  insert into public.plus_subscriptions (
    user_id, plan, price_label, ai_credits, duration_months,
    status, started_at, expires_at
  ) values (
    p_user_id, p_plan, 'Promo · 100% off', v_ai_credits, v_duration_months,
    'active', now(), v_new_expiry
  ) returning id into v_subscription_id;

  update public.plus_promo_redemptions redemption
     set subscription_id = v_subscription_id
   where redemption.id = v_redemption_id;

  return jsonb_build_object(
    'ok', true,
    'plan', p_plan,
    'expires_at', v_new_expiry,
    'subscription_id', v_subscription_id
  );
end;
$$;

revoke all on function public.redeem_plus_promo(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.redeem_plus_promo(uuid, text, text)
  to service_role;
