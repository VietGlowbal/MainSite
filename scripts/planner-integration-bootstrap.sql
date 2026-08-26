-- Bootstrap only for a disposable PostgreSQL database.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.course_applications (id UUID PRIMARY KEY, user_id UUID NOT NULL, course_name TEXT, university_name TEXT);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT SELECT ON public.course_applications, auth.users TO anon, authenticated;
GRANT ALL ON public.course_applications, auth.users TO service_role;
\set app_id 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set user_id 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set foreign_id 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
INSERT INTO auth.users(id) VALUES (:'user_id'), (:'foreign_id') ON CONFLICT DO NOTHING;
INSERT INTO public.course_applications(id, user_id, course_name, university_name) VALUES (:'app_id', :'user_id', 'Test course', 'Test university') ON CONFLICT DO NOTHING;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
