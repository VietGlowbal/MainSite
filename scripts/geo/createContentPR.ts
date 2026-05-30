import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { ensureDir, paths, readManifest, readMetadataFiles, readQualityChecks, scoreAverage, todayDateString } from './lib';

function sh(command: string) { return execSync(command, { cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe' }).trim(); }
function safe(command: string) { try { return sh(command); } catch { return ''; } }
function buildPrBody() {
  const manifest = readManifest();
  const checks = readQualityChecks();
  const metadata = readMetadataFiles();
  const averageScore = scoreAverage(checks);
  const todoCount = checks.filter((check) => check.hasTodoSources).length;
  const duplicateSummary = checks.map((check) => `${check.slug}: ${check.duplicateRisk}`).join(', ') || 'none';
  return `## Generated GEO content\n### New drafts\n${manifest.map((item) => `- ${item.title}`).join('\n') || '- None'}\n### Updated pages\n- None\n### Metadata\n${metadata.map((item) => `- ${item.slug}`).join('\n') || '- None'}\n### Quality check\n- Average score: ${averageScore}\n- Pages requiring source review: ${todoCount}\n- Duplicate risk: ${duplicateSummary}\n- TODO_SOURCE_REQUIRED count: ${todoCount}\n### Reviewer notes\nPlease verify tuition fees, scholarship claims, visa information, and official source links before publishing.`;
}

const date = todayDateString();
const branchName = `geo/content-${date}`;
const prTitle = `GEO content drafts - ${date}`;
ensureDir(paths.reportsDir);
const prBodyPath = path.join(paths.reportsDir, `pr-body-${date}.md`);
fs.writeFileSync(prBodyPath, buildPrBody() + '\n', 'utf8');
safe(`git checkout -b ${branchName}`);
sh('git add data/geo content/geo templates/geo scripts/geo package.json package-lock.json .github/workflows');
try { sh('git diff --cached --quiet'); } catch { sh(`git commit -m ${JSON.stringify(prTitle)}`); }
const shouldCreateRemotePr = process.env.GEO_CREATE_PR === '1';
let prUrl = '';
if (shouldCreateRemotePr) {
  try { prUrl = sh(`gh pr create --draft --title ${JSON.stringify(prTitle)} --body-file ${JSON.stringify(prBodyPath)}`); } catch (error) { prUrl = error instanceof Error ? error.message : String(error); }
}
console.log(JSON.stringify({ branchName, prTitle, prBodyPath: path.relative(process.cwd(), prBodyPath), draftPrCreated: shouldCreateRemotePr, prUrl }, null, 2));
