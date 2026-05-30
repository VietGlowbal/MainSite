import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  ensureDir,
  paths,
  readConfig,
  readManifest,
  readMetadataFiles,
  readQualityChecks,
  scoreAverage,
  timestampDisplay,
  timestampSlug,
} from './lib';

const args = process.argv.slice(2);
const shouldExecute = args.includes('--execute');
const now = new Date();

function sh(command: string) {
  return execSync(command, { cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe' }).trim();
}
function safe(command: string) {
  try { return sh(command); } catch { return ''; }
}
function resolveBranchName(baseName: string) {
  if (!safe(`git rev-parse --verify ${baseName}`)) return baseName;
  let counter = 2;
  while (safe(`git rev-parse --verify ${baseName}-${counter}`)) counter += 1;
  return `${baseName}-${counter}`;
}
function buildReviewStatusTable() {
  const manifest = readManifest();
  const checks = readQualityChecks();
  const rows = manifest.slice(0, 5).map((item) => {
    const check = checks.find((entry) => entry.slug === item.slug);
    const notes = check?.publishable ? 'Sources attached' : check?.blockerReasons?.length ? check.blockerReasons.join('; ') : check?.notes?.join('; ') || 'Needs human review';
    return `| ${item.title} | ${check?.reviewStatus ?? 'draft'} | ${notes.replace(/\|/g, '/')} |`;
  });
  return ['## Review status', '| Page | Status | Notes |', '|---|---|---|', ...rows].join('\n');
}
function buildPrBody() {
  const config = readConfig();
  const manifest = readManifest().slice(0, Math.min(5, config.draftPagesPerRun));
  const checks = readQualityChecks();
  const metadata = readMetadataFiles();
  const averageScore = scoreAverage(checks);
  const todoCount = checks.reduce((sum, check) => sum + check.todoSourceCount, 0);
  const needsReviewCount = checks.filter((check) => check.reviewStatus !== 'publishable').length;
  return `## Generated GEO content\n### New drafts\n${manifest.map((item) => `- ${item.title}`).join('\n') || '- None'}\n### Updated pages\n- None\n### Metadata\n${metadata.map((item) => `- ${item.slug}`).join('\n') || '- None'}\n### Quality check\n- Average score: ${averageScore}\n- Pages requiring source review: ${needsReviewCount}\n- TODO_SOURCE_REQUIRED count: ${todoCount}\n- Mode: ${config.mode}\n${buildReviewStatusTable()}\n## Human review checklist\n- [ ] Claims about tuition fees verified\n- [ ] Entry requirements verified\n- [ ] Scholarship claims verified\n- [ ] Visa/post-study work claims verified\n- [ ] No invented rankings\n- [ ] No duplicate page already exists\n- [ ] CTA links correctly to Glowbal app\n- [ ] Page has clear student segment\n- [ ] Page has clear methodology\n- [ ] Sources are official where possible\n### Reviewer notes\nAutomation may generate generic drafts during testing. PR review remains the safety gate. Auto-merge is disabled.`;
}
const config = readConfig();
const stampSlug = timestampSlug(now);
const stampDisplay = timestampDisplay(now);
const branchName = resolveBranchName(`geo/content-${stampSlug}`);
const prTitle = `GEO content drafts - ${stampDisplay}`;
ensureDir(paths.reportsDir);
const prBodyPath = path.join(paths.reportsDir, `pr-body-${stampSlug}.md`);
fs.writeFileSync(prBodyPath, buildPrBody() + '\n', 'utf8');
const result: Record<string, unknown> = { branchName, prTitle, prBodyPath: path.relative(process.cwd(), prBodyPath), execute: shouldExecute, autoMerge: false, allowMultipleOpenGeoPRs: config.allowMultipleOpenGeoPRs };
if (!shouldExecute) { result.note = 'Dry run only. Pass --execute to create/push a branch and open a draft PR.'; console.log(JSON.stringify(result, null, 2)); process.exit(0); }
const currentBranch = safe('git branch --show-current');
if (currentBranch !== branchName) sh(`git checkout -b ${branchName}`);
sh('git add data/geo content/geo templates/geo scripts/geo package.json package-lock.json .github/workflows geo.tsconfig.json');
let commitCreated = false;
try { sh('git diff --cached --quiet'); } catch { sh(`git commit -m ${JSON.stringify(prTitle)}`); commitCreated = true; }
sh(`git push -u origin ${branchName}`);
const prUrl = sh(`gh pr create --draft --base main --title ${JSON.stringify(prTitle)} --body-file ${JSON.stringify(prBodyPath)}`);
result.commitCreated = commitCreated; result.pushed = true; result.prUrl = prUrl; console.log(JSON.stringify(result, null, 2));
