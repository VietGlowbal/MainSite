import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { ensureDir, paths, readManifest, readMetadataFiles, readQualityChecks, scoreAverage, todayDateString } from './lib';

const args = process.argv.slice(2);
const shouldExecute = args.includes('--execute');

function sh(command: string) {
  return execSync(command, { cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe' }).trim();
}

function safe(command: string) {
  try {
    return sh(command);
  } catch {
    return '';
  }
}

function resolveBranchName(baseName: string) {
  const currentBranch = safe('git branch --show-current');
  if (currentBranch === baseName) return baseName;
  if (!safe(`git rev-parse --verify ${baseName}`)) return baseName;
  let counter = 2;
  while (safe(`git rev-parse --verify ${baseName}-${counter}`)) counter += 1;
  return `${baseName}-${counter}`;
}

function buildPrBody() {
  const manifest = readManifest();
  const checks = readQualityChecks();
  const metadata = readMetadataFiles();
  const averageScore = scoreAverage(checks);
  const todoCount = checks.reduce((sum, check) => sum + check.todoSourceCount, 0);
  const duplicateSummary = checks.map((check) => `${check.slug}: ${check.duplicateRisk}`).join(', ') || 'none';
  const blockerSummary = checks.flatMap((check) => check.blockerReasons.map((reason) => `- ${check.slug}: ${reason}`)).join('\n') || '- None';

  return `## Generated GEO content
### New drafts
${manifest.map((item) => `- ${item.title}`).join('\n') || '- None'}
### Updated pages
- None
### Metadata
${metadata.map((item) => `- ${item.slug}`).join('\n') || '- None'}
### Quality check
- Average score: ${averageScore}
- Pages requiring source review: ${checks.filter((check) => check.reviewRequired).length}
- Duplicate risk: ${duplicateSummary}
- TODO_SOURCE_REQUIRED count: ${todoCount}
### Blockers
${blockerSummary}
## Human review checklist
- [ ] Claims about tuition fees verified
- [ ] Entry requirements verified
- [ ] Scholarship claims verified
- [ ] Visa/post-study work claims verified
- [ ] No invented rankings
- [ ] No duplicate page already exists
- [ ] CTA links correctly to Glowbal app
- [ ] Page has clear student segment
- [ ] Page has clear methodology
- [ ] Sources are official where possible
### Reviewer notes
Please verify tuition fees, scholarship claims, visa information, and official source links before publishing.`;
}

const date = todayDateString();
const branchName = resolveBranchName(`geo/content-${date}`);
const prTitle = `GEO content drafts - ${date}`;
ensureDir(paths.reportsDir);
const prBodyPath = path.join(paths.reportsDir, `pr-body-${date}.md`);
fs.writeFileSync(prBodyPath, buildPrBody() + '\n', 'utf8');

const result: Record<string, unknown> = {
  branchName,
  prTitle,
  prBodyPath: path.relative(process.cwd(), prBodyPath),
  execute: shouldExecute,
};

if (!shouldExecute) {
  result.note = 'Dry run only. Pass --execute to create/push a branch and open a draft PR.';
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const currentBranch = safe('git branch --show-current');
if (currentBranch !== branchName) {
  if (safe(`git rev-parse --verify ${branchName}`)) sh(`git checkout ${branchName}`);
  else sh(`git checkout -b ${branchName}`);
}

sh('git add data/geo content/geo templates/geo scripts/geo package.json package-lock.json .github/workflows geo.tsconfig.json');
let commitCreated = false;
try {
  sh('git diff --cached --quiet');
} catch {
  sh(`git commit -m ${JSON.stringify(prTitle)}`);
  commitCreated = true;
}

sh(`git push -u origin ${branchName}`);
let prUrl = safe(`gh pr view ${branchName} --json url --jq .url`);
if (!prUrl) {
  prUrl = sh(`gh pr create --draft --base main --title ${JSON.stringify(prTitle)} --body-file ${JSON.stringify(prBodyPath)}`);
}

result.commitCreated = commitCreated;
result.pushed = true;
result.prUrl = prUrl;
result.autoMerge = false;
console.log(JSON.stringify(result, null, 2));
