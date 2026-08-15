#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';

const nextCli = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
const result = spawnSync(process.execPath, [nextCli, 'build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role-key',
  },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
