/** Defense-in-depth guard for the service-role client boundary. */
if (typeof window !== 'undefined') {
  throw new Error('The Supabase service-role client is server-only.');
}
