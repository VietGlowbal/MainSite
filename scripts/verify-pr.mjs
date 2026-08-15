#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';

const npmExecPath = process.env.npm_execpath;
if (!npmExecPath) {
  console.error('Run this verification through npm: npm run verify:pr');
  process.exit(1);
}
const scripts = [
  'check:node',
  'typecheck',
  'typecheck:strict',
  'lint',
  'test:ci',
  'build:ci',
];

// GUI Git clients can keep an old PATH after Node is installed or switched.
// Put the directory of the running Node executable first so npm scripts can
// reliably resolve `node` without requiring the client to be restarted.
const childEnv = {
  ...process.env,
  PATH: [path.dirname(process.execPath), process.env.PATH].filter(Boolean).join(path.delimiter),
};

for (const script of scripts) {
  console.log(`\n=== npm run ${script} ===`);
  const result = spawnSync(process.execPath, [npmExecPath, 'run', script], {
    stdio: 'inherit',
    env: childEnv,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('\nPull-request verification passed. Safe to push.');
