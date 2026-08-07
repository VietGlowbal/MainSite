#!/usr/bin/env node

const siteUrl = (process.argv[2] ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
const token = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!siteUrl) {
  console.error('Missing NEXT_PUBLIC_SITE_URL (or pass the site URL as the first argument).');
  process.exit(1);
}
if (!token) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const response = await fetch(`${siteUrl}/api/admin/universities/revalidate`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
});
const body = await response.json().catch(() => null);

if (!response.ok) {
  console.error(`Revalidation failed (${response.status}):`, body ?? response.statusText);
  process.exit(1);
}

console.log('University cache revalidated:', body);
