-- GlowBal read-only schema introspection
-- Paste into Supabase Dashboard -> SQL Editor -> Run, then export/copy the
-- single JSON cell it returns. Reads catalog and statistics views only:
-- no table data, no PII, no writes, no DDL. Safe to run on production.

select jsonb_pretty(jsonb_build_object(

  'generated_at', now(),

  -- 1. RLS state and the actual policy expressions
  'rls', (
    select jsonb_agg(x order by x->>'table')
    from (
      select jsonb_build_object(
        'table', c.relname,
        'rls_enabled', c.relrowsecurity,
        'rls_forced', c.relforcerowsecurity,
        'owner', pg_get_userbyid(c.relowner),
        'policies', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', p.polname,
            'cmd', case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                                 when 'w' then 'UPDATE' when 'd' then 'DELETE'
                                 else 'ALL' end,
            'permissive', p.polpermissive,
            'roles', (select array_agg(pg_get_userbyid(r)) from unnest(p.polroles) r),
            'using', pg_get_expr(p.polqual, p.polrelid),
            'with_check', pg_get_expr(p.polwithcheck, p.polrelid)
          ) order by p.polname)
          from pg_policy p where p.polrelid = c.oid
        ), '[]'::jsonb)
      ) as x
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r','p')
    ) s
  ),

  -- 2. Views: security_invoker is the flag that decides RLS bypass
  'views', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'view', c.relname,
      'owner', pg_get_userbyid(c.relowner),
      'reloptions', c.reloptions,
      'security_invoker', coalesce(
        (select o = 'security_invoker=true' from unnest(coalesce(c.reloptions,'{}')) o
         where o like 'security_invoker=%' limit 1), false)
    ) order by c.relname), '[]'::jsonb)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v','m')
  ),

  -- 3. SECURITY DEFINER functions and their search_path
  'functions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'args', pg_get_function_identity_arguments(p.oid),
      'security_definer', p.prosecdef,
      'config', p.proconfig,
      'owner', pg_get_userbyid(p.proowner),
      'acl', p.proacl::text
    ) order by p.proname), '[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  ),

  -- 4. Every index, so unindexed FKs can be confirmed rather than inferred
  'indexes', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', tablename, 'index', indexname, 'def', indexdef
    ) order by tablename, indexname), '[]'::jsonb)
    from pg_indexes where schemaname = 'public'
  ),

  -- 5. Index usage: zero scans on a large index = dead weight
  'index_usage', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', relname, 'index', indexrelname, 'scans', idx_scan,
      'size', pg_size_pretty(pg_relation_size(indexrelid))
    ) order by idx_scan, relname), '[]'::jsonb)
    from pg_stat_user_indexes where schemaname = 'public'
  ),

  -- 6. Foreign keys, including cross-schema ones to auth.users
  'foreign_keys', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', c.conrelid::regclass::text,
      'constraint', c.conname,
      'definition', pg_get_constraintdef(c.oid)
    ) order by c.conrelid::regclass::text, c.conname), '[]'::jsonb)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f' and n.nspname = 'public'
  ),

  -- 7. Table-level grants to the API roles
  'grants', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', table_name, 'grantee', grantee, 'privilege', privilege_type
    ) order by table_name, grantee), '[]'::jsonb)
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon','authenticated','service_role')
  ),

  -- 8. Storage bucket policies
  'storage_policies', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', p.polname,
      'cmd', case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                           when 'w' then 'UPDATE' when 'd' then 'DELETE' else 'ALL' end,
      'roles', (select array_agg(pg_get_userbyid(r)) from unnest(p.polroles) r),
      'using', pg_get_expr(p.polqual, p.polrelid),
      'with_check', pg_get_expr(p.polwithcheck, p.polrelid)
    ) order by p.polname), '[]'::jsonb)
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage' and c.relname = 'objects'
  ),

  -- 9. Extensions and table sizes
  'extensions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', extname, 'version', extversion) order by extname), '[]'::jsonb)
    from pg_extension
  ),
  'table_sizes', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', relname,
      'total', pg_size_pretty(pg_total_relation_size(c.oid)),
      'bytes', pg_total_relation_size(c.oid)
    ) order by pg_total_relation_size(c.oid) desc), '[]'::jsonb)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p')
  )

)) as introspection;
