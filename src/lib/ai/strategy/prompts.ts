import type { ApplicationStrategyContext } from '@/features/application-strategy/domain';

/**
 * The prompt scaffolding every Feature 2 model call shares.
 *
 * WHY THE TRUST RULES ARE ONE STRING. There are five model calls in this feature
 * and each one can damage a student's application in the same specific way: by
 * inventing an achievement, a grade, a role or a programme claim that the student
 * then submits under their own name. Written per call, the rules drift — the CV
 * reviewer forbids invention and the statement analyser forgets to — and the one
 * that forgets is the one that produces a plausible fabrication. Appended from
 * here, all five are held to the same contract and a change applies to all five.
 */

export const TRUST_RULES = `
NON-NEGOTIABLE RULES:
1. Use ONLY information present in the material provided. Never invent an
   achievement, grade, role, skill, metric, organisation, date or experience. If a
   detail is not in the material, it does not exist.
2. Never invent a claim about the programme or university. If the provided
   programme material does not say something, do not assert it.
3. When you lack the evidence to fill a field, return it EMPTY. An empty field is
   a correct answer. A plausible guess is a wrong answer that a student may submit
   to a university under their own name.
4. Separate fact from interpretation. A fact is quoted from the material. An
   interpretation is your reading of it, and must be recognisable as such.
5. When you quote the student's document as evidence, copy it VERBATIM,
   character for character. Do not paraphrase, tidy, correct or translate a quote.
6. Never state or imply a likelihood of admission, and never produce an overall
   score, ranking, percentage chance or grade for the application as a whole.
7. Write for the student, in the second person, plainly. No flattery, no
   marketing language, no hedged non-answers.
`.trim();

/** Appends the trust rules to a role-specific system prompt. */
export function withTrustRules(systemPrompt: string): string {
  return `${systemPrompt.trim()}\n\n${TRUST_RULES}`;
}

/** Bounds on how much of each document goes into a prompt. */
const LIMITS = {
  cvText: 8000,
  statementText: 12000,
  requirements: 4000,
  courseSummary: 3000,
  academics: 2000,
} as const;

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max)}\n…[truncated]` : trimmed;
}

function listBlock(label: string, items: unknown[]): string {
  if (!Array.isArray(items) || items.length === 0) return `${label}: (none recorded)`;
  const lines = items.slice(0, 40).map((item) => {
    if (typeof item === 'string') return `- ${item}`;
    if (item && typeof item === 'object') {
      // Achievements and activities are row objects whose columns vary. Rendering
      // the whole row rather than picking fields means a column added later is
      // visible to the model without a change here.
      const entries = Object.entries(item as Record<string, unknown>)
        .filter(([key, value]) => value != null && value !== '' && !isNoiseKey(key))
        .map(([key, value]) => `${key}: ${String(value).slice(0, 300)}`);
      return `- ${entries.join(' | ')}`;
    }
    return `- ${String(item)}`;
  });
  return `${label}:\n${lines.join('\n')}`;
}

/** Database bookkeeping the model has no use for and should not reason about. */
function isNoiseKey(key: string): boolean {
  return ['id', 'user_id', 'created_at', 'updated_at', 'application_id'].includes(key);
}

/**
 * The candidate and programme block shared by all five calls.
 *
 * WHY ONE RENDERER. The five calls agree about the student only if they are shown
 * the same thing. Two renderings would eventually differ — one includes
 * achievements, another does not — and then the CV review and the statement
 * analysis would give contradictory advice about the same evidence, which reads
 * to the student as the product not knowing what it thinks.
 *
 * The `notes` block is load-bearing rather than decorative: without it a model
 * shown no CV text reports that the student has not uploaded a CV, when in fact
 * they uploaded a scanned PDF we could not read. That difference is the difference
 * between useful advice and an accusation.
 */
export function renderContext(
  context: ApplicationStrategyContext,
  options?: { includeCv?: boolean | undefined; includeStatement?: boolean | undefined },
): string {
  const parts: string[] = [];

  parts.push('=== PROGRAMME ===');
  parts.push(`University: ${context.application.universityName || '(unknown)'}`);
  parts.push(`Course: ${context.application.courseName || '(unknown)'}`);
  const requirements = truncate(context.application.requirements, LIMITS.requirements);
  parts.push(`Entry requirements: ${requirements ?? '(not available)'}`);
  const summary = truncate(context.application.courseSummary, LIMITS.courseSummary);
  parts.push(`Course summary: ${summary ?? '(not available)'}`);
  if (context.application.deadline) parts.push(`Deadline: ${context.application.deadline}`);

  if (context.application.sources.length > 0) {
    parts.push('\nVerified programme sources (cite these by url when you use them):');
    for (const source of context.application.sources.slice(0, 20)) {
      const heading = source.heading ? ` — ${source.heading}` : '';
      const snippet = source.snippet ? `\n    "${source.snippet.slice(0, 400)}"` : '';
      parts.push(`  - ${source.url}${heading}${snippet}`);
    }
  } else {
    parts.push('\nVerified programme sources: (none — do not assert programme claims)');
  }

  parts.push('\n=== CANDIDATE ===');
  parts.push(`Academics: ${truncate(context.candidate.academics, LIMITS.academics) ?? '(not provided)'}`);
  parts.push(`Goals: ${context.candidate.goals?.trim() || '(not provided)'}`);
  parts.push(listBlock('Achievements', context.candidate.achievements));
  parts.push(listBlock('Activities', context.candidate.activities));

  if (options?.includeCv !== false) {
    parts.push('\n=== CV TEXT ===');
    parts.push(truncate(context.documents.cvText, LIMITS.cvText) ?? '(no readable CV text)');
  }

  if (options?.includeStatement) {
    parts.push('\n=== PERSONAL STATEMENT DRAFT ===');
    parts.push(truncate(context.documents.statementText, LIMITS.statementText) ?? '(no draft yet)');
  }

  if (context.notes.length > 0) {
    parts.push('\n=== NOTES ABOUT THESE INPUTS ===');
    parts.push(context.notes.map((n) => `- ${n}`).join('\n'));
  }

  return parts.join('\n');
}

/** Renders the structured CV the student has confirmed, for the review call. */
export function renderStructuredCv(context: ApplicationStrategyContext): string {
  const cv = context.documents.structuredCv;
  if (!cv || cv.sections.length === 0) return '(no structured CV content yet)';

  const lines: string[] = [];
  for (const section of cv.sections) {
    const entries = section.entries.filter(
      (e) =>
        [e.organization, e.role, e.evidence, ...e.bullets].some(
          (v) => typeof v === 'string' && v.trim().length > 0,
        ),
    );
    if (entries.length === 0) continue;

    lines.push(`\n[${section.title || section.kind}]  (section id: ${section.kind})`);
    for (const entry of entries) {
      const head = [entry.role, entry.organization, entry.location].filter(Boolean).join(' — ');
      const dates = [entry.startDate, entry.current ? 'present' : entry.endDate]
        .filter(Boolean)
        .join(' to ');
      lines.push(`  • ${head}${dates ? ` (${dates})` : ''}`);
      for (const bullet of entry.bullets.filter((b) => b.trim().length > 0)) {
        lines.push(`      - ${bullet}`);
      }
      if (entry.evidence?.trim()) lines.push(`      [evidence] ${entry.evidence}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : '(no structured CV content yet)';
}
