#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

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

for (const script of scripts) {
  console.log(`\n=== npm run ${script} ===`);
  const result = spawnSync(process.execPath, [npmExecPath, 'run', script], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('\nPull-request verification passed. Safe to push.');
