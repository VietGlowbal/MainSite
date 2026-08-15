#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredVersion = fs.readFileSync(path.join(root, '.node-version'), 'utf8').trim();
const currentVersion = process.versions.node;

if (currentVersion !== requiredVersion) {
  console.error(
    `Pull-request verification requires Node ${requiredVersion}; current Node is ${currentVersion}. `
      + 'Run "nvm use" (or select .node-version with your version manager) and try again.',
  );
  process.exit(1);
}

console.log(`Node ${currentVersion} matches CI.`);
