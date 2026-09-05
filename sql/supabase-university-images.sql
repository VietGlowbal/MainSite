-- ============================================================================
-- GLOWBAL — university imagery columns
-- ----------------------------------------------------------------------------
-- Adds stable image_url + logo_url columns on `public.universities` so we
-- never have to hit Wikipedia / Commons at request time. Run once in the
-- Supabase SQL editor; idempotent.
--
-- Populate the columns by running:
--   npm run seed:university-images
--
-- The seed script de-duplicates city photos so two universities in the same
-- city don't end up with identical hero images.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'universities'
      and column_name = 'image_url'
  ) then
    alter table public.universities add column image_url text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'universities'
      and column_name = 'logo_url'
  ) then
    alter table public.universities add column logo_url text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'universities'
      and column_name = 'backup_image_url'
  ) then
    alter table public.universities add column backup_image_url text;
  end if;

  -- Last successful resolution timestamp — useful for re-running the seed
  -- against rows that haven't been refreshed in a while without redoing
  -- everything every time.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'universities'
      and column_name = 'images_resolved_at'
  ) then
    alter table public.universities add column images_resolved_at timestamptz;
  end if;
end $$;
