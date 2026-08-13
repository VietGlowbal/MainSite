#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

if (process.env.CI) process.exit(0);

const root = process.cwd();
const hookPath = path.join(root, '.githooks', 'pre-push');
const gitCommand = process.platform === 'win32' ? 'git.exe' : 'git';
const npmExecPath = path.resolve(
  process.env.npm_execpath
    ?? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
);

const existingResult = spawnSync(
  gitCommand,
  ['config', '--local', '--get', 'core.hooksPath'],
  { cwd: root, encoding: 'utf8' },
);
const existingHooksPath = existingResult.status === 0 ? existingResult.stdout?.trim() ?? '' : '';

if (existingHooksPath && existingHooksPath !== '.githooks') {
  console.warn(
    `[git-hooks] Existing core.hooksPath ${JSON.stringify(existingHooksPath)} was preserved. `
      + 'Run npm run verify:pr before opening a pull request.',
  );
  process.exit(0);
}

try {
  fs.chmodSync(hookPath, 0o755);
} catch (error) {
  console.warn(`[git-hooks] Could not make ${hookPath} executable: ${error.message}`);
}

const installResult = spawnSync(
  gitCommand,
  ['config', '--local', 'core.hooksPath', '.githooks'],
  { cwd: root, encoding: 'utf8' },
);

if (installResult.status !== 0) {
  const detail = installResult.stderr?.trim() || installResult.error?.message || 'unknown git error';
  console.warn(`[git-hooks] Could not install the pre-push hook: ${detail}`);
  process.exit(0);
}

const nodePathResult = spawnSync(
  gitCommand,
  ['config', '--local', 'glowbal.nodePath', process.execPath.replaceAll('\\', '/')],
  { cwd: root, encoding: 'utf8' },
);

if (nodePathResult.status !== 0) {
  const detail = nodePathResult.stderr?.trim() || nodePathResult.error?.message || 'unknown git error';
  console.warn(`[git-hooks] Hook installed, but the Node path could not be recorded: ${detail}`);
  process.exit(0);
}

if (!fs.existsSync(npmExecPath)) {
  console.warn('[git-hooks] Hook installed, but npm could not be located. Run npm run prepare.');
  process.exit(0);
}

const npmPathResult = spawnSync(
  gitCommand,
  ['config', '--local', 'glowbal.npmExecPath', npmExecPath.replaceAll('\\', '/')],
  { cwd: root, encoding: 'utf8' },
);

if (npmPathResult.status !== 0) {
  const detail = npmPathResult.stderr?.trim() || npmPathResult.error?.message || 'unknown git error';
  console.warn(`[git-hooks] Hook installed, but the npm path could not be recorded: ${detail}`);
  process.exit(0);
}

console.log('[git-hooks] Installed the pull-request verification pre-push hook.');
